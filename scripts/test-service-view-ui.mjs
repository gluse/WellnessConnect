import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import React from "react";
import renderer from "react-test-renderer";
import { QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { categoryFixtures } from "./fixtures/categories.mjs";
import { encodeSearchLocation, SEARCH_LOCATION_COOKIE } from "../shared/search-location.ts";

// Real Home/children and apiRequest; every network boundary is synthetic.
globalThis.React = React;
globalThis.requestAnimationFrame = callback => setTimeout(callback, 0);
const service = { id: 7, providerId: "synthetic-provider", name: "Synthetic service", price: "20", duration: 30, category: "health_wellness", serviceType: "one_to_one", isActive: true, latitude: 0, longitude: 0, employee: null, provider: { firstName: "Synthetic", lastName: "Provider" } };
const notifications = [], unexpected = [], searches = [];
let rejectNotification, notificationMode = "pending";
globalThis.fetch = async (url, options = {}) => {
  const path = String(url);
  if (path === "/api/services/7/view") {
    notifications.push({ path, ...options });
    if (notificationMode === "pending") return new Promise((_resolve, reject) => { rejectNotification = reject; });
    if (notificationMode === "http-error") return new Response("Synthetic capture outage", { status: 503 });
    return new Response(null, { status: 204 });
  }
  if ((options.method ?? "GET") !== "GET") {
    unexpected.push(`${options.method} ${path}`);
    throw new Error("Unexpected offline write");
  }
  if (path.startsWith("/locales/")) {
    assert.match(path, /^\/locales\/(en|lv|ru)\/translation\.json$/);
    return new Response(await readFile(`client/public${path}`, "utf8"));
  }
  if (path === "/api/categories") return Response.json(categoryFixtures);
  if (path.startsWith("/api/services/search?")) { searches.push(path); return Response.json([service]); }
  if (path.startsWith("/api/services/catalog?")) return Response.json([service]);
  if (path.startsWith("/api/services/7/reviews?")) return Response.json({ reviews: [], page: 1, hasMore: false });
  if (path === "/api/config/maps") return Response.json({ apiKey: "synthetic-key" });
  unexpected.push(path);
  throw new Error(`Unexpected offline request: ${path}`);
};
const { default: i18n } = await import("../client/src/lib/i18n.ts");
if (!i18n.isInitialized) await new Promise(resolve => i18n.on("initialized", resolve));
await i18n.changeLanguage("en");
for (const locale of ["en", "lv", "ru"]) i18n.addResourceBundle(locale, "translation", JSON.parse(await readFile(`client/public/locales/${locale}/translation.json`, "utf8")), true, true);
globalThis.window = {
  location: { pathname: "/search", search: "", hash: "" }, setTimeout, clearTimeout, addEventListener() {}, removeEventListener() {},
  HTMLSelectElement: { prototype: { value: "" } }, HTMLInputElement: { prototype: { checked: false } },
};
globalThis.document = { cookie: `${SEARCH_LOCATION_COOKIE}=${encodeSearchLocation({ source: "device", latitude: 0, longitude: 0 })}`, visibilityState: "visible", addEventListener() {}, removeEventListener() {} };
globalThis.google = window.google = { maps: { importLibrary: async name => name === "maps" ? { Map: class {} } : { Marker: class {} } } };
const { queryClient } = await import("../client/src/lib/queryClient.ts");
const { default: Home } = await import("../client/src/pages/home.tsx");
const { default: ServiceCard } = await import("../client/src/components/service-card.tsx");
const { default: ServiceDetailModal } = await import("../client/src/components/service-detail-modal.tsx");
const { default: ProviderServicesDialog } = await import("../client/src/components/provider-services-dialog.tsx");
const { default: BookingModal } = await import("../client/src/components/booking-modal.tsx");
const { default: GoogleMap } = await import("../client/src/components/google-map.tsx");
const { act, create } = renderer;
const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
let component;
queryClient.clear(); queryClient.setQueryData(["/api/auth/user"], null);
try {
  await act(async () => { component = create(React.createElement(QueryClientProvider, { client: queryClient }, React.createElement(Router, { hook: memoryLocation({ path: "/search" }).hook }, React.createElement(Home)))); });
  await flush();
  const card = () => component.root.findByType(ServiceCard);
  const modal = () => component.root.findByType(ServiceDetailModal);
  const closeDetails = () => act(async () => modal().props.onClose());
  assert.ok(searches.length > 0);
  assert.equal(notifications.length, 0, "Initial rendering and search do not notify");

  await act(async () => component.root.findByProps({ id: "service-query" }).props.onChange({ target: { value: "synthetic query" } }));
  await act(async () => component.root.findAllByType("form").find(node => node.props.className === "search-query-form").props.onSubmit({ preventDefault() {} }));
  await flush();
  await act(async () => card().props.onViewProvider());
  assert.equal(component.root.findByType(ProviderServicesDialog).props.open, true);
  await act(async () => component.root.findByType(ProviderServicesDialog).props.onClose());
  await act(async () => card().props.onBook());
  assert.equal(component.root.findAllByType(BookingModal).length, 1);
  await act(async () => component.root.findByType(BookingModal).props.onClose());
  assert.equal(notifications.length, 0, "Search, provider-only opening and booking do not notify");

  // This native button's onClick is also the existing keyboard activation path.
  const title = component.root.findAllByType("button").find(node => node.props["data-testid"] === "button-view-details-7");
  await act(async () => title.props.onClick());
  assert.equal(notifications.length, 1, "One explicit details activation makes one request");
  assert.equal(modal().props.open, true, "Details open while the notification is still pending");
  assert.equal(modal().props.service.id, 7);
  await act(async () => rejectNotification(new Error("Synthetic network failure")));
  await flush();
  assert.equal(modal().props.open, true, "Network failure does not close or block details");
  assert.equal(notifications.length, 1, "Failure and subsequent renders do not retry");
  assert.ok(!JSON.stringify(component.toJSON()).includes("Synthetic network failure"));
  await closeDetails();

  notificationMode = "http-error";
  await act(async () => component.root.findByType(ProviderServicesDialog).props.onViewDetails(service));
  await flush();
  assert.equal(notifications.length, 2, "The provider catalog explicit-details callback notifies once");
  assert.equal(modal().props.open, true, "HTTP failure leaves details open");
  await closeDetails();

  notificationMode = "success";
  await act(async () => component.root.findAllByType("button").find(node => node.props["data-testid"] === "button-view-map").props.onClick());
  await flush();
  assert.equal(notifications.length, 2, "Map rendering/fetching does not notify");
  await act(async () => component.root.findByType(GoogleMap).props.onServiceSelect(service));
  assert.equal(notifications.length, 3, "Map explicit selection shares the single details notification");
  assert.equal(modal().props.open, true);
  await closeDetails();
  for (const id of [0, -1, 1.5, 2147483648, "7?actor=forged"]) {
    await act(async () => component.root.findByType(GoogleMap).props.onServiceSelect({ ...service, id }));
    assert.equal(modal().props.open, true);
    assert.equal(notifications.length, 3, "Invalid IDs never become a path or metadata");
    await closeDetails();
  }
  for (const locale of ["lv", "ru"]) {
    await act(async () => i18n.changeLanguage(locale));
    const before = notifications.length;
    await act(async () => component.root.findByType(GoogleMap).props.onServiceSelect(service));
    assert.equal(notifications.length, before + 1, `${locale}: one explicit selection`);
    assert.equal(modal().props.open, true);
    await closeDetails();
  }
  await flush();
  assert.equal(notifications.length, 5, "No automatic retries after any failed/successful notification");
  for (const request of notifications) {
    assert.equal(request.path, "/api/services/7/view");
    assert.equal(request.method, "POST");
    assert.equal(request.body, undefined);
    assert.deepEqual(request.headers, {});
    assert.equal(request.credentials, "include");
  }
  assert.deepEqual(unexpected, []);
  console.log("Service-view UI passed: one body/query-free explicit-details POST; pending/network/HTTP failure keeps modal open; map/provider callbacks; no search/render/provider-only/book events or retry; en/lv/ru (isolated renderer, mocked only).");
} finally {
  if (component) await act(async () => component.unmount());
  queryClient.clear();
  delete globalThis.window; delete globalThis.document; delete globalThis.google;
}
