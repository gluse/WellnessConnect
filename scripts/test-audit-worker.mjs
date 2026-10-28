// Offline only: pure audit/ORM builders, synthetic executors and fake clocks.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createAuditContext } from "../server/audit/context.ts";
import { createAuditEvent } from "../server/audit/events.ts";
import { createAuditWorker, AuditPortFailure } from "../server/audit/worker.ts";
import { auditArguments, enqueueAudit, enqueueDrizzleAudit, auditTransaction, captureIndependent, AuditCaptureUnavailable } from "../server/audit/capture.ts";
import { auditConnection, auditEnvironment, AUDIT_PROJECTS, AUDIT_USERS } from "../server/audit/config.ts";
import { assertAuditRuntimeRole } from "../server/audit/runtime.ts";

const user = "11111111-1111-4111-8111-111111111111";
const event = createAuditEvent(createAuditContext({ actor: { kind: "user", userId: user, effectiveRole: "seeker" },
  scope: { kind: "personal", workspaceId: user }, target: { type: "user", id: user },
  source: { application: "fitsmytime", component: "auth", environment: "development" }, requestId: randomUUID(), operationId: randomUUID() }),
  { eventName: "auth.login.v1", outcome: "succeeded", changes: [] });

// The transaction-aware adapter cannot open another connection or swallow failure.
let calls = [], releases = [], failEnqueue = false, connectionCount = 0;
const executor = { async query(text, values) {
  calls.push({ text, values });
  if (text.includes("enqueue")) {
    if (failEnqueue) throw new Error("CANARY-private-error");
    return { rows: [{ event_id: event.envelope.eventId }] };
  }
  return { rows: [] };
} };
const pool = { async connect() { connectionCount++; return { ...executor, release: value => releases.push(value) }; } };
await auditTransaction(pool, async tx => { await tx.query("SYNTHETIC_DOMAIN_CHANGE"); await enqueueAudit(tx, event); });
assert.equal(connectionCount, 1);
assert.deepEqual(calls.map(call => call.text), ["BEGIN", "SYNTHETIC_DOMAIN_CHANGE", "SELECT audit_capture.enqueue($1,$2,$3) AS event_id", "COMMIT"]);
assert.deepEqual(calls[2].values, [event.canonicalJson, event.payloadHash, event.hashVersion]);
failEnqueue = true; calls = [];
await assert.rejects(auditTransaction(pool, tx => enqueueAudit(tx, event)), AuditCaptureUnavailable);
assert.deepEqual(calls.map(call => call.text), ["BEGIN", "SELECT audit_capture.enqueue($1,$2,$3) AS event_id", "ROLLBACK"]);
assert.equal(releases.at(-1), true);
failEnqueue = false; calls = [];
await captureIndependent(pool, event);
assert.equal(connectionCount, 3);
assert.equal(calls[0].text, "BEGIN");
await assert.rejects(enqueueAudit(executor, { ...event, payloadHash: "0".repeat(64) }));
let drizzleQuery;
await enqueueDrizzleAudit({ execute: async query => { drizzleQuery = query; return { rows: [{ event_id: event.envelope.eventId }] }; } }, event);
assert.ok(drizzleQuery);
assert.deepEqual(auditArguments(event), [event.canonicalJson, event.payloadHash, event.hashVersion]);

for (const kind of ["capture", "worker", "writer"]) {
  const ref = kind === "writer" ? AUDIT_PROJECTS.destination : AUDIT_PROJECTS.source;
  const base = `postgresql://${AUDIT_USERS[kind]}:synthetic@db.${ref}.supabase.co/postgres`;
  assert.equal(auditConnection(base + "?sslmode=require", kind).host, `db.${ref}.supabase.co`);
  for (const suffix of ["?host=evil.invalid", "?sslmode=no-verify", "?sslmode=require&sslmode=disable", "?user=postgres", "?ssl=true"]) assert.throws(() => auditConnection(base + suffix, kind));
  assert.throws(() => auditConnection(base.replace(AUDIT_USERS[kind], "postgres"), kind));
  assert.throws(() => auditConnection(base.replace("/postgres", ":6543/postgres"), kind));
}
assert.equal(auditEnvironment({ AUDIT_ENVIRONMENT: "development" }), "development");
assert.throws(() => auditEnvironment({})); assert.throws(() => auditEnvironment({ AUDIT_ENVIRONMENT: "production" }));
for (const kind of ["capture", "worker", "writer"]) {
  const snapshot = { principal: AUDIT_USERS[kind], group_member: true, may_execute: true,
    rolsuper: false, rolbypassrls: false, rolcreaterole: false, rolcreatedb: false, rolreplication: false, base_access: false, owner_member: false, extra_application_role: false };
  assert.doesNotThrow(() => assertAuditRuntimeRole([snapshot], kind));
  for (const capability of ["rolsuper", "rolbypassrls", "rolcreaterole", "rolcreatedb", "rolreplication", "base_access", "owner_member", "extra_application_role"]) {
    assert.throws(() => assertAuditRuntimeRole([{ ...snapshot, [capability]: true }], kind));
    assert.throws(() => assertAuditRuntimeRole([{ ...snapshot, [capability]: null }], kind));
    const missing = { ...snapshot }; delete missing[capability];
    assert.throws(() => assertAuditRuntimeRole([missing], kind));
  }
  for (const requirement of ["group_member", "may_execute"]) assert.throws(() => assertAuditRuntimeRole([{ ...snapshot, [requirement]: false }], kind));
  assert.throws(() => assertAuditRuntimeRole([{ ...snapshot, principal: "postgres" }], kind));
  assert.throws(() => assertAuditRuntimeRole([], kind));
}

function fixture(extra = {}) {
  let now = Date.now(), state = "pending", token, attempts = 0, failAck = false;
  const destination = new Map(), observed = [];
  const row = () => ({ event_id: event.envelope.eventId, canonical_json: event.canonicalJson, payload_hash: event.payloadHash,
    hash_version: event.hashVersion, lease_token: token, lease_until: new Date(now + 30000), attempts: String(attempts), ...extra });
  const ports = {
    async claim() { if (state === "delivered" || state === "quarantined") return []; state = "leased"; token = randomUUID(); attempts++; return [row()]; },
    async accept(value) { observed.push(["accept", value.event_id, value.payload_hash]); const previous = destination.get(value.event_id);
      if (previous) return previous === value.payload_hash ? "matching" : "conflict";
      destination.set(value.event_id, value.payload_hash); return "inserted"; },
    async ack(value) { observed.push(["ack", value.lease_token]); if (failAck) throw new Error("CANARY-private-error"); if (value.lease_token !== token) return false; state = "delivered"; return true; },
    async retry(value, code, seconds) { observed.push(["retry", value.event_id, code, seconds]); state = "pending"; return value.lease_token === token; },
    async quarantine(value, code) { observed.push(["quarantine", code]); state = "quarantined"; return value.lease_token === token; },
    async health() { return { pending: state === "pending" ? 1 : 0, leased: state === "leased" ? 1 : 0, quarantined: state === "quarantined" ? 1 : 0, expired: 0, oldestAgeSeconds: 0 }; },
  };
  const worker = () => createAuditWorker(ports, { batchSize: 2, timeoutMs: 100, pollMs: 100 }, { now: () => now, random: () => 0.5 });
  return { ports, worker, destination, observed, state: () => state, setFailAck: value => { failAck = value; }, advance: ms => { now += ms; } };
}
const signal = () => new AbortController().signal;
let f = fixture(), worker = f.worker();
await worker.step(signal());
assert.equal(f.state(), "delivered"); assert.equal(worker.snapshot().delivered, 1); assert.equal(f.destination.size, 1);
assert.deepEqual(await worker.health(signal()), { pending: 0, leased: 0, quarantined: 0, expired: 0, oldestAgeSeconds: 0 });

// Crash/ack failure AFTER destination commit: same ID/content retries as matching.
f = fixture(); f.setFailAck(true); worker = f.worker(); await worker.step(signal());
assert.equal(f.destination.size, 1); assert.equal(worker.snapshot().sourceFailures, 1); assert.equal(worker.snapshot().delivered, 0);
f.setFailAck(false); f.advance(31000); await worker.step(signal());
assert.equal(f.destination.size, 1); assert.equal(worker.snapshot().matching, 1); assert.equal(worker.snapshot().delivered, 1);

f = fixture(); f.ports.accept = async () => { throw new Error("CANARY-private-error"); }; worker = f.worker();
await worker.step(signal()); assert.equal(worker.snapshot().retried, 1); assert.equal(worker.snapshot().delivered, 0);
assert.equal(f.observed.find(value => value[0] === "retry")[1], event.envelope.eventId);
assert.ok(f.observed.find(value => value[0] === "retry")[3] >= 1);
assert.equal(JSON.stringify(worker.snapshot()).includes("CANARY"), false);
for (const [disposition, code] of [["conflict", "HASH_CONFLICT"], ["expired", "EXPIRED_AT_DESTINATION"]]) {
  f = fixture(); f.ports.accept = async () => disposition; worker = f.worker(); await worker.step(signal());
  assert.equal(worker.snapshot().quarantined, 1); assert.equal(worker.snapshot().delivered, 0);
  assert.deepEqual(f.observed[0], ["quarantine", code]);
}
for (const patch of [{ hash_version: "future-v2" }, { payload_hash: "0".repeat(64) }, { canonical_json: event.canonicalJson + " " }]) {
  f = fixture(patch); worker = f.worker(); await worker.step(signal());
  assert.equal(worker.snapshot().quarantined, 1); assert.equal(f.destination.size, 0);
}
f = fixture(); f.ports.ack = async () => false; worker = f.worker(); await worker.step(signal());
assert.equal(worker.snapshot().stale, 1); assert.equal(worker.snapshot().delivered, 0);
for (const code of ["AUTHORIZATION_CONFIGURATION", "INVALID_CONTRACT"]) {
  f = fixture(); f.ports.accept = async () => { throw new AuditPortFailure(code); }; worker = f.worker(); await worker.step(signal());
  assert.equal(worker.snapshot().quarantined, 1); assert.equal(worker.snapshot().retried, 0);
}
for (const code of ["DESTINATION_TIMEOUT", "DESTINATION_BUSY"]) {
  f = fixture(); f.ports.accept = async () => { throw new AuditPortFailure(code); }; worker = f.worker(); await worker.step(signal());
  assert.equal(f.observed.find(value => value[0] === "retry")[2], code);
}
f = fixture({ lease_until: new Date(Date.now() + 100) }); worker = f.worker(); await worker.step(signal());
assert.equal(f.destination.size, 0); assert.equal(worker.snapshot().retried, 1);
f = fixture(); f.ports.claim = async () => { throw new Error("CANARY-private-error"); }; worker = f.worker(); await worker.step(signal());
assert.equal(worker.snapshot().sourceFailures, 1);

// Timeout after a possible destination commit: no ack, stable ID retry.
f = fixture(); const originalAccept = f.ports.accept;
f.ports.accept = async (row, aborted) => { await originalAccept(row); return new Promise((_, reject) => aborted.addEventListener("abort", () => reject(new Error("timeout")), { once: true })); };
worker = f.worker(); await worker.step(signal()); assert.equal(f.destination.size, 1); assert.equal(worker.snapshot().retried, 1);
f.ports.accept = originalAccept; await worker.step(signal()); assert.equal(worker.snapshot().matching, 1); assert.equal(f.destination.size, 1);
const stop = new AbortController(); f = fixture();
f.ports.accept = async (_row, abort) => new Promise((_, reject) => abort.addEventListener("abort", () => reject(new Error("cancelled")), { once: true }));
worker = f.worker(); const pending = worker.step(stop.signal); setTimeout(() => stop.abort(), 5); await pending;
assert.equal(worker.snapshot().delivered, 0); assert.equal(worker.snapshot().retried, 0);
// The one newly supported R90 service event traverses the actual worker parser
// and committed-operation ports without changing its canonical evidence.
const viewed = createAuditEvent(createAuditContext({ actor: { kind: "anonymous" }, scope: { kind: "unknown" },
  target: { type: "service", id: "42" }, source: { application: "fitsmytime", component: "service", environment: "development" },
  requestId: randomUUID(), operationId: randomUUID() }), { eventName: "service.viewed.v1", outcome: "succeeded", changes: [] });
f = fixture({ event_id: viewed.envelope.eventId, canonical_json: viewed.canonicalJson, payload_hash: viewed.payloadHash });
worker = f.worker(); await worker.step(signal());
assert.equal(worker.snapshot().delivered, 1); assert.equal(worker.snapshot().quarantined, 0);
assert.equal(f.destination.get(viewed.envelope.eventId), viewed.payloadHash);
console.log("Passed: same-transaction enqueue/rollback and isolated capture; restricted endpoint config; leased delivery, duplicate recovery, outage/timeout, stale CAS, expiry/conflict quarantine, cancellation and bounded metrics. Mocked only; no SQL/services/listeners.");
