import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { parseAuditViewerFilters, buildAuditViewerQuery, auditViewerPage, auditViewerPermissions, auditRecordsCsv, setupAuditViewerRoutes } from '../server/audit/viewer.ts';
import { parseAuditReaderConnection, assertAuditReaderRole } from '../server/audit/viewer-runtime.ts';
import { isAllowedAuthReturnTo } from '../shared/navigation.ts';

const userId = '11111111-1111-4111-8111-111111111111';
const eventId = '22222222-2222-4222-8222-222222222222';
const now = new Date('2026-11-07T12:00:00.000Z');
const env = { AUDIT_ENABLED: 'true', AUDIT_READER_DATABASE_URL: 'configured', AUDIT_READER_USER_IDS: userId, AUDIT_EXPORT_USER_IDS: userId };
const filters = parseAuditViewerFilters({ from: '2026-11-01T00:00:00.000Z', to: now.toISOString(), limit: '1', targetId: '17' }, now);
const row = { event_id: eventId, occurred_at: now, received_at: now, expires_at: new Date('2027-11-07T12:00:00.000Z'), envelope: {
  eventId, occurredAt: now.toISOString(), eventName: 'service.viewed.v1', outcome: 'succeeded', actor: { kind: 'user', userId },
  scope: { kind: 'personal', workspaceId: userId }, target: { type: 'service', id: '17' }, requestId: eventId, operationId: eventId, changes: [],
} };
assert.deepEqual(auditViewerPermissions(userId, env), { canRead: true, canExport: true, available: true });
assert.equal(auditViewerPermissions('different-user', { ...env, APP_ADMIN_USER_IDS: 'different-user' }).canRead, false);
assert.equal(auditViewerPermissions(userId, { ...env, AUDIT_READER_USER_IDS: '' }).canExport, false);
assert.throws(() => parseAuditViewerFilters({ query: 'SELECT * FROM audit.events' }, now));
for (const input of [{ limit: 0 }, { limit: 101 }, { actorId: 'other' }, { from: '2026-11-08T00:00:00Z', to: now.toISOString() },
  { from: '2020-01-01T00:00:00Z', to: now.toISOString() }, { outcome: 'all' }, { targetId: "17' OR TRUE --" }, { from: ['bad'] }]) assert.throws(() => parseAuditViewerFilters(input, now));
const query = buildAuditViewerQuery(filters);
assert.ok(query.text.includes('target_id = $3'));
assert.equal(query.values.at(-1), 2);
assert.equal(query.text.includes('17'), false);
assert.ok(buildAuditViewerQuery(parseAuditViewerFilters({ targetId: 'company_memberships:7|11111111-1111-4111-8111-111111111111' }, now)).values.includes('company_memberships:7|11111111-1111-4111-8111-111111111111'));
const page = auditViewerPage([row, row], filters);
assert.equal(page.events.length, 1); assert.equal(page.hasMore, true); assert.ok(page.nextCursor);
const second = buildAuditViewerQuery({ ...filters, cursor: page.nextCursor });
assert.ok(second.text.includes('(occurred_at,event_id) <'));
assert.throws(() => buildAuditViewerQuery({ ...filters, targetId: '18', cursor: page.nextCursor }));
assert.throws(() => buildAuditViewerQuery({ ...filters, cursor: 'invalid' }));
assert.throws(() => buildAuditViewerQuery({ ...filters, cursor: page.nextCursor }, true));
assert.equal(buildAuditViewerQuery(filters, true).values.at(-1), 1000);
assert.equal(auditViewerPage([], filters).nextCursor, null);
const defaultFilters = parseAuditViewerFilters({}, now);
const defaultPage = auditViewerPage(Array.from({ length: 26 }, () => row), defaultFilters);
assert.doesNotThrow(() => buildAuditViewerQuery(parseAuditViewerFilters({ ...defaultPage.query, cursor: defaultPage.nextCursor }, now)), 'Normalized default dates must retain valid pagination independent of key order');
const csv = auditRecordsCsv([{ ...row, envelope: { ...row.envelope, eventName: '=HYPERLINK("x")', changes: [{ field: '+formula' }] } }]);
assert.ok(csv.includes(`"'=HYPERLINK(""x"")"`));
assert.ok(csv.includes(`"'+formula"`));
assert.equal(isAllowedAuthReturnTo('/administration?section=audit'), true);
assert.equal(isAllowedAuthReturnTo('/administration?section=audit&redirect=https://evil.test'), false);
const role = { principal: 'fmt_audit_reader_dev', reader_member: true, view_access: true, rolsuper: false, rolbypassrls: false,
  rolcreatedb: false, rolcreaterole: false, rolreplication: false, base_access: false, extra_role: false, permanent_ddl: false };
assertAuditReaderRole([role]);
for (const key of ['rolsuper','rolbypassrls','rolcreatedb','rolcreaterole','rolreplication','base_access','extra_role','permanent_ddl']) assert.throws(() => assertAuditReaderRole([{ ...role, [key]: true }]));
assert.throws(() => assertAuditReaderRole([{ ...role, principal: 'postgres' }]));
assert.throws(() => assertAuditReaderRole([]));
const validUrl = 'postgresql://fmt_audit_reader_dev.ynygqodmtgjrngiudalw:synthetic@aws-1-eu-north-1.pooler.supabase.com:5432/postgres?sslmode=verify-full';
assert.equal(parseAuditReaderConnection(validUrl).user, 'fmt_audit_reader_dev.ynygqodmtgjrngiudalw');
for (const value of [validUrl.replace('5432','6543'), validUrl.replace('fmt_audit_reader_dev','postgres'), validUrl + '&sslmode=disable', validUrl + '&host=evil.test', validUrl.replace('verify-full','disable'), validUrl.replace('ynygqodmtgjrngiudalw','hbkooiknruimukkhshrk')]) assert.throws(() => parseAuditReaderConnection(value));

let queries = 0, captures = 0, failQuery = false, failCapture = false, permitted = true, exportPermitted = true, revokeDuringCapture = false, exported = false;
const app = express();
setupAuditViewerRoutes(app, {
  authenticate(req, res, next) { if (req.headers['x-user'] === 'none') return res.status(401).end(); req.user = { claims: { sub: req.headers['x-user'] || userId } }; next(); },
  environment: () => ({ ...env, AUDIT_READER_USER_IDS: permitted ? userId : '', AUDIT_EXPORT_USER_IDS: exportPermitted ? userId : '' }), now: () => now,
  store: { async query() { queries++; if (failQuery) throw new Error('secret connection'); return [row]; } },
  async capture(_user, isExport) { captures++; exported = isExport; if (revokeDuringCapture) permitted = false; if (failCapture) throw new Error('secret capture'); },
});
const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
try {
  let res = await fetch(base + '/api/admin/audit/access'); assert.equal(res.headers.get('cache-control'),'no-store'); assert.equal((await res.json()).canRead,true);
  res = await fetch(base + '/api/admin/audit/events', { headers: { 'x-user': 'other' } }); assert.equal(res.status,403); assert.equal(queries,0);
  res = await fetch(base + '/api/admin/audit/events', { headers: { 'x-user': 'none' } }); assert.equal(res.status,401); assert.equal(queries,0);
  res = await fetch(base + '/api/admin/audit/events?limit=500'); assert.equal(res.status,400); assert.equal(queries,0);
  res = await fetch(base + '/api/admin/audit/events'); assert.equal(res.status,200); assert.equal((await res.json()).events[0].eventId,eventId); assert.equal(captures,1);
  failCapture = true; res = await fetch(base + '/api/admin/audit/events'); assert.equal(res.status,503); assert.ok(!(await res.text()).includes(eventId)); failCapture = false;
  failQuery = true; const before = captures; res = await fetch(base + '/api/admin/audit/events'); assert.equal(res.status,503); assert.equal(captures,before); assert.ok(!(await res.text()).includes('secret')); failQuery = false;
  res = await fetch(base + '/api/admin/audit/export'); assert.equal(res.status,200); assert.ok(res.headers.get('content-type').startsWith('text/csv')); assert.equal(exported,true);
  exportPermitted = false; const beforeExportDenied = queries; res = await fetch(base + '/api/admin/audit/export'); assert.equal(res.status,403); assert.equal(queries,beforeExportDenied); exportPermitted = true;
  revokeDuringCapture = true; res = await fetch(base + '/api/admin/audit/events'); assert.equal(res.status,403); assert.ok(!(await res.text()).includes(eventId)); revokeDuringCapture = false; permitted = true;
  permitted = false; const beforeDenied = queries; res = await fetch(base + '/api/admin/audit/export'); assert.equal(res.status,403); assert.equal(queries,beforeDenied);
  console.log('Audit viewer checks passed: permissions, query bounds, keyset cursors, CSV escaping, TLS configuration, fail-closed HTTP and recorded exports. All data synthetic; database/services mocked.');
} finally { await new Promise((resolve,reject) => server.close(error => error ? reject(error) : resolve())); }
