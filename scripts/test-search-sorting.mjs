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
import { sortServices, canSortServicePrices } from "../client/src/lib/service-sort.ts";

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
const { DialogContent } = await import("../client/src/components/ui/dialog.tsx");
const { act, create } = renderer;
const service = (id, price, extra = {}) => ({
  id, name: `Service ${id}`, price, currency: "EUR", duration: 30, category: "education", serviceType: "one_to_one",
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
assert.deepEqual(ids("price-asc", origin, [rows[0], { ...rows[1], currency: "USD" }]), [1, 2], "Unlike prices must not be compared");
assert.deepEqual(ids("price-asc", origin, [rows[0], { ...rows[1], currency: null }]), [1, 2], "Unknown currency disables price sort");
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
  assert.ok(url.startsWith("/api/services/search/page?") || url.startsWith("/api/services/semantic-search/page?"), `Unexpected request: ${url}`);
  const params = new URL(url, 'https://fixture.invalid').searchParams;
  const location = params.has('latitude') ? { lat: Number(params.get('latitude')), lng: Number(params.get('longitude')) } : null;
  return new Response(JSON.stringify({ services: sortServices(responseRows, params.get('sort') ?? 'default', location), nextCursor: null, mode: 'text', priceSortAvailable: canSortServicePrices(responseRows) }));
};
const flush = async (milliseconds = 40) => act(async () => { await new Promise(resolve => setTimeout(resolve, milliseconds)); });
const flushSearch = async () => { await flush(450); await flush(); };
const dropdown = () => component.root.findByProps({ id: "service-sort" });
const renderedIds = () => component.root.findAllByType(ServiceCard).map(node => node.props.service.id);
const changeSort = async value => { await act(async () => dropdown().props.onChange({ target: { value } })); await flush(); };
// GPS now lives in the explicit location picker. Test its application callback
// here; browser coverage verifies opening the picker and activating the button.
const useLocation = () => {
  const form = component.root.findAllByType(DialogContent).flatMap(node => React.Children.toArray(node.props.children)).find(node => node.props.className === "search-location-form");
  return React.Children.toArray(form.props.children).find(node => node.props.className === "search-location-gps").props.onClick();
};
queryClient.setQueryData(["/api/auth/user"], null);
await act(async () => {
  component = create(React.createElement(QueryClientProvider, { client: queryClient }, React.createElement(Router, { hook: memoryLocation({ path: "/" }).hook }, React.createElement(Home))));
});
await flush();
assert.deepEqual(renderedIds(), [1, 2, 3, 4]);
assert.equal(dropdown().findAllByType("option").find(node => node.props.value === "distance-asc").props.disabled, true);
const submitQuery = async value => {
  if (value !== undefined) await act(async () => component.root.findByProps({ id: "service-query" }).props.onChange({ target: { value } }));
  await act(async () => component.root.findAllByType("form").find(node => node.props.className === "search-query-form").props.onSubmit({ preventDefault() {} }));
  await flush();
};
const requestCount = requests.length;
for (const [sort, expected] of [["price-asc", [2, 4, 3, 1]], ["price-desc", [1, 3, 2, 4]], ["rating-asc", [3, 1, 2, 4]], ["rating-desc", [2, 1, 3, 4]]]) {
  await changeSort(sort);
  assert.deepEqual(renderedIds(), expected);
}
assert.equal(requests.length, requestCount + 4, "Changing sort requests a new globally ordered first page");
assert.deepEqual(requests.slice(requestCount).map(url => new URL(url, 'https://fixture.invalid').searchParams.get('sort')), ['price-asc', 'price-desc', 'rating-asc', 'rating-desc']);
await act(async () => useLocation());
await flush();
assert.equal(dropdown().findAllByType("option").find(node => node.props.value === "distance-asc").props.disabled, false, "Current location immediately enables nearest-first without Search");
assert.equal(dropdown().findAllByType("option").find(node => node.props.value === "distance-desc").props.disabled, false);
await changeSort("distance-desc");
assert.deepEqual(renderedIds(), [3, 1, 2, 4]);
await act(async () => component.root.findAllByType("button").find(node => node.props["aria-label"]?.startsWith("Remove Current location ·")).props.onClick());
await flush();
assert.equal(dropdown().props.value, "default");
assert.deepEqual(renderedIds(), [1, 2, 3, 4]);
responseRows = coordinates;
await act(async () => component.root.findAllByType("input").find(node => node.props.name === "search-mode" && node.props.value === "semantic").props.onChange());
await act(async () => useLocation());
await submitQuery("fixture");
await flushSearch();
await changeSort("distance-asc");
assert.ok(requests.some(url => url.startsWith("/api/services/semantic-search/page?")));
assert.deepEqual(renderedIds(), [6, 5, 7]);
assert.equal(component.root.findAllByType(ServiceCard)[0].props.service.distance, 0);
assert.ok(component.root.findByProps({ id: "service-sort-help" }).children.join("").includes(translation.sorting.ratingsUnavailable));
responseRows = [];
await submitQuery("no matches");
await flushSearch();
assert.deepEqual(renderedIds(), []);
assert.equal(dropdown().props.value, "distance-asc", "Filter changes preserve the chosen sorting");
responseRows = [rows[0], { ...rows[1], currency: "USD" }];
await changeSort("price-asc"); await submitQuery("mixed currency"); await flushSearch();
assert.equal(dropdown().props.value, "default", "Server mixed-currency metadata resets active price sort");
assert.equal(dropdown().findAllByType("option").find(node => node.props.value === "price-asc").props.disabled, true);
assert.equal(dropdown().findAllByType("option").find(node => node.props.value === "price-desc").props.disabled, true);
await act(async () => component.unmount());
queryClient.clear();
await act(async () => { component = create(React.createElement(ServiceRating, { service: unrated[0] })); });
assert.equal(component.toJSON().props.role, "img");
assert.equal(component.toJSON().props["aria-label"], translation.service.notRated);
assert.equal(component.root.findAllByType("button").length, 0, "Unrated services do not imply an available review score");
assert.equal(component.root.findByType("svg").props.fill, "none", "Unrated star is an outline");
await act(async () => component.update(React.createElement(ServiceRating, { service: rows[0] })));
assert.ok(JSON.stringify(component.toJSON()).includes("4.0"));
assert.ok(!JSON.stringify(component.toJSON()).includes("127"));
await act(async () => component.unmount());
for (const locale of ["en", "lv", "ru"]) {
  const data = JSON.parse(await readFile(new URL(`../client/public/locales/${locale}/translation.json`, import.meta.url), "utf8"));
  for (const key of Object.keys(translation.sorting)) assert.ok(data.sorting[key], `${locale}: missing ${key}`);
  assert.ok(data.service.notRated && data.service.ratingOutOfFive);
}
console.log("Passed: six sort orders, numeric prices, missing values, stable ties, unchanged cache, coordinate distances, search page controls, semantic results, rating states, and translations.");
