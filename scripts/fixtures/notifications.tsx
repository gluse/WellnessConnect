import React, { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../../client/src/lib/queryClient";
import AccountCommunication from "../../client/src/components/account-communication";
import AppointmentsPage from "../../client/src/pages/provider/appointments";
import ServiceEditor from "../../client/src/components/provider/service-editor";
import type { Service } from "../../shared/schema";
import type { CommunicationSettings } from "../../shared/notifications";
declare const __FORM_RESOURCES__: Record<string, { translation: object }>;

const params = new URLSearchParams(location.search), mode = params.get("mode") || "appointments";
const NativeDate = Date, now = NativeDate.UTC(2030, 0, 15, 12);
class FixedDate extends NativeDate {
  constructor(value?: string | number | Date, month?: number, day?: number) { if (month !== undefined) super(Number(value), month, day ?? 1); else super(value === undefined ? now : value instanceof NativeDate ? value.getTime() : value); }
  static now() { return now; }
}
globalThis.Date = FixedDate as DateConstructor;
const user = { id: "synthetic-provider", firstName: "Synthetic", currentRole: "provider" };
const service: Service = { id: 7, providerId: user.id, companyId: null, employeeId: null, createdAt: null, updatedAt: null, imageUrl: null, externalUrl: null, name: "Synthetic service <img src=x onerror=alert(1)>", description: "Synthetic description", category: "education", serviceType: "one_to_one", price: "25", duration: 60, cleanupTime: 0, maxCapacity: 1, ageGroups: [], targetGender: "both", instantBooking: false, advancePaymentPercent: 50, addressId: 3, isActive: true, reminderEnabled: false, reminderMethod: "email", reminderHours: 24, address: "Synthetic saved address", latitude: 0, longitude: 0, locationSource: "manual", locationKey: null, locationPlaceId: null, locationExpiresAt: null, locationAddressSource: "user" };
service.reminderEnabled = params.get("reminder") === "true";
const booking = (id: number, status: string, day: number) => ({ id, serviceId: 7, scheduledDate: `2030-01-${day}T15:00:00Z`, totalAmount: "25", status, service, seeker: { firstName: "Synthetic", lastName: "Customer", email: "customer@example.test" }, provider: user });
let records = [booking(1, "pending", 17), booking(2, "confirmed", 18), booking(3, "cancelled", 19), booking(4, "completed", 14)];
const rescheduleRequests: Record<number, object[]> = {};
let preferences: CommunicationSettings = { phone: params.get("phone") === "empty" ? null : "+37120000000", phoneVerified: params.get("verified") === "true", preferredMethod: "email", smsOptIn: params.get("verified") === "true", whatsappOptIn: params.get("verified") === "true", language: "en", verificationAvailable: true };
const permissions = { manageServices: true, manageSchedules: true, manageBookings: params.get("denied") !== "true", manageTeam: true, isOwner: true, readAll: true };
const context = { company: null, membership: null, permissions, workspaces: [] };
const fixture = { ready: false, pro: params.get("pro") === "true", capabilitiesResult: params.get("capabilities") || "success", stateResult: "success", result: "success", previewResult: "success", verifyResult: "success", automaticState: "queued", reminderState: service.reminderEnabled ? "scheduled" : "off", reminderReasonCode: null as string | null, writes: [] as { path: string; body: Record<string, unknown> }[], unexpected: [] as string[], release: null as (() => void) | null,
  switchUser: () => queryClient.setQueryData(["/api/auth/user"], { ...user, id: "other-account" }),
  revoke: () => queryClient.setQueryData(["/api/company/context"], { ...context, permissions: { ...permissions, manageBookings: false } }),
  switchWorkspace: () => queryClient.setQueryData(["/api/company/context"], { ...context, company: { id: 99 } }),
  preferences: () => preferences,
  bookings: () => records,
  refreshStatus: () => queryClient.invalidateQueries({ predicate: query => /^\/api\/bookings\/\d+\/notifications$/.test(String(query.queryKey[0])) }),
  refreshCapabilities: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications/capabilities"] }),
  setServiceReminder: (enabled: boolean) => {
    service.reminderEnabled = enabled;
    fixture.reminderState = enabled ? "scheduled" : "off";
    records = records.map(record => ({ ...record, service: { ...service } }));
    return queryClient.invalidateQueries({ queryKey: ["/api/bookings/provider"] });
  },
};
Object.assign(window, { phase2Fixture: fixture });
window.fetch = async (input, options = {}) => {
  const path = String(input), method = options.method || "GET", body = options.body ? JSON.parse(String(options.body)) : {};
  if (method !== "GET") fixture.writes.push({ path, body });
  const held = () => new Promise<void>((resolve, reject) => { fixture.release = resolve; options.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true }); });
  if (path === "/api/auth/user") return Response.json(user);
  if (path === "/api/company/context") return Response.json(context);
  if (path === "/api/notifications/capabilities") {
    if (fixture.capabilitiesResult === "pending") await held();
    if (fixture.capabilitiesResult === "error") return Response.json({}, { status: 503 });
    return Response.json({ hasPro: fixture.pro, automationEnabled: true, channels: { email: true, sms: true, whatsapp: true } });
  }
  if (path === "/api/bookings/provider") return Response.json(records);
  const requestPath = path.match(/^\/api\/bookings\/(\d+)\/reschedule-requests$/);
  if (requestPath) {
    const bookingId = Number(requestPath[1]);
    if (method === "GET") return Response.json({ requests: rescheduleRequests[bookingId] ?? [] });
    if (method === "POST") {
      if (fixture.result === "pending") await held();
      if (fixture.result === "error") return Response.json({}, { status: 503 });
      const current = records.find(row => row.id === bookingId)!;
      const request = { id: body.clientRequestId, bookingId, requestedById: user.id, requestedByRole: "provider", originalScheduledDate: current.scheduledDate,
        proposedScheduledDate: body.scheduledDate, fallback: body.fallback, state: "pending", note: body.note || null, timezone: body.timeZone,
        createdAt: new Date(now).toISOString(), respondedAt: null, canRespond: false, canWithdraw: true, batchId: null };
      rescheduleRequests[bookingId] = [request];
      return Response.json({ requests: [request] });
    }
  }
  if (path === "/api/provider/employees" || path === "/api/bookings/seeker") return Response.json([]);
  if (path === "/api/categories") return Response.json([{ key: "education", name: "Synthetic category", icon: "", searchKeywords: "" }]);
  if (path === "/api/addresses") return Response.json([{ id: 3, address: "Synthetic saved address" }]);
  if (path === "/api/services/7" && method === "PATCH") { if (fixture.result === "error") return Response.json({}, { status: 503 }); return Response.json({ ...service, ...body }); }
  if (path === "/api/account/communication") {
    if (method === "PATCH") {
      if (fixture.result === "pending") await held();
      if (fixture.result === "error") return Response.json({}, { status: 503 });
      const changed = body.phone !== preferences.phone;
      preferences = { ...preferences, ...body, ...(changed ? { phoneVerified: false, smsOptIn: false, whatsappOptIn: false, preferredMethod: "email" as const } : {}) };
    }
    return Response.json(preferences);
  }
  if (path.endsWith("/verify/start")) return Response.json({ status: "pending", expiresAt: "2030-01-15T12:10:00Z", nextSendAt: "2030-01-15T12:01:00Z" });
  if (path.endsWith("/verify/check")) { if (fixture.verifyResult === "error") return Response.json({}, { status: 400 }); preferences = { ...preferences, phoneVerified: true }; return Response.json({ status: "verified" }); }
  const state = path.match(/^\/api\/bookings\/(\d+)\/notifications$/);
  if (state) {
    if (fixture.stateResult === "error") return Response.json({}, { status: 503 });
    return Response.json({ notification: { mode: "automatic", state: fixture.automaticState }, reminder: { state: fixture.pro ? fixture.reminderState : service.reminderEnabled ? "paused" : "off", dueAt: "2030-01-17T15:00:00Z", channel: "email", reasonCode: fixture.reminderReasonCode } });
  }
  if (path.endsWith("/notification-preview")) {
    if (fixture.previewResult === "pending") await held();
    if (fixture.previewResult === "error") return Response.json({}, { status: 403 });
    if (fixture.pro && (body.kind !== "reminder" || service.reminderEnabled)) return Response.json({}, { status: 403 });
    const text = `${service.name}\n${body.kind === "reminder" ? "Reminder" : "Status updated"}: 18 January 2030 15:00 (UTC)`, encoded = encodeURIComponent(text);
    return Response.json({ customerName: "Synthetic Customer", subject: "Synthetic booking update", message: text, channels: {
      email: { href: `mailto:customer%2Bbooking%40example.test?subject=Synthetic%20booking&body=${encoded}`, reasonCode: null },
      sms: { href: preferences.phoneVerified && preferences.smsOptIn ? `sms:+37120000000?body=${encoded}` : null, reasonCode: "unverified_phone" },
      whatsapp: { href: preferences.phoneVerified && preferences.whatsappOptIn ? `https://wa.me/37120000000?text=${encoded}` : null, reasonCode: "missing_permission" },
    } });
  }
  const times = path.match(/^\/api\/bookings\/(\d+)\/available-times\?/);
  if (times) { const query = new URL(path, location.origin).searchParams, month = query.get("month"), date = query.get("date"); return Response.json(month ? { days: [{ date: month + "-18", availableSlots: 1 }] } : { slots: [{ startsAt: `${date}T16:00:00Z`, endsAt: `${date}T17:00:00Z`, timezone: query.get("timezone"), startTime: "16:00", endTime: "17:00", available: true, slotDuration: 60 }] }); }
  const mutation = path.match(/^\/api\/bookings\/(\d+)\/(status|reschedule)$/);
  if (mutation && method === "PATCH") {
    if (fixture.result === "pending") await held();
    if (fixture.result === "error") return Response.json({}, { status: 503 });
    records = records.map(row => row.id === Number(mutation[1]) ? { ...row, ...body } : row);
    const updated = records.find(row => row.id === Number(mutation[1]));
    return Response.json({ ...updated, notification: body.status === "completed" || (body.status === "cancelled" && Number(mutation[1]) === 2) ? { mode: "none" } : fixture.pro ? { mode: "automatic", state: fixture.automaticState } : { mode: "manual", eventId: "00000000-0000-4000-8000-000000000001" } });
  }
  fixture.unexpected.push(method + " " + path); throw Error("Unexpected fixture request");
};
queryClient.setQueryData(["/api/auth/user"], user);
queryClient.setQueryData(["/api/company/context"], context);
await i18next.use(initReactI18next).init({ lng: params.get("lang") || "en", fallbackLng: false, resources: __FORM_RESOURCES__, interpolation: { escapeValue: false } });
document.documentElement.lang = i18next.language;
function Fixture() {
  const [actor, setActor] = useState(user.id);
  return <main className="phase2-form max-w-4xl mx-auto p-4"><button id="fixture-switch-account" onClick={() => { preferences = { ...preferences, phone: null, phoneVerified: false, smsOptIn: false, whatsappOptIn: false }; setActor("other-account"); }} className="p-3">Switch fixture account</button>{mode === "account" ? <AccountCommunication key={actor} actorId={actor} /> : mode === "service" ? <ServiceEditor service={service} company={false} employees={[]} /> : <AppointmentsPage />}</main>;
}
createRoot(document.getElementById("root")!).render(<StrictMode><QueryClientProvider client={queryClient}><Fixture /></QueryClientProvider></StrictMode>);
fixture.ready = true;
