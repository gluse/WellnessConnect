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
const NativeDate = Date, now = NativeDate.UTC(2030, 0, 15, 12);
class FixedDate extends NativeDate {
  constructor(value?: string | number | Date, month?: number, day?: number) { if (month !== undefined) super(Number(value), month, day ?? 1); else super(value === undefined ? now : value instanceof NativeDate ? value.getTime() : value); }
  static now() { return now; }
}
globalThis.Date = FixedDate as DateConstructor;
const params = new URLSearchParams(location.search), customerMode = location.pathname === "/my-bookings";
const user = { id: "synthetic-actor", firstName: "Anna", lastName: "Kalnina", currentRole: customerMode ? "seeker" : "provider" };
const context: WorkspaceContext = { company: null, membership: null, workspaces: [], invalid: false, permissions: { manageCompany: true, manageTeam: true, manageServices: true, manageSchedules: true, manageBookings: true, readAll: true, isOwner: true } };
const booking = (id: number, date: string, status: string, group = false): BookingWithDetails => ({
  id, seekerId: user.id, serviceId: group ? 3 : id, providerId: user.id, companyId: null, employeeId: null,
  scheduledDate: date, status, totalAmount: group ? "20" : id === 1 ? "210" : "80", participantCount: 1, bookingDuration: group ? 60 : 180,
  service: { id: group ? 3 : id, name: group ? "Morning yoga" : id === 1 ? "Sauna ritual" : "Wellness massage", duration: group ? 60 : 180, serviceType: group ? "group" : "one_to_one", maxCapacity: 8, reminderEnabled: false },
  provider: { id: "synthetic-provider", firstName: "Amber", lastName: "Wellness" }, seeker: user,
} as unknown as BookingWithDetails);
const records = [booking(1, "2030-01-16T10:30:00Z", "confirmed"), booking(2, "2030-01-17T14:00:00Z", "pending"), booking(3, "2030-01-18T09:00:00Z", "confirmed", true), booking(4, "2030-01-18T09:00:00Z", "pending", true), booking(5, "2030-01-14T09:00:00Z", "cancelled")];
const fixture = { ready: false, state: params.get("state") || "success", unexpected: [] as string[], release: null as (() => void) | null,
  refresh: () => queryClient.invalidateQueries({ queryKey: [customerMode ? "/api/bookings/seeker" : "/api/bookings/provider"] }),
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
    if (path === "/api/provider/employees") return Response.json([]);
    if (path === "/api/notifications/capabilities") return Response.json({ hasPro: true, automationEnabled: false, channels: { email: false, sms: false, whatsapp: false } });
    if (/^\/api\/bookings\/\d+\/notifications$/.test(path)) return Response.json({ notification: { mode: "none" }, reminder: { state: "off" } });
    if (/^\/api\/bookings\/\d+\/(event\/)?reschedule-requests$/.test(path)) return Response.json({ requests: [] });
  }
  fixture.unexpected.push(`${method} ${path}`);
  throw Error(`Unexpected read-only layout fixture request: ${method} ${path}`);
};
const language = params.get("lang") || "en";
localStorage.setItem("i18nextLng", language);
await i18next.use(initReactI18next).init({ lng: language, fallbackLng: "en", resources: __FORM_RESOURCES__, interpolation: { escapeValue: false } });
const { default: AppHeader } = await import("../../client/src/components/app-header");
await i18next.changeLanguage(language);
document.documentElement.lang = i18next.language;
queryClient.setQueryData(["/api/auth/user"], user);
queryClient.setQueryData(["/api/company/context"], context);
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={queryClient}>
  <AppHeader />
  {customerMode ? <MyBookings /> : <MyServices />}<Toaster />
</QueryClientProvider>);
fixture.ready = true;
