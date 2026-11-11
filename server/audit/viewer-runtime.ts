import { readFile } from "node:fs/promises";
import tls from "node:tls";
import { AUDIT_PROJECTS, localAuditConnection, assertLocalAuditIsolation, assertAuditTransport, type AuditConnection } from "./config";
import type { AuditViewerStore } from "./viewer";

/** Independent SELECT-only destination credential; never fall back to a writer/owner. */
export function parseAuditReaderConnection(value: unknown, environment: Record<string, string | undefined> = {}): AuditConnection {
  const local = localAuditConnection(value, "reader", environment);
  if (local) return local;
  if (typeof value !== "string" || /[\x00-\x20\x7f]/.test(value)) throw new Error("AUDIT_READER_CONFIGURATION");
  const uri = new URL(value), host = uri.hostname.toLowerCase();
  const direct = host === `db.${AUDIT_PROJECTS.destination}.supabase.co`;
  const expected = direct ? "fmt_audit_reader_dev" : `fmt_audit_reader_dev.${AUDIT_PROJECTS.destination}`;
  if (!["postgres:", "postgresql:"].includes(uri.protocol) || uri.hash || (uri.port && uri.port !== "5432") ||
    (!direct && !/^[a-z0-9.-]+\.pooler\.supabase\.com$/.test(host)) || decodeURIComponent(uri.username) !== expected ||
    !uri.password || decodeURIComponent(uri.pathname) !== "/postgres") throw new Error("AUDIT_READER_CONFIGURATION");
  for (const key of Array.from(uri.searchParams.keys())) if (!["sslmode", "sslrootcert"].includes(key) || uri.searchParams.getAll(key).length !== 1) throw new Error("AUDIT_READER_CONFIGURATION");
  const mode = uri.searchParams.get("sslmode");
  if (mode && !["require", "verify-ca", "verify-full"].includes(mode)) throw new Error("AUDIT_READER_CONFIGURATION");
  return { host, port: 5432, user: expected, password: decodeURIComponent(uri.password), database: "postgres", caPath: uri.searchParams.get("sslrootcert") || undefined };
}
export function assertAuditReaderRole(rows: Record<string, unknown>[]) {
  const row = rows[0];
  if (rows.length !== 1 || row.principal !== "fmt_audit_reader_dev" || row.reader_member !== true || row.view_access !== true ||
    ["rolsuper", "rolbypassrls", "rolcreatedb", "rolcreaterole", "rolreplication", "base_access", "extra_role", "permanent_ddl"].some(key => row[key] !== false)) throw new Error("AUDIT_READER_CONFIGURATION");
}
export function createAuditViewerStore(environment = () => process.env): AuditViewerStore & { close(): Promise<void> } {
  let active: Promise<{ pool: import("pg").Pool; config: AuditConnection }> | undefined;
  const open = async () => {
    const input = environment();
    assertLocalAuditIsolation(input);
    const config = parseAuditReaderConnection(input.AUDIT_READER_DATABASE_URL, input);
    const { default: pg } = await import("pg");
    const ssl: tls.ConnectionOptions = { rejectUnauthorized: true, servername: config.host, minVersion: "TLSv1.2", checkServerIdentity: tls.checkServerIdentity };
    if (config.caPath) ssl.ca = await readFile(config.caPath, "utf8");
    const pool = new pg.Pool({ host: config.host, port: config.port, user: config.user, password: config.password, database: config.database,
      ssl: config.local ? false : ssl, max: 2, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 5000, query_timeout: 6000,
      application_name: "fitsmytime-audit-reader", options: "-c default_transaction_read_only=on -c statement_timeout=5000 -c lock_timeout=1000" });
    pool.on("error", () => {});
    return { pool, config };
  };
  return {
    async query(query) {
      active ??= open().catch(() => { active = undefined; throw new Error("AUDIT_READER_UNAVAILABLE"); });
      const { pool, config } = await active;
      const client = await pool.connect();
      let failed = true;
      try {
        const stream = (client as unknown as { connection: { stream: { encrypted?: boolean; authorized?: boolean; remoteAddress?: string } } }).connection.stream;
        assertAuditTransport(config, stream);
        const role = await client.query(`SELECT current_user AS principal,r.rolsuper,r.rolbypassrls,r.rolcreatedb,r.rolcreaterole,r.rolreplication,
          pg_has_role(current_user,'fm_audit_reader','USAGE') AS reader_member,
          has_table_privilege(current_user,'audit.reader_events','SELECT') AS view_access,
          has_table_privilege(current_user,'audit.events','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS base_access,
          EXISTS(SELECT 1 FROM pg_roles g WHERE g.rolname NOT IN(current_user,'fm_audit_reader') AND pg_has_role(current_user,g.oid,'MEMBER')) AS extra_role,
          has_database_privilege(current_user,current_database(),'CREATE') OR EXISTS(SELECT 1 FROM pg_namespace n WHERE has_schema_privilege(current_user,n.oid,'CREATE')) AS permanent_ddl
          FROM pg_roles r WHERE r.rolname=current_user`);
        assertAuditReaderRole(role.rows);
        const result = await client.query(query.text, query.values);
        failed = false;
        return result.rows;
      } finally { client.release(failed); }
    },
    async close() { const previous = active; active = undefined; if (previous) await (await previous).pool.end(); },
  };
}

export const auditViewerStore = createAuditViewerStore();
