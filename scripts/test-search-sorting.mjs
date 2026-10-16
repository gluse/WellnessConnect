import assert from "node:assert/strict";
import { categoryFixtures } from "./fixtures/categories.mjs";
import { readFile } from "node:fs/promises";
import React from "react";
import renderer from "react-test-renderer";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { sortServices } from "../client/src/lib/service-sort.ts";

globalThis.React = React;
globalThis.window = {
  location: { pathname: "/", search: "", hash: "" }, addEventListener() {}, removeEventListener() {},
  setTimeout, clearTimeout,
  HTMLSelectElement: { prototype: { value: "" } }, HTMLInputElement: { prototype: { checked: false } },
};
globalThis.document = { visibilityState: "visible", addEventListener() {}, removeEventListener() {} };
Object.defineProperty(globalThis, "navigator", { configurable: true, value: {
  geolocation: { getCurrentPosition: success => success({ coords: { latitude: 0, longitude: 0 } }) },
} });
const translation = JSON.parse(await readFile(new URL("../client/public/locales/en/translation.json", import.meta.url), "utf8"));
await i18next.use(initReactI18next).init({ lng: "en", resources: { en: { translation } }, interpolation: { escapeValue: false } });
const { queryClient } = await import("../client/src/lib/queryClient.ts");
const { default: Home } = await import("../client/src/pages/home.tsx");
const { default: ServiceFilters } = await import("../client/src/components/service-filters.tsx");
const { default: ServiceCard } = await import("../client/src/components/service-card.tsx");
const { default: ServiceRating } = await import("../client/src/components/service-rating.tsx");
const { act, create } = renderer;
const service = (id, price, extra = {}) => ({
  id, name: `Service ${id}`, price, duration: 30, category: "education", serviceType: "one_to_one",
  latitude: null, longitude: null, provider: { firstName: "Test", lastName: "Provider" }, employee: null, ...extra,
});
const rows = [
  service(1, "100.00", { distance: 5, rating: 4 }),
  service(2, "9.00", { distance: 0, rating: 5 }),
  service(3, "20.00", { distance: 10, rating: 2 }),
  service(4, "9.00", { rating: null }),
];
const origin = { lat: 0, lng: 0 };
const ids = (sort, location = origin, records = rows) => sortServices(records, sort, location).map(row => row.id);
assert.deepEqual(ids("default"), [1, 2, 3, 4]);
assert.deepEqual(ids("price-asc"), [2, 4, 3, 1], "Prices must be numeric; equal prices retain their search order");
assert.deepEqual(ids("price-desc"), [1, 3, 2, 4]);
assert.deepEqual(ids("distance-asc"), [2, 1, 3, 4]);
assert.deepEqual(ids("distance-desc"), [3, 1, 2, 4], "Unknown distances stay last in either direction");
assert.deepEqual(ids("distance-desc", null), [1, 2, 3, 4], "Distance sorting needs a search location");
assert.deepEqual(ids("rating-asc"), [3, 1, 2, 4]);
assert.deepEqual(ids("rating-desc"), [2, 1, 3, 4], "Unrated services stay last in either direction");
assert.deepEqual(rows.map(row => row.id), [1, 2, 3, 4], "Sorting must not mutate cached search data");
const unrated = rows.map(row => ({ ...row, rating: undefined }));
assert.deepEqual(ids("rating-desc", origin, unrated), [1, 2, 3, 4]);
const malformed = [service(8, "", { distance: NaN, rating: 9 }), service(9, "0", { distance: 0, rating: 1 })];
for (const field of ["price", "distance", "rating"]) for (const direction of ["asc", "desc"]) {
  assert.deepEqual(ids(`${field}-${direction}`, origin, malformed), [9, 8]);
}
const coordinates = [service(5, "10", { latitude: 0, longitude: 0.1 }), service(6, "10", { latitude: 0, longitude: 0 }), service(7, "10")];
const measured = sortServices(coordinates, "distance-asc", origin);
assert.deepEqual(measured.map(row => row.id), [6, 5, 7], "Semantic results without distance metadata must sort using coordinates");
assert.equal(measured[0].distance, 0);
assert.equal(measured[1].distance, 11.1);
assert.equal(coordinates[0].distance, undefined);
assert.ok(Number.isFinite(sortServices([service(10, "10", { latitude: 0, longitude: 180 })], "distance-asc", origin)[0].distance));

let requests = [], responseRows = rows, component;
globalThis.fetch = async url => {
  if (url === "/api/categories") return new Response(JSON.stringify(categoryFixtures));
  requests.push(url);
  assert.ok(url.startsWith("/api/services/search?") || url.startsWith("/api/services/semantic-search?"), `Unexpected request: ${url}`);
  return new Response(JSON.stringify(responseRows));
};
const flush = async () => act(async () => { await new Promise(resolve => setTimeout(resolve, 40)); });
const dropdown = () => component.root.findByProps({ id: "service-sort" });
const renderedIds = () => component.root.findAllByType(ServiceCard).map(node => node.props.service.id);
const changeSort = async value => { await act(async () => dropdown().props.onChange({ target: { value } })); await flush(); };
await act(async () => {
  component = create(React.createElement(QueryClientProvider, { client: queryClient }, React.createElement(Router, { hook: memoryLocation({ path: "/" }).hook }, React.createElement(Home))));
});
await flush();
assert.deepEqual(renderedIds(), [1, 2, 3, 4]);
assert.equal(dropdown().findAllByType("option").find(node => node.props.value === "distance-asc").props.disabled, true);
const requestCount = requests.length;
for (const [sort, expected] of [["price-asc", [2, 4, 3, 1]], ["price-desc", [1, 3, 2, 4]], ["rating-asc", [3, 1, 2, 4]], ["rating-desc", [2, 1, 3, 4]]]) {
  await changeSort(sort);
  assert.deepEqual(renderedIds(), expected);
}
assert.equal(requests.length, requestCount, "Changing sort must reuse fetched results");
await act(async () => component.root.findAllByType(ServiceFilters)[0].props.onUseCurrentLocation());
await flush();
assert.equal(dropdown().findAllByType("option").find(node => node.props.value === "distance-asc").props.disabled, false);
await changeSort("distance-desc");
assert.deepEqual(renderedIds(), [3, 1, 2, 4]);
await act(async () => component.root.findAllByType("button").find(node => node.props["aria-label"] === "Remove 📍 Current Location filter").props.onClick());
await flush();
assert.equal(dropdown().props.value, "default");
assert.deepEqual(renderedIds(), [1, 2, 3, 4]);
responseRows = coordinates;
await act(async () => {
  const filters = component.root.findAllByType(ServiceFilters)[0];
  filters.props.onFiltersChange({ ...filters.props.filters, searchQuery: "fixture", searchMode: "semantic" });
  filters.props.onUseCurrentLocation();
});
await flush();
await changeSort("distance-asc");
assert.ok(requests.some(url => url.startsWith("/api/services/semantic-search?")));
assert.deepEqual(renderedIds(), [6, 5, 7]);
assert.equal(component.root.findAllByType(ServiceCard)[0].props.service.distance, 0);
assert.ok(component.root.findByProps({ id: "service-sort-help" }).children.join("").includes(translation.sorting.ratingsUnavailable));
responseRows = [];
await act(async () => {
  const filters = component.root.findAllByType(ServiceFilters)[0];
  filters.props.onFiltersChange({ ...filters.props.filters, searchQuery: "no matches" });
});
await flush();
assert.deepEqual(renderedIds(), []);
assert.equal(dropdown().props.value, "distance-asc", "Filter changes preserve the chosen sorting");
await act(async () => component.unmount());
queryClient.clear();
await act(async () => { component = create(React.createElement(ServiceRating, { service: unrated[0] })); });
assert.equal(component.toJSON().children.join(""), translation.service.notRated);
await act(async () => component.update(React.createElement(ServiceRating, { service: rows[0] })));
assert.ok(JSON.stringify(component.toJSON()).includes("4.0"));
assert.ok(!JSON.stringify(component.toJSON()).includes("127"));
await act(async () => component.unmount());
for (const locale of ["en", "lv", "es", "zh", "hi", "ar", "pt", "ru", "ja", "de", "fr"]) {
  const data = JSON.parse(await readFile(new URL(`../client/public/locales/${locale}/translation.json`, import.meta.url), "utf8"));
  for (const key of Object.keys(translation.sorting)) assert.ok(data.sorting[key], `${locale}: missing ${key}`);
  assert.ok(data.service.notRated && data.service.ratingOutOfFive);
}
console.log("Passed: six sort orders, numeric prices, missing values, stable ties, unchanged cache, coordinate distances, search page controls, semantic results, rating states, and translations.");
