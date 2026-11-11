import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import * as orm from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import * as schema from "../shared/schema.ts";
import * as money from "../server/money.ts";
import * as gallery from "../server/serviceImages.ts";
import * as storefront from "../shared/storefront.ts";
import * as serviceBookingProtection from "../server/service-booking-protection.ts";
import { assertReminderConfiguration } from "../server/notifications/repository.ts";

// Actual storage + entitlement decisions; only persistence, unrelated operations
// and scheduler invocation are synthetic. No client, environment or network load.
const base = { id: 1, providerId: "provider", companyId: null, addressId: null, name: "Synthetic service", category: "education",
  price: "10.00", currency: "EUR", duration: 30, imageUrl: null, imageUrls: [], reminderEnabled: true,
  reminderMethod: "email", reminderHours: 24, reminderMessage: "Original instructions" };
const dialect = new PgDialect();
let source, pro, changes, reconciliation, activeTransaction;
function reset(hasPro = true) { source = { ...base }; pro = hasPro; changes = []; reconciliation = []; activeTransaction = false; }
const database = {
  async execute(query) { assert.ok(activeTransaction); assert.match(dialect.sqlToQuery(query).sql, /^INSERT INTO public.customer_service_notifications/); return { rows: [] }; },
  select() {
    let table, predicate;
    const query = { from(value) { table = orm.getTableName(value); return this; }, where(value) { predicate = value; return this; },
      leftJoin() { return this; }, innerJoin() { return this; }, groupBy() { return this; }, for() { assert.ok(activeTransaction); return this; },
      as() { return { serviceId: orm.sql`review_stats.service_id`, rating: orm.sql`review_stats.rating`, reviewCount: orm.sql`review_stats.review_count` }; },
      then(resolve, reject) {
        const params = predicate ? dialect.sqlToQuery(predicate).params : [];
        const rows = table === "services" ? params.includes(source.id) && (!params.some(value => typeof value === "string") || params.includes(source.providerId)) ? [source] : []
          : table === "provider_subscriptions" && pro ? [{ userId: "provider", companyId: null, plan: "pro", proUntil: new Date("2099-01-01T00:00:00Z") }] : [];
        return Promise.resolve(rows).then(resolve, reject);
      } };
    return query;
  },
  insert() { return { values(value) { return { async returning() { assert.ok(activeTransaction); changes.push(value); return [{ id: 2, ...value }]; } }; } }; },
  update() { return { set(value) { return { where() { return { async returning() { assert.ok(activeTransaction); changes.push(value); source = { ...source, ...value }; return [source]; } }; } }; } }; },
  async transaction(action) { activeTransaction = true; try { return await action(database); } finally { activeTransaction = false; } },
};
const dependencies = {
  "./service-booking-protection": serviceBookingProtection,
  "@shared/schema": schema, "drizzle-orm": orm, "./db": { db: database }, "./money": money,
  "./serviceImages": gallery, "@shared/storefront": storefront, "node:crypto": await import("node:crypto"),
  "./addresses": { serviceLocation: value => value }, "./storefronts": {}, "@shared/provider": {}, "@shared/scheduling": {},
  "@shared/reviews": {}, "./searchInput": {}, "./customerBookings": {}, "./audit/context": {}, "./audit/events": {}, "./audit/capture": {},
  "./notifications/policy": {}, "./notifications/repository": { assertReminderConfiguration,
    async reconcileServiceReminders(tx, id) { assert.equal(tx, database); assert.ok(activeTransaction); reconciliation.push(id); } },
};
const code = ts.transpileModule(await readFile(new URL("../server/storage.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
vm.runInNewContext(`(function(require,module,exports){${code}\n})`, { Date, Map, Set, Buffer }, { filename: "server/storage.ts" })(name => {
  assert.ok(Object.hasOwn(dependencies, name), `Blocked external dependency: ${name}`); return dependencies[name];
}, module, module.exports);
const storage = new module.exports.DatabaseStorage();
let cases = 0;
reset();
const draft = schema.insertServiceSchema.pick({ reminderMessage: true });
assert.equal(draft.parse({ reminderMessage: "  Bring documents.\nArrive early. " }).reminderMessage, "Bring documents.\nArrive early."); cases++;
for (const value of [null, 42, "x".repeat(1001)]) { assert.equal(draft.safeParse({ reminderMessage: value }).success, false); cases++; }
assert.equal(draft.safeParse({ reminderMessage: "x".repeat(1000) }).success, true); cases++;
assert.equal(draft.safeParse({}).success, true, "Old clients can omit the new field"); cases++;
const note = "Bring <documents> & {date}.\nArrive early.";
assert.equal((await storage.createService({ ...base, reminderMessage: note })).reminderMessage, note); cases++;
reset(false);
await assert.rejects(storage.createService({ ...base, reminderEnabled: false, reminderMessage: note }), error => error.status === 403);
assert.equal(changes.length, 0, "Entitlement denial precedes insertion"); cases++;
reset();
assert.equal((await storage.updateService(1, { reminderMessage: note })).reminderMessage, note);
assert.deepEqual(reconciliation, [1], "Message edit refreshes existing future reminders in the same transaction"); cases++;
reset(false);
await assert.rejects(storage.updateService(1, { reminderMessage: note }), error => error.status === 403);
assert.equal(changes.length, 0); assert.equal(reconciliation.length, 0); cases++;
assert.equal((await storage.updateService(1, { reminderMessage: base.reminderMessage, name: "Renamed" })).reminderMessage, base.reminderMessage);
assert.equal(reconciliation.length, 0, "Expired PRO does not prevent unrelated edits preserving an unchanged note"); cases++;
reset();
assert.equal((await storage.updateService(1, { reminderMessage: "" })).reminderMessage, ""); assert.deepEqual(reconciliation, [1]); cases++;
reset();
const copied = await storage.copyService(1, "provider");
assert.equal(copied.reminderMessage, base.reminderMessage); assert.equal(copied.reminderEnabled, false); cases++;
assert.equal(await storage.copyService(1, "other-provider"), undefined, "Another workspace cannot copy custom instructions"); cases++;
console.log(`Custom service reminders: ${cases} storage/input scenarios passed (actual storage and PRO decisions; strict in-memory adapters).`);
