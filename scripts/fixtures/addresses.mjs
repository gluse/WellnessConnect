import { readFile } from "node:fs/promises";

// Upgrade only connection-local fixtures, so DB regressions can run before deploy.
export async function setupAddressFixtures(query) {
  for (const table of ["users", "companies", "services"]) {
    if (!(await query("SELECT to_regclass($1) AS name", [`pg_temp.${table}`])).rows[0].name) {
      throw new Error(`Create temporary ${table} before address fixtures.`);
    }
  }
  if (!(await query("SELECT to_regclass('pg_temp.geocoding_cache') AS name")).rows[0].name) {
    await query("CREATE TEMP TABLE geocoding_cache (LIKE public.geocoding_cache INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES)");
  }
  const migration = (await readFile(new URL("../../migrations/0008_account_addresses.sql", import.meta.url), "utf8"))
    .replaceAll("public.", "pg_temp.")
    .replace("table_schema = 'public'", "table_schema = (SELECT nspname FROM pg_namespace WHERE oid = pg_my_temp_schema())");
  await query(migration);
}
