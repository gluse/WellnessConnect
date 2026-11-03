import React from "react";
import { createRoot } from "react-dom/client";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../../client/src/lib/queryClient";
import MyServices from "../../client/src/pages/my-services";
import MyBookings from "../../client/src/pages/my-bookings";
import { Toaster } from "../../client/src/components/ui/toaster";
import type { BookingWithDetails, WorkspaceContext } from "../../shared/schema";

declare const __FORM_RESOURCES__: Record<string, { translation: object }>;
const NativeDate = Date, now = NativeDate.UTC(2026, 10, 3, 11, 20);
class FixedDate extends NativeDate {
  constructor(value?: string | number | Date, month?: number, day?: number, hour?: number, minute?: number, second?: number, millisecond?: number) {
    if (month !== undefined) super(Number(value), month, day ?? 1, hour ?? 0, minute ?? 0, second ?? 0, millisecond ?? 0);
    else super(value === undefined ? now : value instanceof NativeDate ? value.getTime() : value);
  }
  static now() { return now; }
}
globalThis.Date = FixedDate as DateConstructor;
const params = new URLSearchParams(location.search), customer = location.pathname === "/my-bookings";
const user = { id: "synthetic-actor", firstName: "Anna", lastName: "Kalniņa", currentRole: customer ? "seeker" : "provider" };
let context: WorkspaceContext = { company: null, membership: null, workspaces: [], invalid: false, permissions: { manageCompany: true, manageTeam: true, manageServices: true, manageSchedules: true, manageBookings: !params.has("readonly"), readAll: true, isOwner: true } };
const booking = (id: number, date: string, duration: number, status: string, name: string, employeeId = 1, group = false): BookingWithDetails => ({
  id, seekerId: user.id, serviceId: group ? 3 : id, providerId: user.id, companyId: null, employeeId,
  scheduledDate: date, status, totalAmount: "30", participantCount: id === 4 ? 2 : 1, bookingDuration: duration,
  service: { id: group ? 3 : id, name, duration, serviceType: group ? "group" : "one_to_one", maxCapacity: 8, reminderEnabled: false },
  provider: { id: "synthetic-provider", firstName: "Amber", lastName: "Wellness" }, seeker: { ...user, firstName: id === 4 ? "Lina" : "Anna" },
  notes: id === 2 ? "Synthetic note\n<script>window.untrustedExecuted = true</script>" : null,
} as unknown as BookingWithDetails);
let records = [
  booking(1, "2026-11-02T09:00:00Z", 60, "confirmed", "Wellness massage"),
  booking(2, "2026-11-03T13:00:00Z", 60, "pending", "Facial treatment"),
  booking(3, "2026-11-03T10:00:00Z", 60, "confirmed", "Morning yoga", 1, true),
  booking(4, "2026-11-03T10:00:00Z", 60, "pending", "Morning yoga", 1, true),
  booking(5, "2026-11-03T13:15:00Z", 60, "confirmed", "Deep tissue massage"),
  booking(6, "2026-11-03T13:30:00Z", 60, "confirmed", "Sauna ritual", 2),
  booking(7, "2026-11-03T14:30:00Z", 15, "confirmed", "Consultation", 2),
  booking(8, "2026-11-02T23:30:00Z", 120, "confirmed", "Late treatment"),
  booking(9, "2026-11-04T09:00:00Z", 180, "confirmed", "Spa ritual"),
  booking(10, "2026-11-06T08:00:00Z", 30, "cancelled", "Cancelled appointment"),
  booking(11, "2026-11-02T14:00:00Z", 30, "completed", "Completed appointment"),
];
const fixture = { ready: false, state: params.get("state") || "success", unexpected: [] as string[], mutations: [] as { method: string; path: string; body: unknown }[],
  failMutation: false, holdMutation: false, release: null as (() => void) | null,
  refresh: () => queryClient.invalidateQueries({ queryKey: [customer ? "/api/bookings/seeker" : "/api/bookings/provider"] }),
  switchWorkspace() { records = []; context = { ...context, company: { id: 99, name: "Other workspace" } as WorkspaceContext["company"] }; queryClient.setQueryData(["/api/company/context"], context); },
};
Object.assign(window, { phase2Fixture: fixture });
window.fetch = async (input, options = {}) => {
  const path = String(input), method = options.method || "GET";
  if (method === "GET") {
    const locale = path.match(/^\/locales\/(en|lv|ru)\/translation.json$/);
    if (locale) return Response.json(__FORM_RESOURCES__[locale[1]].translation);
    if (path === "/api/admin/access") return Response.json({ isAdmin: false });
    if (path === "/api/auth/user") return Response.json(user);
    if (path === "/api/company/context") return Response.json(context);
    if (path === "/api/bookings/provider" || path === "/api/bookings/seeker") {
      if (fixture.state === "loading") await new Promise<void>(resolve => { fixture.release = resolve; });
      if (fixture.state === "error") return Response.json({}, { status: 503 });
      return Response.json(fixture.state === "empty" ? [] : records);
    }
    if (path === "/api/provider/employees") return Response.json([{ id: 1, name: "Mara" }, { id: 2, name: "Laura" }]);
    if (path === "/api/notifications/capabilities") return Response.json({ hasPro: true, automationEnabled: false, channels: { email: false, sms: false, whatsapp: false } });
    if (/^\/api\/bookings\/\d+\/notifications$/.test(path)) return Response.json({ notification: { mode: "none" }, reminder: { state: "off" } });
    if (/^\/api\/bookings\/\d+\/(event\/)?reschedule-requests$/.test(path)) return Response.json({ requests: [] });
    if (/^\/api\/bookings\/\d+\/conversation/.test(path)) return Response.json({ messages: [], nextCursor: null });
    if (/^\/api\/services\/\d+\/availability/.test(path)) return Response.json({ days: [], slots: [], timezone: "UTC" });
    if (/^\/api\/bookings\/\d+\/available-times/.test(path)) return Response.json({ days: [], slots: [], timezone: "UTC" });
    if (/^\/api\/bookings\/\d+\/event-preview$/.test(path)) return Response.json({ bookingIds: [3, 4], bookingCount: 2, participantCount: 3, hasPro: true, recipients: [] });
  }
  const match = path.match(/^\/api\/bookings\/(\d+)\/status$/);
  if (method === "PATCH" && match) {
    const body = JSON.parse(String(options.body)); fixture.mutations.push({ method, path, body });
    if (fixture.holdMutation) await new Promise<void>(resolve => { fixture.release = resolve; });
    if (fixture.failMutation) return Response.json({ message: "Synthetic failure" }, { status: 503 });
    const record = records.find(row => row.id === Number(match[1]))!;
    record.status = body.status; return Response.json(record);
  }
  fixture.unexpected.push(`${method} ${path}`); throw Error(`Unexpected isolated calendar request: ${method} ${path}`);
};
const language = params.get("lang") || "en";
localStorage.setItem("i18nextLng", language);
await i18next.use(initReactI18next).init({ lng: language, fallbackLng: "en", resources: __FORM_RESOURCES__, interpolation: { escapeValue: false } });
const { default: AppHeader } = await import("../../client/src/components/app-header");
await i18next.changeLanguage(language); document.documentElement.lang = i18next.language;
queryClient.setQueryData(["/api/auth/user"], user); queryClient.setQueryData(["/api/company/context"], context);
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={queryClient}><AppHeader />{customer ? <MyBookings /> : <MyServices />}<Toaster /></QueryClientProvider>);
fixture.ready = true;
