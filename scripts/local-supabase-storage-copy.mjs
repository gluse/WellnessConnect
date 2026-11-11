// TASK-064: read hosted Storage, write only the independent loopback Docker copy.
// Import is inert. Never load dotenv or application startup.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { privatePreflight, privateRead, readSettings, requireThat, safeCode } from '../migrations/audit/runtime-support.mjs';
import { privateArtifact } from './local-supabase-copy.mjs';

export const SOURCE = 'https://hbkooiknruimukkhshrk.supabase.co';
// Original copy/evidence target is immutable; later local-only reads use the repaired host port.
export const LOCAL = 'http://127.0.0.1:54321';
export const LOCAL_RUNTIME = 'http://127.0.0.1:15421';
const LIMIT = 100;
const MAX_OBJECTS = 10000;
const MAX_BYTES = 1024 * 1024 * 1024;
const digest = value => createHash('sha256').update(value).digest('hex');
const unwrap = (result, code) => { requireThat(!result.error && result.data != null, code); return result.data; };
export const isAccessDenial = status => [400, 401, 403, 404].includes(Number(status));

export function validateRequest(side, input, init = {}) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  const method = (init.method || input.method || 'GET').toUpperCase();
  const expectedOrigin = side === 'source' ? SOURCE : side === 'local-read' ? LOCAL_RUNTIME : LOCAL;
  requireThat(['source', 'local', 'local-read'].includes(side) && url.origin === expectedOrigin
    && !url.username && !url.password && !url.hash, 'STORAGE_REQUEST_TARGET_REJECTED');
  const pathname = url.pathname;
  const bucketRead = method === 'GET' && /^\/storage\/v1\/bucket(?:\/[^/]+)?$/.test(pathname);
  const objectRead = method === 'GET' && /^\/storage\/v1\/object\/(?:authenticated\/)?[^/]+\/.+/.test(pathname);
  const listRead = method === 'POST' && /^\/storage\/v1\/object\/list\/[^/]+$/.test(pathname);
  const localWrite = side === 'local' && method === 'POST'
    && (pathname === '/storage/v1/bucket' || /^\/storage\/v1\/object\/[^/]+\/.+/.test(pathname));
  requireThat(bucketRead || objectRead || listRead || localWrite, 'STORAGE_REQUEST_OPERATION_REJECTED');
  return { url, method };
}

export function guardedFetch(side, fetcher = globalThis.fetch) {
  return async (input, init = {}) => {
    validateRequest(side, input, init);
    return fetcher(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(30000) });
  };
}

export function bucketOptions(bucket) {
  requireThat(typeof bucket.id === 'string' && /^[a-zA-Z0-9_.-]{1,100}$/.test(bucket.id)
    && bucket.id === bucket.name && (bucket.type == null || bucket.type === 'STANDARD'), 'STORAGE_BUCKET_SHAPE_REJECTED');
  requireThat(typeof bucket.public === 'boolean', 'STORAGE_BUCKET_PRIVACY_MISSING');
  const value = { public: bucket.public };
  if (bucket.file_size_limit != null) {
    requireThat(Number.isSafeInteger(Number(bucket.file_size_limit)) && Number(bucket.file_size_limit) > 0,
      'STORAGE_BUCKET_FILE_LIMIT_REJECTED');
    value.fileSizeLimit = Number(bucket.file_size_limit);
  }
  if (bucket.allowed_mime_types != null) {
    requireThat(Array.isArray(bucket.allowed_mime_types) && bucket.allowed_mime_types.every(x => typeof x === 'string'),
      'STORAGE_BUCKET_MIME_REJECTED');
    value.allowedMimeTypes = [...bucket.allowed_mime_types];
  }
  return value;
}

export async function buckets(storage) {
  const all = [];
  for (let offset = 0; offset < 10000; offset += LIMIT) {
    const page = unwrap(await storage.listBuckets({ limit: LIMIT, offset, sortColumn: 'name', sortOrder: 'asc' }),
      'STORAGE_BUCKET_LIST_FAILED');
    requireThat(Array.isArray(page) && page.length <= LIMIT, 'STORAGE_BUCKET_PAGE_REJECTED');
    all.push(...page);
    if (page.length < LIMIT) {
      requireThat(new Set(all.map(x => x.id)).size === all.length, 'STORAGE_DUPLICATE_BUCKET');
      return all;
    }
  }
  requireThat(false, 'STORAGE_BUCKET_BOUND_EXCEEDED');
}

export async function objects(storage, bucket) {
  const queue = [''];
  const seenFolders = new Set(queue), seenObjects = new Set();
  const all = [];
  for (let index = 0; index < queue.length; index++) {
    requireThat(queue.length <= MAX_OBJECTS, 'STORAGE_FOLDER_BOUND_EXCEEDED');
    const prefix = queue[index];
    for (let offset = 0; offset <= MAX_OBJECTS; offset += LIMIT) {
      const page = unwrap(await storage.from(bucket).list(prefix, {
        limit: LIMIT, offset, sortBy: { column: 'name', order: 'asc' },
      }), 'STORAGE_OBJECT_LIST_FAILED');
      requireThat(Array.isArray(page) && page.length <= LIMIT, 'STORAGE_OBJECT_PAGE_REJECTED');
      for (const entry of page) {
        requireThat(typeof entry.name === 'string' && entry.name && !/[\x00-\x1f\x7f/\\]/.test(entry.name)
          && entry.name !== '.' && entry.name !== '..', 'STORAGE_OBJECT_NAME_REJECTED');
        const key = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.id == null) {
          requireThat(!seenFolders.has(key), 'STORAGE_DUPLICATE_FOLDER');
          seenFolders.add(key); queue.push(key);
        } else {
          requireThat(!seenObjects.has(key), 'STORAGE_DUPLICATE_OBJECT');
          seenObjects.add(key);
          const size = Number(entry.metadata?.size);
          requireThat(Number.isSafeInteger(size) && size >= 0 && size <= 50 * 1024 * 1024,
            'STORAGE_OBJECT_SIZE_REJECTED');
          all.push({ key, size, updatedAt: entry.updated_at, contentType: entry.metadata?.mimetype });
          requireThat(all.length <= MAX_OBJECTS, 'STORAGE_OBJECT_BOUND_EXCEEDED');
        }
      }
      if (page.length < LIMIT) break;
      requireThat(offset < MAX_OBJECTS, 'STORAGE_PAGE_BOUND_EXCEEDED');
    }
  }
  return all.sort((a, b) => a.key.localeCompare(b.key));
}

function sourceSettings() {
  const sid = privatePreflight();
  const selected = privateRead('.env', sid).split(/\r?\n/).filter(line =>
    /^\s*(?:export\s+)?(?:SUPABASE_URL|SUPABASE_SECRET_KEY)\s*=/.test(line)).join('\n');
  const settings = readSettings(selected);
  requireThat(settings.SUPABASE_URL?.replace(/\/$/, '') === SOURCE && settings.SUPABASE_SECRET_KEY,
    'STORAGE_SOURCE_SETTINGS_REJECTED');
  return settings;
}

function localSettings(expectedOrigin = LOCAL) {
  const filename = privateArtifact('supabase-status.json');
  requireThat(fs.existsSync(filename), 'STORAGE_LOCAL_STATUS_NOT_READY');
  const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
  const url = data.API_URL || data.SUPABASE_URL;
  const key = data.SERVICE_ROLE_KEY || data.SECRET_KEY || data.SUPABASE_SECRET_KEY;
  requireThat(url === expectedOrigin && typeof key === 'string' && key.length > 20, 'STORAGE_LOCAL_SETTINGS_REJECTED');
  return { url, key };
}

const api = (url, key, side) => createClient(url, key, { auth: {
  persistSession: false, autoRefreshToken: false, detectSessionInUrl: false,
}, global: { fetch: guardedFetch(side) } }).storage;

export async function inspectStorage() {
  const sourceConfig = sourceSettings();
  const source = api(SOURCE, sourceConfig.SUPABASE_SECRET_KEY, 'source');
  const listed = await buckets(source);
  let objectCount = 0, byteCount = 0;
  for (const bucket of listed) {
    bucketOptions(bucket);
    const manifest = await objects(source, bucket.id);
    objectCount += manifest.length; byteCount += manifest.reduce((sum, item) => sum + item.size, 0);
  }
  return { status: 'passed', mode: 'inventory', sourceWrites: false, buckets: listed.length,
    objects: objectCount, bytes: byteCount, withinCopyBounds: objectCount <= MAX_OBJECTS && byteCount <= MAX_BYTES };
}

export async function verifyLocalPrivacy() {
  const status = JSON.parse(fs.readFileSync(privateArtifact('supabase-status.json'), 'utf8'));
  requireThat(status.API_URL === LOCAL_RUNTIME && typeof status.ANON_KEY === 'string' && status.ANON_KEY.length > 20,
    'STORAGE_LOCAL_ANON_SETTINGS_REJECTED');
  const manifest = JSON.parse(fs.readFileSync(privateArtifact('storage-source-manifest.json'), 'utf8'));
  const anonymous = api(LOCAL_RUNTIME, status.ANON_KEY, 'local-read');
  let privateBuckets = 0, anonymousAccessDenials = 0;
  for (const item of manifest) {
    bucketOptions(item.bucket);
    if (!item.bucket.public) {
      privateBuckets++;
      if (item.objects.length) {
        const key = item.objects[0].key;
        const denied = await anonymous.from(item.bucket.id).download(key);
        requireThat(denied.error && !denied.data && isAccessDenial(denied.error.status ?? denied.error.statusCode),
          'STORAGE_ANONYMOUS_DOWNLOAD_NOT_DENIED');
        const url = `${LOCAL_RUNTIME}/storage/v1/object/public/${encodeURIComponent(item.bucket.id)}/${key.split('/').map(encodeURIComponent).join('/')}`;
        const response = await guardedFetch('local-read')(url, { headers: { apikey: status.ANON_KEY } });
        const deniedStatus = isAccessDenial(response.status);
        await response.body?.cancel();
        requireThat(deniedStatus, 'STORAGE_PUBLIC_DOWNLOAD_NOT_DENIED');
        anonymousAccessDenials += 2;
      }
    }
  }
  return { status: 'passed', privateBuckets, anonymousAccessDenials, sourceAccess: false, writes: false };
}

export async function verifyRecordedObjects(storage, manifest, hashes, originalReceipt) {
  requireThat(originalReceipt?.status === 'passed' && originalReceipt.sourceWrites === false
    && originalReceipt.destination === LOCAL && Array.isArray(manifest) && Array.isArray(hashes)
    && hashes.length <= MAX_OBJECTS && digest(JSON.stringify(hashes)) === originalReceipt.manifestSha256,
  'STORAGE_PERSISTENCE_ORIGINAL_EVIDENCE_REJECTED');
  const entries = new Map();
  for (const item of hashes) {
    const identity = JSON.stringify([item.bucket, item.key]);
    requireThat(!entries.has(identity) && /^[a-f0-9]{64}$/.test(item.sha256)
      && Number.isSafeInteger(item.size) && item.size >= 0, 'STORAGE_PERSISTENCE_HASH_ENTRY_REJECTED');
    entries.set(identity, item);
  }
  const actualBuckets = await buckets(storage);
  requireThat(JSON.stringify(actualBuckets.map(x => x.id).sort()) === JSON.stringify(manifest.map(x => x.bucket.id).sort()),
    'STORAGE_PERSISTENCE_BUCKET_LIST_MISMATCH');
  let verified = 0, bytesVerified = 0;
  for (const item of manifest) {
    const actual = unwrap(await storage.getBucket(item.bucket.id), 'STORAGE_PERSISTENCE_BUCKET_READ_FAILED');
    requireThat(JSON.stringify(bucketOptions(actual)) === JSON.stringify(bucketOptions(item.bucket)),
      'STORAGE_PERSISTENCE_BUCKET_OPTIONS_MISMATCH');
    const actualObjects = await objects(storage, item.bucket.id);
    requireThat(actualObjects.length === item.objects.length && actualObjects.every((object, index) =>
      object.key === item.objects[index].key && object.size === item.objects[index].size),
    'STORAGE_PERSISTENCE_OBJECT_LIST_MISMATCH');
    for (const object of item.objects) {
      const identity = JSON.stringify([item.bucket.id, object.key]);
      const expected = entries.get(identity);
      requireThat(expected && expected.size === object.size && typeof object.contentType === 'string'
        && object.contentType.length > 0, 'STORAGE_PERSISTENCE_EXPECTED_OBJECT_REJECTED');
      const blob = unwrap(await storage.from(item.bucket.id).download(object.key), 'STORAGE_PERSISTENCE_DOWNLOAD_FAILED');
      requireThat(blob.size === expected.size && digest(Buffer.from(await blob.arrayBuffer())) === expected.sha256,
        'STORAGE_PERSISTENCE_CONTENT_MISMATCH');
      requireThat(blob.type.split(';')[0] === object.contentType.split(';')[0], 'STORAGE_PERSISTENCE_CONTENT_TYPE_MISMATCH');
      entries.delete(identity); verified++; bytesVerified += expected.size;
      requireThat(bytesVerified <= MAX_BYTES, 'STORAGE_PERSISTENCE_BYTE_BOUND_EXCEEDED');
    }
  }
  requireThat(entries.size === 0 && verified === originalReceipt.verified && verified === originalReceipt.objects
    && bytesVerified === originalReceipt.bytes, 'STORAGE_PERSISTENCE_TOTAL_MISMATCH');
  return { buckets: manifest.length, objects: verified, bytes: bytesVerified, verified,
    manifestSha256: originalReceipt.manifestSha256 };
}

export async function verifyLocalPersistence(mode = 'local-persistence') {
  // This branch never invokes sourceSettings(), reads hosted .env or constructs a hosted client.
  const local = localSettings(LOCAL_RUNTIME);
  const manifest = JSON.parse(fs.readFileSync(privateArtifact('storage-source-manifest.json'), 'utf8'));
  const hashes = JSON.parse(fs.readFileSync(privateArtifact('storage-content-hashes.json'), 'utf8'));
  const originalReceipt = JSON.parse(fs.readFileSync(privateArtifact('storage-copy-receipt.json'), 'utf8'));
  const startedAt = new Date().toISOString();
  const verification = await verifyRecordedObjects(api(local.url, local.key, 'local-read'), manifest, hashes, originalReceipt);
  const privacy = await verifyLocalPrivacy();
  return { status: 'passed', mode, destination: LOCAL_RUNTIME, originalDestination: LOCAL, sourceAccess: false, writes: false,
    ...verification, privateBuckets: privacy.privateBuckets, anonymousAccessDenials: privacy.anonymousAccessDenials,
    startedAt, completedAt: new Date().toISOString() };
}

export async function copyStorage() {
  const sourceConfig = sourceSettings(), localConfig = localSettings();
  const source = api(SOURCE, sourceConfig.SUPABASE_SECRET_KEY, 'source');
  const local = api(localConfig.url, localConfig.key, 'local');
  const receiptPath = privateArtifact('storage-copy-receipt.json');
  requireThat(!fs.existsSync(receiptPath), 'STORAGE_COPY_ALREADY_ATTEMPTED');
  const sourceBuckets = await buckets(source);
  const manifest = [];
  for (const bucket of sourceBuckets) manifest.push({ bucket, options: bucketOptions(bucket), objects: await objects(source, bucket.id) });
  const initialObjects = manifest.flatMap(x => x.objects);
  const totalBytes = initialObjects.reduce((n, x) => n + x.size, 0);
  requireThat(initialObjects.length <= MAX_OBJECTS && totalBytes <= MAX_BYTES, 'STORAGE_TOTAL_BOUND_EXCEEDED');
  requireThat((await buckets(local)).length === 0, 'STORAGE_TARGET_NOT_EMPTY');
  fs.writeFileSync(privateArtifact('storage-source-manifest.json'), JSON.stringify(manifest), { flag: 'wx' });
  const receipt = { status: 'in-progress', sourceWrites: false, destination: LOCAL,
    buckets: sourceBuckets.length, objects: initialObjects.length, bytes: totalBytes, copied: 0, verified: 0,
    startedAt: new Date().toISOString(), automaticRetry: false };
  fs.writeFileSync(receiptPath, JSON.stringify(receipt), { flag: 'wx' });
  const contentHashes = [];
  try {
    for (const item of manifest) {
      unwrap(await local.createBucket(item.bucket.id, item.options), 'STORAGE_LOCAL_BUCKET_CREATE_FAILED');
      const actualBucket = unwrap(await local.getBucket(item.bucket.id), 'STORAGE_LOCAL_BUCKET_CHECK_FAILED');
      requireThat(JSON.stringify(bucketOptions(actualBucket)) === JSON.stringify(item.options), 'STORAGE_BUCKET_OPTIONS_MISMATCH');
      for (const object of item.objects) {
        const blob = unwrap(await source.from(item.bucket.id).download(object.key), 'STORAGE_SOURCE_DOWNLOAD_FAILED');
        requireThat(blob.size === object.size, 'STORAGE_SOURCE_SIZE_CHANGED');
        const bytes = Buffer.from(await blob.arrayBuffer());
        const contentType = object.contentType || blob.type || 'application/octet-stream';
        unwrap(await local.from(item.bucket.id).upload(object.key, bytes, { contentType, upsert: false }), 'STORAGE_LOCAL_UPLOAD_FAILED');
        receipt.copied++;
        const copied = unwrap(await local.from(item.bucket.id).download(object.key), 'STORAGE_LOCAL_DOWNLOAD_FAILED');
        requireThat(copied.size === bytes.length && digest(Buffer.from(await copied.arrayBuffer())) === digest(bytes),
          'STORAGE_LOCAL_CONTENT_MISMATCH');
        requireThat(copied.type.split(';')[0] === contentType.split(';')[0], 'STORAGE_LOCAL_CONTENT_TYPE_MISMATCH');
        receipt.verified++;
        contentHashes.push({ bucket: item.bucket.id, key: object.key, size: bytes.length, sha256: digest(bytes) });
      }
      requireThat(JSON.stringify(await objects(source, item.bucket.id)) === JSON.stringify(item.objects), 'STORAGE_SOURCE_MANIFEST_CHANGED');
      const targetManifest = await objects(local, item.bucket.id);
      requireThat(targetManifest.length === item.objects.length && targetManifest.every((x, i) => x.key === item.objects[i].key && x.size === item.objects[i].size),
        'STORAGE_TARGET_MANIFEST_MISMATCH');
    }
    const finalBuckets = await buckets(source);
    requireThat(JSON.stringify(finalBuckets.map(x => ({ id: x.id, options: bucketOptions(x) }))) ===
      JSON.stringify(sourceBuckets.map(x => ({ id: x.id, options: bucketOptions(x) }))), 'STORAGE_SOURCE_BUCKETS_CHANGED');
    fs.writeFileSync(privateArtifact('storage-content-hashes.json'), JSON.stringify(contentHashes), { flag: 'wx' });
    receipt.status = 'passed'; receipt.manifestSha256 = digest(JSON.stringify(contentHashes));
    receipt.completedAt = new Date().toISOString();
    fs.writeFileSync(receiptPath, JSON.stringify(receipt));
    fs.mkdirSync('output/supabase-local-copy-2026-11-09', { recursive: true });
    fs.writeFileSync('output/supabase-local-copy-2026-11-09/storage-result.json', JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
    return receipt;
  } catch (error) {
    receipt.status = 'stopped'; receipt.code = safeCode(error);
    fs.writeFileSync(receiptPath, JSON.stringify(receipt));
    throw error;
  }
}

export async function selfTest() {
  let checks = 0;
  const check = fn => { fn(); checks++; };
  for (const [side, url, method] of [
    ['source', SOURCE + '/storage/v1/bucket', 'GET'],
    ['source', SOURCE + '/storage/v1/object/list/private', 'POST'],
    ['source', SOURCE + '/storage/v1/object/private/folder/photo.jpg', 'GET'],
    ['local', LOCAL + '/storage/v1/bucket', 'POST'],
    ['local', LOCAL + '/storage/v1/object/private/a.jpg', 'POST'],
  ]) check(() => validateRequest(side, url, { method }));
  for (const [side, url, method] of [
    ['source', SOURCE + '/storage/v1/bucket', 'POST'],
    ['source', SOURCE + '/storage/v1/object/private/a.jpg', 'POST'],
    ['source', SOURCE + '/storage/v1/object/private/a.jpg', 'DELETE'],
    ['source', 'https://other.supabase.co/storage/v1/bucket', 'GET'],
    ['local', SOURCE + '/storage/v1/bucket', 'POST'],
    ['local', 'http://localhost:54321/storage/v1/bucket', 'POST'],
    ['local', LOCAL + '/auth/v1/admin/users', 'POST'],
  ]) check(() => assert.throws(() => validateRequest(side, url, { method })));
  check(() => assert.deepEqual(bucketOptions({ id: 'private', name: 'private', public: false, file_size_limit: 1024,
    allowed_mime_types: ['image/png'] }), { public: false, fileSizeLimit: 1024, allowedMimeTypes: ['image/png'] }));
  check(() => assert.throws(() => bucketOptions({ id: 'private', name: 'private', public: 'false' })));
  const calls = [];
  const fake = { from: () => ({ list: async (prefix, options) => {
    calls.push([prefix, options.offset]);
    if (prefix === '') return { data: [{ name: 'folder', id: null }], error: null };
    return { data: [{ name: 'photo.png', id: 'one', metadata: { size: 7, mimetype: 'image/png' }, updated_at: 'fixed' }], error: null };
  } }) };
  assert.deepEqual((await objects(fake, 'private')).map(x => x.key), ['folder/photo.png']); checks++;
  assert.deepEqual(calls, [['', 0], ['folder', 0]]); checks++;
  const pages = { from: () => ({ list: async (_prefix, options) => ({ data: options.offset === 0
    ? Array.from({ length: 100 }, (_, i) => ({ name: `p${i}`, id: `${i}`, metadata: { size: 0 } }))
    : [{ name: 'last', id: 'last', metadata: { size: 0 } }], error: null }) }) };
  assert.equal((await objects(pages, 'private')).length, 101); checks++;
  let forwarded;
  await guardedFetch('source', async (_url, options) => { forwarded = options; return {}; })(SOURCE + '/storage/v1/bucket');
  assert.equal(forwarded.redirect, 'error'); assert.ok(forwarded.signal); checks++;
  for (const [url, method] of [[SOURCE + '/storage/v1/bucket', 'GET'],
    [LOCAL_RUNTIME + '/storage/v1/bucket', 'POST'], [LOCAL_RUNTIME + '/storage/v1/object/private/p.png', 'POST'],
    [LOCAL_RUNTIME + '/storage/v1/object/private/p.png', 'DELETE'],
    [LOCAL + '/storage/v1/bucket', 'GET'], ['http://localhost:15421/storage/v1/bucket', 'GET']]) {
    check(() => assert.throws(() => validateRequest('local-read', url, { method })));
  }
  check(() => validateRequest('local-read', LOCAL_RUNTIME + '/storage/v1/object/list/private', { method: 'POST' }));
  const originalBucket = { id: 'private', name: 'private', public: false };
  const originalManifest = [{ bucket: originalBucket, objects: [{ key: 'p.png', size: 3, contentType: 'image/png' }] }];
  const originalHashes = [{ bucket: 'private', key: 'p.png', size: 3, sha256: digest(Buffer.from('abc')) }];
  const receipt = { status: 'passed', sourceWrites: false, destination: LOCAL, objects: 1, verified: 1,
    bytes: 3, manifestSha256: digest(JSON.stringify(originalHashes)) };
  const persisted = (body = 'abc', type = 'image/png') => ({
    listBuckets: async () => ({ data: [originalBucket], error: null }),
    getBucket: async () => ({ data: originalBucket, error: null }),
    from: () => ({ list: async () => ({ data: [{ name: 'p.png', id: 'one', metadata: { size: 3 } }], error: null }),
      download: async () => ({ data: new Blob([body], { type }), error: null }) }),
  });
  assert.equal((await verifyRecordedObjects(persisted(), originalManifest, originalHashes, receipt)).verified, 1); checks++;
  await assert.rejects(() => verifyRecordedObjects(persisted('abd'), originalManifest, originalHashes, receipt),
    error => error.safeCode === 'STORAGE_PERSISTENCE_CONTENT_MISMATCH'); checks++;
  await assert.rejects(() => verifyRecordedObjects(persisted('abc', 'image/jpeg'), originalManifest, originalHashes, receipt),
    error => error.safeCode === 'STORAGE_PERSISTENCE_CONTENT_TYPE_MISMATCH'); checks++;
  await assert.rejects(() => verifyRecordedObjects(persisted(), originalManifest, originalHashes, { ...receipt, manifestSha256: 'bad' }),
    error => error.safeCode === 'STORAGE_PERSISTENCE_ORIGINAL_EVIDENCE_REJECTED'); checks++;
  check(() => assert.ok(isAccessDenial(403) && isAccessDenial('400') && !isAccessDenial(500)
    && !isAccessDenial(200) && !isAccessDenial(undefined)));
  return { status: 'passed', checks, sourceAccess: false, privateAccess: false, writes: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    requireThat(process.argv.length === 3 && ['--self-test', '--inventory', '--apply', '--verify-privacy', '--verify-persistence', '--verify-port-repair'].includes(process.argv[2]), 'STORAGE_MODE_REJECTED');
    const result = process.argv[2] === '--self-test' ? await selfTest()
      : process.argv[2] === '--inventory' ? await inspectStorage()
      : process.argv[2] === '--verify-privacy' ? await verifyLocalPrivacy()
      : process.argv[2] === '--verify-persistence' ? await verifyLocalPersistence()
      : process.argv[2] === '--verify-port-repair' ? await verifyLocalPersistence('local-port-repair') : await copyStorage();
    if (process.argv[2] === '--verify-persistence') {
      fs.writeFileSync('output/supabase-local-copy-2026-11-09/storage-persistence-result.json', JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
    }
    if (process.argv[2] === '--verify-port-repair') {
      fs.writeFileSync('output/supabase-local-copy-2026-11-09/storage-port-repair-result.json', JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
    }
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(JSON.stringify({ status: 'stopped', code: safeCode(error), sourceWrites: false, automaticRetry: false }));
    process.exitCode = 1;
  }
}
