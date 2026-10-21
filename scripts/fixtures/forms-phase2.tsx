import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../../client/src/lib/queryClient";
import BookingModal from "../../client/src/components/booking-modal";
import Account from "../../client/src/pages/account";
import type { ServiceWithProvider } from "../../shared/schema";

declare const __FORM_RESOURCES__: Record<string, { translation: object }>;
const NativeDate = Date, fixedNow = NativeDate.UTC(2030, 0, 15, 12);
class FixtureDate extends NativeDate {
  constructor(value?: string | number | Date, month?: number, day?: number, hours?: number, minutes?: number, seconds?: number, milliseconds?: number) {
    if (month !== undefined) super(Number(value), month, day ?? 1, hours ?? 0, minutes ?? 0, seconds ?? 0, milliseconds ?? 0);
    else super(value === undefined ? fixedNow : value instanceof NativeDate ? value.getTime() : value);
  }
  static now() { return fixedNow; }
}
globalThis.Date = FixtureDate as DateConstructor;
const params = new URLSearchParams(location.search);
const user = { id: "synthetic-user", firstName: "Synthetic", lastName: "User", email: "synthetic@example.com", currentRole: "seeker", providerType: "individual" };
const service = {
  id: 7, providerId: "synthetic-provider", name: "Synthetic group session", description: "", category: "education", serviceType: "group", price: "25.00", duration: 45, cleanupTime: 15,
  maxCapacity: 4, ageGroups: ["adults"], targetGender: "both", instantBooking: params.get("instant") === "true", advancePaymentPercent: 30,
  isActive: true, address: "Synthetic address", latitude: 0, longitude: 0, locationSource: "manual",
  provider: { id: "synthetic-provider", firstName: "Synthetic", lastName: "Provider" },
} as ServiceWithProvider;
let addresses = [
  { id: 3, address: "Synthetic saved address", latitude: 0, longitude: 0, locationSource: "manual", locationKey: null, locationExpiresAt: null, locationAddressSource: "user" },
  { id: 4, address: "Synthetic expired address", latitude: null, longitude: null, locationSource: "google", locationKey: "synthetic-expired", locationExpiresAt: "2030-01-14T12:00:00Z", locationAddressSource: "user" },
];
const fixture = {
  ready: false, writes: [] as { path: string; body: Record<string, unknown> }[], unexpected: [] as string[],
  accountResult: "success", passwordResult: "success", addressResult: "success", bookingResult: "success", geocodeResult: "success", availabilityResult: params.get("availability") || "success", removeResult: "error",
  resolve: null as (() => void) | null, geocodes: 0, signedIn: params.get("guest") !== "true",
};
Object.assign(window, { phase2Fixture: fixture });
const held = (signal?: AbortSignal | null) => new Promise<void>((resolve, reject) => {
  fixture.resolve = resolve;
  signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
});
window.fetch = async (input, options = {}) => {
  const path = String(input), method = options.method || "GET";
  const body = options.body ? JSON.parse(String(options.body)) : {};
  if (method !== "GET") fixture.writes.push({ path, body });
  if (path === "/api/auth/user") {
    if (method === "PATCH") {
      if (fixture.accountResult === "pending") await held();
      if (fixture.accountResult === "error") return Response.json({}, { status: 503 });
      if (fixture.accountResult === "unauthorized") return Response.json({}, { status: 401 });
      Object.assign(user, body);
    }
    return Response.json(fixture.signedIn ? user : null);
  }
  if (path === "/api/company/context") return Response.json({ company: null, workspaces: [], permissions: { manageServices: params.get("denied") !== "true", manageBookings: false, manageSchedules: false, manageTeam: false, isOwner: false, readAll: true } });
  if (path === "/api/auth/password") {
    if (fixture.passwordResult === "pending") await held();
    if (fixture.passwordResult === "wrong") return Response.json({ message: "Current password is incorrect." }, { status: 400 });
    if (fixture.passwordResult === "html") return new Response("<html>synthetic response</html>", { headers: { "Content-Type": "text/html" } });
    if (fixture.passwordResult === "unauthorized") return Response.json({}, { status: 401 });
    return Response.json({ success: true, requiresSignIn: false });
  }
  if (path === "/api/geocode") {
    fixture.geocodes++;
    if (fixture.geocodeResult === "pending") await held(options.signal);
    if (fixture.geocodeResult === "error") return Response.json({}, { status: 503 });
    return Response.json({ latitude: 56.95, longitude: 24.1, locationSource: "google", locationKey: "synthetic-key", locationExpiresAt: "2030-01-17T12:00:00Z" });
  }
  if (path === "/api/addresses" && method === "GET") {
    if (params.get("addresses") === "error") return Response.json({}, { status: 503 });
    return Response.json(params.get("addresses") === "empty" ? [] : addresses);
  }
  if ((path === "/api/addresses" && method === "POST") || /^\/api\/addresses\/\d+$/.test(path)) {
    if (method === "DELETE") {
      if (fixture.removeResult === "error") return Response.json({}, { status: 409 });
      addresses = addresses.filter(address => address.id !== Number(path.split("/").at(-1))); return Response.json({});
    }
    if (fixture.addressResult === "pending") await held();
    if (fixture.addressResult === "error") return Response.json({}, { status: 503 });
    if (fixture.addressResult === "forbidden") return Response.json({}, { status: 403 });
    const saved = { ...body, id: method === "POST" ? 10 : Number(path.split("/").at(-1)) } as typeof addresses[number];
    addresses = [...addresses.filter(address => address.id !== saved.id), saved]; return Response.json(saved);
  }
  if (path.startsWith("/api/availability/month/")) {
    if (fixture.availabilityResult === "pending") await held();
    if (fixture.availabilityResult === "error") return Response.json({}, { status: 503 });
    const month = new URL(path, location.origin).searchParams.get("month");
    return Response.json({ days: fixture.availabilityResult === "empty" ? [] : [{ date: month + "-16", availableSlots: 2 }, { date: month + "-17", availableSlots: 2 }] });
  }
  if (path.startsWith("/api/availability/slots/")) {
    const url = new URL(path, location.origin), date = url.searchParams.get("date"), timezone = url.searchParams.get("timezone") || "UTC";
    return Response.json({ slots: ["10", "11"].map(hour => {
      const start = new Date(date + "T" + hour + ":00:00Z"), end = new Date(start.getTime() + 45 * 60000);
      const time = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
      return { startsAt: start.toISOString(), endsAt: end.toISOString(), startTime: time.format(start), endTime: time.format(end), timezone, available: true, slotDuration: 45 };
    }) });
  }
  if (path === "/api/bookings" && method === "POST") {
    if (fixture.bookingResult === "pending") await held();
    if (fixture.bookingResult === "conflict") return Response.json({}, { status: 409 });
    if (fixture.bookingResult === "error") return Response.json({ message: "<img src=x onerror=alert(1)>" }, { status: 503 });
    if (fixture.bookingResult === "forbidden") return Response.json({}, { status: 403 });
    return Response.json({ id: 12, ...body, status: service.instantBooking ? "confirmed" : "pending" });
  }
  if (path === "/api/bookings/seeker" || path === "/api/bookings/provider") return Response.json([]);
  fixture.unexpected.push(method + " " + path); throw new Error("Unexpected synthetic request");
};
await i18next.use(initReactI18next).init({ lng: params.get("lang") || "en", fallbackLng: false, resources: __FORM_RESOURCES__, interpolation: { escapeValue: false } });
function Fixture() {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [dark, setDark] = useState(false);
  useEffect(() => { fixture.ready = true; }, []);
  useEffect(() => { document.documentElement.classList.toggle("dark", dark); }, [dark]);
  return <div className="bg-background text-foreground min-h-screen">
    <nav aria-label="Fixture controls" className="flex flex-wrap gap-4 p-4 border-b">
      <label>Fixture language<select id="fixture-language" value={i18next.language} onChange={event => void i18next.changeLanguage(event.target.value)}>{Object.keys(__FORM_RESOURCES__).map(language => <option key={language}>{language}</option>)}</select></label>
      <button type="button" onClick={() => setDark(previous => !previous)}>Toggle fixture theme</button>
      <button type="button" onClick={() => fixture.resolve?.()}>Resolve fixture request</button>
    </nav>
    {params.get("mode") === "booking" ? <main className="p-4"><button type="button" id="open-booking" className="border rounded-lg p-3" onClick={() => setBookingOpen(true)}>Open booking</button>
      {bookingOpen && <BookingModal service={service} onClose={() => setBookingOpen(false)} />}
    </main> : <Account />}
  </div>;
}
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={queryClient}><Fixture /></QueryClientProvider>);
