import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import React from "react";
import renderer from "react-test-renderer";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { bookableSlots } from "../shared/scheduling.ts";
import { insertServiceSchema } from "../shared/schema.ts";
import { createServiceDraft } from "../client/src/components/provider/service-draft.ts";

const date = "2099-06-04", at = time => new Date(`${date}T${time}:00Z`);
const service = { id: 1, providerId: "provider", companyId: null, employeeId: null, name: "Massage", price: "30", category: "education", serviceType: "one_to_one", duration: 30, cleanupTime: 15, isActive: true, companyActive: true, address: "Riga, Latvia", latitude: 56.95, longitude: 24.1, locationSource: "manual" };
const schedule = { serviceId: null, scheduleType: "specific", specificDate: at("00:00"), startTime: "09:00", endTime: "12:00", timezone: "UTC", breaks: [], isActive: true };
const busy = { id: 1, scheduledDate: at("09:00"), bookingDuration: 30, bookingCleanupTime: 15, status: "confirmed" };
const slots = (overrides = {}) => bookableSlots({ service, schedules: [schedule], bookings: [], date, timezone: "UTC", now: new Date("2099-01-01"), ...overrides });
const starts = overrides => slots(overrides).map(slot => slot.startTime);
assert.equal(starts().at(-1), "11:15", "Cleanup must finish by closing time");
assert.equal(slots()[0].endsAt, at("09:30").toISOString(), "Customer duration excludes cleanup");
assert.equal(slots()[0].slotDuration, 30);
assert.equal(starts({ service: { ...service, cleanupTime: 0 } }).at(-1), "11:30");
assert.equal(starts({ service: { ...service, cleanupTime: 7 } }).at(-1), "11:15");
assert.ok(!starts({ bookings: [busy] }).includes("09:30"));
assert.ok(starts({ bookings: [busy] }).includes("09:45"), "Exact cleanup-end boundary is free");
assert.ok(starts({ bookings: [{ ...busy, status: "cancelled" }] }).includes("09:00"));
for (const status of ["pending", "confirmed", "completed"]) assert.ok(!starts({ bookings: [{ ...busy, status }] }).includes("09:30"));
assert.ok(starts({ bookings: [{ ...busy, bookingCleanupTime: 0 }] }).includes("09:30"), "Legacy bookings retain zero cleanup");
const later = { ...busy, scheduledDate: at("10:00"), bookingDuration: 15, bookingCleanupTime: 30 };
assert.ok(!starts({ bookings: [later] }).includes("09:30"), "Candidate cleanup cannot overlap a later booking");
assert.ok(starts({ bookings: [later] }).includes("09:15"));
const breaks = starts({ schedules: [{ ...schedule, breaks: [{ startTime: "10:00", endTime: "10:30" }] }] });
assert.ok(!breaks.includes("09:30")); assert.ok(breaks.includes("09:15")); assert.ok(breaks.includes("10:30"));
assert.equal(slots({ service: { ...service, cleanupTime: 1440 } }).length, 0);
// Cleanup remains elapsed time across daylight-saving jumps and repetitions.
for (const date of ["2035-03-25", "2035-10-28"]) {
  const ds = { ...schedule, specificDate: new Date(date), startTime: "01:00", endTime: "05:00", timezone: "Europe/Riga" };
  for (const slot of slots({ date, schedules: [ds], timezone: "Europe/Riga", now: new Date("2035-01-01") })) {
    const end = new Date(Date.parse(slot.startsAt) + 45 * 60_000);
    const localEnd = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Riga", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(end);
    assert.ok(localEnd <= "05:00");
    assert.equal(Date.parse(slot.endsAt) - Date.parse(slot.startsAt), 30 * 60_000);
  }
}
const schema = insertServiceSchema.pick({ cleanupTime: true });
for (const value of [0, 7, 1440]) assert.ok(schema.safeParse({ cleanupTime: value }).success);
for (const value of [-1, 1.5, 1441, null, "15", NaN, Infinity]) assert.equal(schema.safeParse({ cleanupTime: value }).success, false);
assert.equal(createServiceDraft().cleanupTime, 0);
assert.equal(createServiceDraft(service).cleanupTime, 15);

globalThis.React = React;
globalThis.window = { setTimeout, clearTimeout, addEventListener() {}, removeEventListener() {}, HTMLSelectElement: { prototype: { value: "" } }, HTMLInputElement: { prototype: { checked: false } } };
globalThis.document = { visibilityState: "visible", addEventListener() {}, removeEventListener() {} };
const resources = {};
for (const locale of ["en", "lv", "es", "zh", "hi", "ar", "pt", "ru", "ja", "de", "fr"]) {
  const translation = JSON.parse(await readFile(new URL(`../client/public/locales/${locale}/translation.json`, import.meta.url), "utf8"));
  for (const key of ["label", "help", "invalid"]) assert.ok(translation.serviceCleanup[key], `${locale}: ${key}`);
  resources[locale] = { translation };
}
await i18next.use(initReactI18next).init({ lng: "en", resources });
const { queryClient } = await import("../client/src/lib/queryClient.ts");
const { default: ServiceEditor } = await import("../client/src/components/provider/service-editor.tsx");
queryClient.setQueryData(["/api/categories"], [{ key: "education", name: "Education", icon: "", searchKeywords: "" }]);
let writes = [], failSave = false;
globalThis.fetch = async (url, options = {}) => {
  if (options.method === "PATCH") { writes.push(JSON.parse(options.body)); return new Response(JSON.stringify(failSave ? { message: "Retry save" } : service), { status: failSave ? 500 : 200 }); }
  throw new Error(`Unexpected request: ${url}`);
};
const { act, create } = renderer;
let component;
await act(async () => { component = create(React.createElement(QueryClientProvider, { client: queryClient }, React.createElement(Router, { hook: memoryLocation({ path: "/edit" }).hook }, React.createElement(ServiceEditor, { service, employees: [], company: false })))); });
const field = () => component.root.findAllByType("input").find(node => node.props.id === "cleanupTime");
assert.equal(field().props.value, 15);
assert.equal(field().props["aria-describedby"], "cleanupTime-help");
await act(async () => i18next.changeLanguage("lv"));
assert.ok(component.root.findAllByType("label").some(node => node.children.includes(resources.lv.translation.serviceCleanup.label)));
const change = async value => act(async () => field().props.onChange({ target: { value } }));
const save = async () => act(async () => { component.root.findAllByType("button").find(node => node.props["data-testid"] === "button-save-inactive-service").props.onClick(); await new Promise(resolve => setTimeout(resolve, 30)); });
for (const value of ["", "-1", "1.5", "1441"]) {
  await change(value); await save();
  assert.equal(writes.length, 0, "Save Inactive must validate without native form validation");
  assert.ok(component.root.findByProps({ role: "alert" }).children.includes(resources.lv.translation.serviceCleanup.invalid));
}
await change("25"); failSave = true; await save();
assert.equal(field().props.value, 25, "Failed saves preserve extra time");
failSave = false; await save(); assert.equal(writes.at(-1).cleanupTime, 25);
await change("0"); await save(); assert.equal(writes.at(-1).cleanupTime, 0);
await act(async () => component.unmount()); queryClient.clear();

delete globalThis.window; delete globalThis.document;
process.env.DATABASE_URL = "postgresql://fixture:fixture@127.0.0.1:1/fixture";
process.env.SUPABASE_URL = "http://127.0.0.1:1";
process.env.SUPABASE_PUBLISHABLE_KEY = "fixture-key";
process.env.SUPABASE_SECRET_KEY = "fixture-key";
process.env.SESSION_SECRET = "fixture-secret-for-local-tests-only-123456";
process.env.OPENAI_API_KEY = "fixture-key";
const { registerRoutes } = await import("../server/routes.ts");
const { storage } = await import("../server/storage.ts");
const { pool } = await import("../server/db.ts");
const routes = [], app = () => {};
app.use = app.set = () => app;
for (const method of ["get", "post", "put", "patch", "delete"]) app[method] = (path, ...handlers) => { routes.push({ method, path, handlers }); return app; };
const server = await registerRoutes(app);
const workspace = { company: null, permissions: { manageBookings: true, manageServices: true, readAll: true } };
async function request(method, path, extra = {}) {
  let code = 200, data;
  const res = { status(value) { code = value; return this; }, json(value) { data = value; return this; } };
  await routes.find(route => route.method === method && route.path === path).handlers.at(-1)({ user: { claims: { sub: "provider" } }, workspace, params: { id: "1", serviceId: "1" }, query: { date, timezone: "UTC" }, body: {}, ...extra }, res);
  return { code, data };
}
let saved;
storage.getServiceById = async () => service;
storage.getAvailabilityByProvider = async () => [schedule];
storage.getBookingsForResourceRange = async () => [busy];
storage.createBooking = async input => { saved = input; return input; };
storage.updateService = async (id, input) => { saved = input; return { ...service, ...input }; };
storage.getBookingById = async () => ({ ...busy, serviceId: 1, providerId: "provider", companyId: null, employeeId: null, service: { ...service, cleanupTime: 120 } });
try {
  const result = await request("post", "/api/bookings", { body: { serviceId: 1, scheduledDate: at("10:00").toISOString(), bookingDuration: 1, bookingCleanupTime: 0 } });
  assert.equal(result.code, 200); assert.equal(saved.bookingDuration, 30); assert.equal(saved.bookingCleanupTime, 15);
  for (const cleanupTime of [-1, 1.5, 1441, null, "15"]) assert.equal((await request("patch", "/api/services/:id", { body: { cleanupTime } })).code, 400);
  assert.equal((await request("patch", "/api/services/:id", { body: { cleanupTime: 0 } })).code, 200);
  assert.equal(saved.cleanupTime, 0);
  assert.equal((await request("patch", "/api/services/:id", { workspace: { company: null, permissions: {} }, body: { cleanupTime: 15 } })).code, 403);
  const daily = await request("get", "/api/availability/slots/:serviceId");
  assert.equal(daily.data.slots[0].startTime, "09:45");
  assert.equal(daily.data.slots.at(-1).startTime, "11:15");
  const month = await request("get", "/api/availability/month/:serviceId", { query: { month: "2099-06", timezone: "UTC" } });
  assert.equal(month.data.days.find(day => day.date === date).availableSlots, daily.data.slots.length);
  const reschedule = await request("get", "/api/bookings/:id/available-times");
  assert.equal(reschedule.data.slots[0].startTime, "09:00", "Exclude the appointment being moved");
  assert.equal(reschedule.data.slots.at(-1).startTime, "11:15", "Use saved cleanup rather than edited listing");
} finally { server.close(); await pool.end(); }
console.log("Passed: cleanup validation/translations/editor saves, service boundaries, breaks, DST, cancellation, customer duration, protected updates, server-owned snapshots, daily/monthly availability, and rescheduling previews.");
