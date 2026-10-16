import "dotenv/config";
import { readFile } from "node:fs/promises";
import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10_000 });
try {
  await pool.query(await readFile(new URL("../migrations/0004_registered_locations.sql", import.meta.url), "utf8"));
  console.log("Registered locations and hourly coordinate cleanup are ready. Legacy locations were preserved.");
} catch (error) {
  console.error("Location setup failed:", error.code || error.name);
  process.exitCode = 1;
} finally {
  await pool.end();
}
