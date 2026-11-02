import React from "react";
import { createRoot } from "react-dom/client";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../../client/src/lib/queryClient";
import AppointmentsPage from "../../client/src/pages/provider/appointments";
import MyBookings from "../../client/src/pages/my-bookings";
import type { BookingWithDetails } from "../../shared/schema";
import type { BookingMessage, RescheduleRequest } from "../../shared/appointment-collaboration";

declare const __FORM_RESOURCES__: Record<string, { translation: object }>;
const NativeDate = Date, now = NativeDate.UTC(2030, 0, 15, 12);
class FixedDate extends NativeDate {
  constructor(value?: string | number | Date, month?: number, day?: number) { if (month !== undefined) super(Number(value), month, day ?? 1); else super(value === undefined ? now : value instanceof NativeDate ? value.getTime() : value); }
  static now() { return now; }
}
globalThis.Date = FixedDate as DateConstructor;
const params = new URLSearchParams(location.search), customerMode = params.has("customer");
const provider = { id: "provider", firstName: "Emma", lastName: "Provider" }, customer = { id: "customer-1", firstName: "Ana", lastName: "K" };
const service = { id: 7, providerId: provider.id, name: "Group Pilates", serviceType: "group", maxCapacity: 8, duration: 60, cleanupTime: 0, price: "20", reminderEnabled: false };
const booking = (id: number, status: string, count: number, name: string, extra = {}) => ({ id, serviceId: 7, providerId: provider.id, seekerId: `customer-${id}`, companyId: null, employeeId: 1, participantCount: count, scheduledDate: "2030-01-16T09:00:00.000Z", bookingDuration: 60, bookingCleanupTime: 0, totalAmount: String(count * 20), advanceAmount: "0", status, service, provider, seeker: { id: `customer-${id}`, firstName: name, lastName: "K" }, ...extra }) as unknown as BookingWithDetails;
let records = [booking(1, "confirmed", 2, "Ana", { notes: 'Please reserve a mat.\nLūdzu paklājiņu. Пожалуйста. <img src=x onerror="window.noteExecuted=true">' }), booking(2, "confirmed", 2, "Mark"), booking(3, "pending", 1, "Lina", { notes: "First visit." }), booking(4, "confirmed", 1, "Other", { employeeId: 2 })];
const current = (id: number) => records.find(row => row.id === id)!;
const messages: Record<number, BookingMessage[]> = { 1: [{ id: "00000000-0000-4000-8000-000000000001", bookingId: 1, authorId: provider.id, authorRole: "provider", authorName: "Emma", body: "Please arrive early.", createdAt: "2030-01-15T08:10:00.000Z", broadcastId: null }] };
if (params.has("older")) messages[1].unshift({ ...messages[1][0], id: "00000000-0000-4000-8000-000000000000", body: "Earlier message", createdAt: "2030-01-15T07:00:00.000Z" });
const requests: Record<number, RescheduleRequest[]> = {};
const fixture = { ready: false, writes: [] as { path: string; body: Record<string, any> }[], unexpected: [] as string[], failSend: params.has("fail"), denied: false,
  requests, records: () => records, messages, pro: params.has("pro"),
  refresh: () => queryClient.invalidateQueries({ queryKey: ["booking-collaboration"] }),
  revoke: async () => { queryClient.setQueryData(["/api/company/context"], { ...context, permissions: { manageBookings: false } }); },
};
const request = (id: number, fallback: "keep_original" | "cancel_booking", own = false): RescheduleRequest => ({ id: `10000000-0000-4000-8000-${String(id).padStart(12, "0")}`, bookingId: id, requestedById: own ? customerMode ? customer.id : provider.id : customerMode ? provider.id : customer.id, requestedByRole: own ? customerMode ? "customer" : "provider" : customerMode ? "provider" : "customer", originalScheduledDate: String(current(id).scheduledDate), proposedScheduledDate: "2030-01-17T11:00:00.000Z", fallback, state: "pending", note: "Could we change the time?", timezone: "Europe/Riga", createdAt: "2030-01-15T10:00:00.000Z", respondedAt: null, canRespond: !own, canWithdraw: own, batchId: null });
if (params.has("request")) requests[1] = [request(1, params.get("request") === "cancel" ? "cancel_booking" : "keep_original")];
const context = { company: null, membership: null, workspaces: [], permissions: { manageBookings: !params.has("viewer"), readAll: true } };
Object.assign(window, { phase2Fixture: fixture });
window.fetch = async (input, options = {}) => {
  const path = String(input), method = options.method || "GET", body = options.body ? JSON.parse(String(options.body)) : {};
  if (method !== "GET") fixture.writes.push({ path, body });
  if (path === "/api/bookings/provider" && method === "GET") return Response.json(records);
  if (path === "/api/bookings/seeker" && method === "GET") return Response.json(records.filter(row => row.seekerId === customer.id));
  if (path === "/api/company/context" && method === "GET") return Response.json(context);
  if (path === "/api/provider/employees" && method === "GET") return Response.json([{ id: 1, name: "Emma" }, { id: 2, name: "Alex" }]);
  if (path === "/api/notifications/capabilities" && method === "GET") return Response.json({ hasPro: fixture.pro, automationEnabled: false, channels: {} });
  if (/^\/api\/bookings\/\d+\/notifications$/.test(path) && method === "GET") return Response.json({ notification: { mode: "none" }, reminder: { state: "off" } });
  const available = path.match(/^\/api\/bookings\/(\d+)\/available-times\?/);
  if (available && method === "GET") return Response.json(path.includes("month=") ? { days: [{ date: "2030-01-17", availableSlots: 1 }] } : { slots: [{ startsAt: "2030-01-17T11:00:00.000Z", endsAt: "2030-01-17T12:00:00.000Z", startTime: "11:00", endTime: "12:00", timezone: "UTC", available: true, availableCapacity: 8, slotDuration: 60 }] });
  const match = path.match(/^\/api\/bookings\/(\d+)\/(.*)$/);
  if (match) {
    const id = Number(match[1]), route = match[2];
    if (route === "event/reschedule-requests" && method === "GET") return Response.json({ requests: Object.values(requests).flat() });
    if (route.startsWith("conversation") && method === "GET") {
      if (fixture.denied) return Response.json({ message: "Forbidden" }, { status: 403 });
      const history = messages[id] ?? [];
      return Response.json(params.has("older") ? route.includes("?before=") ? { messages: history.slice(0, -1), nextCursor: null } : { messages: history.slice(-1), nextCursor: history.at(-1)?.id ?? null } : { messages: history, nextCursor: null });
    }
    if (route === "conversation" && method === "POST") {
      if (fixture.failSend) { fixture.failSend = false; return Response.json({ message: "Try again" }, { status: 500 }); }
      const saved = { id: crypto.randomUUID(), bookingId: id, authorId: customerMode ? customer.id : provider.id, authorRole: customerMode ? "customer" : "provider", authorName: customerMode ? "Ana" : "Emma", body: body.body, createdAt: new Date().toISOString(), broadcastId: null } as BookingMessage;
      messages[id] = [...(messages[id] ?? []), saved]; return Response.json(saved);
    }
    if (route === "reschedule-requests" && method === "GET") return Response.json({ requests: requests[id] ?? [] });
    if (route === "reschedule-requests" && method === "POST") { requests[id] = [{ ...request(id, body.fallback, true), proposedScheduledDate: body.scheduledDate, note: body.note }]; return Response.json({ requests: requests[id] }); }
    if (/^reschedule-requests\/[^/]+\/(respond|withdraw)$/.test(route) && method === "POST") {
      const row = requests[id][0];
      row.state = route.endsWith("withdraw") ? "withdrawn" : body.decision === "accept" ? "accepted" : "declined";
      row.canRespond = row.canWithdraw = false;
      if (body.decision === "accept") records = records.map(booking => booking.id === id ? { ...booking, scheduledDate: new Date(row.proposedScheduledDate) } : booking);
      else if (body.decision === "decline" && row.fallback === "cancel_booking") records = records.map(booking => booking.id === id ? { ...booking, status: "cancelled" } : booking);
      return Response.json({ request: row, booking: current(id) });
    }
    if (route === "event/preview" && method === "POST") {
      const active = records.filter(row => row.employeeId === current(id).employeeId && (body.action === "complete" ? row.status === "confirmed" : row.status === "confirmed" || row.status === "pending"));
      return Response.json({ bookingIds: active.map(row => row.id), bookingCount: active.length, participantCount: active.reduce((sum, row) => sum + (row.participantCount ?? 1), 0), hasPro: fixture.pro, recipients: active.map(row => ({ bookingId: row.id, customerName: row.seeker.firstName, status: row.status, participantCount: row.participantCount })) });
    }
    if (route === "event/status" && method === "POST") { records = records.map(row => body.bookingIds.includes(row.id) ? { ...row, status: body.status } : row); return Response.json({ bookings: records.filter(row => body.bookingIds.includes(row.id)) }); }
    if (route === "event/messages" && method === "POST") return fixture.denied ? Response.json({ message: "Forbidden" }, { status: 403 }) : Response.json({ saved: body.bookingIds.length, customerCount: body.bookingIds.length });
    if (route === "event/reschedule-requests" && method === "POST") { for (const bookingId of body.bookingIds) requests[bookingId] = [{ ...request(bookingId, body.fallback, true), proposedScheduledDate: body.scheduledDate }]; return Response.json({ requests: body.bookingIds.flatMap((bookingId: number) => requests[bookingId]) }); }
    if (route === "status" && method === "PATCH") { records = records.map(row => row.id === id ? { ...row, status: body.status } : row); return Response.json(current(id)); }
  }
  fixture.unexpected.push(method + " " + path); throw Error("Unexpected collaboration fixture request");
};
queryClient.setQueryData(["/api/auth/user"], customerMode ? customer : provider);
queryClient.setQueryData(["/api/company/context"], context);
await i18next.use(initReactI18next).init({ lng: params.get("lang") || "en", fallbackLng: false, resources: __FORM_RESOURCES__, interpolation: { escapeValue: false } });
document.documentElement.lang = i18next.language;
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={queryClient}>{customerMode ? <MyBookings /> : <main className="max-w-5xl mx-auto p-4"><AppointmentsPage /></main>}</QueryClientProvider>);
fixture.ready = true;
