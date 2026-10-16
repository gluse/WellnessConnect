import "dotenv/config";
import { readFile } from "node:fs/promises";
import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10_000 });
try {
  await pool.query(await readFile(new URL("../migrations/0006_service_cleanup_time.sql", import.meta.url), "utf8"));
  console.log("Preparation and cleanup time is ready. Existing bookings retain zero extra minutes.");
} catch (error) {
  console.error("Preparation and cleanup time setup failed:", error.code || error.name);
  process.exitCode = 1;
} finally { await pool.end(); }
