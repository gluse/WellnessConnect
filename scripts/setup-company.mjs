import "dotenv/config";
import { readFile } from "node:fs/promises";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10_000 });
try {
  for (const file of ["0001_company_providers.sql", "0002_company_teams.sql"]) {
    const sql = await readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8");
    await pool.query(sql);
  }
  console.log("Company workspaces and team permissions are ready. Existing company records were preserved.");
} catch (error) {
  console.error("Company setup failed:", error.code || error.name);
  process.exitCode = 1;
} finally {
  await pool.end();
}
