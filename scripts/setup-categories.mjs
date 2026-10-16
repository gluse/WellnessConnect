import "dotenv/config";
import { readFile } from "node:fs/promises";
import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10_000 });
try {
  await pool.query(await readFile(new URL("../migrations/0005_categories.sql", import.meta.url), "utf8"));
  console.log("Categories are ready. Existing category keys and services were preserved.");
} catch (error) {
  console.error("Category setup failed:", error.code || error.name);
  process.exitCode = 1;
} finally { await pool.end(); }
