import assert from "node:assert/strict";
import React from "react";
import renderer from "react-test-renderer";
import { QueryClientProvider } from "@tanstack/react-query";
import { Router, Route, Switch } from "wouter";
import { memoryLocation } from "wouter/memory-location";

globalThis.React = React;
globalThis.window = { location: { pathname: "/my-bookings", search: "", hash: "" }, addEventListener() {}, removeEventListener() {} };
globalThis.document = { visibilityState: "visible", addEventListener() {}, removeEventListener() {} };
const { queryClient } = await import("../client/src/lib/queryClient.ts");
const { isAllowedAuthReturnTo } = await import("../shared/navigation.ts");
const { default: MyBookings } = await import("../client/src/pages/my-bookings.tsx");
const { default: RoleSwitcher } = await import("../client/src/components/role-switcher.tsx");
const { act, create } = renderer;
const user = { id: "customer", firstName: "Customer", currentRole: "seeker" };
const booking = (id, status, days) => ({
  id, status, scheduledDate: new Date(Date.now() + days * 86400_000).toISOString(), totalAmount: "25.00",
  provider: { firstName: "Test", lastName: "Provider" }, service: { name: `Service ${id}`, duration: 60 },
});
const records = [booking(1, "confirmed", 2), booking(2, "pending", 3), booking(3, "completed", -2), booking(4, "cancelled", 4)];
let component, location, requests, releaseResponse, response;
globalThis.fetch = async url => {
  requests.push(url);
  assert.equal(url, "/api/bookings/seeker", "Customer page must only fetch the customer's bookings");
  return new Promise(resolve => { releaseResponse = () => resolve(response); });
};
const flush = async () => act(async () => { await new Promise(resolve => setTimeout(resolve, 40)); });
const buttons = label => component.root.findAllByType("button").filter(node => node.children.includes(label));
const click = async label => { await act(async () => buttons(label)[0].props.onClick()); await flush(); };
const names = () => component.root.findAllByType("article").map(node => node.findAllByType("p")[0].children.join(""));
async function mount(auth = user) {
  if (component) await act(async () => component.unmount());
  queryClient.clear(); requests = []; releaseResponse = undefined;
  queryClient.setQueryData(["/api/auth/user"], auth);
  location = memoryLocation({ path: "/my-bookings", record: true });
  await act(async () => {
    component = create(React.createElement(QueryClientProvider, { client: queryClient },
      React.createElement(Router, { hook: location.hook }, React.createElement(React.Fragment, null,
        React.createElement(RoleSwitcher), React.createElement(Switch, null,
          React.createElement(Route, { path: "/my-bookings", component: MyBookings }),
          React.createElement(Route, { path: "/login" }, React.createElement("p", null, "Sign in")))))));
  });
  await flush();
}
async function respond(data, status = 200) {
  response = new Response(JSON.stringify(data), { status });
  await act(async () => releaseResponse());
  await flush();
}

await mount(null);
assert.equal(location.history.at(-1), "/login?returnTo=%2Fmy-bookings");
assert.deepEqual(requests, [], "Signed-out visitors must not fetch bookings");
assert.equal(isAllowedAuthReturnTo("/my-bookings"), true);
assert.equal(isAllowedAuthReturnTo("/my-bookings/other"), false);
assert.equal(isAllowedAuthReturnTo("//example.com/my-bookings"), false);

await mount();
assert.deepEqual(requests, ["/api/bookings/seeker"]);
assert.ok(component.root.findByProps({ role: "status" }).children.includes("Loading appointments…"));
assert.equal(component.root.findAllByType("article").length, 0);
const headerNav = component.root.findByProps({ "aria-label": "Services" });
assert.equal(headerNav.findAllByType("a").find(node => node.props.href === "/my-bookings").props["aria-current"], "page");
assert.equal(headerNav.findAllByType("a").find(node => node.props.href === "/my-services").props["aria-current"], undefined);
const mobileNav = component.root.findByProps({ "aria-label": "Customer navigation" });
assert.equal(mobileNav.findAllByType("a").find(node => node.props.href === "/my-bookings").props["aria-current"], "page");
await respond(records);
assert.deepEqual(names(), ["Service 1", "Service 2"]);
assert.equal(buttons("Mark complete").length, 0, "Customer bookings must not expose provider actions");
await act(async () => component.root.findByType("select").props.onChange({ target: { value: "pending" } }));
assert.deepEqual(names(), ["Service 2"]);
await act(async () => component.root.findByType("select").props.onChange({ target: { value: "all" } }));
await click("Past & cancelled");
assert.deepEqual(names(), ["Service 4", "Service 3"]);
await click("By date");
assert.ok(component.root.findAllByType("table").length > 0, "Preserve the calendar date picker");
await click("Upcoming");
await act(async () => queryClient.setQueryData(["/api/bookings/seeker"], [...records, booking(5, "confirmed", 5)]));
await flush();
assert.deepEqual(names(), ["Service 1", "Service 2", "Service 5"], "Show new bookings from the shared cache");

await mount();
await respond({ message: "Unavailable" }, 500);
assert.ok(component.root.findByProps({ role: "alert" }));
assert.equal(buttons("Try again").length, 1);
await click("Try again");
assert.equal(buttons("Try again").length, 0, "Retry must show loading until the request completes");
assert.ok(component.root.findByProps({ role: "status" }));
await respond([]);
assert.equal(component.root.findAllByProps({ role: "alert" }).length, 0);
assert.ok(component.root.findAllByType("p").some(node => node.children.includes("No appointments in this view.")));
assert.equal(requests.length, 2);

await mount();
await respond({ message: "Unauthorized" }, 401);
assert.equal(location.history.at(-1), "/login?returnTo=%2Fmy-bookings");
assert.equal(queryClient.getQueryData(["/api/auth/user"]), null, "Expired sessions must clear cached authentication");
await act(async () => component.unmount());
queryClient.clear();
console.log("Passed: customer booking routes, auth redirects, data isolation, navigation, calendar/status/history filters, cache updates, loading, errors, retry, and session expiry.");
