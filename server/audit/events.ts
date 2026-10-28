import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AuditContractError, AUDIT_HASH_VERSION, canonicalAuditJson, auditPayloadHash, freezeAuditJson, type DeepReadonly } from "./canonical.ts";
import { assertAuditContext, auditContextSchema, userIdSchema, type AuditContext } from "./context.ts";

// Deliberately staged security-first registry. Every other catalog event is
// unsupported until its real producer/field/outcome contract is reviewed.
export const SUPPORTED_AUDIT_EVENTS = Object.freeze([
  "auth.login.v1", "auth.oauth_started.v1", "auth.oauth_callback.v1",
  "auth.session_established.v1", "auth.logout.v1", "auth.password_changed.v1",
  "security.action_denied.v1", "account.details_changed.v1",
  "account.active_role_changed.v1", "company.membership_changed.v1",
  "company.ownership_transferred.v1",
  "service.viewed.v1",
  "billing.checkout_reserved.v1", "billing.checkout_created.v1", "billing.checkout_unknown.v1",
  "billing.checkout_resolved.v1", "billing.event_accepted.v1", "billing.event_quarantined.v1",
  "billing.subscription_reconciled.v1", "billing.offer_changed.v1", "billing.price_mapping_changed.v1",
  "billing.manual_grant_changed.v1", "billing.workspace_initialized.v1",
  "billing.portal_reserved.v1", "billing.portal_created.v1", "billing.portal_unknown.v1",
] as const);
export type AuditEventName = typeof SUPPORTED_AUDIT_EVENTS[number];
const outcomes = ["succeeded", "rejected", "denied", "failed", "unknown"] as const;
const safeReasons = [
  "INVALID_INPUT", "INVALID_CREDENTIALS", "UNAUTHENTICATED", "FORBIDDEN",
  "CROSS_WORKSPACE", "WRONG_ORIGIN", "RATE_LIMITED", "PROVIDER_DISABLED",
  "OAUTH_CANCELLED", "SESSION_EXPIRED", "CONFLICT", "PROVIDER_UNAVAILABLE",
  "PROVIDER_TIMEOUT", "LOCAL_FAILURE", "NO_CHANGE",
] as const;
const valueSchema = z.union([z.boolean(), z.number().finite(), z.string().max(128), z.null()]);
const changeSchema = z.object({
  field: z.string().max(64), before: valueSchema.optional(), after: valueSchema.optional(),
  redacted: z.literal(true).optional(),
}).strict();
const actionSchema = z.object({
  eventName: z.enum(SUPPORTED_AUDIT_EVENTS), outcome: z.enum(outcomes),
  reasonCode: z.enum(safeReasons).optional(), changes: z.array(changeSchema).max(64),
}).strict();
export type AuditAction = DeepReadonly<z.infer<typeof actionSchema>>;
const timestampSchema = z.string().datetime({ precision: 3 }).refine(value =>
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value &&
  value >= "2000-01-01T00:00:00.000Z" && value < "2200-01-01T00:00:00.000Z");
const envelopeSchema = z.object({
  ...auditContextSchema.innerType().shape,
  eventId: z.string().uuid(), schemaVersion: z.literal(1), catalogVersion: z.literal(1),
  occurredAt: timestampSchema, ...actionSchema.shape, retentionClass: z.enum(["B", "S", "R"]),
}).strict();
export type AuditEnvelope = ReturnType<typeof parseAuditEnvelope>;

const selfEvents = new Set<AuditEventName>([
  "auth.session_established.v1", "auth.logout.v1", "auth.password_changed.v1",
  "account.details_changed.v1", "account.active_role_changed.v1",
]);
const companyEvents = new Set<AuditEventName>(["company.membership_changed.v1", "company.ownership_transferred.v1"]);
function retention(eventName: AuditEventName): "B" | "S" | "R" {
  if (eventName.startsWith("billing.")) return eventName === "billing.event_quarantined.v1" ? "S" : "B";
  if (eventName === "service.viewed.v1") return "R";
  return eventName.startsWith("account.") || companyEvents.has(eventName) ? "B" : "S";
}

function validatePolicy(event: z.infer<typeof envelopeSchema>): void {
  const reject = () => { throw new AuditContractError(); };
  const { actor, scope, target, eventName, outcome, reasonCode, changes } = event;
  if (eventName.startsWith("billing.")) {
    auditContextSchema.parse({ actor, scope, target, source: event.source,
      requestId: event.requestId, operationId: event.operationId,
      ...(event.parentEventId ? { parentEventId: event.parentEventId } : {}) });
    if (event.source.component !== "billing" || event.retentionClass !== retention(eventName) || changes.length || actor.kind === "anonymous") reject();
    if (eventName === "billing.event_quarantined.v1") {
      if (outcome !== "rejected" || reasonCode !== "CONFLICT") reject();
    } else if (["billing.checkout_unknown.v1", "billing.portal_unknown.v1"].includes(eventName)) {
      if (outcome !== "unknown" || reasonCode !== "PROVIDER_TIMEOUT") reject();
    } else if (outcome !== "succeeded" || reasonCode !== undefined) reject();
    const resolved = scope.kind === "personal" || scope.kind === "company";
    if (scope.kind === "company" && Number(scope.workspaceId) > 2147483647) reject();
    const owner = actor.kind === "user" && (scope.kind === "personal" ? actor.effectiveRole === "provider" && actor.userId === scope.workspaceId
      : scope.kind === "company" && actor.effectiveRole === "owner");
    const worker = actor.kind === "service" && actor.serviceId === "billing-worker";
    const support = actor.kind === "user" && actor.effectiveRole === "support";
    if (eventName === "billing.offer_changed.v1") {
      if (!support || scope.kind !== "global" || target.type !== "billing_offer") reject();
    } else if (eventName === "billing.manual_grant_changed.v1") {
      if (!support || !resolved || target.type !== "manual_grant") reject();
    } else if (eventName === "billing.workspace_initialized.v1") {
      if (!owner || (scope.kind === "personal" ? target.type !== "user" || target.id !== scope.workspaceId
        : scope.kind !== "company" || target.type !== "company" || target.id !== scope.workspaceId)) reject();
    } else if (eventName === "billing.event_quarantined.v1") {
      if (!worker || (!resolved && scope.kind !== "unknown") || target.type !== "billing_event") reject();
    } else if (eventName === "billing.event_accepted.v1") {
      if (!worker || !resolved || target.type !== "billing_event") reject();
    } else if (eventName === "billing.subscription_reconciled.v1") {
      if (!worker || !resolved || target.type !== "billing_subscription") reject();
    } else if (eventName === "billing.price_mapping_changed.v1" || eventName === "billing.checkout_resolved.v1") {
      if (!worker || !resolved || target.type !== "billing_operation") reject();
    } else if (!resolved || target.type !== "billing_operation" || !(owner || (worker && ["billing.checkout_unknown.v1", "billing.portal_unknown.v1"].includes(eventName)))) reject();
    return;
  }
  const localMutation = eventName.startsWith("account.") || companyEvents.has(eventName);
  const expectedComponent = eventName.startsWith("auth.") ? "auth"
    : eventName.startsWith("account.") ? "account"
      : companyEvents.has(eventName) ? "company-access" : eventName === "service.viewed.v1" ? "service" : "authorization";
  if (event.source.component !== expectedComponent) reject();
  if (localMutation && outcome === "unknown") reject();
  // Also apply context refinements when parsing an envelope received for replay.
  auditContextSchema.parse({ actor, scope, target, source: event.source,
    requestId: event.requestId, operationId: event.operationId,
    ...(event.parentEventId ? { parentEventId: event.parentEventId } : {}) });
  if (event.retentionClass !== retention(eventName)) reject();
  if (scope.kind === "global") reject(); // No staged event grants global audit access.
  if (eventName === "service.viewed.v1" && (target.type !== "service" || scope.kind !== "unknown" ||
    outcome !== "succeeded" || reasonCode !== undefined || changes.length ||
    (actor.kind === "user" && !["seeker", "provider"].includes(actor.effectiveRole)))) reject();
  if (eventName === "security.action_denied.v1") {
    if (outcome !== "denied" || target.type !== "request" || !reasonCode ||
      !["UNAUTHENTICATED", "FORBIDDEN", "CROSS_WORKSPACE", "WRONG_ORIGIN", "RATE_LIMITED", "SESSION_EXPIRED"].includes(reasonCode)) reject();
  }
  if (selfEvents.has(eventName) && (actor.kind !== "user" || target.type !== "user" || target.id !== actor.userId ||
    (scope.kind === "personal" && scope.workspaceId !== actor.userId) || scope.kind === "unknown")) reject();
  if (companyEvents.has(eventName) && (actor.kind !== "user" || scope.kind !== "company" ||
    !["owner", "admin"].includes(actor.effectiveRole))) reject();
  if (eventName === "company.membership_changed.v1" && target.type !== "membership") reject();
  if (eventName === "company.ownership_transferred.v1" && (target.type !== "company" || actor.kind !== "user" || actor.effectiveRole !== "owner")) reject();
  if (eventName.startsWith("account.") && scope.kind !== "personal") reject();
  if (eventName.startsWith("auth.") && !selfEvents.has(eventName)) {
    if (outcome === "succeeded" && eventName !== "auth.oauth_started.v1" && actor.kind !== "user") reject();
    if (actor.kind === "user" && target.type !== "user") reject();
    if (actor.kind === "user" && target.type === "user" && target.id !== actor.userId) reject();
    if (actor.kind === "user" && scope.kind === "personal" && scope.workspaceId !== actor.userId) reject();
  }
  if (outcome !== "succeeded" && changes.length) reject();
  if (outcome !== "succeeded" && !reasonCode) reject();
  if (outcome === "succeeded" && reasonCode && reasonCode !== "NO_CHANGE") reject();
  if (outcome === "unknown" && (reasonCode !== "PROVIDER_TIMEOUT" || eventName === "auth.session_established.v1")) reject();
  if (outcome === "failed" && (!reasonCode || !["PROVIDER_UNAVAILABLE", "LOCAL_FAILURE"].includes(reasonCode))) reject();
  if (outcome === "denied" && (!reasonCode || !["INVALID_CREDENTIALS", "UNAUTHENTICATED", "FORBIDDEN", "CROSS_WORKSPACE", "WRONG_ORIGIN", "RATE_LIMITED", "SESSION_EXPIRED"].includes(reasonCode))) reject();
  if (outcome === "rejected" && (!reasonCode || !["INVALID_INPUT", "CONFLICT", "PROVIDER_DISABLED", "OAUTH_CANCELLED", "SESSION_EXPIRED"].includes(reasonCode))) reject();
  if (reasonCode === "INVALID_CREDENTIALS" && eventName !== "auth.login.v1" && eventName !== "auth.password_changed.v1") reject();
  if (reasonCode === "NO_CHANGE" && (!localMutation || outcome !== "succeeded")) reject();
  if (reasonCode === "NO_CHANGE" && changes.length) reject();
  if (new Set(changes.map(change => change.field)).size !== changes.length) reject();
  const valueFields: Record<string, z.ZodTypeAny> = eventName === "account.active_role_changed.v1"
    ? { currentRole: z.enum(["seeker", "provider"]) }
    : eventName === "company.membership_changed.v1"
      ? { role: z.enum(["admin", "provider", "viewer"]), employeeId: z.union([z.number().int().positive(), z.null()]) }
      : eventName === "company.ownership_transferred.v1" ? { ownerId: userIdSchema } : {};
  const indicatorFields = eventName === "account.details_changed.v1" ? ["firstName", "lastName"] : [];
  for (const change of changes) {
    if (indicatorFields.includes(change.field)) {
      if (!change.redacted || "before" in change || "after" in change) reject();
    } else {
      const schema = Object.hasOwn(valueFields, change.field) ? valueFields[change.field] : undefined;
      if (!schema || change.redacted || !("before" in change) || !("after" in change) ||
        !schema.safeParse(change.before).success || !schema.safeParse(change.after).success ||
        change.before === change.after) reject();
    }
  }
  if (outcome === "succeeded" && (indicatorFields.length || Object.keys(valueFields).length) &&
    !changes.length && reasonCode !== "NO_CHANGE") reject();
  if (eventName === "company.ownership_transferred.v1" && changes.some(change =>
    change.field === "ownerId" && (actor.kind !== "user" || change.before !== actor.userId))) reject();
}

/** Validate replay/destination input without asserting its external authenticity. */
export function parseAuditEnvelope(input: unknown) {
  try {
    canonicalAuditJson(input); // Reject getters/custom serialization before Zod.
    const event = envelopeSchema.parse(input);
    validatePolicy(event);
    return freezeAuditJson(event);
  } catch { throw new AuditContractError(); }
}

/** Pass only changed field NAMES; sensitive before/after values never enter here. */
export function redactedAccountChanges(fields: readonly ("firstName" | "lastName")[]) {
  if (!Array.isArray(fields) || fields.length > 2 || new Set(fields).size !== fields.length ||
    fields.some(field => field !== "firstName" && field !== "lastName")) throw new AuditContractError();
  return freezeAuditJson(fields.map(field => ({ field, redacted: true as const })));
}

/** No I/O/config reads. Clock/UUID injection is for server-owned tests/adapters. */
export function createAuditEvent(context: AuditContext, action: AuditAction, dependencies = {
  now: () => new Date(), newId: () => randomUUID() as string,
}) {
  try {
    assertAuditContext(context);
    canonicalAuditJson(action);
    const parsed = actionSchema.parse(action);
    const envelope = parseAuditEnvelope({ ...context, ...parsed, eventId: dependencies.newId(),
      schemaVersion: 1, catalogVersion: 1, occurredAt: dependencies.now().toISOString(),
      retentionClass: retention(parsed.eventName) });
    const canonicalJson = canonicalAuditJson(envelope);
    return freezeAuditJson({ envelope, canonicalJson, payloadHash: auditPayloadHash(canonicalJson), hashVersion: AUDIT_HASH_VERSION });
  } catch { throw new AuditContractError(); }
}

/** Selected P1: R expires after 90 days, B/S after 365; retries never extend it. */
export function auditEventExpiresAt(input: unknown): string {
  const event = parseAuditEnvelope(input);
  return new Date(Date.parse(event.occurredAt) + (event.retentionClass === "R" ? 90 : 365) * 24 * 60 * 60 * 1000).toISOString();
}
