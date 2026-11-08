import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import * as drizzle from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import * as schema from '../shared/schema.ts';
import * as gallery from '../server/serviceImages.ts';
import * as money from '../server/money.ts';
import * as storefront from '../shared/storefront.ts';
import * as scheduling from '../shared/scheduling.ts';
import * as reviews from '../shared/reviews.ts';
import * as provider from '../shared/provider.ts';
import * as searchInput from '../server/searchInput.ts';
import * as customerBookings from '../server/customerBookings.ts';
import * as auditContext from '../server/audit/context.ts';
import * as auditEvents from '../server/audit/events.ts';
import * as auditCapture from '../server/audit/capture.ts';
import * as notifications from '../shared/notifications.ts';
import * as workspacePricing from '../shared/workspace-pricing.ts';
import { z } from 'zod';

// Strict VM import allowlists: no real DB, env, Auth, Storage or server startup.
async function load(path, dependencies) {
  const source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(`(function(require,module,exports){${compiled}\n})`, { Date, Map, Set, Buffer, process: { env: {} }, console: { error() {} } }, { filename: path })(name => {
    assert.ok(Object.hasOwn(dependencies, name), `Blocked external import: ${path} -> ${name}`); return dependencies[name];
  }, module, module.exports);
  return module.exports;
}
const paths = Array.from({ length: 11 }, (_, index) => `/objects/owner/${String(index + 1).padStart(8, '0')}-1111-4111-8111-111111111111.png`);
const { serviceImageChanges, serviceImageList, assertServiceImageEntitlement } = gallery;
assert.deepEqual(serviceImageChanges({ imageUrl: paths[0] }), { imageUrls: [paths[0]], imageUrl: paths[0] });
assert.deepEqual(serviceImageChanges({}, { imageUrls: paths.slice(0, 3) }), {});
assert.deepEqual(serviceImageChanges({ imageUrl: null }, { imageUrls: paths.slice(0, 3) }), { imageUrls: [], imageUrl: null });
assert.deepEqual(serviceImageChanges({ imageUrls: [] }), { imageUrls: [], imageUrl: null });
assert.deepEqual(serviceImageChanges({ imageUrls: paths.slice(0, 2), imageUrl: paths[4] }), { imageUrls: paths.slice(0, 2), imageUrl: paths[0] });
assert.throws(() => serviceImageChanges({ imageUrls: paths }), /10/);
assert.throws(() => serviceImageChanges({ imageUrls: [paths[0], paths[0]] }), /different/);
assert.throws(() => assertServiceImageEntitlement({ imageUrls: paths.slice(0, 2) }, false), error => error.status === 403);
assertServiceImageEntitlement({ imageUrls: paths.slice(0, 10) }, true);
assertServiceImageEntitlement({ imageUrls: [paths[2], paths[0]] }, false, { imageUrls: paths.slice(0, 3) });
assert.throws(() => assertServiceImageEntitlement({ imageUrls: [paths[3], paths[0]] }, false, { imageUrls: paths.slice(0, 3) }), error => error.status === 403);
for (const imageUrls of [null, [null], [42], [''], Array(11).fill(paths[0]), [paths[0], paths[0]], ['x'.repeat(1025)]]) {
  assert.equal(schema.insertServiceSchema.pick({ imageUrls: true }).safeParse({ imageUrls }).success, false);
}

const dialect = new PgDialect(), compiled = predicate => dialect.sqlToQuery(predicate);
let source, subscriptions = [], inserted = [], updates = [], selects = [], transaction = false, rollbacks = 0;
function filter(rows, predicate) {
  if (!predicate) return rows;
  const query = compiled(predicate);
  return rows.filter(row => Array.from(query.sql.matchAll(/"\w+"\."(\w+)" = \$(\d+)/g)).every(match => row[match[1].replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())] === query.params[Number(match[2]) - 1])
    && (!query.sql.includes('"company_id" is null') || row.companyId == null));
}
const database = {
  select() {
    let table, predicate;
    const query = { from(value) { table = drizzle.getTableName(value); return query; }, where(value) { predicate = value; return query; },
      leftJoin() { return query; }, innerJoin() { return query; }, groupBy() { return query; }, orderBy() { return query; },
      as() { return { serviceId: drizzle.sql`review_stats.service_id`, rating: drizzle.sql`review_stats.rating`, reviewCount: drizzle.sql`review_stats.review_count` }; },
      for(mode) { assert.equal(transaction, true); selects.push({ table, mode, ...(predicate ? compiled(predicate) : {}) }); return query; },
      then(resolve, reject) { return Promise.resolve(filter(table === 'provider_subscriptions' ? subscriptions : table === 'services' && source ? [source] : [], predicate)).then(resolve, reject); } };
    return query;
  },
  insert() { return { values(values) { return { async returning() { assert.equal(transaction, true); inserted.push(values); return [{ id: 91, ...values }]; } }; } }; },
  update() { return { set(values) { return { where() { return { async returning() { assert.equal(transaction, true); updates.push(values); source = { ...source, ...values }; return [source]; } }; } }; } }; },
  async transaction(work) { transaction = true; try { return await work(database); } catch (error) { rollbacks++; throw error; } finally { transaction = false; } },
};
const base = { id: 1, providerId: 'owner', companyId: null, employeeId: null, addressId: null, name: 'Synthetic', category: 'education', price: '10', currency: 'EUR', duration: 30, cleanupTime: 0, reminderEnabled: false, reminderMethod: 'email', reminderHours: 24,
  advancePaymentPercent: 0, imageUrl: paths[0], imageUrls: paths.slice(0, 3), isActive: true };
const activePro = { userId: 'owner', companyId: null, plan: 'pro', proUntil: new Date('2099-01-01') };
const reset = (pro = true, companyId = null) => { source = { ...base, companyId }; inserted = []; updates = []; selects = []; subscriptions = pro ? [{ ...activePro, userId: companyId == null ? 'owner' : null, companyId }] : []; };
const dependencies = { './money': money, './serviceImages': gallery, '@shared/storefront': storefront, 'node:crypto': await import('node:crypto'), '@shared/schema': schema,
  './db': { db: database }, 'drizzle-orm': drizzle, '@shared/provider': provider, './storefronts': {}, './addresses': { serviceLocation: value => value }, '@shared/scheduling': scheduling,
  '@shared/reviews': reviews, './searchInput': searchInput, './customerBookings': customerBookings, './audit/context': auditContext, './audit/events': auditEvents, './audit/capture': auditCapture,
  './notifications/repository': { assertReminderConfiguration() {}, async reconcileServiceReminders() {} }, './notifications/policy': {} };
const storageModule = await load('server/storage.ts', dependencies), storage = new storageModule.DatabaseStorage();
reset(); let saved = await storage.createService({ ...base, imageUrls: paths.slice(0, 10), imageUrl: paths[4] });
assert.equal(saved.imageUrls.length, 10); assert.equal(saved.imageUrl, paths[0]);
assert.ok(selects.some(query => query.table === 'provider_subscriptions' && query.mode === 'share'));
reset(false); await assert.rejects(() => storage.createService({ ...base }), error => error.status === 403); assert.equal(inserted.length, 0);
subscriptions = [{ ...activePro, proUntil: new Date(0) }]; await assert.rejects(() => storage.createService({ ...base }), error => error.status === 403);
reset(true, 7); saved = await storage.createService({ ...base, companyId: 7 }); assert.equal(saved.imageUrls.length, 3);
assert.deepEqual(selects.find(query => query.table === 'provider_subscriptions').params, [7]);
reset(false, 7); subscriptions = [activePro]; await assert.rejects(() => storage.createService({ ...base, companyId: 7 }), error => error.status === 403, 'Personal Pro does not grant company Pro');
reset(false); saved = await storage.updateService(1, { name: 'Updated' }); assert.deepEqual(saved.imageUrls, base.imageUrls); assert.equal(selects.some(query => query.table === 'provider_subscriptions'), false);
saved = await storage.updateService(1, { imageUrls: [paths[2], paths[0]] }); assert.deepEqual(saved.imageUrls, [paths[2], paths[0]]); assert.equal(saved.imageUrl, paths[2]);
await assert.rejects(() => storage.updateService(1, { imageUrls: [paths[2], paths[3]] }), error => error.status === 403);
saved = await storage.updateService(1, { imageUrl: paths[3] }); assert.deepEqual(saved.imageUrls, [paths[3]]);
saved = await storage.updateService(1, { imageUrls: [] }); assert.equal(saved.imageUrl, null);
reset(); saved = await storage.copyService(1, 'owner'); assert.deepEqual(saved.imageUrls, base.imageUrls); assert.equal(saved.isActive, false);
reset(false); saved = await storage.copyService(1, 'owner'); assert.deepEqual(saved.imageUrls, [paths[0]]); assert.equal(source.imageUrls.length, 3, 'Free copy leaves source intact');
assert.equal(await storage.copyService(1, 'stranger'), undefined); assert.equal(rollbacks >= 4, true);

let imageRows = [], brandedRows = [], downloaded = [], signed = 0, blob = { size: 8, async arrayBuffer() { return Uint8Array.from([137,80,78,71,13,10,26,10]).buffer; } };
const imageDb = { select() { let table, predicate; const query = { from(value) { table = drizzle.getTableName(value); return query; }, leftJoin() { return query; }, innerJoin() { return query; },
  where(value) { predicate = value; return query; }, limit() { return query; }, then(resolve, reject) {
    if (table === 'services') { const statement = compiled(predicate), path = statement.params.find(value => typeof value === 'string' && value.startsWith('/objects/'));
      assert.ok(statement.sql.includes('ANY('), 'Gallery lookup queries every gallery path');
      const companyParameter = statement.sql.includes('"company_id" =') ? statement.params.find(value => typeof value === 'number') : undefined;
      return Promise.resolve(imageRows.filter(row => serviceImageList(row.service).includes(path) && (companyParameter === undefined || row.service.companyId === companyParameter))).then(resolve, reject);
    }
    return Promise.resolve(brandedRows).then(resolve, reject);
  } }; return query; } };
const imageStorage = await load('server/imageStorage.ts', { 'node:crypto': await import('node:crypto'), 'drizzle-orm': drizzle, '@shared/schema': schema, './db': { db: imageDb },
  './storefronts': { publishedStorefrontConditions: () => drizzle.sql`true` }, './supabase': { storageBucket: 'synthetic', supabaseAdmin: { storage: { from() { return {
    async createSignedUploadUrl() { signed++; return { data: { signedUrl: 'https://synthetic.invalid/upload' } }; }, async download(key) { downloaded.push(key); return { data: blob }; }
  }; } } } } });
for (const [type, size] of [['image/svg+xml', 8], ['image/png', 0], ['image/png', 10 * 1024 * 1024 + 1], ['image/png', 1.5]]) await assert.rejects(() => imageStorage.createImageUpload('owner', type, size), error => error.status === 400);
assert.equal(signed, 0); await imageStorage.createImageUpload('owner', 'image/png', 10 * 1024 * 1024); assert.equal(signed, 1);
await imageStorage.downloadImage(paths[0]); blob = { size: 10 * 1024 * 1024 + 1 }; await assert.rejects(() => imageStorage.downloadImage(paths[0]), error => error.status === 400);
blob = { size: 5, async arrayBuffer() { return Uint8Array.from([1, 2, 3, 4, 5]).buffer; } }; await assert.rejects(() => imageStorage.downloadImage(paths[0]), error => error.status === 400);
blob = { size: 8, async arrayBuffer() { return Uint8Array.from([137,80,78,71,13,10,26,10]).buffer; } };
await assert.rejects(() => imageStorage.downloadImage(paths[0].replace('.png', '.jpg')), error => error.status === 400, 'Magic bytes must match file extension');
imageRows = [{ service: { ...base, companyId: 7 }, company: { isActive: true } }];
assert.equal(await imageStorage.canReadImage(paths[2]), true, 'Non-cover active photo publicly readable');
await imageStorage.validateServiceImage(paths[2], 'coworker', 7);
await assert.rejects(() => imageStorage.validateServiceImage(paths[2], 'coworker', 8), error => error.status === 403);
await assert.rejects(() => imageStorage.validateServiceImage(paths[2], 'stranger'), error => error.status === 403);
imageRows[0].company.isActive = false; assert.equal(await imageStorage.canReadImage(paths[2]), false);
imageRows[0].company.isActive = true; imageRows[0].service.isActive = false; assert.equal(await imageStorage.canReadImage(paths[2]), false);
assert.equal(await imageStorage.canReadImage(paths[2], 'coworker', { company: { id: 7 }, permissions: { readAll: true } }), true);
assert.equal(await imageStorage.canReadImage(paths[2], 'coworker', { company: { id: 8 }, permissions: { readAll: true } }), false);
imageRows[0].service.employeeId = 5;
assert.equal(await imageStorage.canReadImage(paths[2], 'coworker', { company: { id: 7 }, membership: { employeeId: 5 }, permissions: { readAll: false } }), true);
assert.equal(await imageStorage.canReadImage(paths[2], 'coworker', { company: { id: 7 }, membership: { employeeId: 6 }, permissions: { readAll: false } }), false);
imageRows = []; assert.equal(await imageStorage.canReadImage(paths[2], 'owner'), true); assert.equal(await imageStorage.canReadImage(paths[2], 'stranger'), false);
await assert.rejects(() => imageStorage.canReadImage('/objects/owner/../../secret'), error => error.status === 400);

// Actual handlers and real workspace checks; all persistence/media boundaries fake.
const access = await load('server/companyAccess.ts', { './db': { db: database }, 'drizzle-orm': drizzle, '@shared/schema': schema, './customerBookings': customerBookings });
const noop = () => {}, routes = [], app = () => {}; app.use = app.set = () => app;
for (const method of ['get', 'post', 'patch', 'put', 'delete']) app[method] = (path, ...handlers) => { routes.push({ method, path, handlers }); return app; };
class ProviderError extends Error {}
let confirmed = [], routeSaved, routePatch, mediaDenied = false;
const routeStorage = { async getServiceById() { return source; }, async createService(value) { routeSaved = value; return value; }, async updateService(id, value) { routePatch = value; return value; }, async copyService(...args) { return storage.copyService(...args); }, async upsertServiceEmbedding() {} };
const routeDependencies = { ...dependencies, '@shared/workspace-pricing': workspacePricing, './workspace-pricing/routes': { setupWorkspacePricingRoutes: noop }, './workspace-pricing/store': { createWorkspacePricingStore: () => ({}) }, http: { createServer: () => ({}) }, './storage': { ...storageModule, storage: routeStorage },
  './search-pagination/store': { createSearchPageStore: () => ({}) }, './wishlist/routes': { setupWishlistRoutes: noop }, './wishlist/postgres': { createWishlistStore: () => ({}) }, './wishlist/service': { createWishlistService: () => ({}) }, './wishlist/inbox': { createInboxService: () => ({}) },
  './auth': { setupAuth: noop, isAuthenticated: noop }, zod: { z }, './companyAccess': access, './supabase': {}, './imageStorage': { ImageStorageError: imageStorage.ImageStorageError, async validateServiceImage(path, userId, companyId) { confirmed.push({ path, userId, companyId }); if (mediaDenied) throw new imageStorage.ImageStorageError(403, 'Denied image'); } },
  './embeddings': { generateEmbedding: async () => [] }, './geocoding': { GeocodingError: ProviderError }, './registeredLocations': {}, './searchLocations': {}, './categories': { categoryStore: { async list() { return [{ key: 'education' }]; } } }, '@shared/categories': { CategoryError: ProviderError }, './audit/http': {},
  './addresses': { addressStore: { async get() { return { address: 'Synthetic address' }; } } }, './audit/remote': {}, './audit/reads': { protectedReadAudit: () => noop, auditResponseDenials: () => noop }, './audit/viewer': { setupAuditViewerRoutes: noop }, './audit/viewer-runtime': { auditViewerStore: {} }, './audit/location': { setupLocationAuditRoutes: noop },
  './service-view-report/routes': { setupServiceViewReportRoutes: noop }, './service-view-report/store': { createServiceViewReportStore: () => ({}) }, './service-view-report/service': { createServiceViewReportService: () => ({}), ServiceViewReportError: ProviderError }, './notifications/routes': { setupNotificationRoutes: noop }, './appointments/routes': { setupAppointmentRoutes: noop }, './notifications/transports': { notificationConfig: () => ({ enabled: false }) }, '@shared/notifications': notifications };
for (const [module, method] of Object.entries({ publicSearch: 'setupPublicSearchRoutes', searchLocationRoutes: 'setupSearchLocationRoutes', payments: 'setupPaymentRoutes', companyRoutes: 'setupCompanyRoutes', adminRoutes: 'setupAdminRoutes', categoryRoutes: 'setupCategoryRoutes', reviewRoutes: 'setupReviewRoutes', providerCatalogRoutes: 'setupProviderCatalogRoutes', storefrontRoutes: 'setupStorefrontRoutes', serviceViewRoutes: 'setupServiceViewRoutes', schedulingRoutes: 'setupSchedulingRoutes' })) routeDependencies[`./${module}`] = { [method]: noop };
await (await load('server/routes.ts', routeDependencies)).registerRoutes(app);
async function request(method, path, body, workspace = { company: null, permissions: { manageServices: true, readAll: true } }) {
  let code = 200, data; const response = { status(value) { code = value; return this; }, json(value) { data = value; return this; } };
  await routes.find(route => route.method === method && route.path === path).handlers.at(-1)({ user: { claims: { sub: 'owner' } }, workspace, params: { id: '1' }, body }, response);
  return { code, data };
}
reset(); const valid = { ...base, addressId: 3, serviceType: 'one_to_one', imageUrls: paths.slice(0, 3) }; delete valid.id;
schema.insertServiceSchema.parse(valid);
assert.equal((await request('post', '/api/services', valid)).code, 200); assert.equal(confirmed.length, 3); assert.equal(routeSaved.imageUrl, paths[0]);
confirmed = []; assert.equal((await request('patch', '/api/services/:id', { name: 'Unrelated' })).code, 200); assert.equal(confirmed.length, 0); assert.equal(Object.hasOwn(routePatch, 'imageUrls'), false);
assert.equal((await request('patch', '/api/services/:id', { imageUrls: [paths[2], paths[0]] })).code, 200); assert.equal(routePatch.imageUrl, paths[2]);
confirmed = []; assert.equal((await request('post', '/api/services', { ...valid, imageUrls: paths })).code, 400); assert.equal(confirmed.length, 0);
assert.equal((await request('patch', '/api/services/:id', { imageUrls: paths.slice(0, 2) }, { company: { id: 99 }, permissions: { manageServices: true } })).code, 403); assert.equal(confirmed.length, 0);
assert.equal((await request('post', '/api/services', valid, { company: null, permissions: { manageServices: false } })).code, 403); assert.equal(confirmed.length, 0);
mediaDenied = true; assert.equal((await request('post', '/api/services', valid)).code, 403); mediaDenied = false;
reset(false); assert.equal((await request('post', '/api/services/:id/copy', {})).data.imageUrls.length, 1);
console.log('Passed service gallery normalization/count/unique, personal/company Pro/expiry, transaction locks/denials, downgrade edits, copy, image read/reuse authorization, 10MiB and MIME content checks, actual service handlers. Strict offline adapters; no DB/network/private config used.');
