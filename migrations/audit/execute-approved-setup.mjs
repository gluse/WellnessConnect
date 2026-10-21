// DB-owned, fixed-manifest setup executor. No app imports or generic SQL input.
// Modes: offline (no .env/network), preflight (read-only), apply (both gates,
// destination commit+metadata verification, then source commit+verification).
// User approved these two development/test targets and additive objects only.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, X509Certificate } from 'node:crypto';
import tls from 'node:tls';
import assert from 'node:assert/strict';
import pg from 'pg';

const directory = path.dirname(fileURLToPath(import.meta.url));
const repository = path.resolve(directory, '../..');
const environment = 'development';
const sourceCaFingerprint='80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA';
const targets = Object.freeze({
  source: { setting: 'DATABASE_URL', apiSetting: 'SUPABASE_URL', ref: 'hbkooiknruimukkhshrk' },
  destination: { setting: 'AUDIT_DATABASE_URL', apiSetting: 'AUDIT_SUPABASE_URL', ref: 'ynygqodmtgjrngiudalw' },
});
const manifest = Object.freeze({
  '_contract_v1.sql': '030f81d453a22216719cefdd550e052df558ec89dc99334b92460e86ee3ae64b',
  '0000_preflight.sql': 'd89af727f54c046be4f8ef3e81bdc9c2af9c8e22dd65794169276a90582f5b63',
  '0001_destination.sql': '13c44e20635125ab0918f1acc5c4424a0bf64b36b2945f2a336497b3eacf3381',
  '0001_source.sql': '2cdd5712867a328779dd3062d7344ce69459594ca4405bfffbea21394838978a',
  '0002_verify_destination.sql': 'f21583e63abecb3b741aac04d18f8bf3be14d6e17494e43af1eee2a5e9aef733',
  '0002_verify_source.sql': 'cbe1bbb20b0c9c24816a1d416fff7b4efbedc4d962a5d8ecb8ccb26d836adfba',
});
const raw = new Map();
const sha256 = value => createHash('sha256').update(value).digest('hex');
class SafeFailure extends Error {
  constructor(code, detail = {}) { super(code); this.safeCode = code; this.detail = detail; }
}
const emit = value => process.stdout.write(JSON.stringify({ at: new Date().toISOString(), ...value }) + '\n');
function fail(code, detail) { throw new SafeFailure(code, detail); }
function safeError(error) {
  if (error instanceof SafeFailure) return { code: error.safeCode, ...error.detail };
  const code = typeof error?.code === 'string' && /^(?:[0-9A-Z]{5}|E[A-Z_]{2,60}|[A-Z_]{3,60})$/.test(error.code)
    ? error.code : 'UNCLASSIFIED_ERROR';
  const position = /^\d{1,8}$/.test(String(error?.position ?? '')) ? Number(error.position) : undefined;
  return { code, ...(position ? { sqlPosition: position } : {}) };
}
function loadManifest() {
  for (const [name, digest] of Object.entries(manifest)) {
    const bytes = fs.readFileSync(path.join(directory, name));
    if (sha256(bytes) !== digest) fail('MANIFEST_DIGEST_MISMATCH', { file: name });
    raw.set(name, bytes.toString('utf8'));
  }
}
function preprocess(name) {
  if (!Object.hasOwn(manifest, name) || name === '_contract_v1.sql') fail('FILE_NOT_EXECUTABLE');
  const lines = raw.get(name).split(/\r?\n/);
  let includes = 0;
  const sql = lines.map(line => {
    if (line === '\\set ON_ERROR_STOP on') return '';
    if (line === '\\ir _contract_v1.sql') {
      if (!/^0001_(source|destination)\.sql$/.test(name) || ++includes > 1) fail('INCLUDE_REJECTED');
      return raw.get('_contract_v1.sql');
    }
    if (line === "SELECT set_config('audit_migration.environment', :'audit_environment', true) AS audit_environment \\gset") {
      return "SELECT set_config('audit_migration.environment', 'development', true);";
    }
    const project = line.match(/^SELECT set_config\('audit_migration.project_ref', '([a-z0-9]{20})', true\) AS audit_project_ref \\gset$/);
    if (project) {
      const expected = name === '0001_source.sql' ? targets.source.ref : name === '0001_destination.sql' ? targets.destination.ref : null;
      if (project[1] !== expected) fail('PROJECT_LABEL_MISMATCH');
      return `SELECT set_config('audit_migration.project_ref', '${expected}', true);`;
    }
    if (/^\s*\\/.test(line) || line.includes('\\gset') || line.includes(":'audit_environment'")) fail('PSQL_DIRECTIVE_REJECTED');
    return line;
  }).join('\n');
  if (/^0001_/.test(name)) {
    if (includes !== 1 || (sql.match(/^BEGIN;$/gm) || []).length !== 1 || (sql.match(/^COMMIT;$/gm) || []).length !== 1) fail('TRANSACTION_WRAPPER_REJECTED');
  } else if (!sql.includes('BEGIN READ ONLY;') || includes) fail('READ_ONLY_WRAPPER_REJECTED');
  return sql;
}
function describeConnection(value, target) {
  try {
    if (typeof value !== 'string' || /[\r\n]/.test(value)) fail('CONNECTION_CONFIGURATION_REJECTED');
    const uri = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(uri.protocol) || uri.hash) fail('CONNECTION_SCHEME_REJECTED');
    const host = uri.hostname.toLowerCase();
    const user = decodeURIComponent(uri.username);
    const password = decodeURIComponent(uri.password);
    const database = decodeURIComponent(uri.pathname.slice(1));
    if (!user || !password || !database || /(?:YOUR[_ -]|REPLACE[_ -]|<|>)/i.test(user + password + database)) fail('CONNECTION_PLACEHOLDER_REJECTED');
    if (uri.port && uri.port !== '5432') fail('MIGRATION_CONNECTION_MODE_REJECTED');
    let ref; let transport;
    const direct = host.match(/^db\.([a-z0-9]{20})\.supabase\.co$/);
    if (direct) { ref = direct[1]; transport = 'direct'; }
    else if (/^[a-z0-9.-]+\.pooler\.supabase\.com$/.test(host)) {
      ref = user.match(/^[a-zA-Z0-9_-]+\.([a-z0-9]{20})$/)?.[1]; transport = 'session-pooler';
    }
    if (ref !== targets[target].ref) fail('CONNECTION_TARGET_REJECTED', { target });
    const allowed = new Set(['sslmode','sslrootcert','sslcert','sslkey','application_name','connect_timeout']);
    for (const key of uri.searchParams.keys()) if (!allowed.has(key) || uri.searchParams.getAll(key).length !== 1) fail('CONNECTION_OPTION_REJECTED');
    const mode = uri.searchParams.get('sslmode');
    if (mode && !['require','verify-ca','verify-full'].includes(mode)) fail('TLS_CONFIGURATION_REJECTED');
    return { host,user,password,database,ref,transport,uri };
  } catch (error) { if (error instanceof SafeFailure) throw error; fail('CONNECTION_CONFIGURATION_REJECTED'); }
}
function readPermittedSettings() {
  const wanted = new Set(['DATABASE_URL','AUDIT_DATABASE_URL','SUPABASE_URL','AUDIT_SUPABASE_URL']);
  const values = new Map();
  for (const line of fs.readFileSync(path.join(repository, '.env'), 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?(DATABASE_URL|AUDIT_DATABASE_URL|SUPABASE_URL|AUDIT_SUPABASE_URL)\s*=\s*(.*?)\s*$/);
    if (!match || !wanted.has(match[1])) continue;
    if (values.has(match[1])) fail('DUPLICATE_CONNECTION_SETTING');
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1,-1);
    values.set(match[1], value);
  }
  for (const [target, config] of Object.entries(targets)) {
    describeConnection(values.get(config.setting), target);
    const api = values.get(config.apiSetting);
    if (api) {
      try {
        const parsed = new URL(api);
        if (parsed.protocol !== 'https:' || parsed.hostname !== `${config.ref}.supabase.co` || parsed.username || parsed.password) fail('API_REFERENCE_MISMATCH');
      } catch (error) { if (error instanceof SafeFailure) throw error; fail('API_REFERENCE_MISMATCH'); }
    }
  }
  return values;
}
function existingSourceCA(settings) {
  const source=describeConnection(settings.get(targets.source.setting),'source');
  const certificatePath=source.uri.searchParams.get('sslrootcert');
  if (!certificatePath) fail('EXISTING_SOURCE_CA_MISSING');
  const pem=fs.readFileSync(certificatePath,'utf8');
  const blocks=pem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g) || [];
  if (blocks.length !== 1 || pem.trim() !== blocks[0]) fail('EXISTING_SOURCE_CA_FORMAT_REJECTED');
  const certificate=new X509Certificate(blocks[0]);
  const now=Date.now();
  if (!certificate.ca || !certificate.checkIssued(certificate) || !certificate.verify(certificate.publicKey)
      || !/supabase/i.test(certificate.issuer) || !/supabase/i.test(certificate.subject)
      || certificate.fingerprint256 !== sourceCaFingerprint
      || Date.parse(certificate.validFrom)>now || Date.parse(certificate.validTo)<=now) fail('EXISTING_SOURCE_CA_REJECTED');
  return blocks[0];
}
function clientFor(value, target, auditCA) {
  const config = describeConnection(value, target);
  const ssl = { rejectUnauthorized:true, servername:config.host, checkServerIdentity:tls.checkServerIdentity, minVersion:'TLSv1.2' };
  for (const [query, property] of [['sslrootcert','ca'],['sslcert','cert'],['sslkey','key']]) {
    const certificate = config.uri.searchParams.get(query);
    if (certificate) ssl[property] = fs.readFileSync(certificate, 'utf8');
  }
  if (target === 'destination' && auditCA) {
    if (ssl.ca) fail('AUDIT_CA_ALREADY_CONFIGURED');
    ssl.ca=auditCA; // Existing user-configured Supabase anchor, destination only.
  }
  // No connectionString: SSL query parameters cannot override strict TLS.
  const client = new pg.Client({ host:config.host,port:5432,user:config.user,password:config.password,database:config.database,
    ssl,sslnegotiation:'postgres',application_name:'fitsmytime-audit-approved-setup',
    client_encoding:'UTF8',connectionTimeoutMillis:10000,query_timeout:90000 });
  client.on('notice', () => {});
  client.on('error', error => { client.auditSafeConnectionError = safeError(error).code; });
  return { client, transport:config.transport };
}
const selects = result => (Array.isArray(result) ? result : [result]).filter(item => item.command === 'SELECT');
function checkPreflight(result, target) {
  const rows = selects(result);
  if (rows.length !== 5 || rows[0].rows.length !== 1 || rows[1].rows.length !== 1 || rows[2].rows.length !== 1) fail('PREFLIGHT_RESULT_SHAPE_REJECTED');
  const info=rows[0].rows[0], powers=rows[1].rows[0], objects=rows[2].rows[0];
  const app=target === 'source';
  const checks = { supported_version:info.supported_version === true,utf8:info.utf8_database === true,
    no_prior_set_role:info.no_prior_set_role === true,create_role:powers.rolcreaterole === true || powers.rolsuper === true,
    create_schema:objects.may_create_schema === true,expected_users:objects.application_users_present === app,
    expected_bookings:objects.application_bookings_present === app,no_audit_schemas:rows[3].rows.length === 0,
    no_audit_roles:rows[4].rows.length === 0 };
  if (Object.values(checks).some(value => !value)) fail('PREFLIGHT_REJECTED', { target, failed:Object.keys(checks).filter(key => !checks[key]) });
  const principal = /^[a-zA-Z0-9_.@-]{1,64}$/.test(info.migration_principal) ? info.migration_principal : '[redacted-principal]';
  return { projectRef:targets[target].ref,serverVersionNum:info.server_version_num,principal,
    superuser:powers.rolsuper === true,bypassRls:powers.rolbypassrls === true,checks };
}
function checkVerification(result, target) {
  const rows=selects(result); const expected=target === 'source' ? [6,2,1,9,4] : [6,3,1,3,6];
  if (rows.length !== 6 || expected.some((count,index) => rows[index].rows.length !== count) || rows[5].rows.length < 1) fail('VERIFICATION_ROW_COUNT_REJECTED', { target });
  let checks=0;
  for (const resultSet of rows) {
    const booleanFields=resultSet.fields.filter(field => field.dataTypeID === 16).map(field => field.name);
    if (!booleanFields.length) fail('VERIFICATION_BOOLEAN_SHAPE_REJECTED',{target});
    for (const row of resultSet.rows) for (const key of booleanFields) {
      checks++; if (row[key] !== true) fail('VERIFICATION_REJECTED', { target,check:key });
    }
  }
  return { projectRef:targets[target].ref,selectRowCounts:rows.map(item => item.rows.length),booleanChecksPassed:checks };
}
function offline() {
  const scripts=Object.keys(manifest).filter(name => name !== '_contract_v1.sql');
  for (const name of scripts) assert.ok(preprocess(name).length);
  assert.equal(describeConnection(`postgresql://fixture:fixture@db.${targets.source.ref}.supabase.co/postgres?sslmode=verify-full`, 'source').ref, targets.source.ref);
  assert.equal(describeConnection(`postgresql://postgres.${targets.destination.ref}:fixture@fixture.pooler.supabase.com:5432/postgres?sslmode=require`, 'destination').transport, 'session-pooler');
  const rejected = [
    [`postgresql://fixture:fixture@db.${targets.source.ref}.supabase.co/postgres`, 'destination'],
    ['https://fixture:fixture@example.invalid/postgres', 'source'],
    [`postgresql://fixture:fixture@db.${targets.source.ref}.supabase.co:6543/postgres`, 'source'],
    [`postgresql://fixture:fixture@db.${targets.source.ref}.supabase.co/postgres?sslmode=no-verify`, 'source'],
    [`postgresql://fixture:fixture@db.${targets.source.ref}.supabase.co/postgres?host=elsewhere.invalid`, 'source'],
    [`postgresql://fixture:YOUR_PASSWORD@db.${targets.source.ref}.supabase.co/postgres`, 'source'],
  ];
  for (const [value,target] of rejected) assert.throws(() => describeConnection(value,target), SafeFailure);
  assert.throws(() => preprocess('_contract_v1.sql'),SafeFailure);
  assert.throws(() => preprocess('../other.sql'),SafeFailure);
  const source=raw.get('0001_source.sql');
  try {
    for (const suffix of ['\n\\! forbidden-shell','\n\\ir ../forbidden.sql']) {
      raw.set('0001_source.sql',source+suffix);
      assert.throws(() => preprocess('0001_source.sql'),SafeFailure);
    }
    raw.set('0001_source.sql',source.replace(/^COMMIT;$/m,''));
    assert.throws(() => preprocess('0001_source.sql'),SafeFailure);
  } finally { raw.set('0001_source.sql',source); }
  const select = rows => ({command:'SELECT',rows});
  const preflight = [select([{migration_principal:'fixture',server_version_num:170000,supported_version:true,utf8_database:true,no_prior_set_role:true}]),
    select([{rolcreaterole:true,rolsuper:false,rolbypassrls:false}]),
    select([{may_create_schema:true,application_users_present:true,application_bookings_present:true}]),select([]),select([])];
  assert.equal(checkPreflight(preflight,'source').superuser,false);
  assert.throws(() => checkPreflight(preflight,'destination'),SafeFailure);
  const verification=[6,2,1,9,4,1].map(count => ({ command:'SELECT',fields:[{name:'ok',dataTypeID:16}],rows:Array.from({length:count},()=>({ok:true})) }));
  assert.ok(checkVerification(verification,'source').booleanChecksPassed);
  verification[0].rows[0].ok=null;
  assert.throws(() => checkVerification(verification,'source'),SafeFailure);
  emit({ mode:'offline',status:'passed',environment,files:scripts,endpointRejectionCases:rejected.length,
    directiveRejectionCases:3,metadataGateCases:4,readsEnv:false,connects:false,manifest });
}

async function main() {
  const mode=process.argv[2];
  const reuseSourceCA=process.argv[3] === '--audit-use-source-ca';
  if (!['offline','preflight','apply'].includes(mode) ||
      !(process.argv.length === 3 || (process.argv.length === 4 && reuseSourceCA && mode !== 'offline'))) fail('MODE_REJECTED');
  loadManifest();
  if (mode === 'offline') { offline(); return; }
  // Avoid unrelated ambient libpq settings; only explicit approved URI settings.
  for (const key of Object.keys(process.env)) if (key.startsWith('PG')) delete process.env[key];
  const settings=readPermittedSettings();
  const auditCA=reuseSourceCA ? existingSourceCA(settings) : undefined;
  if (auditCA) emit({stage:'configuration',target:'destination',trustSource:'existing-configured-source-supabase-ca',caFingerprint256:sourceCaFingerprint});
  const connections={}; const commits={ destination:'not-attempted',source:'not-attempted' };
  const failedPreflights=[];
  let stage='configuration'; let activeTarget;
  try {
    for (const target of ['destination','source']) {
      activeTarget=target; stage='connect';
      try {
        const connection=clientFor(settings.get(targets[target].setting),target,auditCA);
        connections[target]=connection;
        await connection.client.connect();
        const stream=connection.client.connection.stream;
        if (stream.encrypted !== true || stream.authorized !== true) fail('VERIFIED_TLS_REQUIRED',{target});
        stage='preflight';
        const checked=checkPreflight(await connection.client.query(preprocess('0000_preflight.sql')),target);
        emit({ stage,status:'passed',target,transport:connection.transport,tlsVerified:true,...checked });
      } catch (error) {
        failedPreflights.push(target);
        emit({ stage,status:'failed',target,...safeError(error),commits });
      }
    }
    if (failedPreflights.length) fail('PREFLIGHTS_NOT_PASSED',{failedTargets:failedPreflights});
    emit({ stage:'both-preflights',status:'passed',environment,mode });
    if (mode === 'preflight') return;
    for (const target of ['destination','source']) {
      activeTarget=target; stage='migration';
      const client=connections[target].client;
      if (client.auditSafeConnectionError) fail('CONNECTION_UNHEALTHY',{target});
      const file=target === 'source' ? '0001_source.sql' : '0001_destination.sql';
      emit({ stage,status:'starting',target,projectRef:targets[target].ref,file,sha256:manifest[file],includeSha256:manifest['_contract_v1.sql'] });
      commits[target]='uncertain';
      try {
        const result=await client.query(preprocess(file));
        const final=Array.isArray(result) ? result.at(-1) : result;
        if (final.command !== 'COMMIT') fail('COMMIT_RESULT_UNCERTAIN',{target});
        commits[target]='committed';
      } catch (error) {
        if (/^[0-9A-Z]{5}$/.test(error?.code ?? '')) {
          const ambiguous=error.code === '40003' || error.code.startsWith('08');
          try {
            await client.query('ROLLBACK');
            if (!ambiguous) commits[target]='rolled-back';
          } catch { /* uncertain remains */ }
        }
        throw error;
      }
      emit({ stage,status:'committed',target,migrationVersion:target === 'source' ? 'source-0001' : 'destination-0001',commits });
      stage='verification';
      const verifyFile=target === 'source' ? '0002_verify_source.sql' : '0002_verify_destination.sql';
      const verified=checkVerification(await client.query(preprocess(verifyFile)),target);
      emit({ stage,status:'passed',target,sha256:manifest[verifyFile],...verified });
    }
    emit({ stage:'complete',status:'passed',commits,environment,scope:'additive-audit-objects-and-metadata-only' });
  } catch (error) {
    emit({ stage,status:'stopped',target:activeTarget,...safeError(error),commits });
    process.exitCode=1;
  } finally {
    settings.clear();
    for (const {client} of Object.values(connections)) {
      try { await client.end(); } catch { /* Never output connection/error objects. */ }
    }
  }
}
try { await main(); }
catch (error) { emit({ stage:'initialization',status:'stopped',...safeError(error) }); process.exitCode=1; }
