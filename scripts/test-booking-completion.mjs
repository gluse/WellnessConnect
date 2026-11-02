import assert from "node:assert/strict";
import React from "react";
import renderer from "react-test-renderer";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { QueryClientProvider } from "@tanstack/react-query";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { readFile } from "node:fs/promises";

await i18next.use(initReactI18next).init({ lng: "en", resources: { en: { translation: JSON.parse(await readFile("client/public/locales/en/translation.json", "utf8")) } } });

globalThis.React = React;
globalThis.window = { location: { pathname: "/", search: "", hash: "" }, addEventListener() {}, removeEventListener() {} };
globalThis.document = { visibilityState: "visible", addEventListener() {}, removeEventListener() {} };
const { queryClient } = await import("../client/src/lib/queryClient.ts");
const { useToast } = await import("../client/src/hooks/use-toast.ts");
const { default: AppointmentsPage } = await import("../client/src/pages/provider/appointments.tsx");
const { default: AppointmentAgenda } = await import("../client/src/components/appointment-agenda.tsx");
const { act, create } = renderer;
const user = { id: "provider", firstName: "Test", lastName: "Provider", email: "provider@example.com", providerType: "individual" };
const context = { company: null, membership: null, workspaces: [], permissions: { manageBookings: true, manageServices: false, manageSchedules: false, manageTeam: false, isOwner: false } };
const past = new Date(Date.now() - 86400_000).toISOString();
const future = new Date(Date.now() + 86400_000).toISOString();
const booking = (id, status, scheduledDate, amount) => ({
  id, status, scheduledDate, totalAmount: String(amount), provider: user,
  seeker: { firstName: "Test", lastName: "Customer" },
  service: { name: `Appointment ${id}`, duration: 60 },
});
let bookings = [booking(1, "confirmed", future, 30), booking(2, "confirmed", past, 40), booking(3, "pending", future, 20), booking(4, "completed", past, 50), booking(5, "cancelled", past, 60)];
queryClient.setQueryData(["/api/auth/user"], user);
queryClient.setQueryData(["/api/company/context"], context);
queryClient.setQueryData(["/api/provider/employees"], []);
queryClient.setQueryData(["/api/services/provider"], []);
queryClient.setQueryData(["/api/bookings/provider"], bookings);
queryClient.setQueryData(["/api/bookings/seeker"], []);
queryClient.setQueryData(["/api/availability/provider"], []);
const requests = [];
let resolveWrite;
globalThis.fetch = async (url, options = {}) => {
  if (url === "/api/notifications/capabilities") return Response.json({ hasPro: false, automationEnabled: false, channels: { email: false, sms: false, whatsapp: false } });
  if (/^\/api\/bookings\/\d+\/notifications$/.test(url)) return Response.json({ notification: { mode: "none" }, reminder: { state: "off" } });
  if (/^\/api\/bookings\/\d+\/reschedule-requests$/.test(url)) return Response.json({ requests: [] });
  if (options.method === "PATCH") {
    requests.push({ url, body: JSON.parse(options.body) });
    return new Promise(resolve => { resolveWrite = resolve; });
  }
  assert.equal(url, "/api/bookings/provider");
  return new Response(JSON.stringify(bookings));
};
let toasts = [];
function ToastProbe() { toasts = useToast().toasts; return null; }
let component;
await act(async () => {
  component = create(React.createElement(QueryClientProvider, { client: queryClient },
    React.createElement(Router, { hook: memoryLocation({ path: "/" }).hook },
      React.createElement(React.Fragment, null, React.createElement(AppointmentsPage), React.createElement(ToastProbe)))));
});
const buttons = label => component.root.findAllByType("button").filter(node => node.children.includes(label));
const click = async label => act(async () => buttons(label)[0].props.onClick());
const flush = async () => act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
await flush();
assert.equal(buttons("Mark complete").length, 1, "Only confirmed appointments can be completed");
assert.equal(buttons("Approve").length, 1, "Pending appointments still require approval");
await click("Past & cancelled");
assert.equal(buttons("Mark complete").length, 1, "Providers can complete past confirmed appointments");
const revenueIsPreserved = () => component.root.findAllByType("div").some(node => node.children.filter(child => typeof child === "string").join("") === "$120");
assert.equal(revenueIsPreserved(), true);
await click("Mark complete");
await flush();
assert.deepEqual(requests[0], { url: "/api/bookings/2/status", body: { status: "completed", timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone } });
assert.equal(buttons("Mark complete")[0].props.disabled, true);
assert.equal(buttons("More actions")[0].props.disabled, true, "Reschedule/cancel menu is disabled during save");
await act(async () => resolveWrite(new Response(JSON.stringify({ message: "Try again" }), { status: 500 })));
await flush();
assert.equal(buttons("Mark complete")[0].props.disabled, false, "Allow retry after a failed save");
assert.equal(queryClient.getQueryData(["/api/bookings/provider"]).find(item => item.id === 2).status, "confirmed");
assert.equal(toasts[0].title, "Error");
await click("Mark complete");
await flush();
bookings = bookings.map(item => item.id === 2 ? { ...item, status: "completed" } : item);
await act(async () => resolveWrite(new Response(JSON.stringify(bookings.find(item => item.id === 2)))));
await flush();
assert.equal(requests.length, 2);
assert.equal(buttons("Mark complete").length, 0, "Completed appointments have no completion action");
assert.equal(queryClient.getQueryData(["/api/bookings/provider"]).find(item => item.id === 2).status, "completed");
assert.equal(queryClient.getQueryState(["/api/bookings/seeker"]).isInvalidated, true);
assert.equal(toasts[0].title, "Booking Completed");
assert.equal(revenueIsPreserved(), true, "Completing a booking must preserve revenue");
await act(async () => queryClient.setQueryData(["/api/company/context"], { ...context, permissions: { ...context.permissions, manageBookings: false } }));
await flush();
await click("Upcoming");
assert.equal(buttons("Mark complete").length, 0, "Read-only providers cannot complete appointments");
await act(async () => component.unmount());
queryClient.clear();
let customer;
await act(async () => { customer = create(React.createElement(AppointmentAgenda, { bookings, onStatusChange() { throw new Error("Customer must not change status"); } })); });
assert.equal(customer.root.findAllByType("button").some(node => node.children.includes("Mark complete")), false, "Customer view cannot complete appointments");
await act(async () => customer.unmount());
console.log("Passed: provider completion, permissions, past appointments, pending controls, save failures, retry, cache refresh, and revenue preservation.");
