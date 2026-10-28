import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import * as drizzle from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import * as schema from "../shared/schema.ts";
import * as preferences from "../shared/search-location.ts";
import { setupSearchLocationRoutes } from "../server/searchLocationRoutes.ts";

const { searchLocationSchema, encodeSearchLocation, decodeSearchLocation, SEARCH_LOCATION_MAX_AGE } = preferences;
const device = { source: "device", latitude: 56.95, longitude: 24.1 };
const address = { source: "address", inputText: "Synthetic town", placeId: "synthetic-place" };
for (const value of [device, address]) assert.deepEqual(decodeSearchLocation(encodeSearchLocation(value, 1000), 1001), value);
for (const value of [{ ...device, latitude: 91 }, { ...device, longitude: Infinity }, { ...device, userId: "forged" },
  { ...address, latitude: 1 }, { ...address, inputText: " " }, { source: "device" }, { ...address, inputText: "x".repeat(301) }]) {
  assert.equal(searchLocationSchema.safeParse(value).success, false);
}
assert.equal(decodeSearchLocation("malformed"), null);
assert.equal(decodeSearchLocation("x".repeat(3001)), null);
assert.equal(decodeSearchLocation(encodeSearchLocation(device, 1000), 1000 + SEARCH_LOCATION_MAX_AGE * 1000), null);
assert.throws(() => encodeSearchLocation({ source: "address", inputText: "界".repeat(300), placeId: "界".repeat(512) }));

// Exercise the actual store through an import whitelist. No DB module is loaded.
const calls = [], rows = new Map(); let values, where, selected, conflict;
const dialect = new PgDialect();
const db = {
  select() { return { from() { return { where(predicate) { calls.push({ kind: "read", query: dialect.sqlToQuery(predicate) }); return Promise.resolve(selected ?? []); } }; } }; },
  insert() { return { values(value) { values = value; return {
    async onConflictDoUpdate(spec) { conflict = spec; calls.push({ kind: "write", value }); },
    async onConflictDoNothing(spec) { conflict = spec; calls.push({ kind: "adopt", value }); },
  }; } }; },
  delete() { return { async where(predicate) { where = dialect.sqlToQuery(predicate); calls.push({ kind: "delete", query: where }); } }; },
};
const dependencies = { "drizzle-orm": drizzle, "@shared/schema": schema, "@shared/search-location": preferences, "./db": { db } };
const source = await readFile(new URL("../server/searchLocations.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
vm.runInNewContext(`(function(require,module,exports){${compiled}\n})`, { Date })(name => {
  assert.ok(Object.hasOwn(dependencies, name), `Blocked live import ${name}`); return dependencies[name];
}, module, module.exports);
const store = module.exports.searchLocationStore;
assert.equal(await store.get("account-a"), null);
assert.deepEqual(calls.at(-1).query.params, ["account-a"]);
await store.put("account-a", device);
assert.equal(values.userId, "account-a"); assert.equal(values.latitude, device.latitude); assert.equal(values.inputText, null);
assert.equal(conflict.target, schema.userSearchLocations.userId);
await store.put("account-b", address);
assert.equal(values.userId, "account-b"); assert.equal(values.latitude, null); assert.equal(values.longitude, null);
assert.equal(values.inputText, address.inputText); assert.equal(values.placeId, address.placeId);
selected = [{ source: "address", inputText: address.inputText, placeId: address.placeId }];
assert.deepEqual(await store.get("account-b"), address);
assert.deepEqual(await store.adopt("account-b", device), address, "Existing profile selection wins during guest adoption");
assert.equal(conflict.target, schema.userSearchLocations.userId);
await store.remove("account-a"); assert.deepEqual(where.params, ["account-a"]);
const beforeInvalid = calls.length;
await assert.rejects(store.put("account-a", { ...address, latitude: 1 }));
assert.equal(calls.length, beforeInvalid);

const app = express(); app.use(express.json({ limit: "8kb" }));
let user = null, unavailable = false;
const operations = [];
setupSearchLocationRoutes(app, (req, res, next) => {
  if (!user) return res.sendStatus(401);
  req.user = { claims: { sub: user } }; next();
}, {
  async get(id) { if (unavailable) throw Error("private data"); operations.push(["get", id]); return rows.get(id) ?? null; },
  async put(id, value) { if (unavailable) throw Error("private data"); operations.push(["put", id]); rows.set(id, value); },
  async adopt(id, value) { if (unavailable) throw Error("private data"); if (!rows.has(id)) rows.set(id, value); return rows.get(id); },
  async remove(id) { if (unavailable) throw Error("private data"); operations.push(["delete", id]); rows.delete(id); },
});
const server = createServer(app);
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}/api/account/search-location`;
const request = (method = "GET", value) => fetch(url, { method, ...(value ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) } : {}) });
try {
  for (const method of ["GET", "PUT", "DELETE"]) assert.equal((await request(method, method === "PUT" ? device : undefined)).status, 401);
  assert.equal(operations.length, 0);
  user = "account-a";
  assert.equal(await (await request()).json(), null);
  assert.equal((await request("PUT", device)).status, 204);
  const loaded = await request(); assert.deepEqual(await loaded.json(), device); assert.equal(loaded.headers.get("cache-control"), "no-store");
  const adopted = await fetch(url + "/adopt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(address) });
  assert.equal(adopted.status, 200); assert.deepEqual(await adopted.json(), device);
  assert.equal((await request("PUT", { ...device, userId: "account-b" })).status, 400);
  user = "account-b"; assert.equal(await (await request()).json(), null);
  assert.equal((await request("DELETE")).status, 204); assert.ok(rows.has("account-a"));
  unavailable = true;
  for (const method of ["GET", "PUT", "DELETE"]) {
    const response = await request(method, method === "PUT" ? address : undefined);
    assert.equal(response.status, 503); assert.ok(!(await response.text()).includes("private data"));
  }
  unavailable = false; user = "account-a";
  assert.equal((await request("DELETE")).status, 204); assert.equal(rows.has("account-a"), false);
} finally { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); }
console.log("Passed: preference validation/cookie expiry, actual store owner predicates and provenance, owner-only HTTP read/write/delete, account isolation, no-store and sanitized failures. Mocked database only.");
