// Migration and CRUD checks use connection-local temporary tables, preserving customer data.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import "dotenv/config";
import { pool } from "../server/db.ts";
import { categoryStore } from "../server/categories.ts";

pool.options.max = 1;
pool.options.idleTimeoutMillis = 0;
// Pin a client: pool.query discards its connection after an expected SQL error,
// which would lose temporary tables and fall back to public tables.
const client = await pool.connect();
const originalQuery = pool.query;
pool.query = client.query.bind(client);
try {
  const security = (await pool.query(`SELECT relrowsecurity AS rls,
    has_table_privilege('anon','public.categories','SELECT,INSERT,UPDATE,DELETE') AS anon_access,
    has_table_privilege('authenticated','public.categories','SELECT,INSERT,UPDATE,DELETE') AS browser_access
    FROM pg_class WHERE oid = 'public.categories'::regclass`)).rows[0];
  assert.equal(security.rls, true); assert.equal(security.anon_access, false); assert.equal(security.browser_access, false);
  await pool.query("CREATE TEMP TABLE services (id integer PRIMARY KEY, category varchar NOT NULL); INSERT INTO pg_temp.services VALUES (1,'education'),(2,'legacy_category')");
  const migration = (await readFile(new URL("../migrations/0005_categories.sql", import.meta.url), "utf8"))
    .replaceAll("public.", "pg_temp.")
    .replaceAll("categories_name_idx", "category_fixture_name_idx")
    .replaceAll("services_category_idx", "category_fixture_service_idx");
  await pool.query(migration);
  assert.equal((await categoryStore.list()).length, 4);
  assert.equal((await categoryStore.list()).find(row => row.key === "legacy_category").name, "legacy_category");
  await categoryStore.update("education", { name: "Learning", icon: "📚", searchKeywords: "lessons" });
  await pool.query(migration);
  assert.equal((await categoryStore.list()).find(row => row.key === "education").name, "Learning", "Rerunning setup preserves administrator edits");
  assert.deepEqual((await pool.query("SELECT * FROM pg_temp.services ORDER BY id")).rows, [{ id: 1, category: "education" }, { id: 2, category: "legacy_category" }]);
  const sports = { key: "sports", name: "Sports", icon: "⚽", searchKeywords: "fitness" };
  assert.deepEqual(await categoryStore.create(sports), sports);
  await assert.rejects(categoryStore.create(sports), error => (error.cause ?? error).code === "23505");
  await assert.rejects(categoryStore.create({ ...sports, key: "sports2", name: "SPORTS" }), error => (error.cause ?? error).code === "23505");
  await pool.query("INSERT INTO pg_temp.services VALUES (3,'sports')");
  await assert.rejects(categoryStore.remove("sports"), error => (error.cause ?? error).code === "23503");
  await assert.rejects(pool.query("INSERT INTO pg_temp.services VALUES (4,'missing')"), error => error.code === "23503");
  await assert.rejects(pool.query("UPDATE pg_temp.services SET category='missing' WHERE id=3"), error => error.code === "23503");
  await categoryStore.update("sports", { name: "Exercise", icon: "🏋️", searchKeywords: "workout" });
  assert.equal((await pool.query("SELECT category FROM pg_temp.services WHERE id=3")).rows[0].category, "sports");
  await pool.query("UPDATE pg_temp.services SET category='education' WHERE id=3");
  await categoryStore.remove("sports");
  assert.ok(!(await categoryStore.list()).some(row => row.key === "sports"));
  await assert.rejects(categoryStore.remove("missing"), error => error.status === 404);
  await assert.rejects(categoryStore.update("missing", { name: "Missing", icon: "", searchKeywords: "" }), error => error.status === 404);
  console.log("Category migration, idempotency, legacy preservation, CRUD, foreign keys, and database security passed.");
} finally { pool.query = originalQuery; client.release(); await pool.end(); }
