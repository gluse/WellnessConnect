import { z } from "zod";

export class AuditConfigurationError extends Error {
  constructor() { super("Invalid audit runtime configuration"); this.name = "AuditConfigurationError"; }
}
export const AUDIT_PROJECTS = Object.freeze({ source: "hbkooiknruimukkhshrk", destination: "ynygqodmtgjrngiudalw" });
export const AUDIT_USERS = Object.freeze({ capture: "fmt_audit_capture_dev", worker: "fmt_audit_worker_dev", writer: "fmt_audit_writer_dev" });
export type AuditConnectionKind = keyof typeof AUDIT_USERS;
export interface AuditConnection {
  host: string; port: number; user: string; password: string; database: string; caPath?: string;
}

/** Pure parser. No environment/file reads, connections, TLS downgrade or URI overrides. */
export function auditConnection(value: unknown, kind: AuditConnectionKind): AuditConnection {
  try {
    if (typeof value !== "string" || /[\r\n]/.test(value)) throw new AuditConfigurationError();
    const uri = new URL(value);
    if (!["postgres:", "postgresql:"].includes(uri.protocol) || uri.hash || (uri.port && uri.port !== "5432")) throw new AuditConfigurationError();
    const host = uri.hostname.toLowerCase();
    const user = decodeURIComponent(uri.username), password = decodeURIComponent(uri.password);
    const database = decodeURIComponent(uri.pathname.slice(1));
    const ref = kind === "writer" ? AUDIT_PROJECTS.destination : AUDIT_PROJECTS.source;
    const direct = host === `db.${ref}.supabase.co`;
    const pooled = /^[a-z0-9.-]+\.pooler\.supabase\.com$/.test(host);
    if ((!direct && !pooled) || user !== (direct ? AUDIT_USERS[kind] : `${AUDIT_USERS[kind]}.${ref}`) ||
      !password || database !== "postgres") throw new AuditConfigurationError();
    for (const key of Array.from(uri.searchParams.keys())) {
      if (!["sslmode", "sslrootcert"].includes(key) || uri.searchParams.getAll(key).length !== 1) throw new AuditConfigurationError();
    }
    const mode = uri.searchParams.get("sslmode");
    if (mode && !["require", "verify-ca", "verify-full"].includes(mode)) throw new AuditConfigurationError();
    const caPath = uri.searchParams.get("sslrootcert") || undefined;
    return { host, port: 5432, user: direct ? user : AUDIT_USERS[kind] + "." + ref, password, database, ...(caPath ? { caPath } : {}) };
  } catch { throw new AuditConfigurationError(); }
}

/** Same fixed source/TLS policy for the independently restricted application. */
export function auditApplicationConnection(value: unknown): AuditConnection {
  try {
    if (typeof value !== "string" || /[\x00-\x20\x7f]/.test(value)) throw new AuditConfigurationError();
    const uri = new URL(value), user = decodeURIComponent(uri.username);
    const direct = uri.hostname.toLowerCase() === `db.${AUDIT_PROJECTS.source}.supabase.co`;
    const expected = direct ? "fmt_app_dev" : `fmt_app_dev.${AUDIT_PROJECTS.source}`;
    if (user !== expected) throw new AuditConfigurationError();
    uri.username = direct ? AUDIT_USERS.capture : `${AUDIT_USERS.capture}.${AUDIT_PROJECTS.source}`;
    return { ...auditConnection(uri.href, "capture"), user };
  } catch { throw new AuditConfigurationError(); }
}

export function auditEnvironment(input: Record<string, string | undefined>): string {
  if (input.AUDIT_ENVIRONMENT !== "development") throw new AuditConfigurationError();
  return input.AUDIT_ENVIRONMENT;
}

/** Remote Auth producers remain staged until durable intent/reconciliation exists. */
export function assertAuditActivation(input: Record<string, string | undefined>): void {
  for (const key of ["AUDIT_ENABLED", "AUDIT_WORKER_ENABLED", "AUDIT_SERVICE_VIEWS_ENABLED"]) {
    if (input[key] !== undefined && input[key] !== "true" && input[key] !== "false") throw new AuditConfigurationError();
  }
  if (input.AUDIT_AUTH_EVENTS_ENABLED !== undefined && input.AUDIT_AUTH_EVENTS_ENABLED !== "false") throw new AuditConfigurationError();
  if (input.AUDIT_ENABLED === "true" || input.AUDIT_WORKER_ENABLED === "true") {
    auditEnvironment(input);
    if (input.PGBINARY) throw new AuditConfigurationError();
  }
}
export const workerOptionsSchema = z.object({
  batchSize: z.number().int().min(1).max(100), timeoutMs: z.number().int().min(100).max(8000),
  pollMs: z.number().int().min(100).max(60000),
}).strict();
