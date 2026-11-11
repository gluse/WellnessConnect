import { z } from "zod";

export class AuditConfigurationError extends Error {
  constructor() { super("Invalid audit runtime configuration"); this.name = "AuditConfigurationError"; }
}
export const AUDIT_PROJECTS = Object.freeze({ source: "hbkooiknruimukkhshrk", destination: "ynygqodmtgjrngiudalw" });
export const AUDIT_USERS = Object.freeze({ capture: "fmt_audit_capture_dev", worker: "fmt_audit_worker_dev", writer: "fmt_audit_writer_dev" });
export type AuditConnectionKind = keyof typeof AUDIT_USERS;
type Environment = Record<string, string | undefined>;
export interface AuditConnection {
  host: string; port: number; user: string; password: string; database: string; caPath?: string;
  local?: true;
}

export const LOCAL_AUDIT_PORTS = Object.freeze({ source: 15422, destination: 15432, api: 15421 });
type LocalConnectionKind = AuditConnectionKind | "application" | "reader";

/** The local copy is an explicit development profile; it cannot redirect hosted credentials. */
export function localAuditConnection(value: unknown, kind: LocalConnectionKind, environment: Environment): AuditConnection | undefined {
  if (environment.AUDIT_RUNTIME_PROFILE === undefined) return undefined;
  if (environment.AUDIT_RUNTIME_PROFILE !== "local-docker" || environment.NODE_ENV !== "development") throw new AuditConfigurationError();
  try {
    if (typeof value !== "string" || /[\x00-\x20\x7f]/.test(value)) throw new AuditConfigurationError();
    const uri = new URL(value);
    const destination = kind === "writer" || kind === "reader";
    const user = kind === "application" ? "fmt_app_dev" : kind === "reader" ? "fmt_audit_reader_dev" : AUDIT_USERS[kind];
    const port = destination ? LOCAL_AUDIT_PORTS.destination : LOCAL_AUDIT_PORTS.source;
    if (!["postgres:", "postgresql:"].includes(uri.protocol) || uri.hostname !== "127.0.0.1" || uri.port !== String(port) || uri.hash ||
      decodeURIComponent(uri.username) !== user || !uri.password || decodeURIComponent(uri.pathname) !== "/postgres") throw new AuditConfigurationError();
    for (const key of Array.from(uri.searchParams.keys())) {
      if (key !== "sslmode" || uri.searchParams.getAll(key).length !== 1 || uri.searchParams.get(key) !== "disable") throw new AuditConfigurationError();
    }
    return { host: "127.0.0.1", port, user, password: decodeURIComponent(uri.password), database: "postgres", local: true };
  } catch { throw new AuditConfigurationError(); }
}

/** Validate the complete configured local profile before any connection opens. */
export function assertLocalAuditIsolation(environment: Environment): void {
  if (environment.AUDIT_RUNTIME_PROFILE === undefined) return;
  if (environment.AUDIT_RUNTIME_PROFILE !== "local-docker" || environment.NODE_ENV !== "development") throw new AuditConfigurationError();
  for (const name of ["SUPABASE_GOOGLE_ENABLED", "SUPABASE_FACEBOOK_ENABLED", "SUPABASE_APPLE_ENABLED", "SUPABASE_MICROSOFT_ENABLED",
    "NOTIFICATIONS_ENABLED", "NOTIFICATIONS_AUTOMATION_ENABLED", "NOTIFICATIONS_VERIFICATION_ENABLED", "PRODUCT_ACTIVITY_ENABLED",
    "STRIPE_BILLING_ENABLED", "STRIPE_NEW_CHECKOUTS_ENABLED"]) {
    if (environment[name] !== undefined && environment[name] !== "false") throw new AuditConfigurationError();
  }
  const connections = { DATABASE_URL: "application", AUDIT_CAPTURE_DATABASE_URL: "capture", AUDIT_SOURCE_DATABASE_URL: "worker",
    AUDIT_DATABASE_URL: "writer", AUDIT_READER_DATABASE_URL: "reader" } as const;
  for (const [key, kind] of Object.entries(connections)) if (environment[key]) localAuditConnection(environment[key], kind, environment);
  if (environment.AUDIT_ENABLED === "true" && (!environment.DATABASE_URL || !environment.AUDIT_CAPTURE_DATABASE_URL)) throw new AuditConfigurationError();
  if (environment.AUDIT_WORKER_ENABLED === "true" && (!environment.AUDIT_SOURCE_DATABASE_URL || !environment.AUDIT_DATABASE_URL)) throw new AuditConfigurationError();
  if (environment.DATABASE_URL && !environment.SUPABASE_URL) throw new AuditConfigurationError();
  if (environment.SUPABASE_URL !== undefined && environment.SUPABASE_URL !== `http://127.0.0.1:${LOCAL_AUDIT_PORTS.api}`) throw new AuditConfigurationError();
  if (environment.APP_URL !== undefined) {
    try {
      const uri = new URL(environment.APP_URL);
      if (uri.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(uri.hostname) || uri.port !== "5000" || uri.username || uri.password || uri.pathname !== "/" || uri.search || uri.hash) throw new AuditConfigurationError();
    } catch { throw new AuditConfigurationError(); }
  }
}

/** Even the plaintext local exception checks the actual peer address. */
export function assertAuditTransport(config: AuditConnection, stream: { encrypted?: boolean; authorized?: boolean; remoteAddress?: string } | undefined): void {
  if (config.local === true) {
    if (!["127.0.0.1", "::ffff:127.0.0.1"].includes(stream?.remoteAddress ?? "")) throw new AuditConfigurationError();
  } else if (stream?.encrypted !== true || stream.authorized !== true) throw new AuditConfigurationError();
}

/** Pure parser. No environment/file reads, connections, TLS downgrade or URI overrides. */
export function auditConnection(value: unknown, kind: AuditConnectionKind, environment: Environment = {}): AuditConnection {
  try {
    const local = localAuditConnection(value, kind, environment);
    if (local) return local;
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
export function auditApplicationConnection(value: unknown, environment: Environment = {}): AuditConnection {
  try {
    const local = localAuditConnection(value, "application", environment);
    if (local) return local;
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

/** Remote producers require the versioned durable-intent contract before activation. */
export function assertAuditActivation(input: Record<string, string | undefined>): void {
  assertLocalAuditIsolation(input);
  for (const key of ["AUDIT_ENABLED", "AUDIT_WORKER_ENABLED", "AUDIT_SERVICE_VIEWS_ENABLED"]) {
    if (input[key] !== undefined && input[key] !== "true" && input[key] !== "false") throw new AuditConfigurationError();
  }
  if (input.AUDIT_AUTH_EVENTS_ENABLED !== undefined && !["true", "false"].includes(input.AUDIT_AUTH_EVENTS_ENABLED)) throw new AuditConfigurationError();
  if (input.AUDIT_AUTH_EVENTS_ENABLED === "true" && (input.AUDIT_ENABLED !== "true" || input.AUDIT_PRODUCER_CONTRACT !== "completion-0008")) throw new AuditConfigurationError();
  if (input.AUDIT_ENABLED === "true" || input.AUDIT_WORKER_ENABLED === "true") {
    auditEnvironment(input);
    if (input.PGBINARY) throw new AuditConfigurationError();
  }
}
export const workerOptionsSchema = z.object({
  batchSize: z.number().int().min(1).max(100), timeoutMs: z.number().int().min(100).max(8000),
  pollMs: z.number().int().min(100).max(60000),
}).strict();
