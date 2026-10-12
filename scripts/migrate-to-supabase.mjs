import "dotenv/config";
import pg from "pg";
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const tables = ["sessions", "users", "services", "bookings", "service_embeddings", "availability"];
const sequences = ["services_id_seq", "bookings_id_seq", "service_embeddings_id_seq", "availability_id_seq"];
const sourceUrl = process.env.SOURCE_DATABASE_URL;
const targetUrl = process.env.DATABASE_URL;

// Pass credentials through the tool environment, never shell strings or arguments.
function toolEnv(connectionString) {
  const url = new URL(connectionString);
  const env = {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGCONNECT_TIMEOUT: "10",
    PGSSLMODE: url.searchParams.get("sslmode") || "verify-full",
  };
  for (const [parameter, variable] of [
    ["sslrootcert", "PGSSLROOTCERT"], ["sslcert", "PGSSLCERT"], ["sslkey", "PGSSLKEY"],
  ]) {
    if (url.searchParams.has(parameter)) env[variable] = url.searchParams.get(parameter);
  }
  return env;
}

function runTool(command, args, env) {
  const result = spawnSync(command, args, { env, encoding: "utf8", windowsHide: true, maxBuffer: 10 * 1024 * 1024 });
  if (result.error?.code === "ENOENT") {
    throw new Error(`Install PostgreSQL client tools and add ${command} to PATH. See docs/supabase.md.`);
  }
  if (result.error || result.status !== 0) {
    // Database tool output can include secrets; do not print it.
    throw new Error(`${command} failed. Check permissions, connectivity, TLS, and client version. Backup files are retained.`);
  }
}

async function counts(client) {
  const result = {};
  for (const table of tables) {
    const { rows } = await client.query(`SELECT count(*)::text AS count FROM public."${table}"`);
    result[table] = rows[0].count;
  }
  return result;
}

let source;
let target;
try {
  if (!sourceUrl || !targetUrl) throw new Error("Set SOURCE_DATABASE_URL and DATABASE_URL in .env before migrating. Keep passwords out of chat.");
  const sourceIdentity = new URL(sourceUrl);
  const targetIdentity = new URL(targetUrl);
  for (const url of [sourceIdentity, targetIdentity]) {
    if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("Use PostgreSQL connection strings, not Supabase API keys.");
  }
  if (sourceIdentity.hostname === targetIdentity.hostname && sourceIdentity.pathname === targetIdentity.pathname && sourceIdentity.username === targetIdentity.username) {
    throw new Error("Source and target must be different databases.");
  }
  for (const tool of ["pg_dump", "pg_restore", "psql"]) runTool(tool, ["--version"], process.env);
  source = new pg.Client({ connectionString: sourceUrl, connectionTimeoutMillis: 10_000 });
  target = new pg.Client({ connectionString: targetUrl, connectionTimeoutMillis: 10_000 });
  await source.connect();
  await target.connect();

  const existing = await target.query(
    "SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = ANY($1::text[])",
    [[...tables, ...sequences]],
  );
  if (existing.rows.length) throw new Error("Target already contains application tables or sequences. Nothing was overwritten. Use an empty Supabase project.");
  const roles = await target.query("SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')");
  if (roles.rows.length !== 2) throw new Error("Target is missing Supabase API roles. Check DATABASE_URL points to your Supabase project.");
  const sourceCounts = await counts(source);
  console.table(sourceCounts);
  console.log("Preflight passed: source tables exist and target has no application tables.");
  if (!process.argv.includes("--apply")) {
    console.log("Read-only check complete. Pause source application writes, then run npm run db:transfer -- --apply.");
  } else {
    const backupDir = resolve("database-backups", new Date().toISOString().replace(/[:.]/g, "-"));
    mkdirSync(backupDir, { recursive: true });
    const archive = resolve(backupDir, "application.dump");
    const sql = resolve(backupDir, "application.sql");
    const secureSql = fileURLToPath(new URL("./supabase-secure-tables.sql", import.meta.url));
    console.log("Backing up application tables and sequences. Source data will not be modified.");
    runTool("pg_dump", [
      "--format=custom", "--no-owner", "--no-privileges", "--file", archive,
      ...[...tables, ...sequences].map(name => `--table=public.${name}`),
    ], toolEnv(sourceUrl));
    runTool("pg_restore", ["--no-owner", "--no-privileges", "--file", sql, archive], process.env);
    console.log("Restoring tables, data, sequences, and access restrictions in one transaction.");
    runTool("psql", ["--no-psqlrc", "--single-transaction", "--set=ON_ERROR_STOP=1", "--file", sql, "--file", secureSql], toolEnv(targetUrl));
    const targetCounts = await counts(target);
    for (const table of tables) {
      if (targetCounts[table] !== sourceCounts[table]) throw new Error(`Row counts differ for ${table}. Keep the application on the source and investigate writes before switching.`);
    }
    const security = await target.query(
      "SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = ANY($1::text[]) AND NOT c.relrowsecurity",
      [tables],
    );
    if (security.rows.length) throw new Error("Row-level security verification failed. Do not switch the application yet.");
    console.table(targetCounts);
    console.log(`Transfer verified. Backup saved in ${backupDir}. Update the deployed backend DATABASE_URL and restart it.`);
  }
} catch (error) {
  let message = error instanceof Error ? error.message : "Database migration failed.";
  for (const connection of [sourceUrl, targetUrl].filter(Boolean)) {
    message = message.split(connection).join("[redacted connection]");
    try {
      const password = new URL(connection).password;
      if (password) {
        message = message.split(password).join("[redacted]");
        message = message.split(decodeURIComponent(password)).join("[redacted]");
      }
    } catch { /* Never print an invalid connection string. */ }
  }
  console.error(message);
  process.exitCode = 1;
} finally {
  await source?.end().catch(() => {});
  await target?.end().catch(() => {});
}
