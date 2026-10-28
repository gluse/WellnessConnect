import assert from "node:assert/strict";
import { createRequire } from "node:module";
import vm from "node:vm";
import { build } from "esbuild";

// Bundle the real route and access decisions, replacing every external adapter
// before evaluation. No application database/Auth/config module is imported.
const adapters = new Map([
  ["./db", "export const db = globalThis.fixture.db;"],
  ["@shared/schema", `const table = name => Object.assign({name}, Object.fromEntries(["id", "email", "companyId", "userId", "role", "employeeId", "invitedBy", "acceptedAt", "revokedAt", "expiresAt"].map(key => [key, {column:key,table:name}])));
    export const companies=table('companies'), companyMemberships=table('members'), companyInvitations=table('invitations'), employees=table('employees'), users=table('users'), services=table('services'), addresses=table('addresses'), bookings=table('bookings'), availability=table('availability');`],
  ["drizzle-orm", `export const eq=(column,value)=>({op:'eq',column,value}), ne=(column,value)=>({op:'ne',column,value}), gt=(column,value)=>({op:'gt',column,value}), isNull=column=>({op:'null',column}), and=(...items)=>({op:'and',items}), sql=(strings,column,value)=>({op:'lowerEmail',column,value});`],
  ["./auth", `export const isAuthenticated=(req,res,next)=>req.user ? next() : res.status(401).json({message:'Sign in required.'});`],
  ["./supabase", `export const appUrl='https://example.test'; export const supabaseAdmin={auth:{admin:{inviteUserByEmail(...args){globalThis.fixture.emailCalls++; return globalThis.fixture.sendEmail(...args);}}}};`],
  ["./customerBookings", "export const assertCustomerBookingChange=()=>{throw Error('Unexpected booking operation');};"],
]);
const bundled = await build({ entryPoints: ["server/companyRoutes.ts"], bundle: true, write: false, platform: "node", format: "cjs", packages: "external", logLevel: "silent", plugins: [{ name: "offline-adapters", setup(builder) {
  builder.onResolve({ filter: /.*/ }, args => adapters.has(args.path) ? { path: args.path, namespace: "offline" } : undefined);
  builder.onLoad({ filter: /.*/, namespace: "offline" }, args => ({ contents: adapters.get(args.path), loader: "js" }));
} }] });
const fixedTime = Date.parse("2026-10-27T10:00:00.000Z");
class FrozenDate extends Date {
  constructor(...args) { super(...(args.length ? args : [fixedTime])); }
  static now() { return fixedTime; }
}
const invitationId = "11111111-1111-4111-8111-111111111111";
const otherInvitationId = "22222222-2222-4222-8222-222222222222";
const originalInvite = { id: invitationId, companyId: 7, email: "santa@example.test", role: "admin", employeeId: 11, tokenHash: "synthetic-private-hash", invitedBy: "owner", expiresAt: new Date(fixedTime + 86400000), acceptedAt: null, revokedAt: null };
let state, operations, rollbackCount, failUpdate, emptyUpdate, queryFailure, cases = 0;
const fixture = { emailCalls: 0, warnings: [], sendEmail: async () => ({ error: null }) };
function matches(row, predicate) {
  if (!predicate) return true;
  if (predicate.op === "and") return predicate.items.every(item => matches(row, item));
  const value = row[predicate.column.table]?.[predicate.column.column] ?? row[predicate.column.column];
  if (predicate.op === "lowerEmail") return value?.toLowerCase() === predicate.value;
  if (predicate.op === "eq") return value === predicate.value;
  if (predicate.op === "ne") return value !== predicate.value;
  if (predicate.op === "null") return value == null;
  if (predicate.op === "gt") return value > predicate.value;
  throw Error("Unexpected predicate");
}
function query(kind, table, selected) {
  let predicate, changes, lock, join;
  return {
    from(value) { table = value; return this; },
    innerJoin(value) { join = value; return this; },
    where(value) { predicate = value; return this; },
    for(value) { lock = value; return this; },
    set(value) { changes = value; return this; },
    values(value) { changes = value; return this; },
    returning(value) { selected = value; return this; },
    then(resolve, reject) {
      try {
        operations.push({ kind, table: table.name, lock, changes: structuredClone(changes) });
        if (queryFailure) throw Error("private database address and credentials");
        if (kind === "insert") state[table.name].push(structuredClone(changes));
        const source = join ? state[table.name].flatMap(row => state[join.name].filter(other => row.userId === other.id).map(other => ({ [table.name]: row, [join.name]: other }))) : state[table.name];
        const rows = source.filter(row => matches(row, predicate));
        if (kind === "update") {
          if (emptyUpdate) return Promise.resolve([]).then(resolve, reject);
          for (const row of rows) Object.assign(row, changes);
          if (failUpdate) throw Error("private database address and credentials");
        }
        const result = rows.map(row => selected ? Object.fromEntries(Object.entries(selected).map(([key, column]) => [key, row[column.column]])) : structuredClone(row));
        return Promise.resolve(result).then(resolve, reject);
      } catch (error) { return Promise.reject(error).then(resolve, reject); }
    },
  };
}
const tx = { select: selected => query("select", undefined, selected), update: table => query("update", table), insert: table => query("insert", table), delete() { throw Error("Unexpected deletion"); } };
fixture.db = { async transaction(callback) {
  const before = structuredClone(state);
  try { return await callback(tx); } catch (error) { state = before; rollbackCount++; throw error; }
} };
const module = { exports: {} };
const require = createRequire(import.meta.url);
vm.runInNewContext(bundled.outputFiles[0].text, { module, exports: module.exports, fixture, Date: FrozenDate, console: { error() {}, warn(...args) { fixture.warnings.push(args); } }, require(name) {
  assert.ok(["node:crypto", "zod"].includes(name), `Forbidden runtime import: ${name}`);
  return require(name);
} });
const routes = [];
module.exports.setupCompanyRoutes({ use() {}, ...Object.fromEntries(["get", "post", "patch", "delete"].map(method => [method, (path, ...handlers) => routes.push({ method, path, handlers })])) });
const route = routes.find(route => route.method === "patch" && route.path === "/api/company/invitations/:id");
assert.ok(route, "Pending invitations must have their own update endpoint");
function reset() {
  state = { companies: [{ id: 7, isActive: true }, { id: 8, isActive: true }], members: [{ companyId: 7, userId: "owner", role: "owner", employeeId: null }, { companyId: 7, userId: "juris", role: "provider", employeeId: 10 }], employees: [{ id: 10, companyId: 7 }, { id: 11, companyId: 7 }, { id: 12, companyId: 7 }, { id: 20, companyId: 8 }], invitations: [structuredClone(originalInvite)], users: [] };
  operations = []; rollbackCount = 0; failUpdate = false; emptyUpdate = false; queryFailure = false; fixture.emailCalls = 0; fixture.warnings = []; fixture.sendEmail = async () => ({ error: null });
}
async function request({ body = { role: "provider", employeeId: 11 }, id = invitationId, signedIn = true, permission = true, companyId = 7, invalid = false, userId = "owner", method = "patch" } = {}) {
  const req = { body, params: { id }, user: signedIn ? { claims: { sub: userId } } : undefined, session: {}, workspace: { invalid, company: companyId == null ? null : { id: companyId }, membership: { employeeId: null }, permissions: { manageTeam: permission } } };
  const res = { code: 200, status(code) { this.code = code; return this; }, json(value) { this.body = value; return this; } };
  const selectedRoute = method === "patch" ? route : routes.find(route => route.method === method && route.path === "/api/company/invitations");
  for (const handler of selectedRoute.handlers) {
    let next = false;
    await handler(req, res, () => { next = true; });
    if (!next) break;
  }
  return res;
}
async function denied(status, configure = () => {}, options = {}) {
  reset(); configure(); const before = structuredClone(state);
  const result = await request(options);
  assert.equal(result.code, status, JSON.stringify(result.body)); assert.deepEqual(state, before, "Rejected writes preserve all state");
  assert.equal(fixture.emailCalls, 0); cases++;
  return result;
}

reset();
const beforeMembers = structuredClone(state.members);
assert.deepEqual(JSON.parse(JSON.stringify((await request()).body)), { success: true });
assert.deepEqual(state.invitations[0], { ...originalInvite, role: "provider" }, "Santa's existing invitation changes only requested access");
assert.deepEqual(state.members, beforeMembers, "Juris and all accepted memberships remain unchanged");
assert.equal(fixture.emailCalls, 0, "Editing neither sends email nor rotates the invitation");
assert.deepEqual(operations.filter(operation => operation.lock).map(operation => operation.table), ["companies", "invitations"], "Match company then invitation serialization used by acceptance");
assert.deepEqual(operations.filter(operation => operation.kind === "update").map(operation => operation.table), ["invitations"]); cases++;
reset(); assert.equal((await request({ body: { role: "viewer", employeeId: 12 } })).code, 200); assert.equal(state.invitations[0].employeeId, 12); cases++;
reset(); assert.equal((await request({ body: { role: "admin", employeeId: null } })).code, 200); assert.equal(state.invitations[0].employeeId, null); cases++;
reset(); assert.equal((await request({ body: { role: "admin" } })).code, 200); assert.equal(state.invitations[0].employeeId, null); cases++;
reset(); state.members[0].role = "admin"; assert.equal((await request()).code, 200); cases++;
reset(); await request({ body: { role: "provider", employeeId: 11, email: "attacker@example.test", invitedBy: "juris", tokenHash: "replaced", expiresAt: "2099-01-01", acceptedAt: "now", companyId: 8 } });
assert.deepEqual(state.invitations[0], { ...originalInvite, role: "provider" }, "Unknown writable fields are stripped"); cases++;

await denied(401, undefined, { signedIn: false }); assert.equal(operations.length, 0);
await denied(403, undefined, { permission: false }); assert.equal(operations.length, 0);
await denied(403, undefined, { invalid: true });
await denied(400, undefined, { companyId: null });
await denied(403, () => { state.members[0].role = "viewer"; });
await denied(403, () => { state.members.shift(); });
await denied(403, () => { state.companies[0].isActive = false; });
await denied(403, () => { state.companies.shift(); });
await denied(404, () => { state.members.push({ companyId: 8, userId: "other-manager", role: "admin" }); }, { companyId: 8, userId: "other-manager" });
await denied(404, undefined, { id: otherInvitationId });
await denied(400, undefined, { id: "not-an-invitation-id" }); assert.equal(operations.length, 0);
for (const body of [
  { role: "owner", employeeId: 11 }, { role: "unknown", employeeId: 11 },
  { role: "provider", employeeId: null }, { role: "viewer" },
  { role: "provider", employeeId: "11" }, { role: "provider", employeeId: 0 },
  { role: "provider", employeeId: -1 }, { role: "provider", employeeId: 1.5 },
  { employeeId: 11 }, null,
]) { await denied(400, undefined, { body }); assert.equal(operations.length, 0); }
await denied(400, undefined, { body: { role: "provider", employeeId: 20 } });
await denied(400, undefined, { body: { role: "provider", employeeId: 999 } });
await denied(409, undefined, { body: { role: "provider", employeeId: 10 } });
await denied(409, () => { state.invitations.push({ ...structuredClone(originalInvite), id: otherInvitationId, email: "other@example.test", employeeId: 12 }); }, { body: { role: "provider", employeeId: 12 } });
for (const field of ["acceptedAt", "revokedAt"]) await denied(410, () => { state.invitations[0][field] = new Date(fixedTime - 1000); });
for (const offset of [-1000, 0]) await denied(410, () => { state.invitations[0].expiresAt = new Date(fixedTime + offset); });
await denied(410, () => { state.invitations[0].invitedBy = "missing-inviter"; });
await denied(410, () => { state.invitations[0].invitedBy = "juris"; });
await denied(410, () => { emptyUpdate = true; }); assert.equal(rollbackCount, 1, "A stale update must abort the transaction");
for (const flag of ["acceptedAt", "revokedAt", "expiresAt"]) {
  reset();
  state.invitations.push({ ...structuredClone(originalInvite), id: otherInvitationId, employeeId: 12, [flag]: new Date(fixedTime - 1) });
  assert.equal((await request({ body: { role: "provider", employeeId: 12 } })).code, 200, `A ${flag} invitation does not reserve another employee`); cases++;
}
for (const configure of [() => { failUpdate = true; }, () => { queryFailure = true; }]) {
  const result = await denied(500, configure);
  assert.equal(rollbackCount, 1); assert.deepEqual(Object.keys(result.body), ["message"]);
  assert.equal(result.body.message, "Unable to complete the company request.");
  assert.ok(!JSON.stringify(result.body).includes("private"), "Adapter errors must not reveal private details");
}
console.log(`Passed ${cases} offline pending-invitation handler cases: isolated Santa updates, unchanged memberships/invite identity, authorization, validation, conflicts, stale state, transaction failure and safe responses.`);

let creationCases = 0;
const createBody = { email: "new-employee@example.test", role: "provider", employeeId: 12, sendEmail: true };
for (const outcome of [null, { code: "email_address_not_authorized", status: 403 }, { code: "over_email_send_rate_limit", status: 429 }, { code: "email_exists", status: 422 }, { code: "user_already_exists", status: 422 }, { code: "private-key-and-email@example.test", status: 500 }]) {
  for (const thrown of outcome ? [false, true] : [false]) {
    reset();
    fixture.sendEmail = async (email, options) => {
      assert.equal(email, createBody.email); assert.equal(options.redirectTo, "https://example.test/api/callback");
      assert.equal(state.invitations.length, 2, "Invitation commits before mail attempt");
      if (thrown) throw { ...outcome, message: "private raw message/token", email: "private@example.test" };
      return { error: outcome && { ...outcome, message: "private raw message/token" } };
    };
    const membersBefore = structuredClone(state.members);
    const result = await request({ method: "post", body: createBody });
    assert.equal(result.code, 201, "Committed invitation always retains successful creation response");
    assert.equal(result.body.emailSent, !outcome); assert.equal(fixture.emailCalls, 1, "Mail attempt is not retried");
    assert.deepEqual(Object.keys(result.body).sort(), ["emailSent", "id", "invitationUrl", "message"]);
    assert.match(result.body.invitationUrl, /^https:\/\/example\.test\/invite\?token=[a-f0-9]{64}$/);
    assert.equal(state.invitations[1].id, result.body.id); assert.equal(state.invitations[1].email, createBody.email);
    assert.deepEqual(state.members, membersBefore); assert.equal(state.invitations.length, 2); assert.equal(rollbackCount, 0);
    assert.equal(fixture.warnings.length, outcome ? 1 : 0);
    assert.ok(!JSON.stringify(result.body).includes("private"));
    assert.ok(!JSON.stringify(fixture.warnings).includes("private"), "Only bounded diagnostics reach server warnings");
    creationCases++;
  }
}
reset(); assert.equal((await request({ method: "post", body: { ...createBody, sendEmail: false } })).code, 201); assert.equal(fixture.emailCalls, 0); assert.equal(fixture.warnings.length, 0); creationCases++;
reset(); queryFailure = true; assert.equal((await request({ method: "post", body: createBody })).code, 500); assert.equal(fixture.emailCalls, 0); assert.equal(state.invitations.length, 1); creationCases++;
console.log(`Passed ${creationCases} offline invitation creation/email cases: unchanged201 contract after returned/thrown mail failures, one attempt, commit-before-send, safe server-only diagnostics, manual fallback and database-failure isolation.`);
