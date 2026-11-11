import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../../client/src/lib/queryClient";
import type { Availability, BookingWithDetails, Service, User } from "../../shared/schema";
import AvailabilityEditor from "../../client/src/components/availability-editor";
import ServiceImageGallery from "../../client/src/components/service-image-gallery";
import AppointmentAgenda from "../../client/src/components/appointment-agenda";
import AccountMenu from "../../client/src/components/account-menu";
import { InboxList } from "../../client/src/components/inbox";

declare const __FORM_RESOURCES__: Record<string, { translation: object }>;
const params = new URLSearchParams(location.search), mode = params.get("mode") || "availability";
const image = (color: string) => "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="${color}"/></svg>`);
const base: Availability = { id: 1, providerId: "provider", companyId: null, serviceId: null, scheduleType: "recurring", daysOfWeek: [1], startTime: "09:00", endTime: "17:00", timezone: "Europe/Riga", breaks: [], recurrenceEndType: "never", recurrenceEndValue: null, isActive: true, createdAt: null, updatedAt: null, specificDate: null, slotDuration: 60 };
let rows: Availability[] = [base];
let refresh = () => {};
const fixture = { ready: true, writes: [] as { path: string; body: any }[], unexpected: [] as string[], result: "success", release: null as (() => void) | null, refresh: () => refresh(),
  language: (language: string) => i18next.changeLanguage(language) };
Object.assign(window, { phase2Fixture: fixture, followupFixture: fixture });
const user = { id: "synthetic-user", firstName: "Synthetic", profileImageUrl: params.get("avatar") } as User;
queryClient.setQueryData(["/api/auth/user"], user);
queryClient.setQueryData(["/api/company/context"], { company: null, workspaces: [], permissions: {}, invalid: false });
window.fetch = async (input, options = {}) => {
  const path = String(input), method = options.method || "GET";
  const body = options.body ? JSON.parse(String(options.body)) : {};
  if (method !== "GET") {
    fixture.writes.push({ path, body });
    if (fixture.result === "pending") await new Promise<void>(resolve => { fixture.release = resolve; });
    if (fixture.result === "error") return Response.json({}, { status: 503 });
  }
  if (path === "/api/availability/weekly") {
    rows = rows.filter(row => row.serviceId !== body.serviceId || row.scheduleType !== "recurring");
    if (!body.inherit) {
      for (const day of body.days) for (const range of day.intervals) rows.push({ ...base, ...range, serviceId: body.serviceId, daysOfWeek: [day.day], timezone: body.timezone, recurrenceEndType: body.recurrenceEndType, recurrenceEndValue: body.recurrenceEndValue });
      if (!body.days.some((day: any) => day.intervals.length)) rows.push({ ...base, serviceId: body.serviceId, timezone: body.timezone, daysOfWeek: [], startTime: "00:00", endTime: "00:00" });
    }
    return Response.json({});
  }
  if (path === "/api/availability/override") {
    rows = rows.filter(row => row.serviceId !== body.serviceId || row.scheduleType !== "specific" || !String(row.specificDate).startsWith(body.date));
    for (const range of body.intervals.length ? body.intervals : [{ startTime: "00:00", endTime: "00:00" }]) rows.push({ ...base, ...range, serviceId: body.serviceId, scheduleType: "specific", specificDate: body.date + "T00:00:00Z", timezone: body.timezone });
    return Response.json({});
  }
  if (path === "/api/auth/user") return Response.json(user);
  if (path === "/api/admin/access") return Response.json({ isAdmin: false });
  if (path === "/api/admin/audit/access") return Response.json({ canRead: false });
  if (path.startsWith("/api/inbox/notifications/read?")) return Response.json({});
  if (path.startsWith("/api/inbox/notifications?")) return Response.json({ items: [{ id: "service-change:1", revision: 1, serviceId: 7, bookingId: 10, kind: "service_changes", serviceName: "Synthetic conference", available: !params.has("unavailable"), count: 1, reportingDay: "2026-11-11", read: false }], nextCursor: null });
  fixture.unexpected.push(`${method} ${path}`); throw Error(`Unexpected fixture request ${method} ${path}`);
};
await i18next.use(initReactI18next).init({ lng: params.get("lang") || "en", fallbackLng: false, resources: __FORM_RESOURCES__, interpolation: { escapeValue: false } });
function AvailabilityFixture() {
  const [schedules, setSchedules] = useState(rows);
  refresh = () => setSchedules([...rows]);
  queryClient.invalidateQueries = async () => { refresh(); };
  return <AvailabilityEditor services={[{ id: 7, name: "Synthetic conference" } as Service]} schedules={schedules} />;
}
const bookings = ["completed", "cancelled"].map((status, i) => ({ id: 10 + i, serviceId: 7, scheduledDate: "2026-01-01T10:00:00Z", status, totalAmount: "20.00", currency: "EUR", service: { name: "Synthetic conference", duration: 60 }, provider: { firstName: "Synthetic", lastName: "Provider" } })) as unknown as BookingWithDetails[];
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={queryClient}><main className="max-w-3xl p-4 mx-auto">
  {mode === "availability" ? <AvailabilityFixture /> : mode === "gallery" ? <ServiceImageGallery service={{ name: "Synthetic conference", imageUrls: [image("#315d50"), image("#c7d9c5"), "data:image/png;base64,broken"] }} /> : mode === "bookings" ? <AppointmentAgenda bookings={bookings} fixedView="past" /> : mode === "avatar" ? <div className="bg-slate-800 p-3 text-white"><AccountMenu /></div> : <InboxList kind="notifications" />}
</main></QueryClientProvider>);
