import React from "react";
import { createRoot } from "react-dom/client";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../../client/src/lib/queryClient";
import MyBookings from "../../client/src/pages/my-bookings";
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
const user = { id: "customer", firstName: "Synthetic", currentRole: "seeker" };
const booking = (id: number, status: string, date: string, seekerId = user.id) => ({
  id, seekerId, serviceId: 7, providerId: "provider", status, scheduledDate: date, totalAmount: "25.00", bookingDuration: 45,
  service: { name: `Synthetic service ${id}`, duration: 45 }, provider: { firstName: "Synthetic", lastName: "Provider" },
});
let records = [booking(1,"confirmed","2030-01-16T09:00:00Z"), booking(2,"pending","2030-01-17T09:00:00Z"), booking(3,"completed","2030-01-14T09:00:00Z"), booking(4,"cancelled","2030-01-18T09:00:00Z"), booking(5,"confirmed","2030-01-14T09:00:00Z"), booking(6,"confirmed","2030-01-19T09:00:00Z","someone-else")];
const fixture = { ready: false, result: "success", refreshError: false, writes: [] as {path: string; body: Record<string, unknown>}[], unexpected: [] as string[], reads: [] as string[], resolve: null as (() => void) | null, slotVersion: 0, switchUser: () => queryClient.setQueryData(["/api/auth/user"], { ...user, id: "other-customer" }), logout: () => queryClient.setQueryData(["/api/auth/user"], null), cache: () => queryClient.getQueryData(["/api/bookings/seeker"]), providerInvalidated: () => queryClient.getQueryState(["/api/bookings/provider"])?.isInvalidated };
Object.assign(window, { phase2Fixture: fixture });
window.fetch = async (input, options = {}) => {
  const path = String(input), method = options.method || "GET";
  if (method === "GET") fixture.reads.push(path);
  else fixture.writes.push({path, body: JSON.parse(String(options.body))});
  if (path === "/api/auth/user") return Response.json(user);
  if (path === "/api/bookings/seeker") return fixture.refreshError ? Response.json({}, {status:503}) : Response.json(records);
  if (path === "/api/company/context") return Response.json({ company: null, workspaces: [], permissions: {} });
  const available = path.match(/^\/api\/bookings\/(\d+)\/available-times\?/);
  if (available) {
    const url = new URL(path, location.origin), month = url.searchParams.get("month"), date = url.searchParams.get("date"), timezone = url.searchParams.get("timezone");
    if (month) return Response.json({ days: [{date: month+"-16",availableSlots:2},{date:month+"-17",availableSlots:2}] });
    return Response.json({slots: (fixture.slotVersion ? ["11","12"] : ["10","11"]).map(hour => ({startsAt: `${date}T${hour}:00:00.000Z`,endsAt: `${date}T${hour}:45:00.000Z`,startTime: `${hour}:00`,endTime: `${hour}:45`, timezone, available: true, slotDuration:45}))});
  }
  const mutation = path.match(/^\/api\/bookings\/(\d+)\/(status|reschedule)$/);
  if (mutation && method === "PATCH") {
    if (fixture.result === "pending") await new Promise<void>(resolve => {fixture.resolve = resolve;});
    if (fixture.result === "unauthorized") return Response.json({}, {status:401});
    if (fixture.result === "denied") return Response.json({}, {status:403});
    if (fixture.result === "conflict") { fixture.slotVersion++; return Response.json({}, {status:409}); }
    if (fixture.result === "error") return Response.json({message:"<img src=x onerror=alert(1)>"}, {status:503});
    const body = JSON.parse(String(options.body));
    records = records.map(row => row.id === Number(mutation[1]) ? {...row, ...body} : row);
    return Response.json(records.find(row => row.id === Number(mutation[1])));
  }
  fixture.unexpected.push(method+" "+path); throw Error("Unexpected fixture request");
};
queryClient.setQueryData(["/api/auth/user"], user);
queryClient.setQueryData(["/api/bookings/provider"], []);
await i18next.use(initReactI18next).init({ lng: new URLSearchParams(location.search).get("lang") || "en", fallbackLng: false, resources: __FORM_RESOURCES__, interpolation: {escapeValue:false} });
document.documentElement.lang = i18next.language;
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={queryClient}><MyBookings /></QueryClientProvider>);
fixture.ready = true;
