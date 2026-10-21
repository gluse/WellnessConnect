import { readFile } from "node:fs/promises";
import tls from "node:tls";
import { auditConnection, auditEnvironment, AUDIT_USERS, type AuditConnectionKind } from "./config.ts";
import { AuditCaptureUnavailable, captureIndependent, type AuditPool, type AuditExecutor, type PreparedAuditEvent } from "./capture.ts";
import { AuditPortFailure, type AuditClaim, type AuditWorkerPorts, type DeliveryDisposition } from "./worker.ts";

type Environment = Record<string, string | undefined>;
type RuntimePool = Awaited<ReturnType<typeof openPool>>;

/** Explicit startup only. Importing this module creates no pool or connection. */
async function openPool(url: string | undefined, kind: AuditConnectionKind) {
  const config = auditConnection(url, kind);
  const { default: pg } = await import("pg");
  const ssl: tls.ConnectionOptions = { rejectUnauthorized: true, servername: config.host,
    checkServerIdentity: tls.checkServerIdentity, minVersion: "TLSv1.2" };
  if (config.caPath) ssl.ca = await readFile(config.caPath, "utf8");
  // Explicit fields only: URL/libpq SSL/host/query options cannot override policy.
  const pool = new pg.Pool({ host: config.host, port: config.port, user: config.user, password: config.password,
    database: config.database, ssl, max: kind === "capture" ? 2 : 1,
    connectionTimeoutMillis: 5000, idleTimeoutMillis: 10000,
    application_name: `fitsmytime-audit-${kind}`, query_timeout: 6000,
    options: "-c statement_timeout=5000 -c lock_timeout=1000 -c idle_in_transaction_session_timeout=10000" });
  pool.on("error", () => { /* Per-operation failures/worker metrics report safe classes only. */ });
  const wrap = async () => {
    const client = await pool.connect();
    const stream = (client as unknown as { connection: { stream: { encrypted?: boolean; authorized?: boolean } } }).connection.stream;
    if (!stream.encrypted || !stream.authorized) { client.release(true); throw new AuditCaptureUnavailable(); }
    let released = false;
    return {
      query: async (text: string, values?: unknown[]) => client.query(text, values),
      release: (destroy = false) => { if (!released) { released = true; client.release(destroy); } },
    };
  };
  const adapter: AuditPool = { connect: wrap };
  return { pool, adapter };
}

async function run(pool: RuntimePool, text: string, values: unknown[] = [], signal?: AbortSignal) {
  if (signal?.aborted) throw new AuditCaptureUnavailable();
  const client = await pool.adapter.connect();
  const abort = () => client.release(true); // Destroy socket: timed-out COMMIT may still have succeeded.
  signal?.addEventListener("abort", abort, { once: true });
  let failed = false;
  try {
    if (signal?.aborted) throw new AuditCaptureUnavailable();
    return await client.query(text, values);
  } catch (error) {
    failed = true;
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    throw new AuditPortFailure(code === "42501" || code === "28P01" || code === "28000" ? "AUTHORIZATION_CONFIGURATION"
      : code === "22023" || code === "22P02" ? "INVALID_CONTRACT"
        : code === "40001" || code === "40P01" ? "DESTINATION_BUSY"
          : signal?.aborted || code === "57014" ? "DESTINATION_TIMEOUT" : "DESTINATION_UNAVAILABLE");
  }
  finally { signal?.removeEventListener("abort", abort); client.release(failed); }
}

/** Validate server-returned capability snapshot; never accepts client authority. */
export function assertAuditRuntimeRole(rows: Record<string, unknown>[], kind: AuditConnectionKind): void {
  const row = rows[0];
  if (rows.length !== 1 || row.principal !== AUDIT_USERS[kind] || row.group_member !== true || row.may_execute !== true ||
    ["rolsuper", "rolbypassrls", "rolcreaterole", "rolcreatedb", "base_access", "owner_member", "extra_application_role"].some(key => row[key] !== false)) throw new AuditCaptureUnavailable();
}

async function checkRole(pool: RuntimePool, kind: AuditConnectionKind) {
  const group = kind === "worker" ? "fm_audit_delivery" : kind === "writer" ? "fm_audit_writer" : "fm_audit_capture";
  const object = kind === "writer" ? "audit.events" : "audit_capture.audit_outbox";
  const entry = kind === "writer" ? "audit.accept(text,text,text)" : kind === "worker" ? "audit_capture.claim(integer)" : "audit_capture.enqueue(text,text,text)";
  const result = await run(pool, `SELECT current_user AS principal,r.rolsuper,r.rolbypassrls,r.rolcreaterole,r.rolcreatedb,
    pg_has_role(current_user,$1,'MEMBER') AS group_member,
    has_function_privilege(current_user,$2,'EXECUTE') AS may_execute,
    has_table_privilege(current_user,$3,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS base_access,
    EXISTS (SELECT 1 FROM pg_roles owner_role WHERE owner_role.rolname IN
      ('fm_audit_contract_owner','fm_audit_source_owner','fm_audit_destination_owner')
      AND pg_has_role(current_user,owner_role.oid,'MEMBER')) AS owner_member,
    EXISTS (SELECT 1 FROM pg_roles extra_role WHERE left(extra_role.rolname,3) = 'fm_'
      AND extra_role.rolname <> $1 AND ($4 <> 'worker' OR extra_role.rolname <> 'fm_audit_source_monitor')
      AND pg_has_role(current_user,extra_role.oid,'MEMBER')) AS extra_application_role
    FROM pg_roles r WHERE r.rolname=current_user`, [group, entry, object, kind]);
  assertAuditRuntimeRole(result.rows, kind);
}

export async function createCaptureRuntime(environment: Environment) {
  auditEnvironment(environment);
  if (environment.AUDIT_ENABLED !== "true") throw new AuditCaptureUnavailable();
  const pool = await openPool(environment.AUDIT_CAPTURE_DATABASE_URL, "capture");
  try { await checkRole(pool, "capture"); }
  catch { await pool.pool.end(); throw new AuditCaptureUnavailable(); }
  return { capture: (event: PreparedAuditEvent) => captureIndependent(pool.adapter, event), close: () => pool.pool.end(),
    ready: async () => { await checkRole(pool, "capture"); } };
}

export async function createWorkerRuntime(environment: Environment): Promise<{ ports: AuditWorkerPorts; close(): Promise<void> }> {
  auditEnvironment(environment);
  if (environment.AUDIT_WORKER_ENABLED !== "true") throw new AuditCaptureUnavailable();
  const source = await openPool(environment.AUDIT_SOURCE_DATABASE_URL, "worker");
  let destination: RuntimePool | undefined;
  try {
    destination = await openPool(environment.AUDIT_DATABASE_URL, "writer");
    await checkRole(source, "worker"); await checkRole(destination, "writer");
    const target = destination;
    const flag = async (name: "ack" | "retry" | "quarantine", row: AuditClaim, values: unknown[], signal: AbortSignal) => {
      const placeholders = values.map((_, index) => `$${index + 3}`).join(",");
      const result = await run(source, `SELECT audit_capture.${name}($1,$2${values.length ? "," + placeholders : ""}) AS changed`,
        [row.event_id, row.lease_token, ...values], signal);
      if (result.rows.length !== 1 || typeof result.rows[0].changed !== "boolean") throw new AuditCaptureUnavailable();
      return result.rows[0].changed;
    };
    const ports: AuditWorkerPorts = {
      claim: async (limit, signal) => (await run(source, "SELECT * FROM audit_capture.claim($1)", [limit], signal)).rows,
      accept: async (row, signal) => {
        // Single autocommit statement; resolves only after ReadyForQuery/commit.
        const result = await run(target, "SELECT audit.accept($1,$2,$3) AS disposition",
          [row.canonical_json, row.payload_hash, row.hash_version], signal);
        const value = result.rows[0]?.disposition;
        if (result.rows.length !== 1 || !["inserted", "matching", "conflict", "expired"].includes(String(value))) throw new AuditCaptureUnavailable();
        return value as DeliveryDisposition;
      },
      ack: (row, signal) => flag("ack", row, [], signal),
      retry: (row, code, delay, signal) => flag("retry", row, [code, delay], signal),
      quarantine: (row, code, signal) => flag("quarantine", row, [code], signal),
      health: async signal => {
        const result = await run(source, `SELECT status,event_count::text,expired_count::text,
          GREATEST(0,extract(epoch FROM clock_timestamp()-oldest_created_at))::text AS age_seconds
          FROM audit_capture.delivery_health`, [], signal);
        const health = { pending: 0, leased: 0, quarantined: 0, expired: 0, oldestAgeSeconds: 0 };
        for (const row of result.rows) {
          if (!["pending", "leased", "quarantined", "delivered"].includes(String(row.status))) throw new AuditCaptureUnavailable();
          const count = Number(row.event_count), expired = Number(row.expired_count), age = Number(row.age_seconds);
          if (![count, expired, age].every(value => Number.isFinite(value) && value >= 0) || !Number.isSafeInteger(count)) throw new AuditCaptureUnavailable();
          if (row.status !== "delivered") {
            health[row.status as "pending" | "leased" | "quarantined"] = count;
            health.expired += expired; health.oldestAgeSeconds = Math.max(health.oldestAgeSeconds, age);
          }
        }
        return health;
      },
    };
    return { ports, close: async () => { await Promise.all([source.pool.end(), target.pool.end()]); } };
  } catch { await Promise.all([source.pool.end(), destination?.pool.end()]); throw new AuditCaptureUnavailable(); }
}
