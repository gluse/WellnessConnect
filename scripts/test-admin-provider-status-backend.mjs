import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import * as orm from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import * as schema from "../shared/schema.ts";
import * as scheduling from "../shared/scheduling.ts";
import * as storefront from "../shared/storefront.ts";
import * as admin from "../shared/admin.ts";

// Load actual directory/query/route code with DB and Auth boundaries replaced.
// No dotenv, credentials, sockets, server startup or database clients are loaded.
async function load(file, dependencies) {
  const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(`(function(require,module,exports){${compiled}\n})`, { Date, Map, Set, Intl }, { filename: file })(name => {
    assert.ok(Object.hasOwn(dependencies, name), `Blocked external dependency: ${file} -> ${name}`);
    return dependencies[name];
  }, module, module.exports);
  return module.exports;
}
const dialect = new PgDialect();
const profileRows = [
  { id: "user-00", currentRole: "provider" },
  { id: "user-01", currentRole: "seeker" },
  { id: "user-02", currentRole: null },
  { id: "user-03", currentRole: "unexpected" },
  { id: "outside", currentRole: "provider" },
];
const rawUsers = Array.from({ length: 30 }, (_, index) => ({
  id: `user-${String(index).padStart(2, "0")}`, email: `user-${index}@example.test`, created_at: "2026-11-01T00:00:00Z",
  user_metadata: { currentRole: index === 0 ? "seeker" : "provider", isServiceProvider: index !== 0 },
}));
let queries = [], fail = false;
const database = {
  select(fields) {
    assert.deepEqual(Object.keys(fields), ["id", "currentRole"], "Read only the fields needed for provider status");
    assert.equal(fields.id, schema.users.id); assert.equal(fields.currentRole, schema.users.currentRole);
    return { from(table) {
      assert.equal(table, schema.users);
      return { async where(predicate) {
        const query = dialect.sqlToQuery(predicate); queries.push(query);
        assert.match(query.sql, /"users"\."id" in \(/);
        if (fail) throw Error("Private connection details");
        return profileRows.filter(row => query.params.includes(row.id));
      } };
    } };
  },
};
const directory = await load("server/admin-directory.ts", {
  "./db": { db: database }, "@shared/schema": schema, "drizzle-orm": orm,
  "@shared/storefront": storefront, "@shared/scheduling": scheduling,
  "./supabase": { supabaseAdmin: { auth: { admin: { async listUsers({ page, perPage }) {
    assert.equal(page, 1); assert.equal(perPage, 1000); return { data: { users: rawUsers }, error: null };
  } } } } },
});
const emptyCompanies = async () => new Map();
const emptySubscriptions = async () => new Map();
const statuses = await directory.loadDirectoryProviderStatuses(profileRows.map(row => row.id));
assert.deepEqual([...statuses], [["user-00", true], ["user-01", false], ["user-02", null], ["user-03", null], ["outside", true]]);
assert.equal(queries.length, 1);
queries = [];
assert.equal((await directory.loadDirectoryProviderStatuses([])).size, 0);
assert.equal(queries.length, 0, "Empty page skips the DB query");
const first = await directory.registeredUserDirectory(admin.defaultAdminUserFilters, 1, 25, emptyCompanies, emptySubscriptions);
assert.equal(queries.length, 1, "A page needs one role query, never one query per row");
assert.deepEqual(queries[0].params, Array.from(first.users, user => user.id));
assert.equal(first.users.length, 25); assert.equal(first.hasNextPage, true);
assert.deepEqual(Array.from(first.users.slice(0, 5), user => user.isServiceProvider), [true, false, null, null, null]);
assert.equal(first.users[0].proSubscription.enabled, false, "Providers need no Pro subscription or company membership");
assert.equal(first.users[1].isServiceProvider, false, "Editable provider metadata cannot override an application seeker role");
assert.equal(first.users[4].isServiceProvider, null, "Never infer a role for an Auth user without an application profile");
queries = [];
const second = await directory.registeredUserDirectory(admin.defaultAdminUserFilters, 2, 25, emptyCompanies, emptySubscriptions);
assert.deepEqual(queries[0].params, Array.from(second.users, user => user.id));
assert.equal(second.users.length, 5); assert.equal(second.hasNextPage, false);
assert.ok(!queries[0].params.includes("outside"));
queries = [];
const none = await directory.registeredUserDirectory({ ...admin.defaultAdminUserFilters, search: "missing@example.test" }, 1, 25, emptyCompanies, emptySubscriptions);
assert.equal(none.users.length, 0); assert.equal(queries.length, 0);

const handlers = [];
const auth = (_req, _res, next) => next();
const routes = await load("server/adminRoutes.ts", {
  zod: await import("zod"), "./auth": { isAuthenticated: auth },
  "./appAdmin": { isAppAdmin: () => true, requireAppAdmin: auth },
  "@shared/admin": admin, "./admin-directory": directory,
});
routes.setupAdminRoutes({ get(path, ...chain) { handlers.push({ path, chain }); } }, emptyCompanies, emptySubscriptions);
const handler = handlers.find(route => route.path === "/api/admin/users").chain.at(-1);
fail = true;
const res = { code: 200, set() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
await handler({ query: {} }, res);
assert.equal(res.code, 503, "Profile query failure returns a controlled error instead of false No labels");
assert.deepEqual(Object.keys(res.body), ["message"]);
assert.ok(!JSON.stringify(res.body).includes("Private"));
console.log("PASS: provider/seeker/unknown mapping, metadata isolation, page-bounded batch queries, empty pages, pagination and sanitized role-query failure. Database/Auth boundaries mocked; no connected operations.");
