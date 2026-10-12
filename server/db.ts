import "dotenv/config";
import pg from "pg";
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set to a PostgreSQL connection string. See .env.example and docs/supabase.md.",
  );
}

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
});
pool.on("error", (error) => {
  console.error("PostgreSQL pool error:", "code" in error ? error.code : error.name);
});
export const db = drizzle({ client: pool, schema });
