import assert from "node:assert/strict";
import { test } from "node:test";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema.ts";
import { createBillingRepository } from "../server/billing/repository.ts";

// A scripted PG transport, not a database. No pg Pool, connection, env loading or SQL execution.
// These checks exercise the actual Drizzle adapter's decisions/transactions, not PostgreSQL locks/RLS.
const authority = { provider: "fixture", merchantAccount: "merchant-a", mode: "live" };
const binding = { ...authority, workspaceId: 7 };
const operation = { id: "351495de-68f4-461a-af7d-3b7484f784cb", binding,
  actorId: "f4868c24-87f1-405b-bb82-6116a86662ba", idempotencyKey: "fixture-request-0001",
  fingerprint: "a".repeat(64), requestedOffer: "monthly-fixture", termsVersion: "v1",
  state: "reserved", remoteCheckoutId: null, resolvedAt: null };
const stored = { id: operation.id, ...binding, kind: "checkout", initiatorId: operation.actorId,
  idempotencyKey: operation.idempotencyKey, fingerprint: operation.fingerprint, approvedOfferRef: operation.requestedOffer,
  termsVersion: operation.termsVersion, state: "reserved", remoteCheckoutId: null, resolvedAt: null,
  accountId: "e1660b5b-4ae9-4899-b0a3-d7c267f08e14", createdAt: new Date(0), updatedAt: new Date(0), failureCode: null };

function fixture(results, hooks = {}, insertResults = []) {
  let committed = 0, rolledBack = 0, effects = 0;
  const changes = [];
  const client = { async query(config) {
    const text = typeof config === "string" ? config : config.text;
    if (text === "begin") return { rows: [] };
    if (text === "commit") { committed++; return { rows: [] }; }
    if (text === "rollback") { rolledBack++; return { rows: [] }; }
    if (!text.startsWith("select")) {
      effects++;
      if (text.includes(" returning ")) return { rows: (insertResults.shift() ?? []).map(row => [row.id]) };
      return { rows: [] };
    }
    const rows = results.shift();
    assert.ok(rows, "unexpected read: scripted fixture exhausted");
    const fields = [...text.slice(7, text.indexOf(" from ")).matchAll(/"([^\"]+)"/g)]
      .map(match => match[1].replace(/_([a-z])/g, (_, char) => char.toUpperCase()));
    return { rows: rows.map(row => fields.map(field => row[field] ?? null)) };
  } };
  const database = drizzle({ client, schema });
  const repository = createBillingRepository(database, authority, {
    async authorizeCheckout() {}, async recordChange(_tx, change) { changes.push(change); }, ...hooks,
  }, () => 15);
  return { repository, changes, get committed() { return committed; }, get rolledBack() { return rolledBack; }, get effects() { return effects; } };
}

test("real dormant checkout adapter records new account/operation atomically with mandatory audit", async () => {
  const value = fixture([[{ id: 7 }], [], [], [], []]);
  const result = await value.repository.reserve(operation);
  assert.equal(result.kind, "reserved"); assert.deepEqual(result.operation, operation);
  assert.equal(value.committed, 1); assert.equal(value.rolledBack, 0); assert.equal(value.effects, 2);
  assert.deepEqual(value.changes, [{ kind: "checkout.reserved", workspaceId: 7, reference: operation.id }]);
});

test("fresh transactional authorization denial and audit rejection roll back", async () => {
  const denied = fixture([[{ id: 7 }]], { async authorizeCheckout() { throw new Error("denied"); } });
  await assert.rejects(denied.repository.reserve(operation), /denied/);
  assert.equal(denied.effects, 0); assert.equal(denied.committed, 0); assert.equal(denied.rolledBack, 1);
  const rejected = fixture([[{ id: 7 }], [], [], [], []], { async recordChange() { throw new Error("audit policy unavailable"); } });
  await assert.rejects(rejected.repository.reserve(operation), /audit policy unavailable/);
  assert.equal(rejected.committed, 0); assert.equal(rejected.rolledBack, 1);
});

test("different-key checkout remains busy after hosted session creation; active contract also blocks", async () => {
  const busy = fixture([[{ id: 7 }], [], [{ ...stored, state: "completed", remoteCheckoutId: "remote-1" }]]);
  const result = await busy.repository.reserve({ ...operation, idempotencyKey: "different-request1" });
  assert.equal(result.kind, "busy"); assert.equal(result.operation.resolvedAt, null);
  assert.equal(busy.effects, 0); assert.equal(busy.changes.length, 0);
  const active = fixture([[{ id: 7 }], [], [], [{ id: "contract-1" }]]);
  await assert.rejects(active.repository.reserve(operation), error => error.code === "CONFLICT");
  assert.equal(active.effects, 0); assert.equal(active.rolledBack, 1);
});

test("same key is replayed only for identical payload and authoritative workspace/mode", async () => {
  const replay = fixture([[{ id: 7 }], [stored]]);
  assert.equal((await replay.repository.reserve(operation)).kind, "replay");
  assert.equal(replay.effects, 0);
  const conflict = fixture([[{ id: 7 }], [{ ...stored, fingerprint: "b".repeat(64) }]]);
  await assert.rejects(conflict.repository.reserve(operation), error => error.code === "CONFLICT");
  const wrongMode = fixture([]);
  await assert.rejects(wrongMode.repository.reserve({ ...operation, binding: { ...binding, mode: "test" } }),
    error => error.code === "BINDING_MISMATCH");
  assert.equal(wrongMode.committed, 0); assert.equal(wrongMode.effects, 0);
});

test("unknown marker cannot downgrade an already completed checkout or release its slot", async () => {
  const completed = { ...stored, state: "completed", remoteCheckoutId: "remote-1" };
  const value = fixture([[completed], [{ id: 7 }], [completed]]);
  await value.repository.markUnknown(operation.id);
  assert.equal(value.effects, 0); assert.equal(value.changes.length, 0); assert.equal(value.committed, 1);
});

const verifiedEvent = { ...authority, eventId: "event-1", eventType: "invoice.updated", customerId: "customer-1",
  processorSubscriptionId: "subscription-1", occurredAt: 10, fingerprint: "a".repeat(64) };
const account = { id: stored.accountId, ...binding, customerId: "customer-1", createdAt: new Date(0), updatedAt: new Date(0) };
const eventId = "25b29913-2d82-4063-bbec-514b33aa33e6";

test("mapped inbox insertion dirties the contract and records audit in the same transaction", async () => {
  const value = fixture([[account], [{ id: 7 }], [{ id: "contract-1" }]], {}, [[{ id: eventId }]]);
  assert.equal(await value.repository.ingest(verifiedEvent), "inserted");
  assert.equal(value.committed, 1); assert.equal(value.effects, 2);
  assert.deepEqual(value.changes, [{ kind: "event.accepted", workspaceId: 7, reference: eventId }]);
});

test("unknown first-event binding is quarantined rather than manufacturing a paid contract", async () => {
  const value = fixture([[]], {}, [[{ id: eventId }]]);
  assert.equal(await value.repository.ingest(verifiedEvent), "quarantined");
  assert.equal(value.effects, 1);
  assert.deepEqual(value.changes, [{ kind: "event.quarantined", workspaceId: null, reference: eventId }]);
});

test("repeated mapped event has no new dirty/audit effect; changed identity quarantines", async () => {
  const existing = { ...authority, id: eventId, fingerprint: verifiedEvent.fingerprint, state: "pending", workspaceId: 7 };
  const duplicate = fixture([[account], [{ id: 7 }], [{ id: "contract-1" }], [existing]]);
  assert.equal(await duplicate.repository.ingest(verifiedEvent), "duplicate");
  assert.equal(duplicate.effects, 1); assert.equal(duplicate.changes.length, 0);
  const conflict = fixture([[account], [{ id: 7 }], [{ id: "contract-1" }], [{ ...existing, fingerprint: "b".repeat(64) }]]);
  assert.equal(await conflict.repository.ingest(verifiedEvent), "quarantined");
  assert.equal(conflict.effects, 2); assert.equal(conflict.changes[0].kind, "event.quarantined");
});
