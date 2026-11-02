import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { cleanupBookingMessages, messageHistoryExpiresAt, messageRetentionCutoff, startBookingMessageRetention } from "../server/appointments/retention.ts";
import { memoryDatabase } from "./fixtures/notification-database.mjs";

// Real purge policy, generated predicates and bounds with an in-memory relational
// adapter. No environment configuration, sockets or SQL execution.
const now = new Date("2032-02-29T12:34:56Z"), cutoff = new Date("2031-02-28T12:34:56Z");
const old = new Date("2030-01-01T00:00:00Z"), recent = new Date("2032-02-01T00:00:00Z");
const booking = (id, extra = {}) => ({ id, status: "completed", closedAt: old, ...extra });
const message = (bookingId, createdAt = old) => ({ id: randomUUID(), bookingId, body: "Synthetic retained message", createdAt });
let cases = 0;
assert.equal(messageRetentionCutoff(now).toISOString(), cutoff.toISOString()); cases++;
assert.equal(messageRetentionCutoff(new Date("2031-03-31T09:00:00Z")).toISOString(), "2030-03-31T09:00:00.000Z"); cases++;
assert.throws(() => messageRetentionCutoff(new Date("invalid"))); cases++;
assert.equal(messageHistoryExpiresAt(new Date("2032-02-29T12:34:56Z")).toISOString(), "2033-02-28T12:34:56.000Z"); cases++;
let memory = memoryDatabase({ bookings: [booking(1), booking(2, { status: "cancelled" }), booking(3, { status: "pending", closedAt: null }),
  booking(4, { status: "confirmed", closedAt: null }), booking(5, { closedAt: recent }), booking(6), booking(7, { closedAt: null }), booking(8, { closedAt: cutoff })],
  booking_messages: [message(1), message(2), message(3), message(4), message(5), message(6), message(6, recent), message(7), message(8, cutoff)],
  booking_reschedule_requests: [{ id: "immutable-decision", bookingId: 1, state: "accepted" }] });
assert.equal(await cleanupBookingMessages(memory.database, now), 3); cases++;
assert.deepEqual(Array.from(new Set(memory.data.booking_messages.map(row => row.bookingId))).sort(), [3, 4, 5, 6, 7]); cases++;
assert.equal(memory.data.booking_reschedule_requests.length, 1, "Message retention never deletes consent decision records"); cases++;
assert.equal(await cleanupBookingMessages(memory.database, now), 0); cases++;
// Leap-day anchors reach their twelve-month anniversary on the following Feb28,
// but neither the previous day nor one millisecond before the anniversary.
memory = memoryDatabase({ bookings: [booking(1, { closedAt: new Date("2032-02-29T12:34:56Z") })], booking_messages: [message(1, new Date("2032-02-29T12:34:56Z"))] });
assert.equal(await cleanupBookingMessages(memory.database, new Date("2033-02-27T12:34:56Z")), 0);
assert.equal(await cleanupBookingMessages(memory.database, new Date("2033-02-28T12:34:55.999Z")), 0);
assert.equal(await cleanupBookingMessages(memory.database, new Date("2033-02-28T12:34:56Z")), 1); cases++;
memory = memoryDatabase({ bookings: [booking(1)], booking_messages: [message(1, new Date("2032-02-28T12:34:56.001Z"))] });
assert.equal(await cleanupBookingMessages(memory.database, new Date("2033-02-28T12:34:56Z")), 0); cases++;
// Empty terminal histories do not consume the bounded candidate page forever.
memory = memoryDatabase({ bookings: [...Array.from({ length: 150 }, (_, index) => booking(index + 1)), booking(1000)], booking_messages: [message(1000)] });
assert.equal(await cleanupBookingMessages(memory.database, now), 1); cases++;
memory = memoryDatabase({ bookings: [booking(1)], booking_messages: Array.from({ length: 1201 }, () => message(1)) });
assert.equal(await cleanupBookingMessages(memory.database, now), 1000); assert.equal(memory.data.booking_messages.length, 201); cases++;
assert.equal(await cleanupBookingMessages(memory.database, now), 201); cases++;
memory = memoryDatabase({ bookings: Array.from({ length: 101 }, (_, index) => booking(index + 1)), booking_messages: Array.from({ length: 101 }, (_, index) => message(index + 1)) });
assert.equal(await cleanupBookingMessages(memory.database, now), 100); assert.equal(await cleanupBookingMessages(memory.database, now), 1); cases++;
// Simulate a send committed while candidate booking locks were being acquired.
// The fresh aggregation statement must protect the entire conversation.
memory = memoryDatabase({ bookings: [booking(1)], booking_messages: [message(1)] });
const originalSelect = memory.database.select.bind(memory.database); let selects = 0;
memory.database.select = (...args) => {
  if (++selects === 2) memory.data.booking_messages.push(message(1, recent));
  return originalSelect(...args);
};
assert.equal(await cleanupBookingMessages(memory.database, now), 0); assert.equal(memory.data.booking_messages.length, 2); cases++;
// Maintenance never overlaps itself, stops on lifecycle shutdown and reports
// only a controlled callback rather than private driver failures.
let calls = 0, errors = 0, release;
const gate = new Promise(resolve => { release = resolve; });
const maintenance = startBookingMessageRetention({ async transaction() { calls++; await gate; throw new Error("PRIVATE driver failure"); } },
  { now: () => now, intervalMs: 60000, onError: () => errors++ });
const first = maintenance.tick(); await maintenance.tick(); assert.equal(calls, 1);
maintenance.stop(); release(); await first; await maintenance.tick(); assert.equal(calls, 1); assert.equal(errors, 1); cases++;
console.log(`Passed ${cases} message-retention scenarios: UTC calendar12months/leapday, terminal/last-message anchors, unresolved preservation, exact expiry, bounded batches, no empty-history starvation, fresh-snapshot race protection and lifecycle isolation. In-memory database only.`);
