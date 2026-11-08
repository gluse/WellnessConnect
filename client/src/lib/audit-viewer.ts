export interface AuditAccess { canRead: boolean; canExport: boolean; available: boolean }
export interface AuditRecord {
  eventId: string; eventName: string; occurredAt: string; receivedAt: string; expiresAt: string;
  actor: { kind: string; userId?: string; effectiveRole?: string; serviceId?: string };
  scope: { kind: string; workspaceId?: string }; target: { type: string; id?: string };
  outcome: string; reasonCode?: string; changes: { field: string; before?: unknown; after?: unknown; redacted?: boolean }[];
  source: { application: string; environment: string; component: string };
  requestId: string; operationId: string; retentionClass: string;
}
export const auditFilterNames = ["from", "to", "action", "outcome", "actorId", "workspaceId", "targetType", "targetId", "requestId", "operationId", "source"] as const;
export type AuditFilters = Record<typeof auditFilterNames[number], string>;
export interface AuditPage { events: AuditRecord[]; nextCursor: string | null; hasMore: boolean; query: Record<string, unknown> }
export function defaultAuditFilters(): AuditFilters {
  const now = new Date();
  return { from: new Date(now.getTime() - 7 * 86400_000).toISOString().slice(0, 16), to: now.toISOString().slice(0, 16), action: "", outcome: "", actorId: "", workspaceId: "", targetType: "", targetId: "", requestId: "", operationId: "", source: "" };
}
export function auditQuery(filters: AuditFilters, cursor?: string): string {
  const params = new URLSearchParams();
  for (const name of auditFilterNames) {
    const value = filters[name].trim();
    if (value) params.set(name, name === "from" || name === "to" ? new Date(value + "Z").toISOString() : value);
  }
  params.set("limit", "25");
  if (cursor) params.set("cursor", cursor);
  return params.toString();
}
