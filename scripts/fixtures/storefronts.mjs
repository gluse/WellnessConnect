import { readFile } from "node:fs/promises";

// Never create subscriptions referencing real users or advance production sequences.
export async function setupStorefrontFixtures(query) {
  for (const table of ["users", "companies"]) {
    if (!(await query("SELECT to_regclass($1) AS table_name", [`pg_temp.${table}`])).rows[0].table_name) {
      throw new Error(`Create temporary ${table} fixtures before storefront fixtures.`);
    }
  }
  const migration = (await readFile(new URL("../../migrations/0007_pro_storefronts.sql", import.meta.url), "utf8")).replaceAll("public.", "pg_temp.");
  await query(migration);
}
