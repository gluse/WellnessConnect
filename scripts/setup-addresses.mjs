import "dotenv/config";
import { readFile } from "node:fs/promises";
import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10_000 });
try {
  await pool.query(await readFile(new URL("../migrations/0008_account_addresses.sql", import.meta.url), "utf8"));
  console.log("Account addresses are ready. Existing service locations were moved without geocoding.");
} catch (error) {
  console.error("Address setup failed:", error.code || error.name);
  process.exitCode = 1;
} finally { await pool.end(); }
