import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createAppointmentRepository, AppointmentError } from "../server/appointments/repository.ts";
import { appointmentEventKey, messageInputSchema, rescheduleInputSchema } from "../shared/appointment-collaboration.ts";
import { memoryDatabase } from "./fixtures/notification-database.mjs";

// Real policy/repository and parameterized Drizzle predicates; only persistence
// is in-memory. No server startup, environment file, socket or credentials.
const previousEnvironment = process.env;
process.env = { NODE_ENV: "test", NOTIFICATIONS_ENABLED: "false" };
const clock = new Date("2030-01-17T10:00:00Z");
const provider = { id: "provider", role: "provider" }, customer = { id: "customer", role: "customer" };
const original = new Date("2030-01-18T09:00:00Z"), proposed = "2030-01-19T11:00:00.000Z";
const service = { id: 10, providerId: "provider", companyId: null, serviceType: "group", duration: 60, cleanupTime: 0, maxCapacity: 8, isActive: true };
const booking = (id = 1, extra = {}) => ({ id, providerId: "provider", companyId: null, employeeId: 7, serviceId: 10, seekerId: id === 1 ? "customer" : `customer-${id}`,
  participantCount: 2, scheduledDate: original, bookingDuration: 60, bookingCleanupTime: 0, status: "confirmed", notificationRevision: 0, updatedAt: clock, ...extra });
const input = extra => ({ scheduledDate: proposed, fallback: "keep_original", timeZone: "Europe/Riga", clientRequestId: randomUUID(), ...extra });
let memory, repository, cases = 0;
const seed = extra => {
  memory = memoryDatabase({ bookings: [booking()], services: [service], users: [{ id: "provider", firstName: "Synthetic", lastName: "Provider" }, { id: "customer", firstName: "Synthetic", lastName: "Customer" }],
    availability: [{ id: 1, providerId: "provider", companyId: null, serviceId: 10, isActive: true, scheduleType: "recurring", daysOfWeek: [0, 1, 2, 3, 4, 5, 6], startTime: "08:00", endTime: "18:00", timezone: "UTC" }],
    provider_subscriptions: [{ id: 1, userId: "provider", companyId: null, plan: "pro", proUntil: new Date("2031-01-01Z") }], ...extra });
  repository = createAppointmentRepository(memory.database, () => new Date(clock));
};
const rejects = async (action, code) => { await assert.rejects(action, error => error instanceof AppointmentError && error.code === code); cases++; };
const message = text => ({ body: text, clientRequestId: randomUUID() });
try {
  seed();
  const text = "Rīga\nСообщение <img src=x onerror=alert(1)>";
  const send = message(text), sent = await repository.sendMessage(provider, 1, send);
  assert.equal(sent.body, text); assert.equal(sent.authorRole, "provider"); assert.equal(sent.authorName, "Synthetic Provider");
  assert.equal((await repository.sendMessage(provider, 1, send)).id, sent.id);
  assert.equal(memory.data.booking_messages.length, 1); cases++;
  await rejects(() => repository.sendMessage(provider, 1, { ...send, body: "different" }), "idempotency_conflict");
  await repository.sendMessage(customer, 1, message("Спасибо. Paldies."));
  assert.equal((await repository.conversation(customer, 1)).messages.length, 2); cases++;
  await rejects(() => repository.conversation({ id: "intruder", role: "customer" }, 1), "forbidden");
  await rejects(() => repository.sendMessage({ id: "other-provider", role: "provider" }, 1, message("secret")), "forbidden");
  assert.equal(messageInputSchema.safeParse({ ...message("x"), authorId: "someone" }).success, false);
  assert.equal(messageInputSchema.safeParse(message(" ")).success, false); assert.equal(messageInputSchema.safeParse(message("x".repeat(4001))).success, false); cases++;

  seed();
  for (let index = 0; index < 55; index++) await repository.sendMessage(provider, 1, message(`Message ${index}`));
  const page = await repository.conversation(customer, 1), older = await repository.conversation(customer, 1, page.nextCursor);
  assert.equal(page.messages.length, 50); assert.equal(older.messages.length, 5); assert.equal(older.nextCursor, null);
  assert.equal(new Set([...page.messages, ...older.messages].map(row => row.id)).size, 55); cases++;
  await rejects(() => repository.conversation(customer, 1, randomUUID()), "invalid_cursor");

  seed({ bookings: [booking(), booking(2), booking(3, { status: "pending", participantCount: 1 }), booking(4, { status: "cancelled" }),
    booking(5, { employeeId: 8 }), booking(6, { bookingDuration: 30 }), booking(7, { bookingCleanupTime: 15 })] });
  const preview = await repository.previewEvent(provider, 1, "message");
  assert.deepEqual(preview.bookingIds, [1, 2, 3]); assert.equal(preview.participantCount, 5); assert.equal(preview.hasPro, true); cases++;
  await rejects(() => repository.broadcast(customer, 1, { ...message("Hello"), bookingIds: [1, 2, 3] }), "forbidden");
  await rejects(() => repository.broadcast(provider, 1, { ...message("Hello"), bookingIds: [1, 2, 5] }), "event_changed");
  const broadcast = { ...message("Group announcement"), bookingIds: [1, 2, 3] };
  assert.equal((await repository.broadcast(provider, 1, broadcast)).saved, 3);
  await repository.broadcast(provider, 1, broadcast); assert.equal(memory.data.booking_messages.length, 3);
  const privateHistory = await repository.conversation(customer, 1); assert.equal(privateHistory.messages.length, 1); assert.equal(privateHistory.messages[0].broadcastId, null);
  assert.equal(JSON.stringify(privateHistory).includes("customer-2"), false); cases++;
  memory.data.provider_subscriptions[0].plan = "free";
  await rejects(() => repository.broadcast(provider, 1, { ...message("blocked"), bookingIds: [1, 2, 3] }), "pro_required");
  await repository.sendMessage(provider, 1, message("Individual works without Pro")); cases++;

  seed({ bookings: [booking(), booking(2), booking(3, { status: "pending" })] });
  const completePreview = await repository.previewEvent(provider, 1, "complete"); assert.deepEqual(completePreview.bookingIds, [1, 2]);
  await rejects(() => repository.updateEvent(provider, 1, { status: "completed", bookingIds: [1], timeZone: "UTC" }), "event_changed");
  await repository.updateEvent(provider, 1, { status: "completed", bookingIds: [1, 2], timeZone: "UTC" });
  assert.deepEqual(memory.data.bookings.map(row => row.status), ["completed", "completed", "pending"]);
  await repository.updateEvent(provider, 1, { status: "completed", bookingIds: [1, 2], timeZone: "UTC" }); cases++;

  seed();
  let request = (await repository.request(provider, 1, input())).requests[0];
  assert.equal(request.canWithdraw, true); assert.equal(request.canRespond, false); assert.equal(memory.data.bookings[0].scheduledDate.getTime(), original.getTime());
  assert.equal((await repository.requests(customer, 1)).requests[0].canRespond, true); cases++;
  await rejects(() => repository.respond(provider, 1, request.id, "accept"), "wrong_recipient");
  await rejects(() => repository.request(customer, 1, input()), "request_pending");
  const accepted = await repository.respond(customer, 1, request.id, "accept");
  assert.equal(accepted.request.state, "accepted"); assert.equal(accepted.booking.scheduledDate.toISOString(), proposed);
  assert.equal((await repository.respond(customer, 1, request.id, "accept")).request.state, "accepted"); cases++;
  await rejects(() => repository.respond(customer, 1, request.id, "decline"), "request_superseded");

  for (const fallback of ["keep_original", "cancel_booking"]) {
    seed(); request = (await repository.request(provider, 1, input({ fallback }))).requests[0];
    await repository.respond(customer, 1, request.id, "decline");
    assert.equal(memory.data.bookings[0].status, fallback === "keep_original" ? "confirmed" : "cancelled");
    assert.equal(memory.data.bookings[0].scheduledDate.getTime(), original.getTime()); cases++;
  }
  for (const fallback of ["keep_original", "cancel_booking"]) {
    seed(); request = (await repository.request(customer, 1, input({ fallback }))).requests[0];
    assert.equal((await repository.requests(provider, 1)).requests[0].canRespond, true);
    await repository.respond(provider, 1, request.id, "decline");
    assert.equal(memory.data.bookings[0].status, fallback === "keep_original" ? "confirmed" : "cancelled"); cases++;
  }

  seed({ bookings: [booking(), booking(2), booking(3, { status: "pending", participantCount: 1 })] });
  let result = await repository.request(provider, 1, input({ fallback: "cancel_booking" }), [1, 2, 3]);
  await repository.respond(customer, 1, result.requests[0].id, "accept");
  await repository.respond({ id: "customer-2", role: "customer" }, 2, result.requests[1].id, "decline");
  assert.equal(memory.data.bookings[0].scheduledDate.toISOString(), proposed);
  assert.equal(memory.data.bookings[1].status, "cancelled"); assert.equal(memory.data.bookings[2].status, "pending");
  assert.equal(memory.data.bookings[2].scheduledDate.getTime(), original.getTime());
  await repository.respond({ id: "customer-3", role: "customer" }, 3, result.requests[2].id, "accept");
  assert.equal(memory.data.bookings[2].status, "pending"); assert.equal(memory.data.bookings[2].scheduledDate.toISOString(), proposed); cases++;
  assert.equal((await repository.requests(customer, 1)).requests[0].batchId, null);
  assert.deepEqual((await repository.eventRequests(provider, 1)).requests.map(row => row.state), ["accepted", "declined", "accepted"]); cases++;
  await rejects(() => repository.eventRequests(customer, 1), "forbidden");

  seed(); request = (await repository.request(provider, 1, input({ fallback: "cancel_booking" }))).requests[0];
  memory.data.bookings.push(booking(2, { scheduledDate: new Date(proposed), participantCount: 8 }));
  await rejects(() => repository.respond(customer, 1, request.id, "accept"), "time_unavailable");
  assert.equal(memory.data.bookings[0].status, "confirmed"); assert.equal(memory.data.bookings[0].scheduledDate.getTime(), original.getTime());
  assert.equal(memory.data.booking_reschedule_requests[0].state, "pending"); cases++;

  seed({ bookings: [booking(), ...Array.from({ length: 5001 }, (_, index) => booking(index + 2, { scheduledDate: new Date("2029-01-01T09:00:00Z") }))] });
  request = (await repository.request(provider, 1, input())).requests[0];
  await repository.respond(customer, 1, request.id, "accept"); assert.equal(memory.data.bookings[0].scheduledDate.toISOString(), proposed); cases++;
  seed({ services: [service, { ...service, id: 11, duration: 120 }], bookings: [booking(), booking(2, { serviceId: 11, scheduledDate: new Date("2030-01-19T09:30:00Z"), bookingDuration: null })] });
  await rejects(() => repository.request(provider, 1, input()), "time_unavailable");
  seed({ bookings: [booking(1, { participantCount: 5 }), booking(2, { participantCount: 4 })] });
  await rejects(() => repository.request(provider, 1, input(), [1, 2]), "time_unavailable");
  assert.equal(memory.data.booking_reschedule_requests.length, 0, "Impossible group proposal writes no requests");

  seed(); const sameRequest = input(); request = (await repository.request(provider, 1, sameRequest)).requests[0];
  assert.equal((await repository.request(provider, 1, sameRequest)).requests[0].id, request.id);
  await rejects(() => repository.request(provider, 1, { ...sameRequest, fallback: "cancel_booking" }), "idempotency_conflict");
  await rejects(() => repository.withdraw(customer, 1, request.id), "forbidden");
  await repository.withdraw(provider, 1, request.id); assert.equal(memory.data.bookings[0].scheduledDate.getTime(), original.getTime()); cases++;
  request = (await repository.request(provider, 1, input())).requests[0]; memory.data.bookings[0].notificationRevision++;
  assert.equal((await repository.requests(customer, 1)).requests[0].canRespond, false);
  await rejects(() => repository.respond(customer, 1, request.id, "accept"), "request_superseded");

  seed(); request = (await repository.request(provider, 1, input({ fallback: "cancel_booking" }))).requests[0];
  const later = createAppointmentRepository(memory.database, () => new Date("2030-01-20T10:00:00Z"));
  assert.equal((await later.requests(customer, 1)).requests[0].state, "pending");
  assert.equal(memory.data.bookings[0].status, "confirmed"); assert.equal(memory.data.bookings[0].scheduledDate.getTime(), original.getTime()); cases++;

  seed({ bookings: [booking(1, { companyId: 8 })], companies: [{ id: 8, isActive: true }],
    company_memberships: [{ id: 1, companyId: 8, userId: "staff", role: "provider", employeeId: 7 }] });
  const staff = { id: "staff", role: "provider", companyId: 8 };
  await repository.sendMessage(staff, 1, message("Authorized assigned staff"));
  memory.data.company_memberships[0].employeeId = 99;
  await rejects(() => repository.conversation(staff, 1), "forbidden");
  memory.data.company_memberships[0].employeeId = 7; memory.data.company_memberships[0].role = "viewer";
  assert.equal((await repository.conversation(staff, 1)).messages.length, 1);
  await rejects(() => repository.sendMessage(staff, 1, message("Denied viewer write")), "forbidden");
  memory.data.company_memberships.length = 0;
  await rejects(() => repository.conversation(staff, 1), "forbidden");

  seed({ bookings: [booking(), booking(2)] });
  const insert = memory.database.insert.bind(memory.database); let writes = 0;
  memory.database.insert = table => { if (++writes === 2) throw new Error("synthetic write failure"); return insert(table); };
  await assert.rejects(() => repository.broadcast(provider, 1, { ...message("atomic"), bookingIds: [1, 2] }), /synthetic/);
  assert.equal(memory.data.booking_messages.length, 0, "A partial broadcast must roll back"); cases++;
  assert.notEqual(appointmentEventKey({ ...booking(), service }), appointmentEventKey({ ...booking(2, { bookingCleanupTime: 10 }), service }));
  assert.equal(rescheduleInputSchema.safeParse(input({ timeZone: "not/a/zone" })).success, false); cases++;
  console.log(`Passed ${cases} appointment collaboration scenarios: private two-way history/pagination, idempotency, Pro, event scope/completion, both request directions/fallbacks, independent group decisions, original reservation on failure/silence, revoked access and transactional rollback. In-memory adapters only.`);
} finally { process.env = previousEnvironment; }
