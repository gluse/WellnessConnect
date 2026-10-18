import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import React from "react";
import renderer from "react-test-renderer";
import { QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { categoryFixtures } from "./fixtures/categories.mjs";
import { fetchPublicSearch, searchErrorKey, searchValidationKey } from "../client/src/lib/public-search.ts";

globalThis.React = React;
const filters = { category: "", searchQuery: "", searchMode: "exact", serviceType: "", ageGroups: [], distance: 50, date: "", dateEnd: "", time: "", timeEnd: "", availableOnly: false };
assert.equal(searchValidationKey({ ...filters, date: "2026-10-01", dateEnd: "2026-10-31" }), undefined);
for (const dates of [{ date: "2026-10-01", dateEnd: "2026-11-01" }, { date: "2026-10-02", dateEnd: "2026-10-01" }]) assert.equal(searchValidationKey({ ...filters, ...dates }), "publicSearch.dateRange");
assert.equal(searchValidationKey({ ...filters, date: "2026-02-29" }), "publicSearch.invalidDates");
assert.equal(searchValidationKey({ ...filters, date: "2028-02-29" }), undefined);
assert.equal(searchValidationKey({ ...filters, dateEnd: "2026-10-01" }), "publicSearch.startDateRequired");
assert.equal(searchValidationKey({ ...filters, availableOnly: true }), "publicSearch.startDateRequired");
assert.equal(searchValidationKey({ ...filters, searchQuery: "x".repeat(201) }), "publicSearch.queryTooLong");
assert.equal(searchValidationKey({ ...filters, time: "23:60" }), "publicSearch.invalidTimes");
assert.equal(searchValidationKey({ ...filters, time: "14:00", timeEnd: "13:00" }), "publicSearch.invalidTimes");
assert.equal(searchValidationKey({ ...filters, time: "14:00", timeEnd: "15:00" }), undefined);

let searchRequests = [], status = 200, truncated = false, holdSearch = false;
const publicService = { id: 1, providerId: "fixture-provider", name: "Fixture service", price: "20", duration: 30, category: "health_wellness", serviceType: "one_to_one", latitude: null, longitude: null, provider: { firstName: "Fixture", lastName: "Provider" }, employee: null };
globalThis.fetch = async (url, options = {}) => {
  if (String(url).startsWith("/locales/")) return new Response(await readFile(`client/public${url}`, "utf8"));
  if (url === "/api/categories") return new Response(JSON.stringify(categoryFixtures));
  if (String(url).startsWith("/api/services/search?") || String(url).startsWith("/api/services/semantic-search?")) {
    searchRequests.push({ url: String(url), signal: options.signal });
    if (holdSearch) return new Promise((resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    });
    return new Response(JSON.stringify(status === 200 ? [publicService] : { message: "Untrusted server error text" }), { status, headers: { "X-Search-Truncated": String(truncated) } });
  }
  throw new Error(`Unexpected offline request: ${url}`);
};
const controller = new AbortController();
await fetchPublicSearch({ ...filters, searchQuery: "  yoga  ", searchMode: "semantic", ageGroups: ["adults"], date: "2026-10-01" }, { lat: 56.9, lng: 24.1 }, controller.signal);
const request = searchRequests.at(-1);
const params = new URL(request.url, "http://fixture.invalid").searchParams;
assert.equal(params.get("query"), "yoga");
assert.equal(params.get("date"), "2026-10-01");
assert.equal(params.get("ageGroups"), "adults");
assert.equal(params.get("radius"), "50");
assert.equal(request.signal, controller.signal);
for (const [failureStatus, key] of [[400, "invalidFilters"], [422, "tooBroad"], [429, "rateLimited"], [503, "loadError"]]) {
  status = failureStatus; searchRequests = [];
  await assert.rejects(fetchPublicSearch({ ...filters, searchQuery: "yoga", searchMode: "semantic" }, null), error => searchErrorKey(error) === `publicSearch.${key}`);
  assert.equal(searchRequests.length, 1, "A rejected semantic request must never trigger a second exact request");
}
status = 200;

const { default: i18n, supportedLanguages } = await import("../client/src/lib/i18n.ts");
if (!i18n.isInitialized) await new Promise(resolve => i18n.on("initialized", resolve));
await i18n.changeLanguage("en");
const english = JSON.parse(await readFile("client/public/locales/en/translation.json", "utf8")).publicSearch;
for (const { code } of supportedLanguages) {
  const bundle = JSON.parse(await readFile(`client/public/locales/${code}/translation.json`, "utf8"));
  for (const key of Object.keys(english)) assert.ok(bundle.publicSearch[key], `${code} lacks publicSearch.${key}`);
  i18n.addResourceBundle(code, "translation", bundle, true, true);
}
globalThis.window = { location: { pathname: "/search", search: "", hash: "" }, setTimeout, clearTimeout, addEventListener() {}, removeEventListener() {}, HTMLSelectElement: { prototype: { value: "" } }, HTMLInputElement: { prototype: { checked: false } } };
globalThis.document = { visibilityState: "visible", addEventListener() {}, removeEventListener() {} };
const { queryClient } = await import("../client/src/lib/queryClient.ts");
const { default: Home } = await import("../client/src/pages/home.tsx");
const { default: ServiceFilters } = await import("../client/src/components/service-filters.tsx");
const { default: ServiceCard } = await import("../client/src/components/service-card.tsx");
const { act, create } = renderer;
queryClient.clear(); queryClient.setQueryData(["/api/auth/user"], null);
let component;
const flush = ms => act(async () => { await new Promise(resolve => setTimeout(resolve, ms)); });
await act(async () => { component = create(React.createElement(QueryClientProvider, { client: queryClient }, React.createElement(Router, { hook: memoryLocation({ path: "/search" }).hook }, React.createElement(Home)))); });
await flush(30);
assert.equal(component.root.findAllByType(ServiceCard).length, 1);
const update = changes => act(async () => { const node = component.root.findAllByType(ServiceFilters)[0]; node.props.onFiltersChange({ ...node.props.filters, ...changes }); });
const text = () => JSON.stringify(component.toJSON());
assert.equal(component.root.findAllByType("input").find(node => node.props["data-testid"] === "input-search-query").props.maxLength, 200);
searchRequests = [];
await update({ searchMode: "semantic", searchQuery: "yo" });
await flush(100);
await update({ searchQuery: "yoga" });
await flush(100);
assert.equal(searchRequests.length, 0, "Typing must not invoke paid search per keystroke");
await flush(420);
assert.equal(searchRequests.length, 1);
assert.ok(searchRequests[0].url.includes("query=yoga"));
assert.ok(searchRequests[0].signal instanceof AbortSignal);

status = 429;
await update({ searchQuery: "massage" }); await flush(460); await flush(30);
assert.ok(text().includes(english.rateLimited));
assert.ok(!text().includes(english.empty), "Failures must not appear as an empty successful result");
assert.ok(!text().includes("Untrusted server error text"));
assert.equal(searchRequests.length, 2, "No fallback or retry on a rate-limited request");
status = 200; truncated = true;
const retry = component.root.findAllByType("button").find(node => node.children.includes(english.retry));
await act(async () => { retry.props.onClick(); }); await flush(30);
assert.ok(text().includes(english.truncated));
await i18n.changeLanguage("ar"); await flush(20);
assert.ok(text().includes(i18n.t("publicSearch.truncated")), "New status messages update with the chosen language");

const beforeInvalid = searchRequests.length;
assert.equal(component.root.findAllByType(ServiceCard).length, 1);
await update({ date: "2026-10-01", dateEnd: "2026-11-01" });
assert.equal(component.root.findAllByType(ServiceCard).length, 0, "Invalid filters immediately hide results from the previous search");
await flush(460);
assert.equal(searchRequests.length, beforeInvalid, "Invalid date windows must not issue requests");
assert.ok(text().includes(i18n.t("publicSearch.dateRange")));
assert.ok(component.root.findAllByProps({ role: "alert" }).length > 0);
holdSearch = true;
await update({ searchQuery: "slow first", date: "", dateEnd: "" }); await flush(460);
const obsoleteRequest = searchRequests.at(-1);
assert.equal(obsoleteRequest.signal.aborted, false);
await update({ searchQuery: "slow second" }); await flush(460);
assert.equal(obsoleteRequest.signal.aborted, true, "Changing the debounced query cancels the obsolete request");
const currentRequest = searchRequests.at(-1);
await act(async () => component.unmount());
assert.equal(currentRequest.signal.aborted, true, "Leaving the search page cancels the active request");
queryClient.clear();
console.log("Public search UI: validation, debounce, cancellation signal, no fallback/retries, errors, truncation, 11 locale resources and language switching passed (offline react-test-renderer).");
