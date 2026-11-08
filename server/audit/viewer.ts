import { createHash, randomUUID } from "node:crypto";
import type { Express, RequestHandler } from "express";
import { z } from "zod";
import { rateLimit } from "express-rate-limit";
import { createAuditContext } from "./context";
import { createAuditEvent } from "./events";
import { capturePreparedAudit, recordDenial } from "./http";

const uuid = z.string().uuid();
const timestamp = z.string().datetime().refine(value => Number.isFinite(Date.parse(value)));
const identifier = z.string().regex(/^[A-Za-z0-9_.:-]{1,128}$/);
const filtersSchema = z.object({
  from: timestamp.optional(), to: timestamp.optional(), action: identifier.optional(),
  outcome: z.enum(["succeeded", "rejected", "denied", "failed", "unknown"]).optional(),
  actorId: uuid.optional(), workspaceId: identifier.optional(), targetType: identifier.optional(),
  targetId: z.string().regex(/^[A-Za-z0-9_.:|\-]{1,250}$/).optional(), requestId: uuid.optional(), operationId: uuid.optional(), source: identifier.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25), cursor: z.string().max(512).optional(),
}).strict();
export type AuditViewerFilters = z.infer<typeof filtersSchema>;
type Query = { text: string; values: unknown[] };
type Row = { envelope: Record<string, any>; occurred_at: Date | string; event_id: string; received_at: Date | string; expires_at: Date | string };
export interface AuditViewerStore { query(query: Query): Promise<Row[]>; }
export interface AuditViewerDependencies {
  authenticate: RequestHandler; store: AuditViewerStore;
  environment?: () => NodeJS.ProcessEnv;
  capture?: (userId: string, exported: boolean) => Promise<void>;
  now?: () => Date;
}
export function auditViewerPermissions(userId: string | undefined, environment: NodeJS.ProcessEnv) {
  const includes = (key: string) => Boolean(userId && (environment[key] ?? "").split(",").some(value => value.trim() === userId));
  const canRead = includes("AUDIT_READER_USER_IDS");
  return { canRead, canExport: canRead && includes("AUDIT_EXPORT_USER_IDS"),
    available: environment.AUDIT_ENABLED === "true" && Boolean(environment.AUDIT_READER_DATABASE_URL) };
}
export function parseAuditViewerFilters(input: unknown, now = new Date()): AuditViewerFilters {
  const parsed = filtersSchema.parse(input);
  parsed.to ??= now.toISOString();
  parsed.from ??= new Date(Date.parse(parsed.to) - 7 * 86400_000).toISOString();
  if (Date.parse(parsed.to) < Date.parse(parsed.from) || Date.parse(parsed.to) - Date.parse(parsed.from) > 366 * 86400_000) throw new Error("INVALID_FILTERS");
  return parsed;
}
function fingerprint(filters: AuditViewerFilters) {
  const { cursor: _, ...query } = filters;
  return createHash("sha256").update(JSON.stringify(Object.fromEntries(Object.entries(query).sort(([a], [b]) => a.localeCompare(b))))).digest("hex");
}
export function buildAuditViewerQuery(filters: AuditViewerFilters, exporting = false): Query {
  const values: unknown[] = [filters.from, filters.to];
  const clauses = ["occurred_at >= $1::timestamptz", "occurred_at <= $2::timestamptz"];
  const columns = { action: "event_name", outcome: "outcome", actorId: "actor_id", workspaceId: "workspace_id", targetType: "target_type", targetId: "target_id", requestId: "request_id", operationId: "operation_id", source: "envelope#>>'{source,component}'" };
  for (const [key, column] of Object.entries(columns)) {
    const value = filters[key as keyof typeof columns];
    if (value !== undefined) { values.push(value); clauses.push(`${column} = $${values.length}`); }
  }
  if (filters.cursor) {
    if (exporting) throw new Error("INVALID_FILTERS");
    const cursor = z.object({ at: timestamp, id: uuid, query: z.string().length(64) }).strict().parse(JSON.parse(Buffer.from(filters.cursor, "base64url").toString("utf8")));
    if (cursor.query !== fingerprint(filters)) throw new Error("INVALID_FILTERS");
    values.push(cursor.at, cursor.id);
    clauses.push(`(occurred_at,event_id) < ($${values.length - 1}::timestamptz,$${values.length}::uuid)`);
  }
  values.push(exporting ? 1000 : filters.limit + 1);
  return { text: `SELECT envelope, occurred_at, event_id, received_at, expires_at FROM audit.reader_events WHERE ${clauses.join(" AND ")} ORDER BY occurred_at DESC,event_id DESC LIMIT $${values.length}`, values };
}
const iso = (date: Date | string) => new Date(date).toISOString();
export function auditViewerPage(rows: Row[], filters: AuditViewerFilters) {
  const hasMore = rows.length > filters.limit;
  const visible = rows.slice(0, filters.limit);
  const last = visible.at(-1);
  const { cursor: _, ...query } = filters;
  return { events: visible.map(row => ({ ...row.envelope, receivedAt: iso(row.received_at), expiresAt: iso(row.expires_at) })),
    query, hasMore, nextCursor: hasMore && last ? Buffer.from(JSON.stringify({ at: iso(last.occurred_at), id: last.event_id, query: fingerprint(filters) })).toString("base64url") : null };
}
export function auditRecordsCsv(rows: Row[]) {
  const cell = (value: unknown) => {
    let text = value == null ? "" : String(value);
    if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const words = (value: string) => value.replace(/\.v\d+$/, "").replaceAll(/[._]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
  const description = (event: Record<string, any>) => {
    const operation = event.changes?.find((change: any) => change.field === "operation" || change.field === "action")?.after;
    if (event.eventName === "activity.records_read.v1") return `Viewed ${words(String(operation))}`;
    if (/^data\.record_(created|updated|deleted)\.v1$/.test(event.eventName)) return `${words(String(event.target?.id ?? "record").split(":")[0])}: record ${event.eventName.split("_")[1].split(".")[0]}`;
    return words(String(event.eventName)) + (operation ? `: ${words(String(operation))}` : "");
  };
  const columns = ["Time (UTC)", "Activity", "Activity code", "Outcome", "Actor", "Workspace", "Object type", "Object ID", "Reason", "Request ID", "Operation ID", "Changed fields"];
  return [columns, ...rows.map(({ envelope: e }) => [e.occurredAt, description(e), e.eventName, e.outcome,
    e.actor?.serviceId === "database-runtime" ? "Database change (person not identified)" : e.actor?.userId ?? e.actor?.serviceId ?? e.actor?.kind,
    e.scope?.workspaceId ?? e.scope?.kind, e.target?.type, e.target?.id, e.reasonCode, e.requestId, e.operationId,
    Array.isArray(e.changes) ? e.changes.map((change: any) => words(String(change.field))).join(", ") : ""])].map(row => row.map(cell).join(",")).join("\r\n");
}
async function captureViewerAccess(userId: string, exported: boolean) {
  const context = createAuditContext({ actor: { kind: "user", userId, effectiveRole: "support" }, scope: { kind: "global" }, target: { type: "request" },
    source: { application: "fitsmytime", environment: process.env.AUDIT_ENVIRONMENT!, component: "audit" }, requestId: randomUUID(), operationId: randomUUID() });
  await capturePreparedAudit(createAuditEvent(context, { eventName: exported ? "audit.records_exported.v1" : "audit.records_viewed.v1", outcome: "succeeded", changes: [] }));
}
export function setupAuditViewerRoutes(app: Express, dependencies: AuditViewerDependencies) {
  const environment = dependencies.environment ?? (() => process.env);
  const capture = dependencies.capture ?? captureViewerAccess;
  const limit = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: "draft-7", legacyHeaders: false,
    message: { message: "Too many audit requests. Please wait a minute." } });
  app.get("/api/admin/audit/access", dependencies.authenticate, (req, res) => {
    res.set("Cache-Control", "no-store");
    res.json(auditViewerPermissions(req.user?.claims.sub, environment()));
  });
  for (const exporting of [false, true]) app.get(`/api/admin/audit/${exporting ? "export" : "events"}`, limit, dependencies.authenticate, async (req, res) => {
    res.set({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    const userId = req.user?.claims.sub;
    const permissions = auditViewerPermissions(userId, environment());
    if (!userId || !permissions.canRead || (exporting && !permissions.canExport)) {
      await recordDenial(req, userId ? "FORBIDDEN" : "UNAUTHENTICATED");
      return res.status(userId ? 403 : 401).json({ message: "Audit access is required." });
    }
    if (!permissions.available) return res.status(503).json({ message: "Audit records are temporarily unavailable." });
    let filters: AuditViewerFilters, query: Query;
    try { filters = parseAuditViewerFilters(req.query, dependencies.now?.()); query = buildAuditViewerQuery(filters, exporting); }
    catch { return res.status(400).json({ message: "Choose valid audit filters and a date range of up to 366 days." }); }
    try {
      const rows = await dependencies.store.query(query);
      // No records or export may leave the server before durable access capture.
      await capture(userId, exporting);
      // Recheck explicit permission after awaited work to handle configuration revocation.
      const current = auditViewerPermissions(userId, environment());
      if (!current.canRead || (exporting && !current.canExport)) return res.status(403).json({ message: "Audit access is required." });
      if (exporting) return res.type("text/csv").set("Content-Disposition", 'attachment; filename="audit-records.csv"').send(auditRecordsCsv(rows));
      return res.json(auditViewerPage(rows, filters));
    } catch { return res.status(503).json({ message: "Audit records are temporarily unavailable." }); }
  });
}
