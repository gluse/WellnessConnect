import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../../client/src/lib/queryClient";
import BookingModal from "../../client/src/components/booking-modal";
import AppointmentsPage from "../../client/src/pages/provider/appointments";
import MyBookings from "../../client/src/pages/my-bookings";
import type { BookingWithDetails, ServiceWithProvider } from "../../shared/schema";
import type { BookingMessage } from "../../shared/appointment-collaboration";

declare const __FORM_RESOURCES__: Record<string, { translation: object }>;
const NativeDate = Date, now = NativeDate.UTC(2030, 0, 15, 12);
class FixedDate extends NativeDate {
  constructor(value?: string | number | Date, month?: number, day?: number) {
    if (month !== undefined) super(Number(value), month, day ?? 1);
    else super(value === undefined ? now : value instanceof NativeDate ? value.getTime() : value);
  }
  static now() { return now; }
}
globalThis.Date = FixedDate as DateConstructor;
const params = new URLSearchParams(location.search);
const customer = { id: "synthetic-customer", firstName: "Synthetic", lastName: "Customer" };
const provider = { id: "synthetic-provider", firstName: "Synthetic", lastName: "Provider" };
const service = {
  id: 7, providerId: provider.id, name: "Synthetic notes appointment", serviceType: params.get("type") || "one_to_one",
  maxCapacity: 6, price: "25.00", duration: 45, cleanupTime: 0, isActive: true, locationSource: "manual",
  instantBooking: params.has("instant"), advancePaymentPercent: 0, provider, reminderEnabled: false,
} as ServiceWithProvider;
const context = { company: null, workspaces: [], permissions: { manageBookings: !params.has("viewer"), readAll: !params.has("viewer") } };
let records: BookingWithDetails[] = [];
let messages: BookingMessage[] = [];
const fixture = {
  ready: false, reads: [] as string[], writes: [] as { path: string; body: Record<string, unknown> }[], unexpected: [] as string[],
  failBooking: false, failReply: false,
  replaceNotes: async (notes: string | null) => {
    records = records.map(row => ({ ...row, notes }));
    await queryClient.invalidateQueries({ queryKey: ["/api/bookings/provider"] });
  },
};
Object.assign(window, { phase2Fixture: fixture });
window.fetch = async (input, options = {}) => {
  const path = String(input), method = options.method || "GET";
  if (method === "GET") fixture.reads.push(path);
  if (path === "/api/bookings/seeker" && method === "GET") return Response.json(records);
  if (path === "/api/bookings/provider" && method === "GET") return Response.json(records);
  if (path === "/api/company/context" && method === "GET") return Response.json(context);
  if (path === "/api/provider/employees" && method === "GET") return Response.json([]);
  if (path === "/api/notifications/capabilities" && method === "GET") return Response.json({ hasPro: false, automationEnabled: false, channels: { email: false, sms: false, whatsapp: false } });
  if (path === "/api/bookings/1/notifications" && method === "GET") return Response.json({ notification: { mode: "none" }, reminder: { state: "off" } });
  if (/^\/api\/bookings\/\d+\/(event\/)?reschedule-requests$/.test(path) && method === "GET") return Response.json({ requests: [] });
  if (path.startsWith("/api/availability/month/7?") && method === "GET") return Response.json({ days: [{ date: "2030-01-16", availableSlots: 1 }] });
  if (path.startsWith("/api/availability/slots/7?") && method === "GET") return Response.json({ slots: [{ startsAt: "2030-01-16T09:00:00.000Z", endsAt: "2030-01-16T09:45:00.000Z", startTime: "09:00", endTime: "09:45", timezone: "UTC", available: true, availableCapacity: 6, slotDuration: 45 }] });
  if (path === "/api/bookings/1/conversation" && method === "GET") return Response.json({ messages, nextCursor: null });
  if (path === "/api/bookings/1/conversation" && method === "POST") {
    const body = JSON.parse(String(options.body)); fixture.writes.push({ path, body });
    if (fixture.failReply) { fixture.failReply = false; return Response.json({}, { status: 503 }); }
    const actor = queryClient.getQueryData<{ id: string }>(["/api/auth/user"]);
    const providerAuthor = actor?.id === provider.id;
    const message: BookingMessage = { id: crypto.randomUUID(), bookingId: 1, authorId: actor!.id, authorRole: providerAuthor ? "provider" : "customer", authorName: providerAuthor ? "Synthetic Provider" : "Synthetic Customer", body: body.body, createdAt: new Date().toISOString(), broadcastId: null };
    messages.push(message); return Response.json(message);
  }
  if (path === "/api/bookings" && method === "POST") {
    const body = JSON.parse(String(options.body));
    fixture.writes.push({ path, body });
    if (fixture.failBooking) { fixture.failBooking = false; return Response.json({}, { status: 503 }); }
    records = [{ ...body, notes: null, id: 1, service, seekerId: customer.id, providerId: provider.id, seeker: customer, provider, totalAmount: "25", status: service.instantBooking ? "confirmed" : "pending" }];
    messages = body.initialMessage ? [{ id: crypto.randomUUID(), bookingId: 1, authorId: customer.id, authorRole: "customer", authorName: "Synthetic Customer", body: body.initialMessage, createdAt: new Date().toISOString(), broadcastId: null }] : [];
    return Response.json(records[0]);
  }
  fixture.unexpected.push(method + " " + path); throw Error("Unexpected fixture request");
};
queryClient.setQueryData(["/api/auth/user"], customer);
await i18next.use(initReactI18next).init({ lng: params.get("lang") || "en", fallbackLng: false, resources: __FORM_RESOURCES__, interpolation: { escapeValue: false } });
document.documentElement.lang = i18next.language;
function Fixture() {
  const [mode, setMode] = useState("booking");
  return <main className="phase2-form max-w-4xl mx-auto p-4 space-y-4">
    <button id="fixture-provider-view" className="p-3" onClick={() => {
      queryClient.setQueryData(["/api/auth/user"], provider);
      queryClient.setQueryData(["/api/company/context"], context);
      setMode("provider");
    }}>Open provider fixture</button>
    <button id="fixture-customer-view" className="p-3" onClick={() => { queryClient.setQueryData(["/api/auth/user"], customer); setMode("customer"); }}>Open customer fixture</button>
    {mode === "booking" ? <BookingModal service={service} onClose={() => setMode("booked")} /> : mode === "provider" ? <AppointmentsPage view="upcoming" /> : mode === "customer" ? <MyBookings /> : null}
  </main>;
}
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={queryClient}><Fixture /></QueryClientProvider>);
fixture.ready = true;
