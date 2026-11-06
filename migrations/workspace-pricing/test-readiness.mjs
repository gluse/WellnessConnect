// Injected metadata response fixtures only. Never opens a DB/configuration.
import assert from 'node:assert/strict';
import { WORKSPACE_PRICING_APPLICATION_READINESS_SQL, WORKSPACE_PRICING_APPLICATION_READINESS_KEYS,
  workspacePricingApplicationReadinessArguments, assertWorkspacePricingApplicationReadiness, verifyWorkspacePricingDatabaseReadiness } from './application-readiness.mjs';
import { WISHLIST_APPLICATION_READINESS_KEYS, wishlistApplicationReadinessArguments } from '../wishlist/application-readiness.mjs';
const args = workspacePricingApplicationReadinessArguments(), old = wishlistApplicationReadinessArguments();
assert.equal(args.length, 6); assert.equal(old.length, 5);
assert.equal(JSON.parse(old[0]).length, 40, 'Historical runtime40 profile preserved');
assert.equal(JSON.parse(args[0]).length, 41);
assert.deepEqual(JSON.parse(args[0]).at(-1), { name: 'workspace_pricing_settings', rights: ['SELECT','INSERT','UPDATE'] });
assert.deepEqual(args.slice(1,5), old.slice(1));
assert.equal(WORKSPACE_PRICING_APPLICATION_READINESS_KEYS.length, 32);
assert.deepEqual(WORKSPACE_PRICING_APPLICATION_READINESS_KEYS.slice(0,26), WISHLIST_APPLICATION_READINESS_KEYS);
const profile = JSON.parse(args[5]);
assert.equal(profile.columns.length, 9); assert.equal(profile.constraints.length, 8); assert.equal(profile.indexes.length, 3);
assert.deepEqual(profile.tables, ['workspace_pricing_settings']);
for (const marker of ['workspace_pricing_columns','workspace_pricing_constraints','workspace_pricing_indexes','workspace_pricing_private_acl','workspace_pricing_policies','workspace_pricing_schema_access']) assert.ok(WORKSPACE_PRICING_APPLICATION_READINESS_SQL.includes(marker));
assert.ok(WORKSPACE_PRICING_APPLICATION_READINESS_SQL.includes("a.privilege_type NOT IN('SELECT','INSERT','UPDATE')"));
assert.ok(WORKSPACE_PRICING_APPLICATION_READINESS_SQL.includes("p.polname='fmt_workspace_pricing_server'"));
const good = Object.fromEntries(WORKSPACE_PRICING_APPLICATION_READINESS_KEYS.map(key => [key, true]));
assertWorkspacePricingApplicationReadiness([good]);
let calls = 0;
await verifyWorkspacePricingDatabaseReadiness(async (text, values) => { calls++; assert.equal(text, WORKSPACE_PRICING_APPLICATION_READINESS_SQL); assert.deepEqual(values, args); return { rows: [good] }; });
assert.equal(calls, 1);
for (const key of WORKSPACE_PRICING_APPLICATION_READINESS_KEYS) {
  assert.throws(() => assertWorkspacePricingApplicationReadiness([{ ...good, [key]: false }]), error => error.code === 'WORKSPACE_PRICING_DB_NOT_READY' && error.checks.length === 1 && error.checks[0] === key);
}
for (const rows of [[], null, [{}], [good, good], [{ ...good, extra: true }]]) assert.throws(() => assertWorkspacePricingApplicationReadiness(rows));
await assert.rejects(verifyWorkspacePricingDatabaseReadiness(async () => { throw new Error('private://secret@target'); }), error => {
  assert.equal(error.message, 'WORKSPACE_PRICING_DB_NOT_READY'); assert.deepEqual(error.checks, ['metadata_query']); assert.ok(!JSON.stringify(error).includes('secret')); return true;
});
console.log('PASS:41-table/32-gate integrated pricing readiness, preserved historical profile, private3-right ACL/policy and missing/drifted/malformed/error response handling. Mocked adapters only.');
