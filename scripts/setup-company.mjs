import "dotenv/config";
import { readFile } from "node:fs/promises";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10_000 });
try {
  const sql = await readFile(new URL("../migrations/0001_company_providers.sql", import.meta.url), "utf8");
  await pool.query(sql);
  console.log("Company profiles and employees are ready. Existing services remain individual listings.");
} catch (error) {
  console.error("Company setup failed:", error.code || error.name);
  process.exitCode = 1;
} finally {
  await pool.end();
}
