import assert from "node:assert/strict";
import React from "react";
import renderer from "react-test-renderer";

// Never connect to external services in these tests.
process.env.DATABASE_URL = "postgresql://fixture:fixture@127.0.0.1:1/fixture";
process.env.GOOGLE_GEOCODING_API_KEY = "fixture-key";
const { registerLocation, resolveServiceLocation, addressKey, GOOGLE_COORDINATE_TTL } = await import("../server/registeredLocations.ts");
const { geocodeRegisteredAddress, GeocodingError } = await import("../server/geocoding.ts");
const { currentLocation, normalizeAddress, validCoordinates } = await import("../shared/locations.ts");
const { pool } = await import("../server/db.ts");
const owner = { providerId: "fixture" };
const address = "Brīvības iela 10, Rīga, Latvia";
let calls = 0, row, manual, puts = 0;
const store = {
  manual: async () => manual,
  get: async () => row,
  put: async value => { puts++; row = value; },
  locked: async (_key, action) => action(store),
};
const lookup = async () => { calls++; await new Promise(resolve => setTimeout(resolve, 5)); return { latitude: 56.95, longitude: 24.1, placeId: "fixture-place" }; };
const fails = (action, status) => assert.rejects(action, error => error instanceof GeocodingError && error.status === status);
try {
  for (const bad of [null, [], "", "x", "123456", "https://example.com", "abc@def.example", "a\nlong street", "a".repeat(501)]) {
    await fails(() => registerLocation(bad, owner, store, lookup), 400);
  }
  assert.equal(calls, 0);
  assert.equal(normalizeAddress("  BRĪVĪBAS   iela 10,  Rīga "), normalizeAddress("Brīvības iela 10,Rīga"));
  assert.notEqual(addressKey("Street 12-1, Riga"), addressKey("Street 121, Riga"));
  assert.notEqual(addressKey("Rīga, Latvia"), addressKey("Riga, Latvia"));
  assert.equal(validCoordinates(0, 0), true);
  for (const pair of [[91, 0], [0, -181], [NaN, 0], [Infinity, 0], [null, 0]]) assert.equal(validCoordinates(...pair), false);
  manual = { latitude: 0, longitude: 0 };
  assert.equal((await registerLocation(address, owner, store, lookup)).locationSource, "manual");
  assert.equal(calls, 0);
  manual = undefined;
  const simultaneous = await Promise.all(Array.from({ length: 8 }, () => registerLocation(address, owner, store, lookup)));
  assert.equal(calls, 1); assert.equal(puts, 1);
  assert.ok(simultaneous.every(value => value.locationKey === addressKey(address)));
  const expiry = row.expiresAt.getTime();
  assert.ok(Math.abs(expiry - Date.now() - GOOGLE_COORDINATE_TTL) < 1000);
  const reused = await registerLocation(`  ${address.toUpperCase()} `, owner, store, lookup);
  assert.equal(reused.reused, true); assert.equal(calls, 1); assert.equal(row.expiresAt.getTime(), expiry);
  const input = { address, latitude: row.latitude, longitude: row.longitude };
  const saved = await resolveServiceLocation(input, { ...input, locationSource: "google", locationKey: row.addressKey, locationExpiresAt: "2099-01-01", locationPlaceId: "forged" }, undefined, store);
  assert.equal(saved.locationExpiresAt.getTime(), expiry); assert.equal(saved.locationPlaceId, "fixture-place");
  const existing = { id: 1, ...input, ...saved };
  assert.equal((await resolveServiceLocation(input, { ...input, locationSource: "google", locationKey: row.addressKey }, existing, store)).locationExpiresAt.getTime(), expiry);
  assert.deepEqual(await resolveServiceLocation({ name: "Other name" }, { name: "Other name" }, existing, store), {});
  await fails(() => resolveServiceLocation({ ...input, address: "Other street, Latvia" }, { ...input, locationSource: "google", locationKey: row.addressKey }, existing, store), 409);
  await fails(() => resolveServiceLocation({ ...input, latitude: 12 }, { locationSource: "google", locationKey: row.addressKey }, undefined, store), 409);
  await fails(() => resolveServiceLocation(input, { locationSource: "invalid" }, undefined, store), 400);
  await fails(() => resolveServiceLocation({ address: null }, { address: null }, existing, store), 400);
  await fails(() => resolveServiceLocation({ address: "Other street, Latvia" }, { address: "Other street, Latvia" }, { ...existing, locationSource: "manual" }, store), 400);
  await fails(() => resolveServiceLocation({ latitude: 10 }, { latitude: 10, locationSource: "manual" }, existing, store), 400);
  row.expiresAt = new Date(Date.now() - 1);
  await fails(() => resolveServiceLocation(input, { locationSource: "google", locationKey: row.addressKey }, undefined, store), 409);
  for (const expired of [row.expiresAt, null, "invalid"]) assert.equal(currentLocation({ ...existing, locationExpiresAt: expired }).latitude, null);
  assert.equal(currentLocation({ ...existing, locationSource: "manual", locationExpiresAt: null }).latitude, input.latitude);
  assert.equal(currentLocation({ ...existing, locationSource: "legacy", locationExpiresAt: null }).latitude, input.latitude);
  await registerLocation(address, owner, store, lookup); assert.equal(calls, 2);
  row = undefined;
  const rejectedLookup = async () => { calls++; await new Promise(resolve => setTimeout(resolve, 5)); throw new GeocodingError(422, "UNCERTAIN_MATCH", "Uncertain"); };
  const rejected = await Promise.allSettled(Array.from({ length: 5 }, () => registerLocation(address, owner, store, rejectedLookup)));
  assert.ok(rejected.every(value => value.status === "rejected")); assert.equal(calls, 3); assert.equal(row, undefined);
  await registerLocation(address, owner, store, lookup); assert.equal(calls, 4, "Failure must allow a later retry");
  const good = { place_id: "fixture-place", types: ["street_address"], geometry: { location: { lat: 56.95, lng: 24.1 }, location_type: "ROOFTOP" }, formatted_address: "Never store Google's formatted address" };
  const google = results => async () => new Response(JSON.stringify({ status: "OK", results }));
  assert.deepEqual(await geocodeRegisteredAddress(address, google([good])), { latitude: 56.95, longitude: 24.1, placeId: "fixture-place" });
  for (const bad of [{ ...good, partial_match: true }, { ...good, place_id: "" }, { ...good, place_id: 123 }, { ...good, types: "street_address" }, { ...good, types: ["locality"] }, { ...good, geometry: { ...good.geometry, location_type: "APPROXIMATE" } }]) {
    await fails(() => geocodeRegisteredAddress(address, google([bad])), 422);
  }
  await fails(() => geocodeRegisteredAddress(address, google([good, good])), 422);
  await fails(() => geocodeRegisteredAddress(address, async () => new Response("null")), 503);
  await fails(() => geocodeRegisteredAddress(address, google([{ ...good, geometry: { ...good.geometry, location: { lat: 999, lng: 0 } } }])), 503);

  globalThis.React = React;
  const { default: LocationFields } = await import("../client/src/components/provider/service-location-fields.tsx");
  const { createServiceDraft } = await import("../client/src/components/provider/service-draft.ts");
  const { act, create } = renderer;
  let state, component, requests = 0, release, signal;
  globalThis.fetch = async (_url, options) => {
    requests++; signal = options.signal;
    return new Promise(resolve => { release = () => resolve(new Response(JSON.stringify({ ...saved, locationExpiresAt: new Date(Date.now() + 100000), reused: true }))); });
  };
  function Harness() { const [draft, setDraft] = React.useState(createServiceDraft()); state = draft; return React.createElement(LocationFields, { newService: draft, setNewService: setDraft }); }
  const field = id => component.root.findAllByType("input").find(node => node.props.id === id);
  const verify = () => component.root.findAllByType("button").find(node => node.props["data-testid"] === "button-verify-address");
  const change = async (id, value) => act(async () => field(id).props.onChange({ target: { value } }));
  await act(async () => { component = create(React.createElement(Harness)); });
  assert.equal(requests, 0, "Rendering must never geocode");
  await act(async () => verify().props.onClick()); assert.equal(requests, 0, "Invalid input is rejected locally");
  await change("address", address);
  let pending, duplicate;
  await act(async () => { const click = verify().props.onClick; pending = click(); duplicate = click(); });
  assert.equal(requests, 1); assert.equal(verify().props.disabled, true);
  await act(async () => { release(); await Promise.all([pending, duplicate]); });
  assert.equal(state.address, address, "Keep the user's address, not Google's formatted address");
  assert.equal(state.locationSource, "google"); assert.equal(state.latitude, 56.95);
  await act(async () => verify().props.onClick()); assert.equal(requests, 1, "An unchanged eligible location makes no request");
  await change("address", "Other street 20, Rīga, Latvia");
  assert.equal(state.latitude, null); assert.equal(state.longitude, null); assert.equal(state.locationKey, null);
  await act(async () => { pending = verify().props.onClick(); });
  await change("address", "Another street 30, Rīga, Latvia"); assert.equal(signal.aborted, true);
  await act(async () => { release(); await pending; }); assert.equal(state.latitude, null, "An old response must not overwrite a changed address");
  await change("latitude", "0"); await change("longitude", "0");
  assert.equal(state.locationSource, "manual"); assert.equal(state.latitude, 0); assert.equal(state.longitude, 0);
  assert.equal(verify().props.disabled, true);
  await change("address", address);
  await act(async () => { pending = verify().props.onClick(); release(); await pending; });
  await change("latitude", "10"); assert.equal(state.longitude, null, "Manual entry cannot silently retain half a Google coordinate pair");
  await act(async () => component.unmount());
  const { QueryClient } = await import("@tanstack/react-query");
  const { expireCachedLocations } = await import("../client/src/lib/location-expiry.ts");
  const client = new QueryClient();
  const expired = { ...existing, locationExpiresAt: new Date(1000).toISOString(), locationAddressSource: "user", distance: 1 };
  client.setQueryData(["services"], [expired]);
  client.setQueryData(["bookings"], [{ service: { ...expired, locationAddressSource: "google" } }]);
  client.setQueryData(["other"], { name: "Keep stable references" });
  const stable = client.getQueryData(["other"]);
  expireCachedLocations(client, 2000);
  assert.equal(client.getQueryData(["services"])[0].latitude, null);
  assert.equal(client.getQueryData(["services"])[0].distance, undefined);
  assert.equal(client.getQueryData(["services"])[0].address, address);
  assert.equal(client.getQueryData(["bookings"])[0].service.address, null);
  assert.equal(client.getQueryData(["other"]), stable);
  client.clear();
  delete globalThis.window; delete globalThis.document;
  process.env.SUPABASE_URL = "http://127.0.0.1:1";
  process.env.SUPABASE_PUBLISHABLE_KEY = "fixture-key";
  process.env.SUPABASE_SECRET_KEY = "fixture-key";
  process.env.SESSION_SECRET = "fixture-secret-for-local-tests-only-123456";
  process.env.OPENAI_API_KEY = "fixture-key";
  const { registerRoutes } = await import("../server/routes.ts");
  const { locationStore } = await import("../server/registeredLocations.ts");
  const { isAuthenticated } = await import("../server/auth.ts");
  const routes = [], app = () => {};
  app.set = app.use = () => app;
  for (const method of ["get", "post", "put", "patch", "delete"]) app[method] = (path, ...handlers) => { routes.push({ method, path, handlers }); return app; };
  const server = await registerRoutes(app);
  try {
    assert.equal(routes.some(route => route.method === "get" && route.path === "/api/geocode"), false, "Do not expose the unused public uncached geocoding shortcut");
    const route = routes.find(route => route.method === "post" && route.path === "/api/geocode");
    assert.equal(route.handlers[0], isAuthenticated);
    locationStore.manual = async () => undefined;
    locationStore.get = async () => row;
    async function request(body, allowed) {
      let code = 200, data;
      const res = { status(value) { code = value; return this; }, json(value) { data = value; return this; } };
      await route.handlers.at(-1)({ body, user: { claims: { sub: "fixture" } }, workspace: { company: null, permissions: { manageServices: allowed } } }, res);
      return { code, data };
    }
    assert.equal((await request({ address }, false)).code, 403);
    assert.equal((await request({ address: [] }, true)).code, 400);
    const cachedResponse = await request({ address }, true);
    assert.equal(cachedResponse.code, 200); assert.equal(cachedResponse.data.reused, true);
    assert.equal(cachedResponse.data.formattedAddress, undefined);
    let status;
    await isAuthenticated({ session: {} }, { status(value) { status = value; return this; }, json() {} }, () => { throw new Error("Anonymous lookup must be rejected"); });
    assert.equal(status, 401);
  } finally { server.close(); }
  console.log("Passed: local validation, quality checks, cache reuse/expiry, concurrent requests and failures, trusted save metadata, manual sources, no lookups on render, double clicks, stale responses, and zero coordinates.");
} finally { await pool.end(); }
