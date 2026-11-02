import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";
import { availability, bookingMessages, bookingRescheduleRequests, bookings, companies, companyMemberships, services, users,
  type Booking, type BookingMessage as StoredMessage, type BookingRescheduleRequest as StoredRequest } from "../../shared/schema";
import { appointmentEventKey, type BookingConversation, type BookingMessage, type EventAction, type EventPreview, type RescheduleInput, type RescheduleRequest } from "../../shared/appointment-collaboration";
import { availableCapacity, bookableSlots } from "../../shared/scheduling";
import { captureStatusEvent, reconcileBookingReminder, workspacePro } from "../notifications/repository";
import { statusAction } from "../notifications/policy";
import type { db } from "../db";

export class AppointmentError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export type AppointmentActor = { id: string; role: "provider" | "customer"; companyId?: number | null };
type Database = typeof db;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type QueryDatabase = Pick<Database, "select" | "insert" | "update" | "delete" | "execute">;
type SessionBooking = Booking & { service: typeof services.$inferSelect };
const active = (booking: Booking) => booking.status === "confirmed" || booking.status === "pending";
const fail = (status: number, code: string, message: string): never => { throw new AppointmentError(status, code, message); };

export function createAppointmentRepository(database: Database, now: () => Date = () => new Date()) {
  async function load(database: QueryDatabase, id: number): Promise<SessionBooking> {
    const [booking] = await database.select().from(bookings).where(eq(bookings.id, id));
    if (!booking) return fail(404, "booking_not_found", "Reservation not found.");
    const [service] = await database.select().from(services).where(eq(services.id, booking.serviceId));
    if (!service) return fail(409, "service_unavailable", "The service is no longer available.");
    return { ...booking, service };
  }
  async function authorize(database: QueryDatabase, actor: AppointmentActor, booking: Booking, write: boolean) {
    if (actor.role === "customer") {
      if (actor.id !== booking.seekerId) fail(403, "forbidden", "This conversation does not belong to you.");
      return;
    }
    if (booking.companyId == null) {
      if (actor.companyId != null || booking.providerId !== actor.id) fail(403, "forbidden", "Reservation is not in this workspace.");
      return;
    }
    if (actor.companyId !== booking.companyId) fail(403, "forbidden", "Reservation is not in this workspace.");
    const [company] = await database.select().from(companies).where(eq(companies.id, booking.companyId));
    const [membership] = await database.select().from(companyMemberships).where(and(eq(companyMemberships.companyId, booking.companyId), eq(companyMemberships.userId, actor.id)));
    if (!company?.isActive || !membership || write && membership.role === "viewer") fail(403, "forbidden", "Your access level does not allow this action.");
    if (membership.role !== "owner" && membership.role !== "admin" && (membership.employeeId == null || membership.employeeId !== booking.employeeId)) fail(403, "forbidden", "This reservation is not assigned to you.");
  }
  async function locked<T>(actor: AppointmentActor, id: number, action: (tx: Transaction, booking: SessionBooking) => Promise<T>) {
    return database.transaction(async tx => {
      const initial = await load(tx, id);
      // Matches every existing create/approve/reschedule occupancy lock.
      await tx.execute(sql`SELECT id FROM users WHERE id = ${initial.providerId} FOR UPDATE`);
      const [row] = await tx.select().from(bookings).where(eq(bookings.id, id)).for("update");
      if (!row) return fail(404, "booking_not_found", "Reservation not found.");
      const [service] = await tx.select().from(services).where(eq(services.id, row.serviceId));
      if (!service) return fail(409, "service_unavailable", "The service is no longer available.");
      const booking = { ...row, service };
      await authorize(tx, actor, booking, true);
      return action(tx, booking);
    });
  }
  async function eventRows(tx: QueryDatabase, actor: AppointmentActor, anchor: SessionBooking, action: EventAction, expected?: number[], allowClosedRetry = false) {
    if (actor.role !== "provider") fail(403, "forbidden", "Only the provider can manage a whole event.");
    if (anchor.service.serviceType !== "group") fail(409, "not_group", "This reservation is not a group event.");
    const rows = await tx.select().from(bookings).where(and(eq(bookings.providerId, anchor.providerId), eq(bookings.serviceId, anchor.serviceId),
      eq(bookings.scheduledDate, anchor.scheduledDate), anchor.companyId == null ? isNull(bookings.companyId) : eq(bookings.companyId, anchor.companyId),
      anchor.employeeId == null ? isNull(bookings.employeeId) : eq(bookings.employeeId, anchor.employeeId))).orderBy(asc(bookings.id)).limit(501);
    if (rows.length > 500) fail(409, "event_too_large", "This event has too many bookings for one operation.");
    const key = appointmentEventKey(anchor);
    const matching = rows.filter(row => appointmentEventKey({ ...row, service: anchor.service }) === key);
    const selected = matching.filter(row => action === "complete" ? row.status === "confirmed" : active(row));
    if (expected) {
      const requested = [...expected].sort((a, b) => a - b), actual = selected.map(row => row.id).sort((a, b) => a - b);
      if (requested.length !== actual.length || requested.some((id, index) => id !== actual[index])) {
        const closed = matching.filter(row => requested.includes(row.id));
        if (allowClosedRetry && closed.length === requested.length && closed.every(row => row.status === (action === "complete" ? "completed" : "cancelled"))) return closed;
        fail(409, "event_changed", "The event's bookings changed. Review the affected bookings again.");
      }
    }
    if (!selected.length) fail(409, "no_eligible_bookings", "No active bookings are eligible for this action.");
    // Every row has the already-authorized anchor's exact provider/workspace
    // and employee assignment; no per-participant membership queries are needed.
    return selected;
  }
  async function invalidate(tx: QueryDatabase, bookingId: number) {
    await tx.update(bookingRescheduleRequests).set({ state: "superseded" }).where(and(eq(bookingRescheduleRequests.bookingId, bookingId), eq(bookingRescheduleRequests.state, "pending")));
  }
  function requestView(request: StoredRequest, actor: AppointmentActor, booking: Booking): RescheduleRequest {
    const valid = request.state === "pending" && active(booking) && request.baseRevision === booking.notificationRevision
      && request.originalScheduledDate.getTime() === booking.scheduledDate.getTime();
    return { id: request.id, bookingId: request.bookingId, requestedById: request.requestedById, requestedByRole: request.requestedByRole,
      originalScheduledDate: request.originalScheduledDate.toISOString(), proposedScheduledDate: request.proposedScheduledDate.toISOString(), fallback: request.fallback,
      state: request.state === "pending" && !valid ? "superseded" : request.state, note: request.note, timezone: request.timezone, createdAt: request.createdAt.toISOString(),
      respondedAt: request.respondedAt?.toISOString() ?? null, canRespond: valid && actor.role !== request.requestedByRole,
      canWithdraw: valid && actor.id === request.requestedById, batchId: actor.role === "provider" ? request.batchId : null };
  }
  async function validateNewTime(tx: QueryDatabase, booking: SessionBooking, date: Date) {
    if (!active(booking)) fail(409, "booking_closed", "Only pending or confirmed bookings can be rescheduled.");
    if (!(date > now()) || date.getTime() === booking.scheduledDate.getTime()) fail(409, "invalid_time", "Choose a different future appointment time.");
    const schedules = await tx.select().from(availability).where(and(booking.companyId != null ? eq(availability.companyId, booking.companyId)
      : and(eq(availability.providerId, booking.providerId), isNull(availability.companyId)), eq(availability.isActive, true)));
    const snapshot = { ...booking.service, duration: booking.bookingDuration ?? booking.service.duration, cleanupTime: booking.bookingCleanupTime ?? 0 };
    const offered = bookableSlots({ service: snapshot, schedules, bookings: [], date: date.toISOString().slice(0, 10), timezone: "UTC", now: now() });
    if (!offered.some(slot => slot.startsAt === date.toISOString())) fail(409, "time_unavailable", "Choose a time within the available working hours.");
    const end = new Date(date.getTime() + (snapshot.duration + snapshot.cleanupTime) * 60000);
    const occupied = await tx.select().from(bookings).where(and(ne(bookings.id, booking.id), eq(bookings.providerId, booking.providerId), inArray(bookings.status, ["confirmed", "completed"]),
      booking.employeeId == null ? isNull(bookings.employeeId) : eq(bookings.employeeId, booking.employeeId), lt(bookings.scheduledDate, end),
      sql`${bookings.scheduledDate} + (COALESCE(${bookings.bookingDuration}, (SELECT ${services.duration} FROM ${services} WHERE ${services.id} = ${bookings.serviceId}), 60) + COALESCE(${bookings.bookingCleanupTime}, 0)) * interval '1 minute' > ${date.toISOString()}::timestamp`)).limit(5001);
    if (occupied.length > 5000) fail(409, "time_unavailable", "Availability needs to be reviewed. Choose another time.");
    const legacyServiceIds = Array.from(new Set(occupied.filter(row => row.bookingDuration == null).map(row => row.serviceId)));
    const legacyServices = legacyServiceIds.length ? await tx.select({ id: services.id, duration: services.duration }).from(services).where(inArray(services.id, legacyServiceIds)) : [];
    const capacity = availableCapacity(snapshot, occupied.filter(row => row.id !== booking.id).map(row => ({ ...row,
      bookingDuration: row.bookingDuration ?? legacyServices.find(service => service.id === row.serviceId)?.duration ?? 60 })), date);
    if ((booking.participantCount ?? 1) > capacity) fail(409, "time_unavailable", "The proposed time is no longer available. Your original reservation is unchanged.");
    return capacity;
  }
  async function writeMessage(tx: QueryDatabase, actor: AppointmentActor, bookingId: number, body: string, clientRequestId: string, broadcastId: string | null) {
    const [existing] = await tx.select().from(bookingMessages).where(and(eq(bookingMessages.bookingId, bookingId), eq(bookingMessages.authorId, actor.id), eq(bookingMessages.clientRequestId, clientRequestId)));
    if (existing) {
      if (existing.body !== body) fail(409, "idempotency_conflict", "This send identifier already belongs to another message.");
      return existing;
    }
    const [message] = await tx.insert(bookingMessages).values({ id: randomUUID(), bookingId, authorId: actor.id, authorRole: actor.role, body, clientRequestId, broadcastId, createdAt: now() }).returning();
    return message;
  }
  function messageView(message: StoredMessage, author?: { firstName: string | null; lastName: string | null }): BookingMessage {
    const authorName = [author?.firstName, author?.lastName].filter(Boolean).join(" ") || (message.authorRole === "provider" ? "Service provider" : "Customer");
    // broadcastId is deliberately omitted from customer-facing linkage. It could
    // otherwise reveal common IDs across private conversations.
    return { id: message.id, bookingId: message.bookingId, authorId: message.authorId, authorRole: message.authorRole, authorName,
      body: message.body, createdAt: message.createdAt.toISOString(), broadcastId: null };
  }
  async function createRequest(tx: QueryDatabase, actor: AppointmentActor, booking: SessionBooking, input: RescheduleInput, batchId: string | null, availabilityValidated = false) {
    const [duplicate] = await tx.select().from(bookingRescheduleRequests).where(and(eq(bookingRescheduleRequests.bookingId, booking.id),
      eq(bookingRescheduleRequests.requestedById, actor.id), eq(bookingRescheduleRequests.clientRequestId, input.clientRequestId)));
    if (duplicate) {
      if (duplicate.proposedScheduledDate.toISOString() !== input.scheduledDate || duplicate.fallback !== input.fallback || (duplicate.note ?? "") !== (input.note ?? "")) fail(409, "idempotency_conflict", "This request identifier has already been used.");
      return requestView(duplicate, actor, booking);
    }
    const [current] = await tx.select().from(bookingRescheduleRequests).where(and(eq(bookingRescheduleRequests.bookingId, booking.id), eq(bookingRescheduleRequests.state, "pending")));
    if (current) {
      if (current.baseRevision === booking.notificationRevision && current.originalScheduledDate.getTime() === booking.scheduledDate.getTime() && active(booking)) {
        fail(409, "request_pending", "A reschedule request is already awaiting a response. Review or withdraw it first.");
      }
      await invalidate(tx, booking.id);
    }
    if (actor.role === "customer" && !(booking.scheduledDate > now())) fail(409, "booking_started", "Only future reservations can be changed.");
    if (!availabilityValidated) await validateNewTime(tx, booking, new Date(input.scheduledDate));
    const [request] = await tx.insert(bookingRescheduleRequests).values({ id: randomUUID(), bookingId: booking.id, requestedById: actor.id, requestedByRole: actor.role,
      originalScheduledDate: booking.scheduledDate, proposedScheduledDate: new Date(input.scheduledDate), fallback: input.fallback, state: "pending", note: input.note || null,
      timezone: input.timeZone, clientRequestId: input.clientRequestId, batchId, baseRevision: booking.notificationRevision, createdAt: now(), respondedAt: null, respondedById: null }).returning();
    return requestView(request, actor, booking);
  }
  return {
    async conversation(actor: AppointmentActor, id: number, before?: string): Promise<BookingConversation> {
      const booking = await load(database, id); await authorize(database, actor, booking, false);
      let cursor: StoredMessage | undefined;
      if (before) {
        [cursor] = await database.select().from(bookingMessages).where(and(eq(bookingMessages.id, before), eq(bookingMessages.bookingId, id)));
        if (!cursor) fail(400, "invalid_cursor", "This message page is not available.");
      }
      const rows = await database.select().from(bookingMessages).where(and(eq(bookingMessages.bookingId, id), cursor ? or(lt(bookingMessages.createdAt, cursor.createdAt),
        and(eq(bookingMessages.createdAt, cursor.createdAt), lt(bookingMessages.id, cursor.id))) : undefined)).orderBy(desc(bookingMessages.createdAt), desc(bookingMessages.id)).limit(51);
      const page = rows.slice(0, 50).reverse();
      const authorIds = Array.from(new Set(page.map(row => row.authorId)));
      const authors = authorIds.length ? await database.select({ id: users.id, firstName: users.firstName, lastName: users.lastName }).from(users).where(inArray(users.id, authorIds)) : [];
      const byAuthor = new Map(authors.map(author => [author.id, author]));
      return { messages: page.map(row => messageView(row, byAuthor.get(row.authorId))), nextCursor: rows.length > 50 ? page[0].id : null };
    },
    sendMessage(actor: AppointmentActor, id: number, input: { body: string; clientRequestId: string }) {
      return locked(actor, id, async (tx, booking) => {
        const message = await writeMessage(tx, actor, booking.id, input.body, input.clientRequestId, null);
        const [author] = await tx.select({ firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, actor.id));
        return messageView(message, author);
      });
    },
    previewEvent(actor: AppointmentActor, id: number, action: EventAction): Promise<EventPreview> {
      return locked(actor, id, async (tx, booking) => {
        const rows = await eventRows(tx, actor, booking, action);
        const hasPro = await workspacePro(tx, booking, now().getTime());
        const customers = await tx.select({ id: users.id, firstName: users.firstName, lastName: users.lastName }).from(users).where(inArray(users.id, Array.from(new Set(rows.map(row => row.seekerId)))));
        const byCustomer = new Map(customers.map(customer => [customer.id, customer]));
        const recipients = rows.map(row => {
          const customer = byCustomer.get(row.seekerId);
          return { bookingId: row.id, customerName: [customer?.firstName, customer?.lastName].filter(Boolean).join(" ") || "Customer", status: row.status, participantCount: row.participantCount ?? 1 };
        });
        return { bookingIds: rows.map(row => row.id), bookingCount: rows.length, participantCount: rows.reduce((sum, row) => sum + (row.participantCount ?? 1), 0), hasPro, recipients };
      });
    },
    updateEvent(actor: AppointmentActor, id: number, input: { status: "completed" | "cancelled"; bookingIds: number[]; timeZone: string }) {
      return locked(actor, id, async (tx, booking) => {
        const rows = await eventRows(tx, actor, booking, input.status === "completed" ? "complete" : "cancel", input.bookingIds, true);
        const updated: Booking[] = [];
        for (const row of rows) {
          if (row.status === input.status) { updated.push(row); continue; }
          const [changed] = await tx.update(bookings).set({ status: input.status, closedAt: row.closedAt ?? now(), notificationRevision: row.notificationRevision + 1, updatedAt: now() }).where(eq(bookings.id, row.id)).returning();
          await invalidate(tx, row.id);
          const action = statusAction(row.status, changed.status);
          if (action) await captureStatusEvent(tx, changed, action, input.timeZone);
          await reconcileBookingReminder(tx, changed, now(), input.timeZone); updated.push(changed);
        }
        return { bookings: updated };
      });
    },
    broadcast(actor: AppointmentActor, id: number, input: { body: string; clientRequestId: string; bookingIds: number[] }) {
      return locked(actor, id, async (tx, booking) => {
        if (!await workspacePro(tx, booking, now().getTime())) fail(403, "pro_required", "An active PRO subscription is required to message a group.");
        const rows = await eventRows(tx, actor, booking, "message", input.bookingIds);
        for (const row of rows) await writeMessage(tx, actor, row.id, input.body, input.clientRequestId, input.clientRequestId);
        return { saved: rows.length, customerCount: new Set(rows.map(row => row.seekerId)).size };
      });
    },
    async requests(actor: AppointmentActor, id: number) {
      const booking = await load(database, id); await authorize(database, actor, booking, false);
      const rows = await database.select().from(bookingRescheduleRequests).where(eq(bookingRescheduleRequests.bookingId, id)).orderBy(desc(bookingRescheduleRequests.createdAt), desc(bookingRescheduleRequests.id)).limit(50);
      return { requests: rows.map(row => requestView(row, actor, booking)) };
    },
    async eventRequests(actor: AppointmentActor, id: number) {
      const booking = await load(database, id); await authorize(database, actor, booking, false);
      if (actor.role !== "provider") fail(403, "forbidden", "Only the provider can view group response outcomes.");
      const [latest] = await database.select().from(bookingRescheduleRequests).where(and(eq(bookingRescheduleRequests.bookingId, id), isNotNull(bookingRescheduleRequests.batchId)))
        .orderBy(desc(bookingRescheduleRequests.createdAt), desc(bookingRescheduleRequests.id)).limit(1);
      if (!latest?.batchId) return { requests: [] };
      const rows = await database.select().from(bookingRescheduleRequests).where(eq(bookingRescheduleRequests.batchId, latest.batchId)).orderBy(asc(bookingRescheduleRequests.bookingId)).limit(501);
      if (rows.length > 500) fail(409, "event_too_large", "This event has too many requests to display.");
      const requests: RescheduleRequest[] = [];
      const linkedRows = rows.length ? await database.select().from(bookings).where(inArray(bookings.id, rows.map(row => row.bookingId))) : [];
      const byBooking = new Map(linkedRows.map(row => [row.id, row]));
      const authorizedAssignments = new Set<string>();
      for (const row of rows) {
        const linked = byBooking.get(row.bookingId);
        if (!linked) throw new AppointmentError(404, "booking_not_found", "Reservation not found.");
        const assignment = JSON.stringify([linked.providerId, linked.companyId, linked.employeeId]);
        if (!authorizedAssignments.has(assignment)) { await authorize(database, actor, linked, false); authorizedAssignments.add(assignment); }
        requests.push(requestView(row, actor, linked));
      }
      return { requests };
    },
    request(actor: AppointmentActor, id: number, input: RescheduleInput, bookingIds?: number[]) {
      return locked(actor, id, async (tx, booking) => {
        const rows = bookingIds ? await eventRows(tx, actor, booking, "reschedule", bookingIds) : [booking];
        if (bookingIds) {
          const capacity = await validateNewTime(tx, booking, new Date(input.scheduledDate));
          const confirmedPlaces = rows.filter(row => row.status === "confirmed").reduce((sum, row) => sum + (row.participantCount ?? 1), 0);
          if (confirmedPlaces > capacity) fail(409, "time_unavailable", "The proposed time cannot fit all confirmed places in this event.");
        }
        const requests: RescheduleRequest[] = [];
        for (const row of rows) requests.push(await createRequest(tx, actor, { ...row, service: booking.service }, input, bookingIds ? input.clientRequestId : null, Boolean(bookingIds)));
        return { requests };
      });
    },
    respond(actor: AppointmentActor, id: number, requestId: string, decision: "accept" | "decline") {
      return locked(actor, id, async (tx, booking) => {
        const [request] = await tx.select().from(bookingRescheduleRequests).where(and(eq(bookingRescheduleRequests.id, requestId), eq(bookingRescheduleRequests.bookingId, id))).for("update");
        if (!request) fail(404, "request_not_found", "Reschedule request not found.");
        if (actor.role === request.requestedByRole) fail(403, "wrong_recipient", "Only the other party can respond to this request.");
        if (request.state === (decision === "accept" ? "accepted" : "declined")) return { request: requestView(request, actor, booking), booking };
        if (!requestView(request, actor, booking).canRespond) fail(409, "request_superseded", "This reschedule request is no longer actionable.");
        let changed: Booking = booking;
        if (decision === "accept") {
          await validateNewTime(tx, booking, request.proposedScheduledDate);
          [changed] = await tx.update(bookings).set({ scheduledDate: request.proposedScheduledDate, notificationRevision: booking.notificationRevision + 1, updatedAt: now() }).where(eq(bookings.id, id)).returning();
          await captureStatusEvent(tx, changed, "rescheduled", request.timezone, booking.scheduledDate);
          await reconcileBookingReminder(tx, changed, now(), request.timezone);
        } else if (request.fallback === "cancel_booking") {
          [changed] = await tx.update(bookings).set({ status: "cancelled", closedAt: booking.closedAt ?? now(), notificationRevision: booking.notificationRevision + 1, updatedAt: now() }).where(eq(bookings.id, id)).returning();
          const action = statusAction(booking.status, changed.status);
          if (action) await captureStatusEvent(tx, changed, action, request.timezone);
          await reconcileBookingReminder(tx, changed, now(), request.timezone);
        }
        const [responded] = await tx.update(bookingRescheduleRequests).set({ state: decision === "accept" ? "accepted" : "declined", respondedAt: now(), respondedById: actor.id }).where(eq(bookingRescheduleRequests.id, request.id)).returning();
        return { request: requestView(responded, actor, changed), booking: changed };
      });
    },
    withdraw(actor: AppointmentActor, id: number, requestId: string) {
      return locked(actor, id, async (tx, booking) => {
        const [request] = await tx.select().from(bookingRescheduleRequests).where(and(eq(bookingRescheduleRequests.id, requestId), eq(bookingRescheduleRequests.bookingId, id))).for("update");
        if (!request) fail(404, "request_not_found", "Reschedule request not found.");
        if (request.requestedById !== actor.id) fail(403, "forbidden", "Only the requester can withdraw this request.");
        if (request.state === "withdrawn") return { request: requestView(request, actor, booking) };
        if (!requestView(request, actor, booking).canWithdraw) fail(409, "request_superseded", "This request is no longer actionable.");
        const [withdrawn] = await tx.update(bookingRescheduleRequests).set({ state: "withdrawn", respondedAt: now(), respondedById: actor.id }).where(eq(bookingRescheduleRequests.id, requestId)).returning();
        return { request: requestView(withdrawn, actor, booking) };
      });
    },
  };
}
