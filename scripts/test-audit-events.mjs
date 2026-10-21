// Pure synthetic contract tests. Only node built-ins, Zod and server/audit modules
// are imported. No config, application/schema imports, DB, HTTP, listener or I/O.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createAuditContext } from "../server/audit/context.ts";
import { createAuditEvent, parseAuditEnvelope, redactedAccountChanges,
  auditEventExpiresAt, SUPPORTED_AUDIT_EVENTS } from "../server/audit/events.ts";
import { canonicalAuditJson, auditPayloadHash, AUDIT_MAX_BYTES,
  AUDIT_HASH_VERSION, AuditContractError } from "../server/audit/canonical.ts";

const ids = {
  user: "11111111-1111-4111-8111-111111111111",
  other: "22222222-2222-4222-8222-222222222222",
  event: "33333333-3333-4333-8333-333333333333",
  request: "44444444-4444-4444-8444-444444444444",
  operation: "55555555-5555-4555-8555-555555555555",
};
const fixed = { now: () => new Date("2026-10-19T10:00:00.000Z"), newId: () => ids.event };
const copy = value => structuredClone(value);
const personal = () => ({ actor: { kind: "user", userId: ids.user, effectiveRole: "seeker" },
  scope: { kind: "personal", workspaceId: ids.user }, target: { type: "user", id: ids.user },
  source: { application: "fitsmytime", environment: "test", component: "auth" },
  requestId: ids.request, operationId: ids.operation });
const anonymous = () => ({ ...personal(), actor: { kind: "anonymous" },
  scope: { kind: "unknown" }, target: { type: "request" } });
const company = (type = "membership", role = "admin") => ({ ...personal(),
  actor: { kind: "user", userId: ids.user, effectiveRole: role },
  scope: { kind: "company", workspaceId: "7" },
  target: type === "company" ? { type, id: "7" } : { type, id: ids.other },
  source: { ...personal().source, component: "company-access" } });
const action = (eventName, extra = {}) => ({ eventName, outcome: "succeeded", changes: [], ...extra });
const emit = (input, value, dependencies = fixed) => createAuditEvent(createAuditContext(input), value, dependencies);
let rejected = 0;
function rejects(callback) {
  assert.throws(callback, error => {
    assert.ok(error instanceof AuditContractError);
    assert.equal(error.message, "Invalid audit event contract");
    assert.deepEqual(Object.keys(error), ["name"]);
    rejected++;
    return true;
  });
}

// True outcomes are caller-confirmed facts: no HTTP-status inference or provider
// calls occur in this package. Remote phases remain independently representable.
const login = emit(personal(), action("auth.login.v1"));
assert.equal(login.envelope.actor.userId, ids.user);
assert.equal(login.envelope.scope.workspaceId, ids.user);
assert.equal(login.envelope.retentionClass, "S");
assert.equal(login.hashVersion, AUDIT_HASH_VERSION);
assert.equal(login.payloadHash, createHash("sha256").update(login.canonicalJson).digest("hex"));
assert.equal(auditEventExpiresAt(login.envelope), "2027-10-19T10:00:00.000Z");
assert.equal(emit(anonymous(), action("auth.login.v1", { outcome: "denied", reasonCode: "INVALID_CREDENTIALS" })).envelope.actor.kind, "anonymous");
for (const [outcome, reasonCode] of [["rejected", "INVALID_INPUT"], ["failed", "PROVIDER_UNAVAILABLE"], ["unknown", "PROVIDER_TIMEOUT"]]) {
  assert.equal(emit(anonymous(), action("auth.oauth_callback.v1", { outcome, reasonCode })).envelope.outcome, outcome);
}
assert.equal(emit(anonymous(), action("auth.oauth_started.v1")).envelope.outcome, "succeeded");
for (const name of ["auth.oauth_callback.v1", "auth.session_established.v1", "auth.logout.v1", "auth.password_changed.v1"]) {
  assert.equal(emit(personal(), action(name)).envelope.eventName, name);
}
rejects(() => emit(anonymous(), action("auth.login.v1")));
rejects(() => emit(anonymous(), action("auth.session_established.v1")));
rejects(() => emit(personal(), action("auth.login.v1", { outcome: "failed", reasonCode: "INVALID_INPUT" })));
rejects(() => emit(personal(), action("auth.login.v1", { outcome: "unknown", reasonCode: "LOCAL_FAILURE" })));
rejects(() => emit(personal(), action("auth.login.v1", { outcome: "denied" })));
rejects(() => emit(personal(), action("auth.login.v1", { outcome: "denied", reasonCode: "NO_CHANGE" })));
rejects(() => emit(personal(), action("auth.login.v1", { outcome: "denied", reasonCode: "PROVIDER_TIMEOUT" })));
rejects(() => emit(personal(), action("auth.login.v1", { outcome: "rejected", reasonCode: "FORBIDDEN" })));
rejects(() => emit(personal(), action("auth.session_established.v1", { outcome: "unknown", reasonCode: "PROVIDER_TIMEOUT" })));
rejects(() => emit(personal(), action("auth.login.v1", { reasonCode: "PROVIDER_TIMEOUT" })));
rejects(() => emit(personal(), action("service.created.v1")));

const denied = anonymous(); denied.source.component = "authorization";
for (const reasonCode of ["UNAUTHENTICATED", "FORBIDDEN", "CROSS_WORKSPACE", "WRONG_ORIGIN", "RATE_LIMITED", "SESSION_EXPIRED"]) {
  assert.equal(emit(denied, action("security.action_denied.v1", { outcome: "denied", reasonCode })).envelope.outcome, "denied");
}
rejects(() => emit(denied, action("security.action_denied.v1")));
rejects(() => emit(denied, action("security.action_denied.v1", { outcome: "denied", reasonCode: "CONFLICT" })));
rejects(() => createAuditContext({ ...anonymous(), scope: { kind: "company", workspaceId: "7" } }));
rejects(() => createAuditContext({ ...anonymous(), target: { type: "user", id: ids.user } }));
rejects(() => createAuditContext({ ...anonymous(), actor: { kind: "anonymous", userId: ids.user } }));
rejects(() => createAuditContext({ ...personal(), scope: { kind: "company" } }));
rejects(() => createAuditContext({ ...personal(), scope: { kind: "unknown", workspaceId: ids.user } }));
rejects(() => createAuditContext({ ...personal(), scope: { kind: "global" } }));
rejects(() => createAuditContext({ ...company("company"), target: { type: "company", id: "8" } }));
rejects(() => emit({ ...personal(), target: { type: "user", id: ids.other } }, action("auth.login.v1")));
rejects(() => emit({ ...personal(), scope: { kind: "personal", workspaceId: ids.other } }, action("auth.login.v1")));
rejects(() => createAuditEvent(copy(createAuditContext(personal())), action("auth.login.v1"), fixed));
rejects(() => createAuditEvent(personal(), action("auth.login.v1"), fixed));
rejects(() => emit(personal(), { ...action("auth.login.v1"), target: { type: "user", id: ids.other } }));

const account = personal(); account.source.component = "account";
const privateNames = emit(account, action("account.details_changed.v1", { changes: redactedAccountChanges(["firstName", "lastName"]) }));
assert.deepEqual(privateNames.envelope.changes, [{ field: "firstName", redacted: true }, { field: "lastName", redacted: true }]);
assert.equal(privateNames.envelope.retentionClass, "B");
const persona = action("account.active_role_changed.v1", { changes: [{ field: "currentRole", before: "seeker", after: "provider" }] });
assert.equal(emit(account, persona).envelope.changes[0].after, "provider");
rejects(() => emit(account, { ...persona, outcome: "denied", reasonCode: "FORBIDDEN" }));
rejects(() => emit(account, action("account.active_role_changed.v1", { outcome: "unknown", reasonCode: "PROVIDER_TIMEOUT" })));
rejects(() => emit(account, action("account.active_role_changed.v1")));
assert.equal(emit(account, action("account.active_role_changed.v1", { reasonCode: "NO_CHANGE" })).envelope.changes.length, 0);
for (const changes of [
  [{ field: "currentRole", before: "seeker", after: "owner" }],
  [{ field: "currentRole", before: "seeker", after: "seeker" }],
  [...persona.changes, ...persona.changes],
]) rejects(() => emit(account, action("account.active_role_changed.v1", { changes })));
rejects(() => redactedAccountChanges(["email"]));
rejects(() => redactedAccountChanges(["firstName", "firstName"]));

const membership = action("company.membership_changed.v1", { changes: [{ field: "role", before: "provider", after: "admin" }] });
assert.equal(emit(company(), membership).envelope.scope.workspaceId, "7");
assert.equal(emit(company(), membership).envelope.target.id, ids.other);
assert.notEqual(emit({ ...company(), scope: { kind: "company", workspaceId: "8" } }, membership).payloadHash,
  emit(company(), membership).payloadHash, "Membership identity includes user target AND company scope");
for (const role of ["provider", "viewer", "seeker"]) rejects(() => emit(company("membership", role), membership));
const transfer = action("company.ownership_transferred.v1", { changes: [{ field: "ownerId", before: ids.user, after: ids.other }] });
assert.equal(emit(company("company", "owner"), transfer).envelope.target.id, "7");
rejects(() => emit(company("company", "admin"), transfer));
rejects(() => emit(company("company", "owner"), { ...transfer, changes: [{ field: "ownerId", before: ids.other, after: ids.user }] }));

// No unsafe keys/values survive; validation errors never carry input or Zod issues.
const canary = "CANARY-secret-password-token@example.invalid";
for (const key of ["password", "accessToken", "refreshToken", "cookie", "headers", "body", "email", "invitationUrl", "receivedAt", "requestContext"]) {
  rejects(() => emit(personal(), { ...action("auth.login.v1"), [key]: canary }));
  rejects(() => createAuditContext({ ...personal(), [key]: canary }));
  rejects(() => parseAuditEnvelope({ ...login.envelope, [key]: canary }));
}
for (const field of ["password", "notes", "comment", "address", "latitude", "embedding", "profileImageUrl", "email"]) {
  rejects(() => emit(account, action("account.details_changed.v1", { changes: [{ field, before: canary, after: canary }] })));
}
rejects(() => emit(account, action("account.details_changed.v1", { changes: [{ field: "firstName", redacted: true, after: canary }] })));
rejects(() => emit(personal(), action("auth.login.v1", { reasonCode: canary })));
assert.equal(JSON.stringify(privateNames).includes(canary), false);

const envelope = copy(login.envelope);
for (const patch of [
  { retentionClass: "O" }, { catalogVersion: 2 }, { schemaVersion: 2 },
  { occurredAt: "2026-02-30T10:00:00.000Z" }, { occurredAt: "2026-10-19T10:00:00+00:00" },
  { eventId: canary }, { relatedIds: Array.from({ length: 101 }, () => ids.user) },
]) rejects(() => parseAuditEnvelope({ ...envelope, ...patch }));
rejects(() => emit(account, action("account.details_changed.v1", { changes: Array.from({ length: 65 }, () => ({ field: "firstName", redacted: true })) })));
rejects(() => createAuditContext({ ...personal(), source: { ...personal().source, environment: "" } }));
rejects(() => createAuditContext({ ...personal(), source: { ...personal().source, release: canary } }));
rejects(() => emit(personal(), action("auth.login.v1"), { ...fixed, now: () => new Date(NaN) }));

// Canonical hashing is stable through key reorder, not through actual changes.
function reverseKeys(value) {
  if (Array.isArray(value)) return value.map(reverseKeys);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).reverse().map(([key, child]) => [key, reverseKeys(child)]));
}
assert.equal(canonicalAuditJson(parseAuditEnvelope(reverseKeys(envelope))), login.canonicalJson);
assert.equal(auditPayloadHash(canonicalAuditJson(reverseKeys(envelope))), login.payloadHash);
assert.notEqual(emit(personal(), action("auth.logout.v1")).payloadHash, login.payloadHash);
assert.equal(canonicalAuditJson({ z: [1, -0], a: "é" }), '{"a":"é","z":[1,0]}');
assert.equal(auditPayloadHash("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
assert.equal(Buffer.byteLength(canonicalAuditJson("a".repeat(AUDIT_MAX_BYTES - 2))), AUDIT_MAX_BYTES);
rejects(() => canonicalAuditJson("a".repeat(AUDIT_MAX_BYTES - 1)));
assert.equal(Buffer.byteLength(canonicalAuditJson("€".repeat(Math.floor(AUDIT_MAX_BYTES / 3)))), AUDIT_MAX_BYTES);
rejects(() => canonicalAuditJson("€".repeat(Math.ceil(AUDIT_MAX_BYTES / 3))));
for (const value of [undefined, NaN, Infinity, 1n, new Date(), new Map(), { value: undefined }, Array(2), Array(101).fill(1), JSON.parse('{"__proto__":1}')]) rejects(() => canonicalAuditJson(value));
const cycle = {}; cycle.self = cycle;
rejects(() => canonicalAuditJson(cycle));
let nested = {}; for (let i = 0; i < 14; i++) nested = { child: nested };
rejects(() => canonicalAuditJson(nested));
let getterCalled = false;
const getter = { get password() { getterCalled = true; return canary; } };
rejects(() => parseAuditEnvelope(getter));
assert.equal(getterCalled, false);
const customSerialization = { toJSON() { throw new Error("must never execute"); } };
rejects(() => parseAuditEnvelope(customSerialization));

// No alias lets later request mutations alter accepted context/evidence/hash.
const original = personal();
const context = createAuditContext(original); original.actor.userId = ids.other;
assert.equal(context.actor.userId, ids.user);
assert.throws(() => { context.actor.userId = ids.other; }, TypeError);
assert.throws(() => { login.envelope.changes.push({ field: "email" }); }, TypeError);
assert.throws(() => { login.envelope.source.environment = "production"; }, TypeError);
assert.throws(() => { SUPPORTED_AUDIT_EVENTS.push("fake.v1"); }, TypeError);
assert.equal(SUPPORTED_AUDIT_EVENTS.length, 11);
console.log(`Passed: 11 staged event contracts, truthful outcomes, trusted-context boundary, safe fields/redaction, immutable snapshots, canonical hash/expiry and payload bounds; ${rejected} invalid inputs rejected. No DB/services/application runtime used.`);
