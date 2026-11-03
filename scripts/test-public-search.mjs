import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { setupPublicSearchRoutes } from "../server/publicSearch.ts";
import { setupPaymentRoutes } from "../server/payments.ts";
import { publicSearchSchema, semanticSearchSchema, searchFiltersSchema } from "../server/searchInput.ts";

// Imports contain no DB/client startup. All providers/data access are injected;
// only this isolated loopback HTTP server may receive requests.
const servers = [];
const quietPolicy = { windowMs: 60000, readsPerIp: 1000, readsPerProcess: 1000, semanticPerIp: 1000, semanticPerProcess: 1000, concurrentEmbeddings: 2 };
const service = id => ({ id, name: `Service ${id}`, isActive: true, companyActive: true });
async function harness(overrides = {}, policy = quietPolicy) {
  const calls = { searches: [], candidates: [], embeddings: [] };
  const dependencies = {
    async searchServices(filters) { calls.searches.push(filters); return filters.serviceIds?.map(service) ?? []; },
    async getPublicServiceEmbeddings(filters) { calls.candidates.push(filters); return [{ serviceId: 1, embedding: [1, 0] }]; },
    async generateEmbedding(text, options) { calls.embeddings.push({ text, options }); return [1, 0]; },
    ...overrides,
  };
  const app = express();
  // Model a trusted loopback test proxy so separate synthetic client addresses
  // can verify the process-wide budget independently of the per-IP quota.
  app.set("trust proxy", "loopback");
  setupPublicSearchRoutes(app, dependencies, policy);
  app.use((_req, res) => res.status(404).end());
  const server = createServer(app); servers.push(server);
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { calls, async request(path, headers) { return fetch(`${base}/api/services/${path}`, { headers }); } };
}

try {
  for (const query of [
    { date: "2026-02-30" }, { date: "2026-01-01", dateEnd: "2026-02-01" },
    { date: "2026-01-02", dateEnd: "2026-01-01" }, { dateEnd: "2026-01-01" },
    { availableOnly: "true" }, { time: "25:00" }, { time: "12:00", timeEnd: "11:00" },
    { latitude: "91", longitude: "0", radius: "50" }, { latitude: "0" },
    { latitude: ["0"], longitude: "0", radius: "1" }, { radius: "NaN" },
    { searchQuery: ["value"] }, { searchQuery: "a".repeat(201) },
    { limit: "0" }, { limit: "51" }, { limit: "1.5" }, { limit: ["1", "2"] },
    { companyId: "1" }, { providerId: "fixture" }, { serviceIds: [1] },
  ]) assert.equal(publicSearchSchema.safeParse(query).success, false, JSON.stringify(query));
  for (const query of [{ date: "2026-01-01", dateEnd: "2026-01-31" },
    { date: "2028-02-01", dateEnd: "2028-03-02" },
    { latitude: "0", longitude: "0", radius: "50", ageGroups: "adults" },
    { searchQuery: "  unicode Rīga Русский  " }]) assert.equal(publicSearchSchema.safeParse(query).success, true);
  assert.equal(semanticSearchSchema.safeParse({ query: " " }).success, false);
  assert.equal(searchFiltersSchema.safeParse({ date: "2026-01-01", dateEnd: "9999-12-31", availableOnly: true }).success, false);

  const ordinary = await harness();
  for (const url of ["search?date=2026-01-01&dateEnd=9999-12-31", "search?searchQuery=a&searchQuery=b", "semantic-search?query=%20", "search?latitude[bad]=0"]) {
    const response = await ordinary.request(url); assert.equal(response.status, 400); assert.equal((await response.json()).code, "INVALID_SEARCH");
  }
  assert.equal(ordinary.calls.searches.length, 0, "Invalid ranges/objects must be rejected before data access");
  const timeWindow = "date=2026-11-13&dateEnd=2026-11-13&time=08%3A00&timeEnd=09%3A00";
  const expectedWindow = { date: "2026-11-13", dateEnd: "2026-11-13", time: "08:00", timeEnd: "09:00" };
  const assertWindow = filters => {
    for (const [key, value] of Object.entries(expectedWindow)) assert.equal(filters[key], value, `Preserve ${key} through search paths`);
  };
  const successful = await ordinary.request(`semantic-search?query=fixture&category=health_wellness&latitude=0&longitude=0&radius=10&${timeWindow}`);
  assert.equal(successful.status, 200);
  assert.deepEqual(await successful.json(), [service(1)]);
  assert.equal(ordinary.calls.searches.length, 2, "One exact query and one batch hydration; no per-service fetches");
  assert.deepEqual(ordinary.calls.searches[1].serviceIds, [1]);
  assert.equal(ordinary.calls.embeddings[0].options.timeout, 8000);
  assert.equal(ordinary.calls.embeddings[0].options.maxRetries, 0);
  assert.ok(ordinary.calls.embeddings[0].options.signal instanceof AbortSignal);
  assert.equal(successful.headers.get("cache-control"), "no-store");
  ordinary.calls.searches.forEach(assertWindow);
  ordinary.calls.candidates.forEach(assertWindow);
  assert.equal((await ordinary.request(`search?${timeWindow}&availableOnly=false`)).status, 200);
  assertWindow(ordinary.calls.searches.at(-1));
  assert.equal(ordinary.calls.searches.at(-1).availableOnly, false);

  const text = await harness({ searchServices: async () => [service(7)] });
  const fifty = await harness({ searchServices: async filters => {
    assert.equal(filters.limit, 50, "The public endpoint defaults to 50 even without a limit parameter");
    return Array.from({ length: 100 }, (_, index) => service(index + 1));
  } });
  assert.equal((await (await fifty.request("search")).json()).length, 50);
  assert.deepEqual(await (await text.request("semantic-search?query=fixture")).json(), [service(7)]);
  assert.equal(text.calls.embeddings.length, 0, "Text matches must avoid paid calls");
  const noCandidates = await harness({ getPublicServiceEmbeddings: async () => [] });
  assert.deepEqual(await (await noCandidates.request("semantic-search?query=fixture")).json(), []);
  assert.equal(noCandidates.calls.embeddings.length, 0);

  const overflow = await harness({ getPublicServiceEmbeddings: async () => Array.from({ length: 501 }, (_, id) => ({ serviceId: id + 1, embedding: [1, 0] })) });
  const tooBroad = await overflow.request("semantic-search?query=fixture");
  assert.equal(tooBroad.status, 422); assert.equal((await tooBroad.json()).code, "SEARCH_TOO_BROAD");
  assert.equal(overflow.calls.embeddings.length, 0, "Overflow must be rejected before paid work");
  const largeText = await harness({ searchServices: async () => Array.from({ length: 501 }, (_, id) => service(id + 1)) });
  assert.equal((await largeText.request("search")).status, 422);

  const manyMatches = await harness({
    getPublicServiceEmbeddings: async () => Array.from({ length: 150 }, (_, id) => ({ serviceId: id + 1, embedding: [1, 0] })),
    searchServices: async filters => filters.serviceIds ? [...filters.serviceIds].reverse().map(service) : [],
  });
  const boundedMatches = await manyMatches.request("semantic-search?query=fixture");
  assert.equal(boundedMatches.headers.get("x-search-truncated"), "true");
  assert.deepEqual((await boundedMatches.json()).map(row => row.id), Array.from({ length: 50 }, (_, index) => index + 1));

  let fallbackCalls = [];
  const fallback = await harness({
    searchServices: async filters => { fallbackCalls.push(filters); return fallbackCalls.length === 1 ? [] : [service(3)]; },
    generateEmbedding: async () => { throw new Error("private provider response"); },
  });
  const fallbackResponse = await fallback.request(`semantic-search?query=fixture&category=education&latitude=0&longitude=0&radius=10&${timeWindow}&availableOnly=true`);
  assert.equal(fallbackResponse.status, 200); assert.equal(fallbackResponse.headers.get("x-search-fallback"), "true");
  assert.deepEqual(await fallbackResponse.json(), [service(3)]);
  assert.deepEqual(fallbackCalls[0], fallbackCalls[1], "Fallback retains every location/category/date filter");
  fallbackCalls.forEach(assertWindow);
  const broken = await harness({ searchServices: async () => { throw new Error("private database details"); } });
  const unavailable = await broken.request("semantic-search?query=fixture");
  assert.equal(unavailable.status, 503);
  const safeError = await unavailable.json(); assert.equal(safeError.code, "SEARCH_UNAVAILABLE"); assert.ok(!JSON.stringify(safeError).includes("private"));
  assert.equal((await broken.request("search")).status, 503, "Server remains responsive after both semantic attempts fail");

  const limited = await harness({}, { ...quietPolicy, readsPerIp: 1 });
  assert.equal((await limited.request("search")).status, 200);
  const rateLimited = await limited.request("search"); assert.equal(rateLimited.status, 429); assert.ok(rateLimited.headers.get("retry-after"));
  assert.equal((await rateLimited.json()).code, "SEARCH_RATE_LIMITED");
  const globalLimit = await harness({}, { ...quietPolicy, semanticPerProcess: 1 });
  assert.equal((await globalLimit.request("semantic-search?query=fixture")).status, 200);
  assert.equal((await globalLimit.request("semantic-search?query=fixture", { "X-Forwarded-For": "203.0.113.2" })).status, 429, "Process budget is not reset by forwarded client identity");

  let release, active = 0;
  const busy = await harness({ generateEmbedding: async () => { active++; await new Promise(resolve => { release = resolve; }); return [1, 0]; } }, { ...quietPolicy, concurrentEmbeddings: 1 });
  const first = busy.request("semantic-search?query=fixture");
  for (let attempts = 0; active === 0 && attempts < 100; attempts++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(active, 1);
  assert.equal((await busy.request("semantic-search?query=fixture")).status, 429);
  assert.equal(active, 1, "Rejected concurrent request must not call the provider");
  release(); assert.equal((await first).status, 200);

  // Register the production payment handler with a synthetic authentication
  // boundary and a storage trap: no payment write should be possible at all.
  const paymentApp = express(); let authenticated = false;
  paymentApp.locals.storage = new Proxy({}, { get() { throw new Error("Unexpected payment storage access"); } });
  setupPaymentRoutes(paymentApp, (_req, res, next) => { if (!authenticated) return res.sendStatus(401); next(); });
  const paymentServer = createServer(paymentApp); servers.push(paymentServer);
  await new Promise(resolve => paymentServer.listen(0, "127.0.0.1", resolve));
  const paymentUrl = `http://127.0.0.1:${paymentServer.address().port}/api/payments/process`;
  assert.equal((await fetch(paymentUrl, { method: "POST" })).status, 401);
  authenticated = true;
  const disabledPayment = await fetch(paymentUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingId: 1, amount: 0 }) });
  assert.equal(disabledPayment.status, 501); assert.equal((await disabledPayment.json()).code, "PAYMENTS_UNAVAILABLE");
} finally {
  await Promise.all(servers.map(server => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); })));
}
console.log("Passed: bounded search validation/results, public visibility adapters, semantic budgets/batching/timeouts, complete fallback handling, isolated rate limits, concurrency, and disabled mock payments. No databases or external services accessed.");
