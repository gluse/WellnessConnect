import assert from "node:assert/strict";
import { categoryFixtures } from "./fixtures/categories.mjs";
import React from "react";
import renderer from "react-test-renderer";
import { QueryClientProvider } from "@tanstack/react-query";
import { Router, Route, Switch } from "wouter";
import { memoryLocation } from "wouter/memory-location";

globalThis.React = React;
globalThis.window = {
  location: { pathname: "/my-services", search: "", hash: "", assign() {} },
  HTMLSelectElement: { prototype: { value: "" } }, HTMLInputElement: { prototype: { checked: false } },
  setTimeout, clearTimeout, addEventListener() {}, removeEventListener() {}, confirm: () => true,
};
globalThis.document = { visibilityState: "visible", addEventListener() {}, removeEventListener() {} };
const { queryClient } = await import("../client/src/lib/queryClient.ts");
const { isAllowedAuthReturnTo } = await import("../shared/navigation.ts");
const { default: MyServices } = await import("../client/src/pages/my-services.tsx");
const { default: RoleSwitcher } = await import("../client/src/components/role-switcher.tsx");
const { default: Login } = await import("../client/src/pages/login.tsx");
const { Select } = await import("../client/src/components/ui/select.tsx");
const { act, create } = renderer;
const user = { id: "fixture", firstName: "Test", email: "fixture@example.com", providerType: "company", currentRole: "provider" };
const permissions = { manageServices: true, manageSchedules: true, manageBookings: true, manageTeam: false, isOwner: false, readAll: true };
const personal = { company: null, membership: null, workspaces: [{ id: 2, name: "Company workspace", role: "admin" }], permissions };
const company = { ...personal, company: { id: 2, name: "Company workspace", isActive: true }, membership: { role: "admin" }, permissions: { ...permissions, manageTeam: true } };
const viewer = { ...company, membership: { role: "viewer", employeeId: 3 }, permissions: { manageServices: false, manageSchedules: false, manageBookings: false, manageTeam: false, isOwner: false, readAll: false } };
const service = (id, name, isActive) => ({ id, name, isActive, description: "Existing description", category: "health_wellness", serviceType: "one_to_one", price: "25.00", duration: 45, maxCapacity: 1, ageGroups: ["adults"], targetGender: "both", instantBooking: false, advancePaymentPercent: 30, address: "Riga", latitude: 56.95, longitude: 24.1, imageUrl: "/private/image", externalUrl: "https://example.com/service", employeeId: null });
const personalServices = [service(1, "Personal published offer", true), service(4, "Personal inactive offer", false)];
const companyServices = [service(2, "Company offer", true)];
let context = personal, requests = [], component, location, failSave = false, holdSave = false, resolveSave, failWorkspace = false;
const respond = (data, status = 200) => new Response(JSON.stringify(data), { status });
globalThis.fetch = async (url, options = {}) => {
  if (url === "/api/categories") return new Response(JSON.stringify(categoryFixtures));
  requests.push({ url, method: options.method ?? "GET", body: options.body ? JSON.parse(options.body) : undefined });
  const body = options.body ? JSON.parse(options.body) : undefined;
  const records = context.company ? companyServices : personalServices;
  if (url === "/api/auth/user") return respond(user);
  if (url === "/api/company/context" && options.method === "POST") {
    if (failWorkspace) return respond({ message: "Try again" }, 500);
    context = body.companyId === 2 ? company : personal; return respond(context);
  }
  if (url === "/api/company/context") return respond(context);
  if (url === "/api/services/provider") return respond(records);
  if (url === "/api/provider/employees") return respond(context.company ? [{ id: 3, name: "Company employee", showName: false }] : []);
  if (url === "/api/bookings/provider" || url === "/api/availability/provider") return respond([]);
  if (url === "/api/company/team") return respond({ members: [], invitations: [] });
  if (url === "/api/services/1/copy") { const copied = { ...personalServices[0], id: 101, isActive: false }; personalServices.push(copied); return respond(copied); }
  if (url === "/api/services/101" && options.method === "PATCH") {
    if (failSave) return respond({ message: "Try again" }, 500);
    Object.assign(personalServices.find(row => row.id === 101), body);
    if (holdSave) return new Promise(resolve => { resolveSave = () => resolve(respond(personalServices.find(row => row.id === 101))); });
    return respond(personalServices.find(row => row.id === 101));
  }
  if (url === "/api/services" && options.method === "POST") { const added = { ...body, id: 102 }; records.push(added); return respond(added); }
  if (url === "/api/availability/weekly") return respond({ success: true });
  throw new Error(`Unexpected request: ${options.method ?? "GET"} ${url}`);
};
const flush = async () => act(async () => { await new Promise(resolve => setTimeout(resolve, 60)); });
const input = id => component.root.findAllByType("input").find(node => node.props.id === id);
const click = async id => { await act(async () => component.root.findAllByType("button").find(node => node.props["data-testid"] === id).props.onClick()); await flush(); };
const visit = async path => { await act(async () => location.navigate(path)); await flush(); };
const headings = () => component.root.findAllByType("h1").flatMap(node => node.children).filter(value => typeof value === "string");
async function mount(path, workspace = personal, signedIn = true) {
  if (component) await act(async () => component.unmount());
  queryClient.clear(); context = workspace; requests = [];
  queryClient.setQueryData(["/api/auth/user"], signedIn ? user : null);
  queryClient.setQueryData(["/api/company/context"], workspace);
  queryClient.setQueryData(["/api/auth/providers"], { google: true });
  location = memoryLocation({ path, record: true });
  await act(async () => { component = create(React.createElement(QueryClientProvider, { client: queryClient }, React.createElement(Router, { hook: location.hook }, React.createElement(React.Fragment, null, React.createElement(RoleSwitcher), React.createElement(Switch, null, React.createElement(Route, { path: "/my-services/*?", component: MyServices }), React.createElement(Route, { path: "/login", component: Login })))))); });
  await flush();
}

await mount("/my-services");
assert.equal(location.history.at(-1), "/my-services/appointments");
assert.deepEqual(headings(), ["Appointments"]);
assert.ok(!requests.some(request => request.url === "/api/services/provider" || request.url === "/api/company/team"), "Appointments load only their own feature data");
await act(async () => component.root.findAllByType("a").find(node => node.props.href === "/my-services/services").props.onClick({ button: 0, preventDefault() {} }));
await flush();
assert.deepEqual(headings(), ["Services"]);
assert.equal(component.root.findAllByType("a").find(node => node.props.href === "/my-services").props["aria-current"], "page");
assert.equal(queryClient.getQueryCache().find({ queryKey: ["/api/bookings/provider"] }).getObserversCount(), 0);
await act(async () => component.root.findAllByType("button").find(node => node.children.includes("Inactive")).props.onClick());
assert.equal(component.root.findAllByType("h2").some(node => node.children.includes("Personal published offer")), false);
await act(async () => component.root.findAllByType("button").find(node => node.children.includes("All")).props.onClick());
await click("button-copy-service-1");
assert.equal(location.history.at(-1), "/my-services/services/101/edit");
assert.equal(input("serviceName").props.value, "Personal published offer");
assert.equal(input("externalUrl").props.value, "https://example.com/service");
assert.equal(component.root.findAllByType("select").some(node => node.props.id === "service-employee"), false, "Employee assignment follows the workspace rather than the account provider type");
await act(async () => input("serviceName").props.onChange({ target: { value: "Updated copy" } }));
failSave = true;
await click("button-save-inactive-service");
assert.equal(input("serviceName").props.value, "Updated copy", "Failed saves preserve the draft");
assert.ok(component.root.findAllByProps({ role: "alert" }).some(node => node.children.includes("Try again")));
failSave = false;
holdSave = true;
await click("button-save-inactive-service");
assert.equal(component.root.findAllByType("select").find(node => node.props.id === "workspace").props.disabled, true, "Do not switch workspace while a save is pending");
const blockedClick = { button: 0, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
await act(async () => component.root.findAllByType("nav").find(node => node.props["aria-label"] === "My Services sections").findAllByType("a")[0].props.onClick(blockedClick));
assert.equal(location.history.at(-1), "/my-services/services/101/edit");
holdSave = false;
await act(async () => resolveSave());
await flush();
assert.equal(location.history.at(-1), "/my-services/services");
const saved = requests.filter(request => request.url === "/api/services/101").at(-1).body;
assert.equal(saved.isActive, false);
assert.equal(saved.advancePaymentPercent, 30);
assert.equal(saved.imageUrl, "/private/image");
await visit("/my-services/services/new");
for (const [id, value] of [["serviceName", "New offer"], ["price", "40"], ["address", "Brīvības iela 10, Rīga, Latvia"], ["latitude", "56.95"], ["longitude", "24.1"]]) await act(async () => input(id).props.onChange({ target: { value } }));
await click("button-save-inactive-service");
assert.ok(component.root.findAllByProps({ role: "alert" }).some(node => node.children.includes("Choose a category.")));
assert.ok(!requests.some(request => request.url === "/api/services" && request.method === "POST"));
await act(async () => component.root.findAllByType(Select).find(node => node.props.value === "").props.onValueChange("education"));
await act(async () => component.root.findByType("form").props.onSubmit({ preventDefault() {} }));
await flush();
assert.equal(location.history.at(-1), "/my-services/services");
assert.equal(requests.find(request => request.url === "/api/services" && request.method === "POST").body.isActive, true);
await visit("/my-services/services/1/edit");
assert.equal(input("serviceName").props.value, "Personal published offer");
failWorkspace = true;
await act(async () => input("serviceName").props.onChange({ target: { value: "Unsaved draft" } }));
await act(async () => component.root.findAllByType("select").find(node => node.props.id === "workspace").props.onChange({ target: { value: "2" } }));
await flush();
assert.equal(input("serviceName").props.value, "Unsaved draft", "A failed workspace switch preserves the editor draft");
failWorkspace = false;
await act(async () => component.root.findAllByType("select").find(node => node.props.id === "workspace").props.onChange({ target: { value: "2" } }));
await flush();
assert.equal(location.history.at(-1), "/my-services/services");
assert.equal(component.root.findAllByType("h2").some(node => node.children.includes("Company offer")), true);
assert.equal(component.root.findAllByType("h2").some(node => node.children.includes("Personal published offer")), false);
await visit("/my-services/settings/team");
assert.equal(component.root.findAllByType("select").filter(node => node.props.id === "workspace").length, 1);
await visit("/my-services/availability");
assert.deepEqual(headings(), ["Availability"]);
assert.equal(component.root.findAllByProps({ role: "dialog" }).length, 0, "Availability is an inline page");
await act(async () => component.root.findAllByType("button").find(node => node.children.includes("Save weekly hours")).props.onClick());
await flush();
assert.equal(requests.find(request => request.url === "/api/availability/weekly").body.days.length, 7);
for (const path of ["/my-services/services/new", "/my-services/services/2/edit", "/my-services/availability", "/my-services/settings/team"]) {
  await mount(path, viewer);
  assert.equal(component.root.findAllByType("input").some(node => node.props.id === "serviceName"), false);
  const navigation = component.root.findAllByType("nav").find(node => node.props["aria-label"] === "My Services sections");
  assert.deepEqual(navigation.findAllByType("a").map(node => node.props.href), ["/my-services/appointments", "/my-services/services"]);
  assert.ok(component.root.findAllByProps({ role: "alert" }).length > 0);
}
await mount("/my-services/services/999/edit");
assert.deepEqual(headings(), ["Service not found"]);
await mount("/my-services/settings/unknown");
assert.ok(component.root.findAllByProps({ role: "alert" }).some(node => node.children.includes("Settings page not found.")));
await mount("/my-services/availability", personal, false);
assert.equal(location.history.at(-1), "/login?returnTo=%2Fmy-services%2Favailability");
const destinations = [];
window.location.assign = url => destinations.push(url);
window.location.search = "?returnTo=%2Fmy-services%2Fservices%2F2%2Fedit";
await mount("/login", personal, false);
await act(async () => component.root.findAllByType("button").find(node => node.children.includes("Continue with Google")).props.onClick());
assert.equal(destinations.at(-1), "/api/auth/google?returnTo=%2Fmy-services%2Fservices%2F2%2Fedit");
window.location.search = "";
await act(async () => component.unmount());
queryClient.clear();
for (const path of ["/my-services", "/my-services/appointments", "/my-services/services", "/my-services/services/new", "/my-services/services/42/edit", "/my-services/availability", "/my-services/settings", "/my-services/settings/team", "/account", "/invite?token=fixture"]) assert.equal(isAllowedAuthReturnTo(path), true);
for (const path of ["https://example.com", "//example.com", "/my-services-other", "/my-services/services/42/edit/other", "/unknown", null]) assert.equal(isAllowedAuthReturnTo(path), false);
console.log("Passed: provider routes, feature data isolation, copy/edit/create, failed saves, permissions, workspace switching, availability, and sign-in redirects.");
