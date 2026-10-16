import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import React from "react";
import renderer from "react-test-renderer";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { QueryClientProvider } from "@tanstack/react-query";
import { relativeReviewDate } from "../client/src/lib/review-date.ts";

const now = Date.parse("2026-10-16T12:00:00Z"), day = 86400_000;
assert.equal(relativeReviewDate(new Date(now - 7 * day).toISOString(), "en", now), "7 days ago");
assert.equal(relativeReviewDate(new Date(now - 730 * day).toISOString(), "en", now), "2 years ago");
assert.equal(relativeReviewDate(new Date(now - 5 * 60_000).toISOString(), "en", now), "5 minutes ago");
assert.equal(relativeReviewDate(new Date(now - 60 * day).toISOString(), "en", now), "2 months ago");
assert.equal(relativeReviewDate(new Date(now + day).toISOString(), "en", now), "now");
assert.ok(relativeReviewDate(new Date(now - 7 * day).toISOString(), "fr", now).includes("jours"));
globalThis.React = React;
globalThis.window = { addEventListener() {}, removeEventListener() {} };
globalThis.document = { visibilityState: "visible", addEventListener() {}, removeEventListener() {} };
const translation = JSON.parse(await readFile(new URL("../client/public/locales/en/translation.json", import.meta.url), "utf8"));
await i18next.use(initReactI18next).init({ lng: "en", resources: { en: { translation } }, interpolation: { escapeValue: false } });
const { queryClient } = await import("../client/src/lib/queryClient.ts");
const { default: ServiceReviews } = await import("../client/src/components/service-reviews.tsx");
const { default: ServiceRating } = await import("../client/src/components/service-rating.tsx");
const { act, create } = renderer;
let component, hold = true, release, fail = false, empty = false, requests = [];
const review = { id: 1, reviewerName: "Anna Smith", rating: 2, comment: "Could have been better.\nPlease allow more time.", createdAt: new Date(Date.now() - 7 * day).toISOString() };
globalThis.fetch = async url => {
  requests.push(url);
  const page = Number(new URL(url, "http://localhost").searchParams.get("page"));
  const response = () => new Response(JSON.stringify(fail ? { message: "Unavailable" } : {
    page, hasMore: page === 1 && !empty,
    reviews: empty ? [] : page === 1 ? [review, { ...review, id: 2, rating: 5, comment: "", reviewerName: null }] : [{ ...review, id: 3, createdAt: new Date(Date.now() - 730 * day).toISOString() }],
  }), { status: fail ? 500 : 200 });
  return hold ? new Promise(resolve => { release = () => resolve(response()); }) : response();
};
const flush = async () => act(async () => { await new Promise(resolve => setTimeout(resolve, 40)); });
const button = label => component.root.findAllByType("button").find(node => node.children.includes(label));
const click = async label => { await act(async () => button(label).props.onClick()); await flush(); };
async function mount() {
  if (component) await act(async () => component.unmount());
  queryClient.clear();
  await act(async () => { component = create(React.createElement(QueryClientProvider, { client: queryClient }, React.createElement(ServiceReviews, { serviceId: 17 }))); });
  await flush();
}
await mount();
assert.ok(component.root.findByProps({ role: "status" }).children.includes(translation.reviews.loading));
assert.equal(requests[0], "/api/services/17/reviews?page=1");
hold = false;
await act(async () => release()); await flush();
assert.ok(JSON.stringify(component.toJSON()).includes("Anna Smith"));
assert.ok(JSON.stringify(component.toJSON()).includes(translation.reviews.customer));
assert.equal(component.root.findAllByType("time")[0].children.join(""), "7 days ago");
const first = component.root.findByProps({ "data-testid": "public-review-1" });
assert.equal(first.findAllByType("svg").filter(node => node.props.className.includes("fill-amber-400")).length, 2);
assert.equal(first.findAllByType("p").at(-1).children.join(""), review.comment);
assert.equal(component.root.findByProps({ "data-testid": "public-review-2" }).findAllByType("p").length, 1, "No empty comment block");
assert.equal(button(translation.reviews.previous).props.disabled, true);
await click(translation.reviews.next);
assert.equal(requests.at(-1), "/api/services/17/reviews?page=2");
assert.equal(component.root.findByType("time").children.join(""), "2 years ago");
assert.equal(button(translation.reviews.next).props.disabled, true);
await click(translation.reviews.previous);
assert.equal(component.root.findAllByType("li").length, 2);
fail = true;
await mount();
assert.ok(component.root.findByProps({ role: "alert" }));
fail = false; empty = true;
await click(translation.reviews.retry);
assert.ok(component.root.findAllByType("p").some(node => node.children.includes(translation.reviews.empty)));
assert.equal(button(translation.reviews.next).props.disabled, true);
await act(async () => component.unmount());
queryClient.clear();
const count = requests.length;
await act(async () => { component = create(React.createElement(ServiceRating, { service: { id: 17, name: "Massage", rating: 4, reviewCount: 3 } })); });
const trigger = component.root.findByType("button");
assert.equal(trigger.props["aria-haspopup"], "dialog");
assert.equal(trigger.props["aria-label"], "Read reviews for Massage");
assert.equal(requests.length, count, "Do not load review details until the rating dialog opens");
await act(async () => component.unmount());

delete globalThis.window; delete globalThis.document;
process.env.DATABASE_URL = "postgresql://fixture:fixture@127.0.0.1:1/fixture";
process.env.SUPABASE_URL = "http://127.0.0.1:1";
process.env.SUPABASE_PUBLISHABLE_KEY = "fixture-key";
process.env.SUPABASE_SECRET_KEY = "fixture-key";
const { setupReviewRoutes } = await import("../server/reviewRoutes.ts");
const { storage } = await import("../server/storage.ts");
const { pool } = await import("../server/db.ts");
let route, called = [];
setupReviewRoutes({ get(path, ...handlers) { route = { path, handlers }; }, post() {}, patch() {}, delete() {} });
assert.equal(route.path, "/api/services/:id/reviews");
assert.equal(route.handlers.length, 1, "Reviews for searchable services are readable without signing in");
storage.getServiceReviews = async (id, page) => { called.push({ id, page }); return id === 17 ? { reviews: [review], page, hasMore: false } : undefined; };
async function request(id = "17", query = {}) {
  let status = 200, data, headers = {};
  const res = { set(key, value) { headers[key] = value; return this; }, status(value) { status = value; return this; }, json(value) { data = value; return this; } };
  await route.handlers[0]({ params: { id }, query }, res);
  return { status, data, headers };
}
try {
  const result = await request();
  assert.equal(result.status, 200);
  assert.equal(result.data.reviews[0].comment, review.comment);
  assert.equal(result.headers["Cache-Control"], "no-store");
  assert.deepEqual(called[0], { id: 17, page: 1 });
  assert.equal((await request("17", { page: "2" })).data.page, 2);
  const before = called.length;
  for (const page of ["0", "-1", "1.5", "100001", "x", ["1", "2"]]) assert.equal((await request("17", { page })).status, 400);
  for (const id of ["0", "17x", "1.5", "2147483648"]) assert.equal((await request(id)).status, 400);
  assert.equal(called.length, before);
  assert.equal((await request("999")).status, 404);
  storage.getServiceReviews = async () => { throw new Error("Secret database details"); };
  assert.equal((await request()).status, 500);
  assert.ok(!(await request()).data.message.includes("Secret"));
} finally { await pool.end(); }
console.log("Passed: relative dates, stars, comments, reviewer names/fallbacks, paging, loading, errors/retry, empty results, accessible rating trigger, on-demand loading, and public API validation.");
