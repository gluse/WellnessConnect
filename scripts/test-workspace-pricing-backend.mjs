import assert from "node:assert/strict";
import { IncomingMessage, ServerResponse } from "node:http";
import { Duplex } from "node:stream";
import { once } from "node:events";
import express from "express";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import * as drizzle from "drizzle-orm";
import * as schema from "../shared/schema.ts";
import * as locations from "../shared/locations.ts";
import * as money from "../server/money.ts";
import { getTableName } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { createWorkspacePricingStore } from "../server/workspace-pricing/store.ts";
import { setupWorkspacePricingRoutes } from "../server/workspace-pricing/routes.ts";
import { workspacePricingUpdateSchema, WorkspacePricingError } from "../shared/workspace-pricing.ts";

// Real store/HTTP route + relational persistence adapter; no DB/env/provider or
// socket is imported. SQL predicates are evaluated rather than authorization mocked.
const dialect = new PgDialect(), rows = { users: [{ id: "alice" }, { id: "bob" }], companies: [{ id: 7, isActive: true }, { id: 8, isActive: true }],
  company_memberships: [{ companyId: 7, userId: "alice", role: "owner" }, { companyId: 8, userId: "alice", role: "admin" }, { companyId: 7, userId: "bob", role: "provider" }], workspace_pricing_settings: [] };
const operations = [];
let revisionRace = false, insertRace = false;
const camel = value => value.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
function matches(row, condition) {
  if (!condition) return true;
  const { sql, params } = dialect.sqlToQuery(condition);
  for (const match of sql.matchAll(/"\w+"\."(\w+)" = \$(\d+)/g)) if (row[camel(match[1])] !== params[Number(match[2]) - 1]) return false;
  for (const match of sql.matchAll(/"\w+"\."(\w+)" is null/gi)) if (row[camel(match[1])] != null) return false;
  return true;
}
const database = {
  select() {
    let table, condition;
    const query = { from(value) { table = getTableName(value); return query; }, where(value) { condition = value; return query; }, orderBy() { return query; },
      for(mode) { operations.push({ table, lock: mode }); return query; },
      then(yes, no) { return Promise.resolve(rows[table].filter(row => matches(row, condition)).map(row => ({ ...row }))).then(yes, no); } };
    return query;
  },
  update(table) {
    const name = getTableName(table); let changes, condition;
    const query = { set(value) { changes = value; return query; }, where(value) { condition = value; return query; }, async returning() {
      if (revisionRace) { revisionRace = false; rows[name][0].revision++; }
      const selected = rows[name].filter(row => matches(row, condition));
      for (const row of selected) { Object.assign(row, changes); operations.push({ table: name, update: { ...changes } }); }
      return selected.map(row => ({ ...row }));
    } }; return query;
  },
  insert(table) {
    const name = getTableName(table); let values;
    const query = { values(value) { values = value; return query; }, onConflictDoNothing() { return query; }, async returning() {
      if (insertRace) { insertRace = false; return []; }
      if (rows[name].some(row => values.userId != null ? row.userId === values.userId : row.companyId === values.companyId)) return [];
      rows[name].push({ ...values }); operations.push({ table: name, insert: { ...values } }); return [{ ...values }];
    } }; return query;
  },
  async transaction(work) {
    const previous = structuredClone(rows);
    try { return await work(database); } catch (error) { for (const key of Object.keys(rows)) rows[key] = previous[key]; throw error; }
  },
};
const store = createWorkspacePricingStore(database), personal = { userId: "alice" }, company = { userId: "alice", companyId: 7 };
const personalWorkspace = { kind: "user", id: "alice" }, companyWorkspace = { kind: "company", id: 7 };
let checks = 0;
const check = fn => { fn(); checks++; };
const input = (workspace, expectedRevision, changes) => workspacePricingUpdateSchema.parse({ expectedWorkspace: workspace, expectedRevision, ...changes });
const pristine = await store.get(personal);
check(() => { assert.deepEqual(pristine, { workspace: personalWorkspace, defaultCurrency: null, businessCountryCode: null, revision: 0, canEdit: true }); assert.equal(operations.length, 0, "GET has no lazy writes"); });
let result = await store.patch(personal, input(personalWorkspace, 0, { defaultCurrency: "USD", businessCountryCode: "LV" }));
check(() => { assert.equal(result.revision, 1); assert.equal(result.defaultCurrency, "USD"); assert.equal(rows.workspace_pricing_settings[0].userId, "alice"); assert.equal(rows.workspace_pricing_settings[0].companyId, null); });
result = await store.patch(company, input(companyWorkspace, 0, { defaultCurrency: "EUR" }));
check(() => { assert.equal(result.revision, 1); assert.equal((rows.workspace_pricing_settings.find(row => row.companyId === 7)).userId, null); });
result = await store.patch(personal, input(personalWorkspace, 1, { defaultCurrency: null }));
check(() => { assert.equal(result.revision, 2); assert.equal(result.defaultCurrency, null); assert.equal(result.businessCountryCode, "LV", "omitted settings remain unchanged"); });
await assert.rejects(() => store.patch(personal, input(personalWorkspace, 1, { defaultCurrency: "JPY" })), error => error.code === "WORKSPACE_PRICING_CHANGED"); checks++;
await assert.rejects(() => store.patch(company, input(personalWorkspace, 2, { defaultCurrency: "USD" })), error => error.code === "WORKSPACE_CHANGED"); checks++;
check(() => { assert.equal((rows.workspace_pricing_settings.find(row => row.userId === "alice")).revision, 2); assert.equal((rows.workspace_pricing_settings.find(row => row.companyId === 7)).defaultCurrency, "EUR"); });
for (const actor of [{ userId: "bob", companyId: 7 }, { userId: "outsider", companyId: 7 }, { userId: "missing" }]) {
  const before = operations.filter(row => row.update || row.insert).length;
  await assert.rejects(() => store.get(actor), error => error.status === 403); checks++;
  await assert.rejects(() => store.patch(actor, input(actor.companyId ? companyWorkspace : { kind: "user", id: actor.userId }, 0, { defaultCurrency: "GBP" })), error => error.status === 403); checks++;
  check(() => assert.equal(operations.filter(row => row.update || row.insert).length, before));
}
rows.company_memberships.find(row => row.userId === "bob").role = "viewer";
await assert.rejects(() => store.get({ userId: "bob", companyId: 7 }), error => error.status === 403); checks++;
rows.companies.find(row => row.id === 7).isActive = false;
await assert.rejects(() => store.patch(company, input(companyWorkspace, 1, { defaultCurrency: "GBP" })), error => error.status === 403); checks++;
rows.companies.find(row => row.id === 7).isActive = true;
await store.patch({ userId: "alice", companyId: 8 }, input({ kind: "company", id: 8 }, 0, { defaultCurrency: "GBP" })); checks++;
revisionRace = true;
await assert.rejects(() => store.patch(personal, input(personalWorkspace, 2, { defaultCurrency: "CAD" })), error => error.code === "WORKSPACE_PRICING_CHANGED"); checks++;
insertRace = true;
await assert.rejects(() => store.patch({ userId: "bob" }, input({ kind: "user", id: "bob" }, 0, { defaultCurrency: "CAD" })), error => error.code === "WORKSPACE_PRICING_CHANGED"); checks++;
check(() => assert.ok(operations.every(row => ["workspace_pricing_settings", "users", "companies", "company_memberships"].includes(row.table)), "no service/booking or public profile writes"));
const ownSettings = rows.workspace_pricing_settings.find(row => row.userId === "alice");
ownSettings.revision = 2147483647;
await assert.rejects(() => store.patch(personal, { expectedWorkspace: personalWorkspace, expectedRevision: 2147483647, defaultCurrency: "EUR" }), error => error.code === "WORKSPACE_PRICING_CHANGED"); checks++;
rows.workspace_pricing_settings.find(row => row.userId === "alice").revision = 2;

async function request(app, method, body, user = "alice", companyId, query = "") {
  const chunks = [], socket = new Duplex({ read() {}, write(chunk, _encoding, done) { chunks.push(Buffer.from(chunk)); done(); } });
  Object.defineProperty(socket, "remoteAddress", { value: "127.0.0.1" });
  const req = new IncomingMessage(socket); req._read = () => {}; req.complete = true; req.url = "/api/workspace/pricing-settings" + query; req.method = method;
  req.headers = { "content-type": "application/json", ...(user ? { "x-user": user } : {}), ...(companyId ? { "x-company": String(companyId) } : {}) };
  req.body = body;
  const res = new ServerResponse(req); res.assignSocket(socket); const done = once(res, "finish"); app.handle(req, res); queueMicrotask(() => req.push(null));
  await done; socket.destroy(); const wire = Buffer.concat(chunks).toString(); const json = wire.slice(wire.indexOf("\r\n\r\n") + 4);
  return { status: res.statusCode, body: json ? JSON.parse(json) : null, headers: res.getHeaders() };
}
const app = express();
setupWorkspacePricingRoutes(app, { authenticate(req, res, next) { if (!req.headers["x-user"]) return res.status(401).json({ message: "Unauthorized" }); next(); },
  currentWorkspace(req) { return { userId: String(req.headers["x-user"]), ...(req.headers["x-company"] ? { companyId: Number(req.headers["x-company"]) } : {}) }; }, store });
result = await request(app, "GET");
check(() => { assert.equal(result.status, 200); assert.equal(result.headers["cache-control"], "private, no-store"); assert.equal(result.body.revision, 2); assert.equal(Object.hasOwn(result.body, "userId"), false); });
check(() => assert.equal(result.body.workspace.id, "alice"));
result = await request(app, "GET", null, null);
check(() => { assert.equal(result.status, 401); assert.equal(result.headers["cache-control"], "private, no-store"); });
for (const body of [{ expectedWorkspace: personalWorkspace, expectedRevision: 2 }, { expectedWorkspace: personalWorkspace, expectedRevision: 2, defaultCurrency: "ZZZ" },
  { expectedWorkspace: personalWorkspace, expectedRevision: 2, businessCountryCode: "lv" }, { expectedWorkspace: personalWorkspace, expectedRevision: 2, defaultCurrency: "USD", companyId: 7 },
  { expectedWorkspace: personalWorkspace, expectedRevision: 2, defaultCurrency: "USD", userId: "bob" }, { expectedWorkspace: personalWorkspace, expectedRevision: -1, defaultCurrency: "USD" }]) {
  result = await request(app, "PATCH", body); check(() => assert.equal(result.status, 400));
}
result = await request(app, "PATCH", { expectedWorkspace: companyWorkspace, expectedRevision: 2, defaultCurrency: "USD" });
check(() => { assert.equal(result.status, 409); assert.equal(result.body.code, "WORKSPACE_CHANGED"); });
result = await request(app, "PATCH", { expectedWorkspace: personalWorkspace, expectedRevision: 1, defaultCurrency: "USD" });
check(() => { assert.equal(result.status, 409); assert.equal(result.body.code, "WORKSPACE_PRICING_CHANGED"); });
result = await request(app, "PATCH", { expectedWorkspace: personalWorkspace, expectedRevision: 2, defaultCurrency: "USD" });
check(() => { assert.equal(result.status, 200); assert.equal(result.body.revision, 3); });
result = await request(app, "GET", null, "alice", undefined, "?userId=bob");
check(() => assert.equal(result.status, 400));
const failed = express(); setupWorkspacePricingRoutes(failed, { authenticate: (_req, _res, next) => next(), currentWorkspace: () => personal, store: { async get() { throw Error("PRIVATE_DRIVER_CANARY"); } } });
result = await request(failed, "GET");
check(() => { assert.equal(result.status, 503); assert.equal(JSON.stringify(result.body).includes("PRIVATE_"), false); });

// Exercise real address save/DTO code with the same injected relational boundary.
// The import allowlist prevents loading server/db or a connected access module.
class AddressAccessError extends Error { constructor(status, message) { super(message); this.status = status; } }
const addressDependencies = { "drizzle-orm": drizzle, "@shared/schema": schema, "@shared/locations": locations, "./db": { db: database }, "./companyAccess": { AccessError: AddressAccessError }, "./money": money };
const addressSource = await readFile(new URL("../server/addresses.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(addressSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const addressModule = { exports: {} };
vm.runInNewContext(`(function(require,module,exports){${compiled}\n})`, { Date }, { filename: "server/addresses.ts" })(name => {
  assert.ok(Object.hasOwn(addressDependencies, name), `Blocked connected import: ${name}`); return addressDependencies[name];
}, addressModule, addressModule.exports);
const savedAddress = { id: 70, providerId: "alice", companyId: null, address: "Synthetic address", countryCode: "LV", pricingCurrency: "GBP", latitude: 0, longitude: 0,
  locationSource: "manual", locationKey: null, locationPlaceId: null, locationExpiresAt: null, locationAddressSource: "user" };
rows.addresses = [{ ...savedAddress }];
const { pricingCurrency: _override, ...location } = savedAddress;
await addressModule.exports.addressStore.save(location, { providerId: "alice" }, 70);
check(() => assert.equal(rows.addresses[0].pricingCurrency, "GBP", "old address clients do not clear a saved override"));
await addressModule.exports.addressStore.save({ ...location, pricingCurrency: "USD" }, { providerId: "alice" }, 70);
check(() => assert.equal(rows.addresses[0].pricingCurrency, "USD"));
const publicService = addressModule.exports.serviceLocation({ id: 1, price: "25.00", currency: "EUR" }, rows.addresses[0]);
check(() => { assert.equal(publicService.currency, "EUR"); assert.equal(Object.hasOwn(publicService, "pricingCurrency"), false, "private address pricing default is excluded from service DTO"); });
await addressModule.exports.addressStore.save({ ...location, pricingCurrency: null }, { providerId: "alice" }, 70);
check(() => assert.equal(rows.addresses[0].pricingCurrency, null));
await assert.rejects(() => addressModule.exports.addressStore.save({ ...location, pricingCurrency: "CAD" }, { providerId: "bob" }, 70), error => error.status === 403); checks++;
check(() => assert.equal(rows.addresses[0].pricingCurrency, null, "other-workspace address edit is rejected"));
console.log(`Passed ${checks} workspace pricing backend scenarios: private selected workspace settings, read-only missing defaults, strict inputs, manager/owner authorization and revocation, inactive company, CAS/conflict/binding races, no service repricing, no-store and safe failures. In-memory adapters and HTTP streams only.`);
