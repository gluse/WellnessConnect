import React from "react";
import { createRoot } from "react-dom/client";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../../client/src/lib/queryClient";
import BookingModal from "../../client/src/components/booking-modal";
import type { ServiceWithProvider } from "../../shared/schema";

declare const __FORM_RESOURCES__: Record<string, { translation: object }>;
const NativeDate = Date, now = NativeDate.UTC(2030, 0, 15, 12);
class FixtureDate extends NativeDate {
  constructor(value?: string | number | Date, month?: number, day?: number, hours?: number, minutes?: number, seconds?: number, milliseconds?: number) {
    if (month !== undefined) super(Number(value), month, day ?? 1, hours ?? 0, minutes ?? 0, seconds ?? 0, milliseconds ?? 0);
    else super(value === undefined ? now : value instanceof NativeDate ? value.getTime() : value);
  }
  static now() { return now; }
}
globalThis.Date = FixtureDate as DateConstructor;
const params = new URLSearchParams(location.search);
const user = { id: "synthetic-customer", firstName: "Synthetic", currentRole: "seeker" };
const service = {
  id: 7, providerId: "synthetic-provider", name: "Synthetic group session", serviceType: params.get("type") || "group", maxCapacity: 6,
  price: "25.00", duration: 45, cleanupTime: 15, isActive: true, locationSource: "manual",
  instantBooking: params.get("instant") === "true", advancePaymentPercent: 0,
  provider: { id: "synthetic-provider", firstName: "Synthetic", lastName: "Provider" },
} as ServiceWithProvider;
const fixture = {
  ready: false, capacity: 4 as number | null, reads: [] as string[], writes: [] as { path: string; body: Record<string, unknown> }[], unexpected: [] as string[],
  closed: 0, bookingResult: "success", checkResult: "success",
  existingBookings: [] as { serviceId: number; seekerId: string; scheduledDate: string; status: string }[],
  releaseCheck: () => {},
  switchUser: (id: string) => queryClient.setQueryData(["/api/auth/user"], { ...user, id }),
  refreshCapacity: async (capacity: number | null) => {
    fixture.capacity = capacity;
    await queryClient.invalidateQueries({ predicate: query => String(query.queryKey[0]).startsWith("/api/availability/") });
  },
};
Object.assign(window, { phase2Fixture: fixture });
window.fetch = async (input, options = {}) => {
  const path = String(input), method = options.method || "GET";
  if (method === "GET") fixture.reads.push(path);
  if (path === "/api/auth/user" && method === "GET") return Response.json(user);
  if (path === "/api/bookings/seeker" && method === "GET") {
    if (fixture.checkResult === "pending") await new Promise<void>(resolve => { fixture.releaseCheck = resolve; });
    if (fixture.checkResult === "error") return Response.json({}, { status: 503 });
    if (fixture.checkResult === "invalid") return Response.json({});
    return Response.json(fixture.existingBookings);
  }
  if (path.startsWith("/api/availability/month/7?") && method === "GET") {
    return Response.json({ days: [{ date: "2030-01-16", availableSlots: fixture.capacity === 0 ? 0 : 1 }] });
  }
  if (path.startsWith("/api/availability/slots/7?") && method === "GET") {
    const slot = {
      startsAt: "2030-01-16T09:00:00.000Z", endsAt: "2030-01-16T09:45:00.000Z", startTime: "09:00", endTime: "09:45", timezone: "UTC", available: true, slotDuration: 45,
      ...(fixture.capacity === null ? {} : { availableCapacity: fixture.capacity }),
    };
    return Response.json({ slots: fixture.capacity === 0 ? [] : [slot, ...(params.has("duplicates") ? [{ ...slot, startsAt: "2030-01-16T10:00:00.000Z", endsAt: "2030-01-16T10:45:00.000Z", startTime: "10:00", endTime: "10:45" }] : [])] });
  }
  if (path === "/api/bookings" && method === "POST") {
    const body = JSON.parse(String(options.body));
    fixture.writes.push({ path, body });
    if (fixture.bookingResult === "error") return Response.json({}, { status: 503 });
    return Response.json({ id: 1, status: service.instantBooking ? "confirmed" : "pending", ...body });
  }
  fixture.unexpected.push(method + " " + path);
  throw Error("Unexpected fixture request");
};
queryClient.setQueryData(["/api/auth/user"], user);
await i18next.use(initReactI18next).init({ lng: params.get("lang") || "en", fallbackLng: false, resources: __FORM_RESOURCES__, interpolation: { escapeValue: false } });
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={queryClient}><BookingModal service={service} onClose={() => { fixture.closed++; }} /></QueryClientProvider>);
fixture.ready = true;
