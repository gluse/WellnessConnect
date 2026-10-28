import "dotenv/config";
import pg from "pg";
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";
import { readFileSync } from "node:fs";
import tls from "node:tls";
import { assertAuditActivation, auditApplicationConnection } from "./audit/config";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set to a PostgreSQL connection string. See .env.example and docs/supabase.md.",
  );
}

assertAuditActivation(process.env);
const auditConnection = process.env.AUDIT_ENABLED === "true" ? auditApplicationConnection(process.env.DATABASE_URL) : undefined;
export const pool = new pg.Pool({
  ...(auditConnection ? {
    host: auditConnection.host, port: auditConnection.port, user: auditConnection.user,
    password: auditConnection.password, database: auditConnection.database,
    ...{ replication: "false", sslnegotiation: "postgres" }, options: "-c search_path=pg_catalog,public",
    ssl: { rejectUnauthorized: true, servername: auditConnection.host, checkServerIdentity: tls.checkServerIdentity,
      minVersion: "TLSv1.2" as const, ...(auditConnection.caPath ? { ca: readFileSync(auditConnection.caPath, "utf8") } : {}) },
  } : { connectionString: process.env.DATABASE_URL }),
  max: 5,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
});
pool.on("error", (error) => {
  console.error("PostgreSQL pool error:", "code" in error ? error.code : error.name);
});
export const db = drizzle({ client: pool, schema });
