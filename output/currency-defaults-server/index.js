var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target2, all) => {
  for (var name in all)
    __defProp(target2, name, { get: all[name], enumerable: true });
};

// server/audit/config.ts
import { z as z2 } from "zod";
function auditConnection(value, kind) {
  try {
    if (typeof value !== "string" || /[\r\n]/.test(value)) throw new AuditConfigurationError();
    const uri = new URL(value);
    if (!["postgres:", "postgresql:"].includes(uri.protocol) || uri.hash || uri.port && uri.port !== "5432") throw new AuditConfigurationError();
    const host = uri.hostname.toLowerCase();
    const user = decodeURIComponent(uri.username), password = decodeURIComponent(uri.password);
    const database = decodeURIComponent(uri.pathname.slice(1));
    const ref = kind === "writer" ? AUDIT_PROJECTS.destination : AUDIT_PROJECTS.source;
    const direct = host === `db.${ref}.supabase.co`;
    const pooled = /^[a-z0-9.-]+\.pooler\.supabase\.com$/.test(host);
    if (!direct && !pooled || user !== (direct ? AUDIT_USERS[kind] : `${AUDIT_USERS[kind]}.${ref}`) || !password || database !== "postgres") throw new AuditConfigurationError();
    for (const key of Array.from(uri.searchParams.keys())) {
      if (!["sslmode", "sslrootcert"].includes(key) || uri.searchParams.getAll(key).length !== 1) throw new AuditConfigurationError();
    }
    const mode = uri.searchParams.get("sslmode");
    if (mode && !["require", "verify-ca", "verify-full"].includes(mode)) throw new AuditConfigurationError();
    const caPath = uri.searchParams.get("sslrootcert") || void 0;
    return { host, port: 5432, user: direct ? user : AUDIT_USERS[kind] + "." + ref, password, database, ...caPath ? { caPath } : {} };
  } catch {
    throw new AuditConfigurationError();
  }
}
function auditApplicationConnection(value) {
  try {
    if (typeof value !== "string" || /[\x00-\x20\x7f]/.test(value)) throw new AuditConfigurationError();
    const uri = new URL(value), user = decodeURIComponent(uri.username);
    const direct = uri.hostname.toLowerCase() === `db.${AUDIT_PROJECTS.source}.supabase.co`;
    const expected = direct ? "fmt_app_dev" : `fmt_app_dev.${AUDIT_PROJECTS.source}`;
    if (user !== expected) throw new AuditConfigurationError();
    uri.username = direct ? AUDIT_USERS.capture : `${AUDIT_USERS.capture}.${AUDIT_PROJECTS.source}`;
    return { ...auditConnection(uri.href, "capture"), user };
  } catch {
    throw new AuditConfigurationError();
  }
}
function auditEnvironment(input) {
  if (input.AUDIT_ENVIRONMENT !== "development") throw new AuditConfigurationError();
  return input.AUDIT_ENVIRONMENT;
}
function assertAuditActivation(input) {
  for (const key of ["AUDIT_ENABLED", "AUDIT_WORKER_ENABLED", "AUDIT_SERVICE_VIEWS_ENABLED"]) {
    if (input[key] !== void 0 && input[key] !== "true" && input[key] !== "false") throw new AuditConfigurationError();
  }
  if (input.AUDIT_AUTH_EVENTS_ENABLED !== void 0 && input.AUDIT_AUTH_EVENTS_ENABLED !== "false") throw new AuditConfigurationError();
  if (input.AUDIT_ENABLED === "true" || input.AUDIT_WORKER_ENABLED === "true") {
    auditEnvironment(input);
    if (input.PGBINARY) throw new AuditConfigurationError();
  }
}
var AuditConfigurationError, AUDIT_PROJECTS, AUDIT_USERS, workerOptionsSchema;
var init_config = __esm({
  "server/audit/config.ts"() {
    "use strict";
    AuditConfigurationError = class extends Error {
      constructor() {
        super("Invalid audit runtime configuration");
        this.name = "AuditConfigurationError";
      }
    };
    AUDIT_PROJECTS = Object.freeze({ source: "hbkooiknruimukkhshrk", destination: "ynygqodmtgjrngiudalw" });
    AUDIT_USERS = Object.freeze({ capture: "fmt_audit_capture_dev", worker: "fmt_audit_worker_dev", writer: "fmt_audit_writer_dev" });
    workerOptionsSchema = z2.object({
      batchSize: z2.number().int().min(1).max(100),
      timeoutMs: z2.number().int().min(100).max(8e3),
      pollMs: z2.number().int().min(100).max(6e4)
    }).strict();
  }
});

// server/audit/canonical.ts
import { createHash } from "node:crypto";
function canonicalAuditJson(value) {
  const ancestors = /* @__PURE__ */ new Set();
  let nodes = 0;
  let bytes = 0;
  const add = (part) => {
    bytes += Buffer.byteLength(part, "utf8");
    if (bytes > AUDIT_MAX_BYTES) throw new AuditContractError();
    return part;
  };
  const encode = (item, depth) => {
    if (++nodes > 8192 || depth > 12) throw new AuditContractError();
    if (item === null) return add("null");
    if (typeof item === "string") {
      if (item.length > AUDIT_MAX_BYTES) throw new AuditContractError();
      return add(JSON.stringify(item));
    }
    if (typeof item === "boolean") return add(String(item));
    if (typeof item === "number" && Number.isFinite(item)) return add(JSON.stringify(item));
    if (typeof item !== "object" || !item || ancestors.has(item)) throw new AuditContractError();
    const array = Array.isArray(item);
    if (Object.getPrototypeOf(item) !== (array ? Array.prototype : Object.prototype)) throw new AuditContractError();
    const keys = Reflect.ownKeys(item);
    if (keys.length > 257 || keys.some((key) => typeof key !== "string")) throw new AuditContractError();
    if (array && (item.length > 100 || keys.length !== item.length + 1)) throw new AuditContractError();
    ancestors.add(item);
    const values = [];
    const orderedKeys = array ? Array.from({ length: item.length }, (_, i) => String(i)) : keys.sort();
    add(array ? "[" : "{");
    for (const key of orderedKeys) {
      if (["__proto__", "constructor", "prototype"].includes(key)) throw new AuditContractError();
      const descriptor = Object.getOwnPropertyDescriptor(item, key);
      if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) throw new AuditContractError();
      if (values.length) add(",");
      const prefix = array ? "" : add(JSON.stringify(key) + ":");
      values.push(prefix + encode(descriptor.value, depth + 1));
    }
    ancestors.delete(item);
    return (array ? "[" : "{") + values.join(",") + add(array ? "]" : "}");
  };
  return encode(value, 0);
}
function auditPayloadHash(canonicalJson) {
  return createHash("sha256").update(canonicalJson, "utf8").digest("hex");
}
function freezeAuditJson(value) {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freezeAuditJson(child);
    Object.freeze(value);
  }
  return value;
}
var AUDIT_MAX_BYTES, AUDIT_HASH_VERSION, AuditContractError;
var init_canonical = __esm({
  "server/audit/canonical.ts"() {
    "use strict";
    AUDIT_MAX_BYTES = 32 * 1024;
    AUDIT_HASH_VERSION = "sha256-sorted-json-v1";
    AuditContractError = class extends Error {
      constructor() {
        super("Invalid audit event contract");
        this.name = "AuditContractError";
      }
    };
  }
});

// server/audit/context.ts
import { z as z6 } from "zod";
function createAuditContext(input) {
  try {
    canonicalAuditJson(input);
    const context = freezeAuditJson(auditContextSchema.parse(input));
    contexts.add(context);
    return context;
  } catch {
    throw new AuditContractError();
  }
}
function assertAuditContext(value) {
  if (!value || !contexts.has(value)) throw new AuditContractError();
}
var userIdSchema, roleSchema, actorSchema, scopeSchema, targetSchema, auditContextSchema, contexts;
var init_context = __esm({
  "server/audit/context.ts"() {
    "use strict";
    init_canonical();
    userIdSchema = z6.string().uuid();
    roleSchema = z6.enum(["seeker", "provider", "owner", "admin", "viewer", "support"]);
    actorSchema = z6.discriminatedUnion("kind", [
      z6.object({ kind: z6.literal("user"), userId: userIdSchema, effectiveRole: roleSchema }).strict(),
      z6.object({ kind: z6.literal("anonymous") }).strict(),
      z6.object({ kind: z6.literal("service"), serviceId: z6.literal("billing-worker") }).strict()
    ]);
    scopeSchema = z6.discriminatedUnion("kind", [
      z6.object({ kind: z6.literal("personal"), workspaceId: userIdSchema }).strict(),
      z6.object({ kind: z6.literal("company"), workspaceId: z6.string().regex(/^[1-9][0-9]{0,9}$/) }).strict(),
      z6.object({ kind: z6.literal("global") }).strict(),
      z6.object({ kind: z6.literal("unknown") }).strict()
    ]);
    targetSchema = z6.discriminatedUnion("type", [
      z6.object({ type: z6.literal("request") }).strict(),
      z6.object({ type: z6.literal("user"), id: userIdSchema }).strict(),
      z6.object({ type: z6.literal("membership"), id: userIdSchema }).strict(),
      z6.object({ type: z6.literal("company"), id: z6.string().regex(/^[1-9][0-9]{0,9}$/) }).strict(),
      z6.object({ type: z6.literal("billing_operation"), id: z6.string().uuid() }).strict(),
      z6.object({ type: z6.literal("billing_subscription"), id: z6.string().uuid() }).strict(),
      z6.object({ type: z6.literal("billing_event"), id: z6.string().uuid() }).strict(),
      z6.object({ type: z6.literal("manual_grant"), id: z6.string().uuid() }).strict(),
      z6.object({ type: z6.literal("billing_offer"), id: z6.string().uuid() }).strict(),
      z6.object({ type: z6.literal("service"), id: z6.string().regex(/^[1-9][0-9]{0,9}$/).refine((value) => Number(value) <= 2147483647) }).strict()
    ]);
    auditContextSchema = z6.object({
      actor: actorSchema,
      scope: scopeSchema,
      target: targetSchema,
      source: z6.object({
        application: z6.literal("fitsmytime"),
        environment: z6.string().regex(/^[a-z][a-z0-9-]{0,31}$/),
        component: z6.enum(["auth", "account", "company-access", "authorization", "service", "billing"]),
        release: z6.string().regex(/^[a-f0-9]{7,64}$/).optional()
      }).strict(),
      requestId: z6.string().uuid(),
      operationId: z6.string().uuid(),
      parentEventId: z6.string().uuid().optional()
    }).strict().superRefine((context, issue) => {
      const invalid3 = () => issue.addIssue({ code: "custom", message: "Invalid audit context" });
      const publicService = context.target.type === "service" && context.source.component === "service" && context.scope.kind === "unknown";
      const billing = context.source.component === "billing";
      if (context.actor.kind === "service" && (!billing || context.scope.kind === "global" || context.scope.kind === "unknown" && context.target.type !== "billing_event")) invalid3();
      if (billing && context.actor.kind === "anonymous") invalid3();
      if (context.actor.kind === "anonymous" && (context.scope.kind !== "unknown" || context.target.type !== "request" && !publicService)) invalid3();
      if (context.scope.kind === "unknown" && context.target.type !== "request" && !publicService && !(billing && context.actor.kind === "service" && context.target.type === "billing_event")) invalid3();
      if (context.target.type === "service" && !publicService) invalid3();
      if (context.scope.kind === "global" && (context.actor.kind !== "user" || context.actor.effectiveRole !== "support")) invalid3();
      if (context.scope.kind === "company" && context.actor.kind === "user" && !["owner", "admin", "provider", "viewer"].includes(context.actor.effectiveRole) && !(billing && context.actor.effectiveRole === "support")) invalid3();
      if (context.scope.kind === "personal" && context.actor.kind === "user" && !["seeker", "provider"].includes(context.actor.effectiveRole) && !(billing && context.actor.effectiveRole === "support")) invalid3();
      if (context.target.type === "company" && (context.scope.kind !== "company" || context.target.id !== context.scope.workspaceId)) invalid3();
      if (context.target.type === "membership" && context.scope.kind !== "company") invalid3();
    });
    contexts = /* @__PURE__ */ new WeakSet();
  }
});

// server/audit/events.ts
import { randomUUID } from "node:crypto";
import { z as z7 } from "zod";
function retention(eventName) {
  if (eventName.startsWith("billing.")) return eventName === "billing.event_quarantined.v1" ? "S" : "B";
  if (eventName === "service.viewed.v1") return "R";
  return eventName.startsWith("account.") || companyEvents.has(eventName) ? "B" : "S";
}
function validatePolicy(event) {
  const reject = () => {
    throw new AuditContractError();
  };
  const { actor: actor2, scope: scope2, target: target2, eventName, outcome, reasonCode, changes } = event;
  if (eventName.startsWith("billing.")) {
    auditContextSchema.parse({
      actor: actor2,
      scope: scope2,
      target: target2,
      source: event.source,
      requestId: event.requestId,
      operationId: event.operationId,
      ...event.parentEventId ? { parentEventId: event.parentEventId } : {}
    });
    if (event.source.component !== "billing" || event.retentionClass !== retention(eventName) || changes.length || actor2.kind === "anonymous") reject();
    if (eventName === "billing.event_quarantined.v1") {
      if (outcome !== "rejected" || reasonCode !== "CONFLICT") reject();
    } else if (["billing.checkout_unknown.v1", "billing.portal_unknown.v1"].includes(eventName)) {
      if (outcome !== "unknown" || reasonCode !== "PROVIDER_TIMEOUT") reject();
    } else if (outcome !== "succeeded" || reasonCode !== void 0) reject();
    const resolved = scope2.kind === "personal" || scope2.kind === "company";
    if (scope2.kind === "company" && Number(scope2.workspaceId) > 2147483647) reject();
    const owner = actor2.kind === "user" && (scope2.kind === "personal" ? actor2.effectiveRole === "provider" && actor2.userId === scope2.workspaceId : scope2.kind === "company" && actor2.effectiveRole === "owner");
    const worker = actor2.kind === "service" && actor2.serviceId === "billing-worker";
    const support = actor2.kind === "user" && actor2.effectiveRole === "support";
    if (eventName === "billing.offer_changed.v1") {
      if (!support || scope2.kind !== "global" || target2.type !== "billing_offer") reject();
    } else if (eventName === "billing.manual_grant_changed.v1") {
      if (!support || !resolved || target2.type !== "manual_grant") reject();
    } else if (eventName === "billing.workspace_initialized.v1") {
      if (!owner || (scope2.kind === "personal" ? target2.type !== "user" || target2.id !== scope2.workspaceId : scope2.kind !== "company" || target2.type !== "company" || target2.id !== scope2.workspaceId)) reject();
    } else if (eventName === "billing.event_quarantined.v1") {
      if (!worker || !resolved && scope2.kind !== "unknown" || target2.type !== "billing_event") reject();
    } else if (eventName === "billing.event_accepted.v1") {
      if (!worker || !resolved || target2.type !== "billing_event") reject();
    } else if (eventName === "billing.subscription_reconciled.v1") {
      if (!worker || !resolved || target2.type !== "billing_subscription") reject();
    } else if (eventName === "billing.price_mapping_changed.v1" || eventName === "billing.checkout_resolved.v1") {
      if (!worker || !resolved || target2.type !== "billing_operation") reject();
    } else if (!resolved || target2.type !== "billing_operation" || !(owner || worker && ["billing.checkout_unknown.v1", "billing.portal_unknown.v1"].includes(eventName))) reject();
    return;
  }
  const localMutation = eventName.startsWith("account.") || companyEvents.has(eventName);
  const expectedComponent = eventName.startsWith("auth.") ? "auth" : eventName.startsWith("account.") ? "account" : companyEvents.has(eventName) ? "company-access" : eventName === "service.viewed.v1" ? "service" : "authorization";
  if (event.source.component !== expectedComponent) reject();
  if (localMutation && outcome === "unknown") reject();
  auditContextSchema.parse({
    actor: actor2,
    scope: scope2,
    target: target2,
    source: event.source,
    requestId: event.requestId,
    operationId: event.operationId,
    ...event.parentEventId ? { parentEventId: event.parentEventId } : {}
  });
  if (event.retentionClass !== retention(eventName)) reject();
  if (scope2.kind === "global") reject();
  if (eventName === "service.viewed.v1" && (target2.type !== "service" || scope2.kind !== "unknown" || outcome !== "succeeded" || reasonCode !== void 0 || changes.length || actor2.kind === "user" && !["seeker", "provider"].includes(actor2.effectiveRole))) reject();
  if (eventName === "security.action_denied.v1") {
    if (outcome !== "denied" || target2.type !== "request" || !reasonCode || !["UNAUTHENTICATED", "FORBIDDEN", "CROSS_WORKSPACE", "WRONG_ORIGIN", "RATE_LIMITED", "SESSION_EXPIRED"].includes(reasonCode)) reject();
  }
  if (selfEvents.has(eventName) && (actor2.kind !== "user" || target2.type !== "user" || target2.id !== actor2.userId || scope2.kind === "personal" && scope2.workspaceId !== actor2.userId || scope2.kind === "unknown")) reject();
  if (companyEvents.has(eventName) && (actor2.kind !== "user" || scope2.kind !== "company" || !["owner", "admin"].includes(actor2.effectiveRole))) reject();
  if (eventName === "company.membership_changed.v1" && target2.type !== "membership") reject();
  if (eventName === "company.ownership_transferred.v1" && (target2.type !== "company" || actor2.kind !== "user" || actor2.effectiveRole !== "owner")) reject();
  if (eventName.startsWith("account.") && scope2.kind !== "personal") reject();
  if (eventName.startsWith("auth.") && !selfEvents.has(eventName)) {
    if (outcome === "succeeded" && eventName !== "auth.oauth_started.v1" && actor2.kind !== "user") reject();
    if (actor2.kind === "user" && target2.type !== "user") reject();
    if (actor2.kind === "user" && target2.type === "user" && target2.id !== actor2.userId) reject();
    if (actor2.kind === "user" && scope2.kind === "personal" && scope2.workspaceId !== actor2.userId) reject();
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
  if (new Set(changes.map((change) => change.field)).size !== changes.length) reject();
  const valueFields = eventName === "account.active_role_changed.v1" ? { currentRole: z7.enum(["seeker", "provider"]) } : eventName === "company.membership_changed.v1" ? { role: z7.enum(["admin", "provider", "viewer"]), employeeId: z7.union([z7.number().int().positive(), z7.null()]) } : eventName === "company.ownership_transferred.v1" ? { ownerId: userIdSchema } : {};
  const indicatorFields = eventName === "account.details_changed.v1" ? ["firstName", "lastName"] : [];
  for (const change of changes) {
    if (indicatorFields.includes(change.field)) {
      if (!change.redacted || "before" in change || "after" in change) reject();
    } else {
      const schema = Object.hasOwn(valueFields, change.field) ? valueFields[change.field] : void 0;
      if (!schema || change.redacted || !("before" in change) || !("after" in change) || !schema.safeParse(change.before).success || !schema.safeParse(change.after).success || change.before === change.after) reject();
    }
  }
  if (outcome === "succeeded" && (indicatorFields.length || Object.keys(valueFields).length) && !changes.length && reasonCode !== "NO_CHANGE") reject();
  if (eventName === "company.ownership_transferred.v1" && changes.some((change) => change.field === "ownerId" && (actor2.kind !== "user" || change.before !== actor2.userId))) reject();
}
function parseAuditEnvelope(input) {
  try {
    canonicalAuditJson(input);
    const event = envelopeSchema.parse(input);
    validatePolicy(event);
    return freezeAuditJson(event);
  } catch {
    throw new AuditContractError();
  }
}
function createAuditEvent(context, action, dependencies = {
  now: () => /* @__PURE__ */ new Date(),
  newId: () => randomUUID()
}) {
  try {
    assertAuditContext(context);
    canonicalAuditJson(action);
    const parsed = actionSchema.parse(action);
    const envelope = parseAuditEnvelope({
      ...context,
      ...parsed,
      eventId: dependencies.newId(),
      schemaVersion: 1,
      catalogVersion: 1,
      occurredAt: dependencies.now().toISOString(),
      retentionClass: retention(parsed.eventName)
    });
    const canonicalJson = canonicalAuditJson(envelope);
    return freezeAuditJson({ envelope, canonicalJson, payloadHash: auditPayloadHash(canonicalJson), hashVersion: AUDIT_HASH_VERSION });
  } catch {
    throw new AuditContractError();
  }
}
var SUPPORTED_AUDIT_EVENTS, outcomes, safeReasons, valueSchema, changeSchema, actionSchema, timestampSchema, envelopeSchema, selfEvents, companyEvents;
var init_events = __esm({
  "server/audit/events.ts"() {
    "use strict";
    init_canonical();
    init_context();
    SUPPORTED_AUDIT_EVENTS = Object.freeze([
      "auth.login.v1",
      "auth.oauth_started.v1",
      "auth.oauth_callback.v1",
      "auth.session_established.v1",
      "auth.logout.v1",
      "auth.password_changed.v1",
      "security.action_denied.v1",
      "account.details_changed.v1",
      "account.active_role_changed.v1",
      "company.membership_changed.v1",
      "company.ownership_transferred.v1",
      "service.viewed.v1",
      "billing.checkout_reserved.v1",
      "billing.checkout_created.v1",
      "billing.checkout_unknown.v1",
      "billing.checkout_resolved.v1",
      "billing.event_accepted.v1",
      "billing.event_quarantined.v1",
      "billing.subscription_reconciled.v1",
      "billing.offer_changed.v1",
      "billing.price_mapping_changed.v1",
      "billing.manual_grant_changed.v1",
      "billing.workspace_initialized.v1",
      "billing.portal_reserved.v1",
      "billing.portal_created.v1",
      "billing.portal_unknown.v1"
    ]);
    outcomes = ["succeeded", "rejected", "denied", "failed", "unknown"];
    safeReasons = [
      "INVALID_INPUT",
      "INVALID_CREDENTIALS",
      "UNAUTHENTICATED",
      "FORBIDDEN",
      "CROSS_WORKSPACE",
      "WRONG_ORIGIN",
      "RATE_LIMITED",
      "PROVIDER_DISABLED",
      "OAUTH_CANCELLED",
      "SESSION_EXPIRED",
      "CONFLICT",
      "PROVIDER_UNAVAILABLE",
      "PROVIDER_TIMEOUT",
      "LOCAL_FAILURE",
      "NO_CHANGE"
    ];
    valueSchema = z7.union([z7.boolean(), z7.number().finite(), z7.string().max(128), z7.null()]);
    changeSchema = z7.object({
      field: z7.string().max(64),
      before: valueSchema.optional(),
      after: valueSchema.optional(),
      redacted: z7.literal(true).optional()
    }).strict();
    actionSchema = z7.object({
      eventName: z7.enum(SUPPORTED_AUDIT_EVENTS),
      outcome: z7.enum(outcomes),
      reasonCode: z7.enum(safeReasons).optional(),
      changes: z7.array(changeSchema).max(64)
    }).strict();
    timestampSchema = z7.string().datetime({ precision: 3 }).refine((value) => Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value && value >= "2000-01-01T00:00:00.000Z" && value < "2200-01-01T00:00:00.000Z");
    envelopeSchema = z7.object({
      ...auditContextSchema.innerType().shape,
      eventId: z7.string().uuid(),
      schemaVersion: z7.literal(1),
      catalogVersion: z7.literal(1),
      occurredAt: timestampSchema,
      ...actionSchema.shape,
      retentionClass: z7.enum(["B", "S", "R"])
    }).strict();
    selfEvents = /* @__PURE__ */ new Set([
      "auth.session_established.v1",
      "auth.logout.v1",
      "auth.password_changed.v1",
      "account.details_changed.v1",
      "account.active_role_changed.v1"
    ]);
    companyEvents = /* @__PURE__ */ new Set(["company.membership_changed.v1", "company.ownership_transferred.v1"]);
  }
});

// server/audit/capture.ts
import { sql as sql4 } from "drizzle-orm";
function auditArguments(event) {
  const envelope = parseAuditEnvelope(event.envelope);
  const canonical = canonicalAuditJson(envelope);
  if (canonical !== event.canonicalJson || auditPayloadHash(canonical) !== event.payloadHash || event.hashVersion !== AUDIT_HASH_VERSION) throw new AuditContractError();
  return [canonical, event.payloadHash, event.hashVersion];
}
async function enqueueAudit(transaction, event) {
  try {
    const result = await transaction.query("SELECT audit_capture.enqueue($1,$2,$3) AS event_id", auditArguments(event));
    if (result.rows.length !== 1 || result.rows[0].event_id !== event.envelope.eventId) throw new AuditCaptureUnavailable();
  } catch {
    console.error("Audit capture gap", "CAPTURE_UNAVAILABLE");
    throw new AuditCaptureUnavailable();
  }
}
async function enqueueDrizzleAudit(transaction, event) {
  try {
    const [canonical, hash3, version] = auditArguments(event);
    const result = await transaction.execute(sql4`SELECT audit_capture.enqueue(${canonical},${hash3},${version}) AS event_id`);
    if (result.rows.length !== 1 || result.rows[0].event_id !== event.envelope.eventId) throw new AuditCaptureUnavailable();
  } catch {
    console.error("Audit capture gap", "CAPTURE_UNAVAILABLE");
    throw new AuditCaptureUnavailable();
  }
}
async function auditTransaction(pool2, work) {
  let client2;
  try {
    client2 = await pool2.connect();
  } catch {
    console.error("Audit capture gap", "CAPTURE_UNAVAILABLE");
    throw new AuditCaptureUnavailable();
  }
  let failed = false;
  try {
    await client2.query("BEGIN");
    const value = await work(client2);
    await client2.query("COMMIT");
    return value;
  } catch {
    failed = true;
    await client2.query("ROLLBACK").catch(() => {
    });
    throw new AuditCaptureUnavailable();
  } finally {
    client2.release(failed);
  }
}
async function captureIndependent(pool2, event) {
  await auditTransaction(pool2, (transaction) => enqueueAudit(transaction, event));
}
var AuditCaptureUnavailable;
var init_capture = __esm({
  "server/audit/capture.ts"() {
    "use strict";
    init_canonical();
    init_events();
    AuditCaptureUnavailable = class extends Error {
      status = 503;
      constructor() {
        super("Activity capture is temporarily unavailable");
        this.name = "AuditCaptureUnavailable";
      }
    };
  }
});

// server/audit/worker.ts
import { z as z12 } from "zod";
var claimSchema, AuditPortFailure;
var init_worker = __esm({
  "server/audit/worker.ts"() {
    "use strict";
    init_canonical();
    init_events();
    init_config();
    claimSchema = z12.object({
      event_id: z12.string().uuid(),
      canonical_json: z12.string().max(32768),
      payload_hash: z12.string().regex(/^[a-f0-9]{64}$/),
      hash_version: z12.string().max(64),
      lease_token: z12.string().uuid(),
      lease_until: z12.union([z12.date(), z12.string().datetime()]),
      attempts: z12.union([z12.string().regex(/^[0-9]{1,19}$/), z12.number().int().nonnegative()])
    }).strict();
    AuditPortFailure = class extends Error {
      code;
      constructor(code) {
        super("Audit delivery operation unavailable");
        this.name = "AuditPortFailure";
        this.code = code;
      }
    };
  }
});

// server/audit/runtime.ts
var runtime_exports = {};
__export(runtime_exports, {
  assertAuditRuntimeRole: () => assertAuditRuntimeRole,
  createCaptureRuntime: () => createCaptureRuntime,
  createWorkerRuntime: () => createWorkerRuntime
});
import { readFile } from "node:fs/promises";
import tls2 from "node:tls";
async function openPool(url, kind) {
  const config = auditConnection(url, kind);
  const { default: pg2 } = await import("pg");
  const ssl = {
    rejectUnauthorized: true,
    servername: config.host,
    checkServerIdentity: tls2.checkServerIdentity,
    minVersion: "TLSv1.2"
  };
  if (config.caPath) ssl.ca = await readFile(config.caPath, "utf8");
  const pool2 = new pg2.Pool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    ...{ replication: "false", sslnegotiation: "postgres" },
    database: config.database,
    ssl,
    max: kind === "capture" ? 2 : 1,
    connectionTimeoutMillis: 5e3,
    idleTimeoutMillis: 1e4,
    application_name: `fitsmytime-audit-${kind}`,
    query_timeout: 6e3,
    options: "-c statement_timeout=5000 -c lock_timeout=1000 -c idle_in_transaction_session_timeout=10000"
  });
  pool2.on("error", () => {
  });
  const wrap = async () => {
    const client2 = await pool2.connect();
    const stream = client2.connection.stream;
    if (!stream.encrypted || !stream.authorized) {
      client2.release(true);
      throw new AuditCaptureUnavailable();
    }
    let released = false;
    return {
      query: async (text3, values) => client2.query(text3, values),
      release: (destroy2 = false) => {
        if (!released) {
          released = true;
          client2.release(destroy2);
        }
      }
    };
  };
  const adapter = { connect: wrap };
  return { pool: pool2, adapter };
}
async function run(pool2, text3, values = [], signal) {
  if (signal?.aborted) throw new AuditCaptureUnavailable();
  const client2 = await pool2.adapter.connect();
  const abort = () => client2.release(true);
  signal?.addEventListener("abort", abort, { once: true });
  let failed = false;
  try {
    if (signal?.aborted) throw new AuditCaptureUnavailable();
    return await client2.query(text3, values);
  } catch (error) {
    failed = true;
    const code = error && typeof error === "object" && "code" in error ? error.code : void 0;
    throw new AuditPortFailure(code === "42501" || code === "28P01" || code === "28000" ? "AUTHORIZATION_CONFIGURATION" : code === "22023" || code === "22P02" ? "INVALID_CONTRACT" : code === "40001" || code === "40P01" ? "DESTINATION_BUSY" : signal?.aborted || code === "57014" ? "DESTINATION_TIMEOUT" : "DESTINATION_UNAVAILABLE");
  } finally {
    signal?.removeEventListener("abort", abort);
    client2.release(failed);
  }
}
function assertAuditRuntimeRole(rows, kind) {
  const row = rows[0];
  if (rows.length !== 1 || row.principal !== AUDIT_USERS[kind] || row.group_member !== true || row.may_execute !== true || ["rolsuper", "rolbypassrls", "rolcreaterole", "rolcreatedb", "rolreplication", "base_access", "owner_member", "extra_application_role"].some((key) => row[key] !== false)) throw new AuditCaptureUnavailable();
}
async function checkRole(pool2, kind) {
  const group = kind === "worker" ? "fm_audit_delivery" : kind === "writer" ? "fm_audit_writer" : "fm_audit_capture";
  const object = kind === "writer" ? "audit.events" : "audit_capture.audit_outbox";
  const entry = kind === "writer" ? "audit.accept(text,text,text)" : kind === "worker" ? "audit_capture.claim(integer)" : "audit_capture.enqueue(text,text,text)";
  const result = await run(pool2, `SELECT current_user AS principal,r.rolsuper,r.rolbypassrls,r.rolcreaterole,r.rolcreatedb,r.rolreplication,
    pg_has_role(current_user,$1,'MEMBER') AS group_member,
    has_function_privilege(current_user,$2,'EXECUTE') AS may_execute,
    has_table_privilege(current_user,$3,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS base_access,
    EXISTS (SELECT 1 FROM pg_roles owner_role WHERE owner_role.rolname IN
      ('fm_audit_contract_owner','fm_audit_source_owner','fm_audit_destination_owner')
      AND pg_has_role(current_user,owner_role.oid,'MEMBER')) AS owner_member,
    EXISTS (SELECT 1 FROM pg_roles extra_role WHERE extra_role.rolname <> current_user
      AND extra_role.rolname <> $1 AND ($4 <> 'worker' OR extra_role.rolname <> 'fm_audit_source_monitor')
      AND pg_has_role(current_user,extra_role.oid,'MEMBER')) AS extra_application_role
    FROM pg_roles r WHERE r.rolname=current_user`, [group, entry, object, kind]);
  assertAuditRuntimeRole(result.rows, kind);
}
async function createCaptureRuntime(environment) {
  assertAuditActivation(environment);
  auditEnvironment(environment);
  if (environment.AUDIT_ENABLED !== "true") throw new AuditCaptureUnavailable();
  const pool2 = await openPool(environment.AUDIT_CAPTURE_DATABASE_URL, "capture");
  try {
    await checkRole(pool2, "capture");
  } catch {
    await pool2.pool.end();
    throw new AuditCaptureUnavailable();
  }
  return {
    capture: (event) => captureIndependent(pool2.adapter, event),
    close: () => pool2.pool.end(),
    ready: async () => {
      await checkRole(pool2, "capture");
    }
  };
}
async function createWorkerRuntime(environment) {
  assertAuditActivation(environment);
  auditEnvironment(environment);
  if (environment.AUDIT_WORKER_ENABLED !== "true") throw new AuditCaptureUnavailable();
  const source = await openPool(environment.AUDIT_SOURCE_DATABASE_URL, "worker");
  let destination;
  try {
    destination = await openPool(environment.AUDIT_DATABASE_URL, "writer");
    await checkRole(source, "worker");
    await checkRole(destination, "writer");
    const target2 = destination;
    const flag = async (name, row, values, signal) => {
      const placeholders = values.map((_, index2) => `$${index2 + 3}`).join(",");
      const result = await run(
        source,
        `SELECT audit_capture.${name}($1,$2${values.length ? "," + placeholders : ""}) AS changed`,
        [row.event_id, row.lease_token, ...values],
        signal
      );
      if (result.rows.length !== 1 || typeof result.rows[0].changed !== "boolean") throw new AuditCaptureUnavailable();
      return result.rows[0].changed;
    };
    const ports = {
      claim: async (limit, signal) => (await run(source, "SELECT * FROM audit_capture.claim($1)", [limit], signal)).rows,
      accept: async (row, signal) => {
        const result = await run(
          target2,
          "SELECT audit.accept($1,$2,$3) AS disposition",
          [row.canonical_json, row.payload_hash, row.hash_version],
          signal
        );
        const value = result.rows[0]?.disposition;
        if (result.rows.length !== 1 || !["inserted", "matching", "conflict", "expired"].includes(String(value))) throw new AuditCaptureUnavailable();
        return value;
      },
      ack: (row, signal) => flag("ack", row, [], signal),
      retry: (row, code, delay, signal) => flag("retry", row, [code, delay], signal),
      quarantine: (row, code, signal) => flag("quarantine", row, [code], signal),
      health: async (signal) => {
        const result = await run(source, `SELECT status,event_count::text,expired_count::text,
          GREATEST(0,extract(epoch FROM clock_timestamp()-oldest_created_at))::text AS age_seconds
          FROM audit_capture.delivery_health`, [], signal);
        const health = { pending: 0, leased: 0, quarantined: 0, expired: 0, oldestAgeSeconds: 0 };
        for (const row of result.rows) {
          if (!["pending", "leased", "quarantined", "delivered"].includes(String(row.status))) throw new AuditCaptureUnavailable();
          const count = Number(row.event_count), expired2 = Number(row.expired_count), age = Number(row.age_seconds);
          if (![count, expired2, age].every((value) => Number.isFinite(value) && value >= 0) || !Number.isSafeInteger(count)) throw new AuditCaptureUnavailable();
          if (row.status !== "delivered") {
            health[row.status] = count;
            health.expired += expired2;
            health.oldestAgeSeconds = Math.max(health.oldestAgeSeconds, age);
          }
        }
        return health;
      }
    };
    return { ports, close: async () => {
      await Promise.all([source.pool.end(), target2.pool.end()]);
    } };
  } catch {
    await Promise.all([source.pool.end(), destination?.pool.end()]);
    throw new AuditCaptureUnavailable();
  }
}
var init_runtime = __esm({
  "server/audit/runtime.ts"() {
    "use strict";
    init_config();
    init_capture();
    init_worker();
  }
});

// scripts/privacy-policy.ts
import { readFileSync as readFileSync2 } from "node:fs";
import path from "node:path";
import { loadEnv } from "vite";
function renderPrivacyPolicy(template, env) {
  const name = env.PRIVACY_POLICY_OPERATOR_NAME?.trim() || "";
  const address = env.PRIVACY_POLICY_OPERATOR_ADDRESS?.trim() || "";
  const email = env.PRIVACY_POLICY_EMAIL?.trim() || "";
  let origin = "";
  try {
    const url = new URL(env.PRIVACY_POLICY_PUBLIC_ORIGIN || "");
    if (url.protocol === "https:" && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash) origin = url.origin;
  } catch {
  }
  const validEmail = /^[^\s@<>"'?#&]+@[^\s@<>"'?#&]+\.[^\s@<>"'?#&]+$/.test(email);
  const ready = Boolean(name && address && validEmail && origin);
  const values = {
    STATUS: ready ? "" : '<aside class="draft" role="note"><strong>Draft \u2014 configuration incomplete.</strong> The operator must set the privacy policy details before this page is used as a public policy or submitted to Meta.</aside>',
    ROBOTS: ready ? "index, follow" : "noindex, nofollow",
    CANONICAL: origin ? `<link rel="canonical" href="${escapeHtml(origin)}/privacy-policy.html">` : "",
    OPERATOR: escapeHtml(name || "Operator details pending"),
    ADDRESS: escapeHtml(address || "Postal address pending"),
    CONTACT: validEmail ? `<a href="mailto:${escapeHtml(encodeURIComponent(email).replace(/%40/g, "@"))}">${escapeHtml(email)}</a>` : "Privacy contact email pending",
    HOME: escapeHtml(origin || "/"),
    RETENTION: escapeHtml(env.PRIVACY_POLICY_RETENTION?.trim() || "Account information is retained while needed to provide your account. Booking and transaction records may be retained to meet legal obligations and resolve disputes. Security records are retained as needed to investigate abuse and protect the service. When information is no longer needed for these purposes, it should be deleted or anonymised. Contact us for the retention period applicable to your information."),
    TRANSFERS: escapeHtml(env.PRIVACY_POLICY_INTERNATIONAL_TRANSFERS?.trim() || "Our service providers may process information in countries outside your country of residence, including outside the European Economic Area. Contact us for the processing locations and transfer safeguards applicable to your information, and to request a copy of the relevant safeguards.")
  };
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (token, key) => values[key] ?? token);
}
function privacyPolicyPlugin() {
  let root;
  let publicDetails;
  const render = () => renderPrivacyPolicy(readFileSync2(path.join(root, "client/privacy-policy.template.html"), "utf8"), publicDetails);
  return {
    name: "fitsmytime-privacy-policy",
    configResolved(config) {
      root = path.resolve(config.root, "..");
      const loaded = loadEnv(config.mode, root, "PRIVACY_POLICY_");
      publicDetails = Object.fromEntries([
        "OPERATOR_NAME",
        "OPERATOR_ADDRESS",
        "EMAIL",
        "PUBLIC_ORIGIN",
        "RETENTION",
        "INTERNATIONAL_TRANSFERS"
      ].map((key) => {
        const name = `PRIVACY_POLICY_${key}`;
        return [name, process.env[name] ?? loaded[name]];
      }));
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split("?")[0] !== "/privacy-policy.html" || !["GET", "HEAD"].includes(request.method || "")) return next();
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.setHeader("Cache-Control", "no-store");
        response.end(request.method === "HEAD" ? void 0 : render());
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "privacy-policy.html", source: render() });
    }
  };
}
var escapeHtml;
var init_privacy_policy = __esm({
  "scripts/privacy-policy.ts"() {
    "use strict";
    escapeHtml = (value) => value.replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }
});

// vite.config.ts
var vite_config_exports = {};
__export(vite_config_exports, {
  default: () => vite_config_default
});
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path2 from "path";
var vite_config_default;
var init_vite_config = __esm({
  "vite.config.ts"() {
    "use strict";
    init_privacy_policy();
    vite_config_default = defineConfig({
      plugins: [
        react(),
        privacyPolicyPlugin()
      ],
      resolve: {
        alias: {
          "@": path2.resolve(import.meta.dirname, "client", "src"),
          "@shared": path2.resolve(import.meta.dirname, "shared"),
          "@assets": path2.resolve(import.meta.dirname, "attached_assets")
        }
      },
      root: path2.resolve(import.meta.dirname, "client"),
      build: {
        outDir: path2.resolve(import.meta.dirname, "dist/public"),
        emptyOutDir: true
      },
      server: {
        fs: {
          strict: true,
          deny: ["**/.*"]
        }
      }
    });
  }
});

// server/index.ts
import express4 from "express";

// server/routes.ts
import { createServer } from "http";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  accountDetailsSchema: () => accountDetailsSchema,
  addressInputSchema: () => addressInputSchema,
  addresses: () => addresses,
  addressesRelations: () => addressesRelations,
  availability: () => availability,
  availabilityRelations: () => availabilityRelations,
  billingAccounts: () => billingAccounts,
  billingEvents: () => billingEvents,
  billingInvoices: () => billingInvoices,
  billingOfferRevisions: () => billingOfferRevisions,
  billingOfferSettings: () => billingOfferSettings,
  billingOperations: () => billingOperations,
  billingPriceMappings: () => billingPriceMappings,
  billingSourceState: () => billingSourceState,
  billingSubscriptions: () => billingSubscriptions,
  bookingMessageReads: () => bookingMessageReads,
  bookingMessages: () => bookingMessages,
  bookingRescheduleRequests: () => bookingRescheduleRequests,
  bookings: () => bookings,
  bookingsRelations: () => bookingsRelations,
  categories: () => categories,
  companies: () => companies,
  companyInvitations: () => companyInvitations,
  companyMemberships: () => companyMemberships,
  companyRoles: () => companyRoles,
  employeeSchema: () => employeeSchema,
  employees: () => employees,
  geocodingCache: () => geocodingCache,
  insertAvailabilitySchema: () => insertAvailabilitySchema,
  insertBookingSchema: () => insertBookingSchema,
  insertServiceSchema: () => insertServiceSchema,
  manualProGrants: () => manualProGrants,
  notificationCallbacks: () => notificationCallbacks,
  notificationDeliveryAttempts: () => notificationDeliveryAttempts,
  notificationEvents: () => notificationEvents,
  notificationJobs: () => notificationJobs,
  phoneVerificationChallenges: () => phoneVerificationChallenges,
  productActivityEvents: () => productActivityEvents,
  providerProfileSchema: () => providerProfileSchema,
  providerSubscriptions: () => providerSubscriptions,
  serviceActivityGroups: () => serviceActivityGroups,
  serviceActivityReads: () => serviceActivityReads,
  serviceEmbeddings: () => serviceEmbeddings,
  serviceReviews: () => serviceReviews,
  services: () => services,
  servicesRelations: () => servicesRelations,
  sessions: () => sessions,
  storefronts: () => storefronts,
  userCommunicationPreferences: () => userCommunicationPreferences,
  userSearchLocations: () => userSearchLocations,
  users: () => users,
  usersRelations: () => usersRelations,
  wishlistServices: () => wishlistServices,
  workspacePricingSettings: () => workspacePricingSettings
});
import {
  pgTable,
  text,
  varchar,
  timestamp,
  date,
  jsonb,
  index,
  serial,
  integer,
  decimal,
  boolean,
  doublePrecision,
  primaryKey,
  uniqueIndex,
  check,
  uuid,
  foreignKey,
  unique
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// shared/currencies.ts
var SUPPORTED_CURRENCIES = ["AED", "AFN", "ALL", "AMD", "AOA", "ARS", "AUD", "AWG", "AZN", "BAM", "BBD", "BDT", "BHD", "BIF", "BMD", "BND", "BOB", "BRL", "BSD", "BTN", "BWP", "BYN", "BZD", "CAD", "CDF", "CHF", "CLP", "CNY", "COP", "CRC", "CUP", "CVE", "CZK", "DJF", "DKK", "DOP", "DZD", "EGP", "ERN", "ETB", "EUR", "FJD", "FKP", "GBP", "GEL", "GHS", "GIP", "GMD", "GNF", "GTQ", "GYD", "HKD", "HNL", "HTG", "HUF", "IDR", "ILS", "INR", "IQD", "IRR", "ISK", "JMD", "JOD", "JPY", "KES", "KGS", "KHR", "KMF", "KPW", "KRW", "KWD", "KYD", "KZT", "LAK", "LBP", "LKR", "LRD", "LSL", "LYD", "MAD", "MDL", "MGA", "MKD", "MMK", "MNT", "MOP", "MRU", "MUR", "MVR", "MWK", "MXN", "MYR", "MZN", "NAD", "NGN", "NIO", "NOK", "NPR", "NZD", "OMR", "PAB", "PEN", "PGK", "PHP", "PKR", "PLN", "PYG", "QAR", "RON", "RSD", "RUB", "RWF", "SAR", "SBD", "SCR", "SDG", "SEK", "SGD", "SHP", "SLE", "SOS", "SRD", "SSP", "STN", "SYP", "SZL", "THB", "TJS", "TMT", "TND", "TOP", "TRY", "TTD", "TWD", "TZS", "UAH", "UGX", "USD", "UYU", "UZS", "VES", "VND", "VUV", "WST", "XAF", "XCD", "XCG", "XOF", "XPF", "YER", "ZAR", "ZMW", "ZWG"];
var CURRENCY_DIGITS = Object.freeze({ "AED": 2, "AFN": 2, "ALL": 2, "AMD": 2, "AOA": 2, "ARS": 2, "AUD": 2, "AWG": 2, "AZN": 2, "BAM": 2, "BBD": 2, "BDT": 2, "BHD": 3, "BIF": 0, "BMD": 2, "BND": 2, "BOB": 2, "BRL": 2, "BSD": 2, "BTN": 2, "BWP": 2, "BYN": 2, "BZD": 2, "CAD": 2, "CDF": 2, "CHF": 2, "CLP": 0, "CNY": 2, "COP": 2, "CRC": 2, "CUP": 2, "CVE": 2, "CZK": 2, "DJF": 0, "DKK": 2, "DOP": 2, "DZD": 2, "EGP": 2, "ERN": 2, "ETB": 2, "EUR": 2, "FJD": 2, "FKP": 2, "GBP": 2, "GEL": 2, "GHS": 2, "GIP": 2, "GMD": 2, "GNF": 0, "GTQ": 2, "GYD": 2, "HKD": 2, "HNL": 2, "HTG": 2, "HUF": 2, "IDR": 2, "ILS": 2, "INR": 2, "IQD": 3, "IRR": 2, "ISK": 0, "JMD": 2, "JOD": 3, "JPY": 0, "KES": 2, "KGS": 2, "KHR": 2, "KMF": 0, "KPW": 2, "KRW": 0, "KWD": 3, "KYD": 2, "KZT": 2, "LAK": 2, "LBP": 2, "LKR": 2, "LRD": 2, "LSL": 2, "LYD": 3, "MAD": 2, "MDL": 2, "MGA": 2, "MKD": 2, "MMK": 2, "MNT": 2, "MOP": 2, "MRU": 2, "MUR": 2, "MVR": 2, "MWK": 2, "MXN": 2, "MYR": 2, "MZN": 2, "NAD": 2, "NGN": 2, "NIO": 2, "NOK": 2, "NPR": 2, "NZD": 2, "OMR": 3, "PAB": 2, "PEN": 2, "PGK": 2, "PHP": 2, "PKR": 2, "PLN": 2, "PYG": 0, "QAR": 2, "RON": 2, "RSD": 2, "RUB": 2, "RWF": 0, "SAR": 2, "SBD": 2, "SCR": 2, "SDG": 2, "SEK": 2, "SGD": 2, "SHP": 2, "SLE": 2, "SOS": 2, "SRD": 2, "SSP": 2, "STN": 2, "SYP": 2, "SZL": 2, "THB": 2, "TJS": 2, "TMT": 2, "TND": 3, "TOP": 2, "TRY": 2, "TTD": 2, "TWD": 2, "TZS": 2, "UAH": 2, "UGX": 0, "USD": 2, "UYU": 2, "UZS": 2, "VES": 2, "VND": 0, "VUV": 0, "WST": 2, "XAF": 0, "XCD": 2, "XCG": 2, "XOF": 0, "XPF": 0, "YER": 2, "ZAR": 2, "ZMW": 2, "ZWG": 2 });
var SUPPORTED_COUNTRIES = ["AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX", "AZ", "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS", "BT", "BV", "BW", "BY", "BZ", "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN", "CO", "CR", "CU", "CV", "CW", "CX", "CY", "CZ", "DE", "DJ", "DK", "DM", "DO", "DZ", "EC", "EE", "EG", "EH", "ER", "ES", "ET", "FI", "FJ", "FK", "FM", "FO", "FR", "GA", "GB", "GD", "GE", "GF", "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT", "GU", "GW", "GY", "HK", "HM", "HN", "HR", "HT", "HU", "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR", "IS", "IT", "JE", "JM", "JO", "JP", "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KY", "KZ", "LA", "LB", "LC", "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK", "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ", "NA", "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ", "OM", "PA", "PE", "PF", "PG", "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PW", "PY", "QA", "RE", "RO", "RS", "RU", "RW", "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS", "ST", "SV", "SX", "SY", "SZ", "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO", "TR", "TT", "TV", "TW", "TZ", "UA", "UG", "UM", "US", "UY", "UZ", "VA", "VC", "VE", "VG", "VI", "VN", "VU", "WF", "WS", "YE", "YT", "ZA", "ZM", "ZW"];
var isSupportedCurrency = (value) => typeof value === "string" && Object.hasOwn(CURRENCY_DIGITS, value);
var isSupportedCountry = (value) => typeof value === "string" && SUPPORTED_COUNTRIES.includes(value);
function currencyDigits(currency2) {
  if (!isSupportedCurrency(currency2)) throw new RangeError("Unsupported currency");
  return CURRENCY_DIGITS[currency2];
}

// shared/schema.ts
var codeLiterals = (codes) => sql.join(codes.map((code) => {
  if (!/^[A-Z]{2,3}$/.test(code)) throw new Error("Invalid static country/currency code");
  return sql.raw(`'${code}'`);
}), sql`, `);
var currencyCodeCheck = (currency2) => sql`${currency2} IN (${codeLiterals(SUPPORTED_CURRENCIES)})`;
var moneyAmountCheck = (amount, currency2) => {
  const zero2 = SUPPORTED_CURRENCIES.filter((code) => CURRENCY_DIGITS[code] === 0);
  const three = SUPPORTED_CURRENCIES.filter((code) => CURRENCY_DIGITS[code] === 3);
  return sql`${amount} >= 0 AND ${amount} <= 99999999.99 AND ${amount} = trunc(${amount}, CASE WHEN ${currency2} IN (${codeLiterals(zero2)}) THEN 0 WHEN ${currency2} IN (${codeLiterals(three)}) THEN 3 ELSE 2 END)`;
};
var currencyInput = z.string().refine(isSupportedCurrency, "Choose a supported currency.");
var countryInput = z.string().refine((value) => SUPPORTED_COUNTRIES.some((country2) => country2 === value), "Choose a supported country.");
var sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull()
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
).enableRLS();
var accountDetailsSchema = z.object({
  firstName: z.string().trim().max(100, "Name must be 100 characters or fewer."),
  lastName: z.string().trim().max(100, "Surname must be 100 characters or fewer.")
}).strict();
var users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  currentRole: varchar("current_role", { enum: ["seeker", "provider"] }).default("seeker"),
  providerType: varchar("provider_type", { enum: ["individual", "company"] }).notNull().default("individual"),
  companyName: varchar("company_name", { length: 150 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}).enableRLS();
var userSearchLocations = pgTable("user_search_locations", {
  userId: varchar("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  source: varchar("source", { enum: ["device", "address"] }).notNull(),
  inputText: varchar("input_text", { length: 300 }),
  placeId: varchar("place_id", { length: 512 }),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [check("search_location_shape", sql`(
  (${table.source} = 'device' AND ${table.inputText} IS NULL AND ${table.placeId} IS NULL
    AND ${table.latitude} IS NOT NULL AND ${table.longitude} IS NOT NULL
    AND ${table.latitude} BETWEEN -90 AND 90 AND ${table.longitude} BETWEEN -180 AND 180)
  OR (${table.source} = 'address' AND ${table.inputText} IS NOT NULL
    AND length(trim(${table.inputText})) BETWEEN 1 AND 300
    AND ${table.latitude} IS NULL AND ${table.longitude} IS NULL
    AND (${table.placeId} IS NULL OR length(trim(${table.placeId})) > 0)))`)]).enableRLS();
var companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 150 }).notNull(),
  ownerId: varchar("owner_id").references(() => users.id).notNull(),
  // Stable legacy billing/storage anchor; ownership can transfer independently.
  providerId: varchar("provider_id").references(() => users.id).notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow()
}).enableRLS();
var providerSubscriptions = pgTable("provider_subscriptions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).unique(),
  companyId: integer("company_id").references(() => companies.id).unique(),
  plan: varchar("plan", { enum: ["free", "pro"] }).notNull().default("free"),
  proUntil: timestamp("pro_until", { withTimezone: true }),
  updatedBy: varchar("updated_by").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  check("subscription_workspace_check", sql`(${table.userId} IS NOT NULL) <> (${table.companyId} IS NOT NULL)`),
  check("subscription_plan_check", sql`${table.plan} IN ('free', 'pro') AND (${table.plan} <> 'pro' OR ${table.proUntil} IS NOT NULL)`)
]).enableRLS();
var storefronts = pgTable("storefronts", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscription_id").notNull().references(() => providerSubscriptions.id).unique(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 150 }).notNull(),
  description: text("description").notNull().default(""),
  logoUrl: text("logo_url"),
  coverUrl: text("cover_url"),
  isPublished: boolean("is_published").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}).enableRLS();
var billingScope = () => ({
  workspaceId: integer("workspace_id").notNull().references(() => providerSubscriptions.id),
  provider: varchar("provider", { length: 64 }).notNull(),
  merchantAccount: varchar("merchant_account", { length: 255 }).notNull(),
  mode: varchar("mode", { length: 4, enum: ["test", "live"] }).notNull()
});
var billingTimes = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
var billingOfferRevisions = pgTable("billing_offer_revisions", {
  id: uuid("id").primaryKey(),
  version: integer("version").notNull(),
  amountMinor: integer("amount_minor").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("EUR"),
  interval: varchar("interval", { length: 5 }).notNull().default("month"),
  taxIncluded: boolean("tax_included").notNull().default(true),
  issuedBy: varchar("issued_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex("billing_offer_version").on(table.version),
  check("billing_offer_shape", sql`${table.version} > 0 AND ${table.amountMinor} > 0 AND ${table.currency} = 'EUR' AND ${table.interval} = 'month' AND ${table.taxIncluded} AND (${table.issuedBy} IS NOT NULL OR ${table.version} = 1)`)
]).enableRLS();
var billingOfferSettings = pgTable("billing_offer_settings", {
  singleton: boolean("singleton").primaryKey().default(true),
  currentOfferId: uuid("current_offer_id").notNull(),
  revision: integer("revision").notNull().default(1),
  updatedBy: varchar("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  foreignKey({ name: "billing_offer_settings_current_offer_fk", columns: [table.currentOfferId], foreignColumns: [billingOfferRevisions.id] }),
  check("billing_offer_settings_shape", sql`${table.singleton} AND ${table.revision} > 0 AND (${table.updatedBy} IS NOT NULL OR ${table.revision} = 1)`)
]).enableRLS();
var billingPriceMappings = pgTable("billing_price_mappings", {
  id: uuid("id").primaryKey(),
  offerId: uuid("offer_id").notNull().references(() => billingOfferRevisions.id),
  provider: varchar("provider", { length: 64 }).notNull(),
  merchantAccount: varchar("merchant_account", { length: 255 }).notNull(),
  mode: varchar("mode", { length: 4, enum: ["test", "live"] }).notNull(),
  processorPriceId: varchar("processor_price_id", { length: 255 }),
  state: varchar("state", { enum: ["reserved", "unknown", "ready"] }).notNull(),
  fingerprint: varchar("fingerprint", { length: 64 }).notNull(),
  ...billingTimes()
}, (table) => [
  uniqueIndex("billing_price_offer_scope").on(table.offerId, table.provider, table.merchantAccount, table.mode),
  uniqueIndex("billing_price_remote_identity").on(table.provider, table.merchantAccount, table.mode, table.processorPriceId),
  unique("billing_price_binding").on(table.id, table.offerId, table.provider, table.merchantAccount, table.mode),
  check("billing_price_shape", sql`${table.provider} = 'stripe' AND length(trim(${table.merchantAccount})) > 0 AND ${table.mode} IN ('test','live') AND ${table.state} IN ('reserved','unknown','ready') AND ${table.fingerprint} ~ '^[a-f0-9]{64}$' AND ((${table.state} = 'ready') = (${table.processorPriceId} IS NOT NULL)) AND (${table.processorPriceId} IS NULL OR length(trim(${table.processorPriceId})) > 0)`)
]).enableRLS();
var billingSourceState = pgTable("billing_source_state", {
  workspaceId: integer("workspace_id").primaryKey().references(() => providerSubscriptions.id),
  importedAt: timestamp("imported_at", { withTimezone: true }).notNull(),
  revision: integer("revision").notNull().default(0)
}, (table) => [check("billing_source_revision", sql`${table.revision} >= 0`)]).enableRLS();
var billingAccounts = pgTable("billing_accounts", {
  id: uuid("id").primaryKey(),
  ...billingScope(),
  customerId: varchar("customer_id", { length: 255 }),
  ...billingTimes()
}, (table) => [
  uniqueIndex("billing_account_workspace_scope").on(table.workspaceId, table.provider, table.merchantAccount, table.mode),
  uniqueIndex("billing_account_customer_identity").on(table.provider, table.merchantAccount, table.mode, table.customerId),
  unique("billing_account_binding").on(table.id, table.workspaceId, table.provider, table.merchantAccount, table.mode),
  check("billing_account_shape", sql`${table.mode} IN ('test','live') AND length(trim(${table.provider})) > 0 AND length(trim(${table.merchantAccount})) > 0 AND (${table.customerId} IS NULL OR length(trim(${table.customerId})) > 0)`)
]).enableRLS();
var billingSubscriptions = pgTable("billing_subscriptions", {
  id: uuid("id").primaryKey(),
  ...billingScope(),
  accountId: uuid("account_id").notNull(),
  processorSubscriptionId: varchar("processor_subscription_id", { length: 255 }).notNull(),
  state: varchar("state", { enum: ["pending", "running", "attention", "ended"] }).notNull(),
  processorStatus: varchar("processor_status", { length: 64 }).notNull(),
  approvedOfferRef: varchar("approved_offer_ref", { length: 255 }).notNull(),
  offerRevisionId: uuid("offer_revision_id"),
  priceMappingId: uuid("price_mapping_id"),
  currency: varchar("currency", { length: 3 }).notNull(),
  interval: varchar("interval", { length: 5 }).notNull().default("month"),
  periodStart: timestamp("period_start", { withTimezone: true }),
  periodEnd: timestamp("period_end", { withTimezone: true }),
  paidThrough: timestamp("paid_through", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  generation: integer("generation").notNull().default(0),
  revision: integer("revision").notNull().default(0),
  leaseToken: uuid("lease_token"),
  leaseUntil: timestamp("lease_until", { withTimezone: true }),
  reconciledAt: timestamp("reconciled_at", { withTimezone: true }),
  nextReconcileAt: timestamp("next_reconcile_at", { withTimezone: true }),
  ...billingTimes()
}, (table) => [
  foreignKey({ name: "billing_subscription_account_binding", columns: [table.accountId, table.workspaceId, table.provider, table.merchantAccount, table.mode], foreignColumns: [billingAccounts.id, billingAccounts.workspaceId, billingAccounts.provider, billingAccounts.merchantAccount, billingAccounts.mode] }),
  foreignKey({ name: "billing_subscription_offer_revision_fk", columns: [table.offerRevisionId], foreignColumns: [billingOfferRevisions.id] }),
  foreignKey({ name: "billing_subscription_price_binding", columns: [table.priceMappingId, table.offerRevisionId, table.provider, table.merchantAccount, table.mode], foreignColumns: [billingPriceMappings.id, billingPriceMappings.offerId, billingPriceMappings.provider, billingPriceMappings.merchantAccount, billingPriceMappings.mode] }),
  check("billing_subscription_offer_binding", sql`${table.priceMappingId} IS NULL OR ${table.offerRevisionId} IS NOT NULL`),
  uniqueIndex("billing_subscription_identity").on(table.provider, table.merchantAccount, table.mode, table.processorSubscriptionId),
  unique("billing_subscription_binding").on(table.id, table.accountId, table.workspaceId, table.provider, table.merchantAccount, table.mode),
  uniqueIndex("billing_subscription_workspace_slot").on(table.workspaceId, table.mode).where(sql`${table.state} <> 'ended'`),
  index("billing_subscription_due").on(table.nextReconcileAt),
  check("billing_subscription_shape", sql`${table.mode} IN ('test','live') AND ${table.state} IN ('pending','running','attention','ended') AND ${table.currency} = 'EUR' AND ${table.interval} = 'month' AND length(trim(${table.processorSubscriptionId})) > 0 AND length(trim(${table.processorStatus})) > 0 AND length(trim(${table.approvedOfferRef})) > 0 AND ${table.generation} >= 0 AND ${table.revision} >= 0 AND ((${table.periodStart} IS NULL AND ${table.periodEnd} IS NULL) OR (${table.periodStart} IS NOT NULL AND ${table.periodEnd} IS NOT NULL AND ${table.periodEnd} > ${table.periodStart})) AND ((${table.leaseToken} IS NULL) = (${table.leaseUntil} IS NULL))`)
]).enableRLS();
var billingInvoices = pgTable("billing_invoices", {
  id: uuid("id").primaryKey(),
  ...billingScope(),
  accountId: uuid("account_id").notNull(),
  subscriptionId: uuid("subscription_id").notNull(),
  processorInvoiceId: varchar("processor_invoice_id", { length: 255 }).notNull(),
  status: varchar("status", { enum: ["paid", "unpaid", "reversed"] }).notNull(),
  processorStatus: varchar("processor_status", { length: 64 }),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  amountDue: decimal("amount_due", { precision: 18, scale: 0 }).notNull(),
  amountPaid: decimal("amount_paid", { precision: 18, scale: 0 }).notNull(),
  amountRefunded: decimal("amount_refunded", { precision: 18, scale: 0 }).notNull().default("0"),
  paymentReference: varchar("payment_reference", { length: 255 }),
  refundReferences: varchar("refund_references", { length: 255 }).array().notNull().default(sql`ARRAY[]::varchar(255)[]`),
  disputeReferences: varchar("dispute_references", { length: 255 }).array().notNull().default(sql`ARRAY[]::varchar(255)[]`),
  reconciledAt: timestamp("reconciled_at", { withTimezone: true }).notNull(),
  ...billingTimes()
}, (table) => [
  foreignKey({ name: "billing_invoice_subscription_binding", columns: [table.subscriptionId, table.accountId, table.workspaceId, table.provider, table.merchantAccount, table.mode], foreignColumns: [billingSubscriptions.id, billingSubscriptions.accountId, billingSubscriptions.workspaceId, billingSubscriptions.provider, billingSubscriptions.merchantAccount, billingSubscriptions.mode] }),
  uniqueIndex("billing_invoice_identity").on(table.provider, table.merchantAccount, table.mode, table.processorInvoiceId),
  index("billing_invoice_coverage").on(table.subscriptionId, table.periodStart, table.periodEnd),
  check("billing_invoice_shape", sql`${table.mode} IN ('test','live') AND ${table.status} IN ('paid','unpaid','reversed') AND ${table.currency} = 'EUR' AND length(trim(${table.processorInvoiceId})) > 0 AND ${table.periodEnd} > ${table.periodStart} AND ${table.amountDue} >= 0 AND ${table.amountPaid} >= 0 AND ${table.amountRefunded} >= 0 AND ${table.amountRefunded} <= ${table.amountPaid} AND cardinality(${table.refundReferences}) <= 100 AND cardinality(${table.disputeReferences}) <= 100 AND array_position(${table.refundReferences}, NULL) IS NULL AND array_position(${table.disputeReferences}, NULL) IS NULL AND array_position(${table.refundReferences}, '') IS NULL AND array_position(${table.disputeReferences}, '') IS NULL`)
]).enableRLS();
var billingOperations = pgTable("billing_operations", {
  id: uuid("id").primaryKey(),
  ...billingScope(),
  accountId: uuid("account_id").notNull(),
  kind: varchar("kind", { enum: ["checkout", "portal", "cancel", "reconcile"] }).notNull(),
  initiatorId: varchar("initiator_id").references(() => users.id),
  idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
  fingerprint: varchar("fingerprint", { length: 64 }).notNull(),
  approvedOfferRef: varchar("approved_offer_ref", { length: 255 }),
  offerRevisionId: uuid("offer_revision_id"),
  priceMappingId: uuid("price_mapping_id"),
  termsVersion: varchar("terms_version", { length: 128 }),
  state: varchar("state", { enum: ["reserved", "unknown", "completed", "failed"] }).notNull(),
  remoteCheckoutId: varchar("remote_checkout_id", { length: 255 }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  failureCode: varchar("failure_code", { length: 64 }),
  ...billingTimes()
}, (table) => [
  foreignKey({ name: "billing_operation_account_binding", columns: [table.accountId, table.workspaceId, table.provider, table.merchantAccount, table.mode], foreignColumns: [billingAccounts.id, billingAccounts.workspaceId, billingAccounts.provider, billingAccounts.merchantAccount, billingAccounts.mode] }),
  foreignKey({ name: "billing_operation_offer_revision_fk", columns: [table.offerRevisionId], foreignColumns: [billingOfferRevisions.id] }),
  foreignKey({ name: "billing_operation_price_binding", columns: [table.priceMappingId, table.offerRevisionId, table.provider, table.merchantAccount, table.mode], foreignColumns: [billingPriceMappings.id, billingPriceMappings.offerId, billingPriceMappings.provider, billingPriceMappings.merchantAccount, billingPriceMappings.mode] }),
  check("billing_operation_offer_binding", sql`${table.priceMappingId} IS NULL OR ${table.offerRevisionId} IS NOT NULL`),
  unique("billing_operation_binding").on(table.id, table.accountId, table.workspaceId, table.provider, table.merchantAccount, table.mode),
  uniqueIndex("billing_operation_idempotency").on(table.workspaceId, table.mode, table.kind, table.idempotencyKey),
  uniqueIndex("billing_checkout_workspace_slot").on(table.workspaceId, table.mode).where(sql`${table.kind} = 'checkout' AND ${table.resolvedAt} IS NULL`),
  check("billing_operation_shape", sql`${table.mode} IN ('test','live') AND ${table.kind} IN ('checkout','portal','cancel','reconcile') AND ${table.state} IN ('reserved','unknown','completed','failed') AND ${table.fingerprint} ~ '^[a-f0-9]{64}$' AND length(trim(${table.idempotencyKey})) > 0 AND (${table.kind} = 'reconcile' OR ${table.initiatorId} IS NOT NULL) AND (${table.kind} <> 'checkout' OR (${table.approvedOfferRef} IS NOT NULL AND length(trim(${table.approvedOfferRef})) > 0 AND ${table.termsVersion} IS NOT NULL AND length(trim(${table.termsVersion})) > 0)) AND (${table.kind} <> 'checkout' OR ${table.state} <> 'completed' OR (${table.remoteCheckoutId} IS NOT NULL AND length(trim(${table.remoteCheckoutId})) > 0))`)
]).enableRLS();
var billingEvents = pgTable("billing_events", {
  id: uuid("id").primaryKey(),
  provider: varchar("provider", { length: 64 }).notNull(),
  merchantAccount: varchar("merchant_account", { length: 255 }).notNull(),
  mode: varchar("mode", { length: 4, enum: ["test", "live"] }).notNull(),
  accountId: uuid("account_id"),
  workspaceId: integer("workspace_id"),
  operationId: uuid("operation_id"),
  eventId: varchar("event_id", { length: 255 }).notNull(),
  eventType: varchar("event_type", { length: 128 }).notNull(),
  objectId: varchar("object_id", { length: 255 }).notNull(),
  fingerprint: varchar("fingerprint", { length: 64 }).notNull(),
  state: varchar("state", { enum: ["pending", "processing", "processed", "quarantined"] }).notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  leaseToken: uuid("lease_token"),
  leaseUntil: timestamp("lease_until", { withTimezone: true }),
  failureCode: varchar("failure_code", { length: 64 }),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true })
}, (table) => [
  foreignKey({ name: "billing_event_account_binding", columns: [table.accountId, table.workspaceId, table.provider, table.merchantAccount, table.mode], foreignColumns: [billingAccounts.id, billingAccounts.workspaceId, billingAccounts.provider, billingAccounts.merchantAccount, billingAccounts.mode] }),
  foreignKey({ name: "billing_event_operation_binding", columns: [table.operationId, table.accountId, table.workspaceId, table.provider, table.merchantAccount, table.mode], foreignColumns: [billingOperations.id, billingOperations.accountId, billingOperations.workspaceId, billingOperations.provider, billingOperations.merchantAccount, billingOperations.mode] }),
  uniqueIndex("billing_event_identity").on(table.provider, table.merchantAccount, table.mode, table.eventId),
  index("billing_event_pending").on(table.nextAttemptAt).where(sql`${table.state} IN ('pending','processing')`),
  check("billing_event_shape", sql`${table.mode} IN ('test','live') AND length(trim(${table.provider})) > 0 AND length(trim(${table.merchantAccount})) > 0 AND length(trim(${table.eventId})) > 0 AND length(trim(${table.eventType})) > 0 AND length(trim(${table.objectId})) > 0 AND ${table.fingerprint} ~ '^[a-f0-9]{64}$' AND ${table.state} IN ('pending','processing','processed','quarantined') AND ${table.attempts} >= 0 AND ((${table.accountId} IS NULL) = (${table.workspaceId} IS NULL)) AND (${table.operationId} IS NULL OR ${table.accountId} IS NOT NULL) AND ((${table.leaseToken} IS NULL) = (${table.leaseUntil} IS NULL)) AND ((${table.state} = 'processed') = (${table.processedAt} IS NOT NULL)) AND (${table.state} <> 'processed' OR ${table.accountId} IS NOT NULL)`)
]).enableRLS();
var manualProGrants = pgTable("manual_pro_grants", {
  id: uuid("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull().references(() => providerSubscriptions.id),
  source: varchar("source", { enum: ["legacy_manual", "administrator"] }).notNull(),
  sourceReference: varchar("source_reference", { length: 255 }).notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  issuedBy: varchar("issued_by").references(() => users.id),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  // Preserve the original unbounded updated_by value without truncating it.
  legacyUpdatedBy: varchar("legacy_updated_by"),
  legacyUpdatedAt: timestamp("legacy_updated_at", { withTimezone: true }),
  reasonCode: varchar("reason_code", { length: 64 }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revokedBy: varchar("revoked_by").references(() => users.id)
}, (table) => [
  uniqueIndex("manual_pro_grant_source").on(table.workspaceId, table.source, table.sourceReference),
  index("manual_pro_grant_coverage").on(table.workspaceId, table.startsAt, table.endsAt),
  check("manual_pro_grant_shape", sql`${table.source} IN ('legacy_manual','administrator') AND length(trim(${table.sourceReference})) > 0 AND ${table.endsAt} > ${table.startsAt} AND (${table.source} <> 'administrator' OR ${table.issuedBy} IS NOT NULL) AND (${table.revokedBy} IS NULL OR ${table.revokedAt} IS NOT NULL)`)
]).enableRLS();
var employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  providerId: varchar("provider_id").references(() => users.id).notNull(),
  companyId: integer("company_id").references(() => companies.id),
  name: varchar("name", { length: 100 }).notNull(),
  showName: boolean("show_name").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => [index("employees_provider_idx").on(table.providerId)]).enableRLS();
var companyRoles = ["owner", "admin", "provider", "viewer"];
var companyMemberships = pgTable("company_memberships", {
  companyId: integer("company_id").references(() => companies.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  role: varchar("role", { enum: companyRoles }).notNull(),
  employeeId: integer("employee_id").references(() => employees.id),
  createdAt: timestamp("created_at").defaultNow()
}, (table) => [primaryKey({ columns: [table.companyId, table.userId] }), uniqueIndex("company_memberships_employee_idx").on(table.employeeId)]).enableRLS();
var companyInvitations = pgTable("company_invitations", {
  id: varchar("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  email: varchar("email").notNull(),
  role: varchar("role", { enum: ["admin", "provider", "viewer"] }).notNull(),
  employeeId: integer("employee_id").references(() => employees.id),
  tokenHash: varchar("token_hash").notNull().unique(),
  invitedBy: varchar("invited_by").references(() => users.id).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  revokedAt: timestamp("revoked_at")
}).enableRLS();
var categories = pgTable("categories", {
  key: varchar("key", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  icon: varchar("icon", { length: 16 }).notNull().default(""),
  searchKeywords: text("search_keywords").notNull().default("")
}, (table) => [uniqueIndex("categories_name_idx").on(sql`lower(${table.name})`)]).enableRLS();
var workspacePricingSettings = pgTable("workspace_pricing_settings", {
  id: uuid("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  companyId: integer("company_id").references(() => companies.id, { onDelete: "cascade" }),
  defaultCurrency: varchar("default_currency", { length: 3 }),
  businessCountryCode: varchar("business_country_code", { length: 2 }),
  revision: integer("revision").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex("workspace_pricing_personal_identity").on(table.userId),
  uniqueIndex("workspace_pricing_company_identity").on(table.companyId),
  check("workspace_pricing_owner_check", sql`(${table.userId} IS NOT NULL) <> (${table.companyId} IS NOT NULL)`),
  check("workspace_pricing_currency_check", sql`${table.defaultCurrency} IS NULL OR ${currencyCodeCheck(table.defaultCurrency)}`),
  check("workspace_pricing_country_check", sql`${table.businessCountryCode} IS NULL OR ${table.businessCountryCode} IN (${codeLiterals(SUPPORTED_COUNTRIES)})`),
  check("workspace_pricing_revision_check", sql`${table.revision} > 0`)
]).enableRLS();
var addresses = pgTable("addresses", {
  id: serial("id").primaryKey(),
  providerId: varchar("provider_id").references(() => users.id).notNull(),
  companyId: integer("company_id").references(() => companies.id),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  address: text("address"),
  countryCode: varchar("country_code", { length: 2 }),
  pricingCurrency: varchar("pricing_currency", { length: 3 }),
  locationSource: varchar("location_source", { enum: ["legacy", "manual", "google"] }).notNull().default("legacy"),
  locationKey: varchar("location_key"),
  locationPlaceId: text("location_place_id"),
  locationExpiresAt: timestamp("location_expires_at", { withTimezone: true }),
  locationAddressSource: varchar("location_address_source", { enum: ["user", "google"] }).notNull().default("user"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => [
  index("addresses_workspace_idx").on(table.providerId, table.companyId),
  index("addresses_google_expiry_idx").on(table.locationExpiresAt).where(sql`${table.locationSource} = 'google'`),
  check("addresses_country_code_check", sql`${table.countryCode} IS NULL OR ${table.countryCode} IN (${codeLiterals(SUPPORTED_COUNTRIES)})`),
  check("addresses_pricing_currency_check", sql`${table.pricingCurrency} IS NULL OR ${currencyCodeCheck(table.pricingCurrency)}`)
]).enableRLS();
var addressInputSchema = createInsertSchema(addresses, {
  address: z.string().trim().min(5).max(500),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  countryCode: countryInput.nullable().optional(),
  pricingCurrency: currencyInput.nullable().optional()
}).pick({ address: true, latitude: true, longitude: true, countryCode: true, pricingCurrency: true });
var services = pgTable("services", {
  id: serial("id").primaryKey(),
  providerId: varchar("provider_id").references(() => users.id).notNull(),
  companyId: integer("company_id").references(() => companies.id),
  employeeId: integer("employee_id").references(() => employees.id),
  addressId: integer("address_id").references(() => addresses.id),
  name: varchar("name").notNull(),
  description: text("description"),
  category: varchar("category").notNull().references(() => categories.key),
  serviceType: varchar("service_type", { enum: ["one_to_one", "group"] }).notNull(),
  price: decimal("price").notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  duration: integer("duration").notNull(),
  // in minutes
  cleanupTime: integer("cleanup_time").notNull().default(0),
  // Extra minutes after the service
  maxCapacity: integer("max_capacity").default(1),
  ageGroups: jsonb("age_groups").$type().default([]),
  // ["children", "teens", "adults", "seniors"]
  targetGender: varchar("target_gender", { enum: ["females", "males", "both"] }).default("both"),
  instantBooking: boolean("instant_booking").default(false),
  advancePaymentPercent: integer("advance_payment_percent").default(50),
  imageUrl: text("image_url"),
  externalUrl: text("external_url"),
  reminderEnabled: boolean("reminder_enabled").notNull().default(false),
  reminderMethod: varchar("reminder_method", { enum: ["email", "sms", "whatsapp"] }).notNull().default("email"),
  reminderHours: integer("reminder_hours").notNull().default(24),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => [
  index("services_address_idx").on(table.addressId),
  index("services_category_idx").on(table.category),
  check("services_cleanup_time_check", sql`${table.cleanupTime} BETWEEN 0 AND 1440`),
  check("services_reminder_settings_check", sql`${table.reminderMethod} IN ('email','sms','whatsapp') AND ${table.reminderHours} BETWEEN 1 AND 168`),
  check("services_currency_check", currencyCodeCheck(table.currency)),
  check("services_advance_percent_check", sql`${table.advancePaymentPercent} IS NULL OR (${table.advancePaymentPercent} >= 0 AND ${table.advancePaymentPercent} <= 100)`),
  check("services_price_money_check", moneyAmountCheck(table.price, table.currency))
]).enableRLS();
var geocodingCache = pgTable("geocoding_cache", {
  addressKey: varchar("address_key").primaryKey(),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  placeId: text("place_id"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull()
}).enableRLS();
var bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").references(() => services.id).notNull(),
  seekerId: varchar("seeker_id").references(() => users.id).notNull(),
  providerId: varchar("provider_id").references(() => users.id).notNull(),
  companyId: integer("company_id").references(() => companies.id),
  // Snapshot the assigned employee so editing a listing does not move existing bookings.
  employeeId: integer("employee_id").references(() => employees.id),
  participantCount: integer("participant_count").default(1),
  scheduledDate: timestamp("scheduled_date").notNull(),
  bookingDuration: integer("booking_duration"),
  // Duration in minutes for this specific booking
  bookingCleanupTime: integer("booking_cleanup_time").notNull().default(0),
  // Snapshot; listing edits do not change reservations
  status: varchar("status", { enum: ["pending", "confirmed", "cancelled", "completed"] }).default("pending"),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  // Terminal transition snapshot; payment updates must not extend history retention.
  totalAmount: decimal("total_amount").notNull(),
  advanceAmount: decimal("advance_amount").notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  paymentStatus: varchar("payment_status", { enum: ["pending", "advance_paid", "fully_paid"] }).default("pending"),
  notes: text("notes"),
  notificationRevision: integer("notification_revision").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => [
  index("bookings_employee_date_idx").on(table.employeeId, table.scheduledDate),
  check("bookings_cleanup_time_check", sql`${table.bookingCleanupTime} BETWEEN 0 AND 1440`),
  index("bookings_message_retention_idx").on(table.closedAt, table.id).where(sql`${table.closedAt} IS NOT NULL AND ${table.status} IN ('cancelled','completed')`),
  check("bookings_notification_revision_check", sql`${table.notificationRevision} >= 0`),
  check("bookings_closed_at_check", sql`${table.closedAt} IS NULL OR ${table.status} IN ('cancelled','completed')`),
  check("bookings_currency_check", currencyCodeCheck(table.currency)),
  check("bookings_total_money_check", moneyAmountCheck(table.totalAmount, table.currency)),
  check("bookings_advance_money_check", sql`${moneyAmountCheck(table.advanceAmount, table.currency)} AND ${table.advanceAmount} <= ${table.totalAmount}`)
]).enableRLS();
var bookingMessages = pgTable("booking_messages", {
  id: uuid("id").primaryKey(),
  bookingId: integer("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
  authorId: varchar("author_id").notNull().references(() => users.id),
  authorRole: varchar("author_role", { enum: ["provider", "customer"] }).notNull(),
  body: text("body").notNull(),
  clientRequestId: uuid("client_request_id").notNull(),
  broadcastId: uuid("broadcast_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex("booking_message_request_identity").on(table.authorId, table.clientRequestId, table.bookingId),
  index("booking_message_history_idx").on(table.bookingId, table.createdAt, table.id),
  index("booking_message_broadcast_idx").on(table.broadcastId).where(sql`${table.broadcastId} IS NOT NULL`),
  check("booking_message_shape", sql`${table.authorRole} IN ('provider','customer') AND length(trim(${table.body})) BETWEEN 1 AND 4000 AND length(${table.body}) <= 4000 AND (${table.broadcastId} IS NULL OR ${table.authorRole} = 'provider')`)
]).enableRLS();
var bookingRescheduleRequests = pgTable("booking_reschedule_requests", {
  id: uuid("id").primaryKey(),
  bookingId: integer("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
  requestedById: varchar("requested_by_id").notNull().references(() => users.id),
  requestedByRole: varchar("requested_by_role", { enum: ["provider", "customer"] }).notNull(),
  originalScheduledDate: timestamp("original_scheduled_date", { withTimezone: true }).notNull(),
  proposedScheduledDate: timestamp("proposed_scheduled_date", { withTimezone: true }).notNull(),
  fallback: varchar("fallback", { enum: ["keep_original", "cancel_booking"] }).notNull(),
  state: varchar("state", { enum: ["pending", "accepted", "declined", "withdrawn", "superseded"] }).notNull().default("pending"),
  batchId: uuid("batch_id"),
  clientRequestId: uuid("client_request_id").notNull(),
  note: text("note"),
  timezone: varchar("timezone", { length: 100 }).notNull().default("UTC"),
  baseRevision: integer("base_revision").notNull(),
  respondedById: varchar("responded_by_id").references(() => users.id),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex("booking_reschedule_pending_identity").on(table.bookingId).where(sql`${table.state} = 'pending'`),
  uniqueIndex("booking_reschedule_request_identity").on(table.requestedById, table.clientRequestId, table.bookingId),
  index("booking_reschedule_history_idx").on(table.bookingId, table.createdAt, table.id),
  index("booking_reschedule_batch_idx").on(table.batchId).where(sql`${table.batchId} IS NOT NULL`),
  check("booking_reschedule_shape", sql`${table.requestedByRole} IN ('provider','customer') AND ${table.fallback} IN ('keep_original','cancel_booking') AND ${table.state} IN ('pending','accepted','declined','withdrawn','superseded') AND ${table.baseRevision} >= 0 AND length(trim(${table.timezone})) BETWEEN 1 AND 100 AND (${table.note} IS NULL OR length(${table.note}) <= 2000) AND ${table.originalScheduledDate} <> ${table.proposedScheduledDate} AND (${table.batchId} IS NULL OR ${table.requestedByRole} = 'provider')`),
  check("booking_reschedule_response_shape", sql`(${table.state} <> 'pending' OR (${table.respondedAt} IS NULL AND ${table.respondedById} IS NULL)) AND ((${table.state} <> 'accepted' AND ${table.state} <> 'declined') OR (${table.respondedAt} IS NOT NULL AND ${table.respondedById} IS NOT NULL)) AND (${table.respondedAt} IS NULL OR ${table.respondedAt} >= ${table.createdAt})`)
]).enableRLS();
var wishlistServices = pgTable("wishlist_services", {
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  serviceId: integer("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  savedAt: timestamp("saved_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  primaryKey({ columns: [table.userId, table.serviceId] }),
  index("wishlist_user_saved_idx").on(table.userId, table.savedAt.desc(), table.serviceId.desc()),
  index("wishlist_service_idx").on(table.serviceId)
]).enableRLS();
var productActivityEvents = pgTable("product_activity_events", {
  id: uuid("id").primaryKey(),
  kind: varchar("kind", { enum: ["wishlist_additions", "service_views"] }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  serviceId: integer("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  providerId: varchar("provider_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  companyId: integer("company_id").references(() => companies.id, { onDelete: "cascade" }),
  reportingDay: date("reporting_day", { mode: "string" }).notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true })
}, (table) => [
  uniqueIndex("product_wishlist_daily_identity").on(table.userId, table.serviceId, table.reportingDay).where(sql`${table.kind} = 'wishlist_additions'`),
  index("product_activity_pending_idx").on(table.reportingDay, table.occurredAt, table.id).where(sql`${table.processedAt} IS NULL`),
  index("product_activity_expiry_idx").on(table.expiresAt),
  index("product_activity_user_idx").on(table.userId),
  index("product_activity_service_idx").on(table.serviceId),
  index("product_activity_provider_idx").on(table.providerId),
  index("product_activity_company_idx").on(table.companyId),
  check("product_activity_shape", sql`${table.kind} IN ('wishlist_additions','service_views') AND (${table.kind} <> 'wishlist_additions' OR ${table.userId} IS NOT NULL) AND ${table.reportingDay} = (${table.occurredAt} AT TIME ZONE 'UTC')::date AND ${table.expiresAt} > ${table.occurredAt} AND ${table.expiresAt} <= ${table.occurredAt} + '2160:00:00'::interval AND (${table.processedAt} IS NULL OR ${table.processedAt} >= ${table.occurredAt})`)
]).enableRLS();
var serviceActivityGroups = pgTable("service_activity_groups", {
  id: uuid("id").primaryKey(),
  kind: varchar("kind", { enum: ["wishlist_additions", "service_views"] }).notNull(),
  serviceId: integer("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  providerId: varchar("provider_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  companyId: integer("company_id").references(() => companies.id, { onDelete: "cascade" }),
  scopeKey: varchar("scope_key").notNull(),
  reportingDay: date("reporting_day", { mode: "string" }).notNull(),
  count: integer("count").notNull().default(1),
  revision: integer("revision").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull()
}, (table) => [
  uniqueIndex("service_activity_group_identity").on(table.kind, table.serviceId, table.reportingDay, table.scopeKey),
  index("service_activity_scope_day_idx").on(table.scopeKey, table.reportingDay.desc(), table.id.desc()),
  index("service_activity_group_expiry_idx").on(table.expiresAt),
  index("service_activity_group_service_idx").on(table.serviceId),
  index("service_activity_group_provider_idx").on(table.providerId),
  index("service_activity_group_company_idx").on(table.companyId),
  check("service_activity_group_shape", sql`${table.kind} IN ('wishlist_additions','service_views') AND ${table.count} > 0 AND ${table.revision} > 0 AND ${table.expiresAt} > ${table.updatedAt} AND ${table.scopeKey} = CASE WHEN ${table.companyId} IS NULL THEN 'provider:' || ${table.providerId} ELSE 'company:' || ${table.companyId}::text END`)
]).enableRLS();
var serviceActivityReads = pgTable("service_activity_reads", {
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  groupId: uuid("group_id").notNull().references(() => serviceActivityGroups.id, { onDelete: "cascade" }),
  readRevision: integer("read_revision").notNull().default(0)
}, (table) => [
  primaryKey({ columns: [table.userId, table.groupId] }),
  index("service_activity_read_group_idx").on(table.groupId),
  check("service_activity_read_revision_check", sql`${table.readRevision} >= 0`)
]).enableRLS();
var bookingMessageReads = pgTable("booking_message_reads", {
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  messageId: uuid("message_id").notNull().references(() => bookingMessages.id, { onDelete: "cascade" }),
  contextKey: varchar("context_key", { length: 100 }).notNull(),
  readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  primaryKey({ columns: [table.userId, table.messageId, table.contextKey] }),
  index("booking_message_read_message_idx").on(table.messageId),
  check("booking_message_read_context_check", sql`${table.contextKey} IN ('customer','provider:personal') OR ${table.contextKey} ~ '^provider:company:[1-9][0-9]*$'`)
]).enableRLS();
var userCommunicationPreferences = pgTable("user_communication_preferences", {
  userId: varchar("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  phone: varchar("phone", { length: 16 }),
  phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true }),
  preferredMethod: varchar("preferred_method", { enum: ["email", "sms", "whatsapp"] }),
  emailSuppressed: boolean("email_suppressed").notNull().default(false),
  language: varchar("language", { length: 8 }).notNull().default("en"),
  smsOptIn: boolean("sms_opt_in").notNull().default(false),
  whatsappOptIn: boolean("whatsapp_opt_in").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index("communication_preferences_phone_idx").on(table.phone).where(sql`${table.phone} IS NOT NULL`),
  check("communication_preferences_phone_check", sql`${table.phone} IS NULL OR ${table.phone} ~ '^\\+[1-9][0-9]{7,14}$'`),
  check("communication_preferences_verification_check", sql`(${table.phoneVerifiedAt} IS NULL OR ${table.phone} IS NOT NULL) AND (NOT ${table.smsOptIn} OR ${table.phoneVerifiedAt} IS NOT NULL) AND (NOT ${table.whatsappOptIn} OR ${table.phoneVerifiedAt} IS NOT NULL)`),
  check("communication_preferences_method_check", sql`${table.preferredMethod} IS NULL OR ${table.preferredMethod} = 'email' OR (${table.preferredMethod} = 'sms' AND ${table.smsOptIn}) OR (${table.preferredMethod} = 'whatsapp' AND ${table.whatsappOptIn})`),
  check("communication_preferences_language_check", sql`${table.language} IN ('en','lv','ru','ar','zh','fr','de','hi','ja','pt','es')`)
]).enableRLS();
var phoneVerificationChallenges = pgTable("phone_verification_challenges", {
  id: uuid("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  phone: varchar("phone", { length: 16 }).notNull(),
  providerRequestId: varchar("provider_request_id", { length: 255 }),
  status: varchar("status", { enum: ["pending", "verified", "failed", "expired", "unknown"] }).notNull().default("pending"),
  attemptCount: integer("attempt_count").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  nextSendAt: timestamp("next_send_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index("phone_verification_user_created_idx").on(table.userId, table.createdAt),
  index("phone_verification_phone_created_idx").on(table.phone, table.createdAt),
  index("phone_verification_expiry_idx").on(table.expiresAt),
  uniqueIndex("phone_verification_provider_identity").on(table.providerRequestId),
  check("phone_verification_shape", sql`${table.phone} ~ '^\\+[1-9][0-9]{7,14}$' AND ${table.status} IN ('pending','verified','failed','expired','unknown') AND ${table.attemptCount} BETWEEN 0 AND 5 AND ${table.expiresAt} > ${table.createdAt} AND ${table.nextSendAt} >= ${table.createdAt}`)
]).enableRLS();
var notificationEvents = pgTable("notification_events", {
  id: uuid("id").primaryKey(),
  bookingId: integer("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
  bookingRevision: integer("booking_revision").notNull(),
  kind: varchar("kind", { enum: ["accepted", "rejected", "rescheduled", "reminder"] }).notNull(),
  scheduledDate: timestamp("scheduled_date", { withTimezone: true }).notNull(),
  previousScheduledDate: timestamp("previous_scheduled_date", { withTimezone: true }),
  timezone: varchar("timezone", { length: 100 }).notNull().default("UTC"),
  automatic: boolean("automatic").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex("notification_event_revision_identity").on(table.bookingId, table.bookingRevision, table.kind),
  uniqueIndex("notification_reminder_identity").on(table.bookingId, table.scheduledDate).where(sql`${table.kind} = 'reminder'`),
  index("notification_events_retention_idx").on(table.createdAt),
  check("notification_event_shape", sql`${table.bookingRevision} >= 0 AND ${table.kind} IN ('accepted','rejected','rescheduled','reminder') AND length(trim(${table.timezone})) BETWEEN 1 AND 100 AND (${table.kind} <> 'rescheduled' OR ${table.previousScheduledDate} IS NOT NULL)`)
]).enableRLS();
var notificationJobs = pgTable("notification_jobs", {
  id: uuid("id").primaryKey(),
  eventId: uuid("event_id").notNull().references(() => notificationEvents.id, { onDelete: "cascade" }),
  channel: varchar("channel", { enum: ["email", "sms", "whatsapp"] }),
  state: varchar("state", { enum: ["queued", "leased", "accepted", "delivered", "failed", "unknown", "skipped", "cancelled"] }).notNull().default("queued"),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  leaseToken: uuid("lease_token"),
  leaseUntil: timestamp("lease_until", { withTimezone: true }),
  attemptedAt: timestamp("attempted_at", { withTimezone: true }),
  providerMessageId: varchar("provider_message_id", { length: 255 }),
  reasonCode: varchar("reason_code", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex("notification_job_event_identity").on(table.eventId),
  index("notification_job_due_idx").on(table.dueAt).where(sql`${table.state} = 'queued'`),
  index("notification_job_lease_idx").on(table.leaseUntil).where(sql`${table.state} = 'leased'`),
  index("notification_jobs_retention_idx").on(table.updatedAt),
  check("notification_job_state_check", sql`${table.state} IN ('queued','leased','accepted','delivered','failed','unknown','skipped','cancelled') AND (${table.channel} IS NULL OR ${table.channel} IN ('email','sms','whatsapp'))`),
  check("notification_job_lease_check", sql`((${table.leaseToken} IS NULL) = (${table.leaseUntil} IS NULL)) AND (${table.state} <> 'leased' OR ${table.leaseToken} IS NOT NULL)`),
  check("notification_job_expiry_check", sql`${table.expiresAt} IS NULL OR ${table.expiresAt} >= ${table.dueAt}`)
]).enableRLS();
var notificationDeliveryAttempts = pgTable("notification_delivery_attempts", {
  id: uuid("id").primaryKey(),
  jobId: uuid("job_id").notNull().references(() => notificationJobs.id, { onDelete: "cascade" }),
  provider: varchar("provider", { enum: ["vonage", "resend"] }).notNull(),
  providerMessageId: varchar("provider_message_id", { length: 255 }),
  state: varchar("state", { enum: ["reserved", "accepted", "delivered", "failed", "unknown"] }).notNull().default("reserved"),
  errorCode: varchar("error_code", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex("notification_attempt_job_identity").on(table.jobId),
  index("notification_attempt_recent_idx").on(table.createdAt, table.jobId),
  uniqueIndex("notification_attempt_provider_identity").on(table.provider, table.providerMessageId),
  check("notification_attempt_shape", sql`${table.provider} IN ('vonage','resend') AND ${table.state} IN ('reserved','accepted','delivered','failed','unknown')`)
]).enableRLS();
var notificationCallbacks = pgTable("notification_callbacks", {
  id: uuid("id").primaryKey(),
  provider: varchar("provider", { enum: ["vonage", "resend"] }).notNull(),
  providerEventId: varchar("provider_event_id", { length: 255 }).notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex("notification_callback_identity").on(table.provider, table.providerEventId),
  index("notification_callbacks_retention_idx").on(table.receivedAt),
  check("notification_callback_shape", sql`${table.provider} IN ('vonage','resend') AND length(trim(${table.providerEventId})) > 0`)
]).enableRLS();
var serviceReviews = pgTable("service_reviews", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").references(() => bookings.id).notNull().unique(),
  rating: integer("rating").notNull(),
  comment: text("comment").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow()
}, (table) => [
  check("service_reviews_rating_check", sql`${table.rating} BETWEEN 1 AND 5`),
  check("service_reviews_comment_check", sql`length(${table.comment}) <= 2000 AND (${table.rating} >= 3 OR length(btrim(${table.comment})) > 0)`)
]).enableRLS();
var serviceEmbeddings = pgTable("service_embeddings", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").references(() => services.id).notNull().unique(),
  embedding: jsonb("embedding").$type().notNull(),
  textContent: text("text_content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}).enableRLS();
var availability = pgTable("availability", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").references(() => services.id),
  // Optional - null means applies to all services
  providerId: varchar("provider_id").references(() => users.id).notNull(),
  companyId: integer("company_id").references(() => companies.id),
  // Schedule type
  scheduleType: varchar("schedule_type", { enum: ["specific", "recurring"] }).notNull(),
  // For specific date/time
  specificDate: timestamp("specific_date"),
  // For recurring schedules
  daysOfWeek: jsonb("days_of_week").$type(),
  // [0-6] where 0=Sunday
  // Time slots (HH:MM format) - working hours
  startTime: varchar("start_time").notNull(),
  endTime: varchar("end_time").notNull(),
  // Break times within working hours (e.g., lunch break)
  breaks: jsonb("breaks").$type(),
  // [{startTime: "13:00", endTime: "14:00"}]
  // Slot duration in minutes - kept for backward compatibility but service duration takes precedence
  slotDuration: integer("slot_duration").default(60),
  // Timezone
  timezone: varchar("timezone").notNull().default("UTC"),
  // Recurrence end conditions (for recurring only)
  recurrenceEndType: varchar("recurrence_end_type", { enum: ["never", "after_events", "on_date"] }),
  recurrenceEndValue: varchar("recurrence_end_value"),
  // number of events or date string
  // Status
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}).enableRLS();
var usersRelations = relations(users, ({ many }) => ({
  addresses: many(addresses),
  services: many(services),
  bookings: many(bookings),
  availabilities: many(availability)
}));
var servicesRelations = relations(services, ({ one, many }) => ({
  savedAddress: one(addresses, { fields: [services.addressId], references: [addresses.id] }),
  provider: one(users, {
    fields: [services.providerId],
    references: [users.id]
  }),
  bookings: many(bookings),
  availability: many(availability)
}));
var addressesRelations = relations(addresses, ({ one, many }) => ({
  provider: one(users, { fields: [addresses.providerId], references: [users.id] }),
  services: many(services)
}));
var bookingsRelations = relations(bookings, ({ one }) => ({
  service: one(services, {
    fields: [bookings.serviceId],
    references: [services.id]
  }),
  seeker: one(users, {
    fields: [bookings.seekerId],
    references: [users.id]
  }),
  provider: one(users, {
    fields: [bookings.providerId],
    references: [users.id]
  })
}));
var availabilityRelations = relations(availability, ({ one }) => ({
  service: one(services, {
    fields: [availability.serviceId],
    references: [services.id]
  }),
  provider: one(users, {
    fields: [availability.providerId],
    references: [users.id]
  })
}));
var providerProfileSchema = z.object({
  providerType: z.enum(["individual", "company"]),
  companyName: z.string().trim().max(150).nullable().optional()
}).refine((data) => data.providerType !== "company" || Boolean(data.companyName), {
  message: "Company name is required",
  path: ["companyName"]
});
var employeeSchema = z.object({
  name: z.string().trim().min(1, "Employee name is required").max(100),
  showName: z.boolean().default(false)
});
var insertServiceSchema = createInsertSchema(services, {
  currency: currencyInput,
  advancePaymentPercent: z.number().int().min(0).max(100).nullable().optional(),
  reminderEnabled: z.boolean().optional(),
  reminderMethod: z.enum(["email", "sms", "whatsapp"]).optional(),
  reminderHours: z.number().int().min(1).max(168).optional(),
  cleanupTime: z.number().int().min(0).max(1440).optional(),
  category: z.string().trim().min(1, "Choose a category.").max(64),
  ageGroups: z.array(z.string()).nullable().optional(),
  employeeId: z.number().int().positive().nullable().optional(),
  addressId: z.number().int().positive()
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertBookingSchema = createInsertSchema(bookings, { currency: currencyInput }).omit({
  id: true,
  closedAt: true,
  notificationRevision: true,
  createdAt: true,
  updatedAt: true
}).extend({
  scheduledDate: z.string().or(z.date()).transform((val) => {
    if (typeof val === "string") {
      const date3 = new Date(val);
      if (isNaN(date3.getTime())) {
        throw new Error("Invalid date format");
      }
      return date3;
    }
    return val;
  })
});
var insertAvailabilitySchema = createInsertSchema(availability, {
  daysOfWeek: z.array(z.number().int().min(0).max(6)).nullable().optional(),
  breaks: z.array(z.object({ startTime: z.string(), endTime: z.string() })).nullable().optional()
}).omit({
  id: true,
  createdAt: true
});

// server/db.ts
import "dotenv/config";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
init_config();
import { readFileSync } from "node:fs";
import tls from "node:tls";
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set to a PostgreSQL connection string. See .env.example and docs/supabase.md."
  );
}
assertAuditActivation(process.env);
var auditConnection2 = process.env.AUDIT_ENABLED === "true" ? auditApplicationConnection(process.env.DATABASE_URL) : void 0;
var pool = new pg.Pool({
  ...auditConnection2 ? {
    host: auditConnection2.host,
    port: auditConnection2.port,
    user: auditConnection2.user,
    password: auditConnection2.password,
    database: auditConnection2.database,
    ...{ replication: "false", sslnegotiation: "postgres" },
    options: "-c search_path=pg_catalog,public",
    ssl: {
      rejectUnauthorized: true,
      servername: auditConnection2.host,
      checkServerIdentity: tls.checkServerIdentity,
      minVersion: "TLSv1.2",
      ...auditConnection2.caPath ? { ca: readFileSync(auditConnection2.caPath, "utf8") } : {}
    }
  } : { connectionString: process.env.DATABASE_URL },
  max: 5,
  connectionTimeoutMillis: 1e4,
  idleTimeoutMillis: 3e4
});
pool.on("error", (error) => {
  console.error("PostgreSQL pool error:", "code" in error ? error.code : error.name);
});
var db = drizzle({ client: pool, schema: schema_exports });

// server/storage.ts
import { eq as eq6, and as and5, or as or3, gte, lte, asc as asc4, desc as desc2, sql as sql5, ne as ne2, isNull as isNull5, inArray as inArray3 } from "drizzle-orm";

// shared/provider.ts
function publicProvider(user, company) {
  const provider = { ...user, providerType: company ? "company" : "individual", companyName: company?.name ?? null };
  return {
    ...provider,
    email: null,
    ...provider.providerType === "company" ? { firstName: null, lastName: null, profileImageUrl: null } : {}
  };
}

// server/storefronts.ts
import { and, asc, eq as eq2, gt, inArray, isNull, or, sql as sql3 } from "drizzle-orm";

// shared/storefront.ts
import { z as z3 } from "zod";
var storefrontSlugSchema = z3.string().trim().min(3).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and single hyphens.");
var imagePath = z3.string().regex(/^\/objects\/[a-zA-Z0-9_-]+\/[a-f0-9-]{36}\.(?:jpg|png|webp|gif)$/).nullable();
var storefrontSchema = z3.object({
  slug: storefrontSlugSchema,
  name: z3.string().trim().min(1).max(150),
  description: z3.string().trim().max(3e3),
  logoUrl: imagePath,
  coverUrl: imagePath,
  isPublished: z3.boolean()
}).strict();
var subscriptionTargetSchema = z3.discriminatedUnion("kind", [
  z3.object({ kind: z3.literal("user"), id: z3.string().trim().min(1).max(128) }).strict(),
  z3.object({ kind: z3.literal("company"), id: z3.coerce.number().int().positive().max(2147483647) }).strict()
]);
var subscriptionOptionsSchema = z3.object({
  kind: z3.enum(["user", "company"]),
  search: z3.string().trim().max(200).default(""),
  page: z3.coerce.number().int().min(1).max(1e5).default(1)
}).strict();
var subscriptionUpdateSchema = z3.object({
  target: subscriptionTargetSchema,
  plan: z3.enum(["free", "pro"]),
  proUntil: z3.string().datetime({ offset: true }).nullable()
}).strict().refine((value) => value.plan === "free" || value.proUntil != null && Date.parse(value.proUntil) > Date.now(), "Pro access must have a future expiry date.");
function hasPro(subscription, now = Date.now()) {
  return subscription?.plan === "pro" && subscription.proUntil != null && new Date(subscription.proUntil).getTime() > now;
}
var StorefrontError = class extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
};

// server/billing/manual-writer.ts
import { eq, sql as sql2 } from "drizzle-orm";

// server/billing/contracts.ts
import { z as z4 } from "zod";
var reference = z4.string().trim().min(1).max(255);
var instant = z4.number().int().min(0).max(864e13);
var authoritySchema = z4.object({
  provider: z4.string().trim().min(1).max(64),
  merchantAccount: reference,
  mode: z4.enum(["test", "live"])
}).strict();
var bindingSchema = authoritySchema.extend({ workspaceId: z4.number().int().positive().max(2147483647) }).strict();
var checkoutRequestSchema = z4.object({
  workspaceId: bindingSchema.shape.workspaceId,
  idempotencyKey: z4.string().regex(/^[a-zA-Z0-9_-]{16,128}$/),
  termsVersion: z4.string().regex(/^[a-zA-Z0-9._-]{1,64}$/),
  offerRevision: z4.string().uuid().optional()
}).strict();
var offerSchema = z4.object({
  reference,
  currency: z4.literal("EUR"),
  interval: z4.literal("month"),
  quantity: z4.literal(1),
  termsVersion: checkoutRequestSchema.shape.termsVersion,
  amountMinor: z4.number().int().min(1).max(99999999).optional(),
  taxIncluded: z4.literal(true).optional()
}).strict();
var operationSchema = z4.object({
  id: z4.string().uuid(),
  binding: bindingSchema,
  actorId: z4.string().uuid(),
  idempotencyKey: checkoutRequestSchema.shape.idempotencyKey,
  fingerprint: z4.string().regex(/^[a-f0-9]{64}$/),
  requestedOffer: reference,
  termsVersion: checkoutRequestSchema.shape.termsVersion,
  state: z4.enum(["reserved", "unknown", "completed", "failed"]),
  remoteCheckoutId: reference.nullable(),
  resolvedAt: instant.nullable()
}).strict();
var periodSchema = z4.object({ start: instant, end: instant }).strict().refine((value) => value.start < value.end, "Period must end after it starts");
var invoiceSchema = z4.object({
  processorInvoiceId: reference,
  period: periodSchema,
  status: z4.enum(["paid", "unpaid", "reversed"]),
  currency: z4.literal("EUR").optional(),
  amountDue: z4.string().regex(/^(0|[1-9]\d{0,17})$/).optional(),
  amountPaid: z4.string().regex(/^(0|[1-9]\d{0,17})$/).optional(),
  amountRefunded: z4.string().regex(/^(0|[1-9]\d{0,17})$/).optional(),
  paymentReference: reference.nullable().optional(),
  refundReferences: z4.array(reference).max(100).optional(),
  disputeReferences: z4.array(reference).max(100).optional(),
  exceptionsReviewed: z4.literal(true).optional()
}).strict();
var snapshotSchema = z4.object({
  binding: bindingSchema,
  processorSubscriptionId: reference,
  requestedOffer: reference,
  currency: z4.literal("EUR"),
  interval: z4.literal("month"),
  // Adapter must fetch a complete relevant period set, not one webhook payload.
  evidenceComplete: z4.literal(true),
  invoices: z4.array(invoiceSchema).max(1e3),
  state: z4.enum(["pending", "running", "attention", "ended"]).optional(),
  processorStatus: z4.string().min(1).max(64).optional(),
  period: periodSchema.optional(),
  cancelAtPeriodEnd: z4.boolean().optional()
}).strict();
var leaseSchema = z4.object({
  binding: bindingSchema,
  processorSubscriptionId: reference,
  generation: z4.number().int().nonnegative(),
  revision: z4.number().int().nonnegative(),
  token: z4.string().uuid(),
  expiresAt: instant,
  offerReference: reference.optional()
}).strict();
var verifiedEventSchema = authoritySchema.extend({
  eventId: reference,
  eventType: z4.string().min(1).max(128),
  customerId: reference,
  processorSubscriptionId: reference,
  occurredAt: instant
}).strict();
var BillingError = class extends Error {
  constructor(code) {
    super(code);
    this.code = code;
    this.name = "BillingError";
  }
};
function assertAuthority(actual, expected) {
  if (actual.provider !== expected.provider || actual.merchantAccount !== expected.merchantAccount || actual.mode !== expected.mode) throw new BillingError("BINDING_MISMATCH");
}
function assertBinding(actual, expected) {
  assertAuthority(actual, expected);
  if (actual.workspaceId !== expected.workspaceId) throw new BillingError("BINDING_MISMATCH");
}

// server/billing/manual-writer.ts
var writer;
function installBillingManualWriter(value) {
  writer = value;
}
function billingManualWriter() {
  return writer;
}
async function assertLegacyManualWritable(tx, workspaceId) {
  const exists = await tx.execute(sql2`SELECT to_regclass('public.billing_source_state') IS NOT NULL AS present`);
  if (exists.rows.length !== 1 || typeof exists.rows[0]?.present !== "boolean") throw new BillingError("UNAVAILABLE");
  if (exists.rows[0].present === true) {
    const [marker4] = await tx.select().from(billingSourceState).where(eq(billingSourceState.workspaceId, workspaceId));
    if (marker4) throw new BillingError("UNAVAILABLE");
  }
}

// server/storefronts.ts
var targetWhere = (target2) => target2.kind === "company" ? eq2(providerSubscriptions.companyId, target2.id) : eq2(providerSubscriptions.userId, target2.id);
var publishedStorefrontConditions = () => and(
  eq2(storefronts.isPublished, true),
  eq2(providerSubscriptions.plan, "pro"),
  gt(providerSubscriptions.proUntil, sql3`now()`),
  or(isNull(providerSubscriptions.companyId), eq2(companies.isActive, true))
);
var storefrontStore = {
  async adminOptions({ kind, search, page }) {
    const pageSize = 20;
    const matches = (field) => sql3`strpos(lower(${field}), lower(${search})) > 0`;
    const userName = sql3`coalesce(nullif(trim(concat_ws(' ', ${users.firstName}, ${users.lastName})), ''), nullif(${users.email}, ''), ${users.id})`;
    if (kind === "company") {
      const rows2 = await db.select({ id: companies.id, name: companies.name, isActive: companies.isActive, ownerEmail: users.email }).from(companies).leftJoin(users, eq2(companies.ownerId, users.id)).where(search ? or(matches(companies.name), matches(sql3`${companies.id}::text`), matches(userName), matches(users.email)) : void 0).orderBy(asc(sql3`lower(${companies.name})`), asc(companies.id)).limit(pageSize + 1).offset((page - 1) * pageSize);
      return { items: rows2.slice(0, pageSize).map((row) => ({
        target: { kind: "company", id: row.id },
        name: row.name,
        detail: [row.ownerEmail, `#${row.id}`].filter(Boolean).join(" \xB7 "),
        isActive: row.isActive
      })), hasMore: rows2.length > pageSize };
    }
    const rows = await db.select({ id: users.id, name: userName, email: users.email }).from(users).where(search ? or(matches(userName), matches(users.email), matches(users.id)) : void 0).orderBy(asc(sql3`lower(${userName})`), asc(users.id)).limit(pageSize + 1).offset((page - 1) * pageSize);
    return { items: rows.slice(0, pageSize).map((row) => ({
      target: { kind: "user", id: row.id },
      name: row.name,
      detail: row.email !== row.name ? row.email : null,
      isActive: null
    })), hasMore: rows.length > pageSize };
  },
  async settings(target2) {
    const [row] = await db.select({ subscription: providerSubscriptions, storefront: storefronts }).from(providerSubscriptions).leftJoin(storefronts, eq2(storefronts.subscriptionId, providerSubscriptions.id)).where(targetWhere(target2));
    return {
      subscription: row ? { plan: row.subscription.plan, proUntil: row.subscription.proUntil } : null,
      hasPro: hasPro(row?.subscription ?? null),
      storefront: row?.storefront ?? null
    };
  },
  async save(target2, input) {
    return db.transaction(async (tx) => {
      const [subscription] = await tx.select().from(providerSubscriptions).where(targetWhere(target2)).for("update");
      if (!hasPro(subscription ?? null)) throw new StorefrontError(403, "An active Pro subscription is required.");
      const [existing] = await tx.select().from(storefronts).where(eq2(storefronts.subscriptionId, subscription.id));
      if (existing && existing.slug !== input.slug) throw new StorefrontError(409, "The storefront address cannot be changed after saving.");
      const values = { ...input, updatedAt: /* @__PURE__ */ new Date() };
      const [saved] = existing ? await tx.update(storefronts).set(values).where(eq2(storefronts.id, existing.id)).returning() : await tx.insert(storefronts).values({ ...values, subscriptionId: subscription.id }).returning();
      return saved;
    });
  },
  async publicPage(slug) {
    const [row] = await db.select({ storefront: storefronts, userId: providerSubscriptions.userId, companyId: providerSubscriptions.companyId }).from(storefronts).innerJoin(providerSubscriptions, eq2(storefronts.subscriptionId, providerSubscriptions.id)).leftJoin(companies, eq2(providerSubscriptions.companyId, companies.id)).where(and(eq2(storefronts.slug, slug), publishedStorefrontConditions()));
    if (!row) throw new StorefrontError(404, "Storefront not found.");
    const { name, description, logoUrl, coverUrl } = row.storefront;
    return {
      slug,
      name,
      description,
      logoUrl,
      coverUrl,
      source: row.companyId != null ? { companyId: row.companyId } : { providerId: row.userId }
    };
  },
  async slugs(sources) {
    const companyIds = Array.from(new Set(sources.flatMap((source) => source.companyId == null ? [] : [source.companyId])));
    const userIds = Array.from(new Set(sources.filter((source) => source.companyId == null).map((source) => source.providerId)));
    if (!companyIds.length && !userIds.length) return /* @__PURE__ */ new Map();
    const rows = await db.select({ slug: storefronts.slug, userId: providerSubscriptions.userId, companyId: providerSubscriptions.companyId }).from(storefronts).innerJoin(providerSubscriptions, eq2(storefronts.subscriptionId, providerSubscriptions.id)).leftJoin(companies, eq2(providerSubscriptions.companyId, companies.id)).where(and(
      publishedStorefrontConditions(),
      or(
        companyIds.length ? inArray(providerSubscriptions.companyId, companyIds) : void 0,
        userIds.length ? inArray(providerSubscriptions.userId, userIds) : void 0
      )
    ));
    return new Map(rows.map((row) => [row.companyId != null ? `company:${row.companyId}` : `user:${row.userId}`, row.slug]));
  },
  async adminGet(target2) {
    let name;
    if (target2.kind === "company") {
      const [company] = await db.select().from(companies).where(eq2(companies.id, target2.id));
      if (!company) throw new StorefrontError(404, "Company not found.");
      name = company.name;
    } else {
      const [user] = await db.select().from(users).where(eq2(users.id, target2.id));
      if (!user) throw new StorefrontError(404, "User profile not found. The user must sign in first.");
      name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || user.id;
    }
    const [subscription] = await db.select().from(providerSubscriptions).where(targetWhere(target2));
    return { name, subscription: subscription ?? null };
  },
  async adminUpdate(input, adminId) {
    await this.adminGet(input.target);
    const writer2 = billingManualWriter();
    if (writer2) {
      await writer2(adminId, input);
      return this.adminGet(input.target);
    }
    const values = { plan: input.plan, proUntil: input.plan === "pro" ? new Date(input.proUntil) : null, updatedBy: adminId, updatedAt: /* @__PURE__ */ new Date() };
    await db.transaction(async (tx) => {
      await tx.insert(providerSubscriptions).values({
        plan: "free",
        updatedBy: adminId,
        userId: input.target.kind === "user" ? input.target.id : null,
        companyId: input.target.kind === "company" ? input.target.id : null
      }).onConflictDoNothing();
      const [workspace] = await tx.select().from(providerSubscriptions).where(targetWhere(input.target)).for("update");
      await assertLegacyManualWritable(tx, workspace.id);
      await tx.insert(providerSubscriptions).values({
        ...values,
        userId: input.target.kind === "user" ? input.target.id : null,
        companyId: input.target.kind === "company" ? input.target.id : null
      }).onConflictDoUpdate({ target: input.target.kind === "company" ? providerSubscriptions.companyId : providerSubscriptions.userId, set: values });
    });
    return this.adminGet(input.target);
  }
};

// server/addresses.ts
import { and as and3, asc as asc2, eq as eq4, isNull as isNull3 } from "drizzle-orm";

// shared/locations.ts
function normalizeAddress(address) {
  return address.normalize("NFKC").trim().replace(/\s+/g, " ").replace(/\s*,\s*/g, ",").toLocaleLowerCase("en");
}
function addressError(input) {
  if (typeof input !== "string" || input.trim().length < 5 || input.length > 500 || !new RegExp("\\p{L}", "u").test(input) || /[\x00-\x1f\x7f]|https?:\/\/|www\.|@/i.test(input)) {
    return "Enter a street or venue address, town and country (5\u2013500 characters).";
  }
}
function validCoordinates(latitude, longitude) {
  return typeof latitude === "number" && Number.isFinite(latitude) && Math.abs(latitude) <= 90 && typeof longitude === "number" && Number.isFinite(longitude) && Math.abs(longitude) <= 180;
}
function currentLocation(location, now = Date.now()) {
  if (location.locationSource === "google" && (!location.locationExpiresAt || !(new Date(location.locationExpiresAt).getTime() > now))) {
    if (location.latitude == null && location.longitude == null && location.distance === void 0 && (location.locationAddressSource !== "google" || location.address == null)) return location;
    return {
      ...location,
      latitude: null,
      longitude: null,
      ..."distance" in location ? { distance: void 0 } : {},
      ...location.locationAddressSource === "google" ? { address: null } : {}
    };
  }
  return location;
}

// server/companyAccess.ts
import { and as and2, eq as eq3, isNull as isNull2 } from "drizzle-orm";

// server/customerBookings.ts
var CustomerBookingError = class extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
};
function assertCustomerBookingChange(booking, seekerId, now = /* @__PURE__ */ new Date()) {
  if (!seekerId || booking.seekerId !== seekerId) throw new CustomerBookingError(403, "This reservation does not belong to you.");
  if (booking.status !== "pending" && booking.status !== "confirmed") throw new CustomerBookingError(409, "Only pending or confirmed reservations can be changed.");
  if (!(new Date(booking.scheduledDate).getTime() > now.getTime())) throw new CustomerBookingError(409, "Only future reservations can be changed.");
}

// server/companyAccess.ts
var AccessError = class extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
};
var saveWorkspaceSession = (req) => new Promise((resolve, reject) => req.session.save((error) => error ? reject(error) : resolve()));
async function workspaceContext(userId, selected3) {
  const rows = await db.select({ company: companies, membership: companyMemberships }).from(companyMemberships).innerJoin(companies, eq3(companies.id, companyMemberships.companyId)).where(eq3(companyMemberships.userId, userId));
  const chosen = selected3 === null ? void 0 : selected3 !== void 0 ? rows.find((row) => row.company.id === selected3) : rows.find((row) => row.membership.role === "owner") ?? rows.find((row) => row.company.isActive);
  const manager2 = chosen?.membership.role === "owner" || chosen?.membership.role === "admin";
  const active2 = chosen?.company.isActive ?? true;
  const personal = !chosen && selected3 == null;
  return {
    company: chosen?.company ?? null,
    membership: chosen?.membership ?? null,
    workspaces: rows.map((row) => ({ id: row.company.id, name: row.company.name, role: row.membership.role })),
    invalid: selected3 != null && !chosen,
    permissions: {
      manageCompany: Boolean(manager2 && active2),
      manageTeam: Boolean(manager2 && active2),
      manageServices: Boolean((personal || manager2) && active2),
      manageSchedules: Boolean((personal || manager2) && active2),
      manageBookings: Boolean((personal || manager2 || chosen?.membership.role === "provider") && active2),
      readAll: Boolean(personal || manager2),
      isOwner: chosen?.membership.role === "owner"
    }
  };
}
function scope(req, permission) {
  const ctx = req.workspace;
  if (!ctx || ctx.invalid) throw new AccessError(403, "Choose a workspace you belong to.");
  if (permission && !ctx.permissions[permission]) throw new AccessError(403, "Your access level does not allow this action.");
  return { userId: req.user.claims.sub, providerId: ctx.company?.providerId ?? req.user.claims.sub, companyId: ctx.company?.id, employeeId: ctx.membership?.employeeId, ctx };
}
function assertService(req, service, write = false) {
  const current = scope(req, write ? "manageServices" : void 0);
  if (!service || (current.companyId != null ? service.companyId !== current.companyId : service.companyId != null || service.providerId !== current.userId)) throw new AccessError(403, "Service is not in this workspace.");
  if (!write && !current.ctx.permissions.readAll && (current.employeeId == null || service.employeeId !== current.employeeId)) throw new AccessError(403, "This service is not assigned to you.");
  return current;
}
function assertBooking(req, booking, write = false) {
  const current = scope(req, write ? "manageBookings" : void 0);
  if (!booking || (current.companyId != null ? booking.companyId !== current.companyId : booking.companyId != null || booking.providerId !== current.userId)) throw new AccessError(403, "Reservation is not in this workspace.");
  if (!current.ctx.permissions.readAll && (current.employeeId == null || booking.employeeId !== current.employeeId)) throw new AccessError(403, "This reservation is not assigned to you.");
  return current;
}
function assertBookingChange(req, booking) {
  try {
    assertBooking(req, booking, true);
    return void 0;
  } catch (error) {
    if (!(error instanceof AccessError)) throw error;
    if (!booking || booking.seekerId !== req.user?.claims.sub) throw error;
  }
  const userId = req.user?.claims.sub;
  if (booking && userId && booking.seekerId === userId) {
    assertCustomerBookingChange(booking, userId);
    return userId;
  }
  throw new AccessError(403, "Reservation is not in this workspace.");
}
async function ensureCompany(providerId2, name) {
  return db.transaction(async (tx) => {
    await tx.select().from(users).where(eq3(users.id, providerId2)).for("update");
    let [company] = await tx.select().from(companies).where(eq3(companies.providerId, providerId2));
    const created = !company;
    if (!company) {
      [company] = await tx.insert(companies).values({ name, ownerId: providerId2, providerId: providerId2 }).returning();
      await tx.insert(companyMemberships).values({ companyId: company.id, userId: providerId2, role: "owner" });
      for (const table of [employees, services, addresses, bookings, availability]) {
        await tx.update(table).set({ companyId: company.id }).where(and2(eq3(table.providerId, providerId2), isNull2(table.companyId)));
      }
    }
    await tx.update(users).set({ providerType: "company", companyName: company.name, ...created ? { currentRole: "provider" } : {} }).where(eq3(users.id, providerId2));
    return company;
  });
}

// server/money.ts
import { z as z5 } from "zod";

// shared/money.ts
var zero = BigInt(0);
var scale = (digits) => [BigInt(1), BigInt(10), BigInt(100), BigInt(1e3)][digits];
function readAmount(amount, currency2, allowTrailingZeros) {
  const digits = currencyDigits(currency2);
  if (typeof amount !== "string" || amount.length > 24 || !/^(?:0|[1-9]\d{0,7})(?:\.\d+)?$/.test(amount)) throw new RangeError("Invalid money amount");
  const [whole, fraction = ""] = amount.split(".");
  if (fraction.length > digits && (!allowTrailingZeros || /[1-9]/.test(fraction.slice(digits)))) throw new RangeError("Invalid currency precision");
  const minor = BigInt(whole) * scale(digits) + BigInt(fraction.slice(0, digits).padEnd(digits, "0") || "0");
  if (minor * scale(3 - digits) > BigInt("99999999990")) throw new RangeError("Money amount exceeds limit");
  return { minor, digits };
}
function parseMoneyAmount(amount, currency2) {
  const { minor } = readAmount(amount, currency2, false);
  return minorToAmount(minor, currency2);
}
function normalizeMoneyAmount(amount, currency2) {
  const { minor } = readAmount(amount, currency2, true);
  return minorToAmount(minor, currency2);
}
function amountToMinor(amount, currency2) {
  return readAmount(amount, currency2, false).minor;
}
function minorToAmount(minor, currency2) {
  const digits = currencyDigits(currency2);
  if (typeof minor !== "bigint" || minor < zero) throw new RangeError("Invalid minor units");
  const divisor = scale(digits);
  return String(minor / divisor) + (digits ? "." + String(minor % divisor).padStart(digits, "0") : "");
}
function calculateBookingAmounts(price, currency2, participants, advancePercent) {
  if (!Number.isSafeInteger(participants) || participants < 1 || !Number.isSafeInteger(advancePercent) || advancePercent < 0 || advancePercent > 100) throw new RangeError("Invalid booking amount inputs");
  const unit = amountToMinor(normalizeMoneyAmount(price, currency2), currency2);
  const total = unit * BigInt(participants);
  const totalAmount = parseMoneyAmount(minorToAmount(total, currency2), currency2);
  const advance = (total * BigInt(advancePercent) + BigInt(50)) / BigInt(100);
  return { totalAmount, advanceAmount: minorToAmount(advance, currency2), balanceAmount: minorToAmount(total - advance, currency2) };
}

// server/money.ts
var MoneyInputError = class extends Error {
  status = 400;
};
var PriceChangedError = class extends Error {
  constructor(currentPrice, currentCurrency, currentAdvancePaymentPercent) {
    super("The service price or advance has changed. Review the updated amounts before booking.");
    this.currentPrice = currentPrice;
    this.currentCurrency = currentCurrency;
    this.currentAdvancePaymentPercent = currentAdvancePaymentPercent;
  }
  status = 409;
  code = "PRICE_CHANGED";
};
var expectedPriceSchema = z5.object({
  expectedPrice: z5.string().min(1).max(30),
  expectedCurrency: z5.string().refine(isSupportedCurrency, "Choose a supported currency."),
  expectedAdvancePaymentPercent: z5.number().int().min(0).max(100)
}).transform((input) => {
  try {
    return { expectedPrice: parseMoneyAmount(input.expectedPrice, input.expectedCurrency), expectedCurrency: input.expectedCurrency, expectedAdvancePaymentPercent: input.expectedAdvancePaymentPercent };
  } catch {
    throw new MoneyInputError("Choose a valid expected service price.");
  }
});
function serviceMoneyChanges(input, previous) {
  if (previous && input.price === void 0 && input.currency === void 0) return {};
  if (previous && input.currency !== void 0 && input.currency !== previous.currency && input.price === void 0) {
    throw new MoneyInputError("Review and provide the service amount when changing its currency.");
  }
  const currency2 = input.currency ?? previous?.currency;
  const price = input.price ?? previous?.price;
  if (!currency2 || !isSupportedCurrency(currency2) || price === void 0) throw new MoneyInputError("Choose a price and supported currency.");
  try {
    return { currency: currency2, price: input.price === void 0 ? normalizeMoneyAmount(price, currency2) : parseMoneyAmount(price, currency2) };
  } catch {
    throw new MoneyInputError("Enter an amount within the supported limit and currency precision.");
  }
}
function bookingPriceSnapshot(service, participantCount, expected) {
  let price;
  try {
    price = normalizeMoneyAmount(service.price, service.currency);
  } catch {
    throw new MoneyInputError("This service has no valid currency price and cannot be booked.");
  }
  const advancePaymentPercent = service.advancePaymentPercent ?? 0;
  if (expected.expectedCurrency !== service.currency || expected.expectedPrice !== price || expected.expectedAdvancePaymentPercent !== advancePaymentPercent) throw new PriceChangedError(price, service.currency, advancePaymentPercent);
  try {
    const { totalAmount, advanceAmount } = calculateBookingAmounts(price, service.currency, participantCount, advancePaymentPercent);
    return { currency: service.currency, totalAmount, advanceAmount };
  } catch {
    throw new MoneyInputError("The reservation amount exceeds the supported limit.");
  }
}
function serviceMoneyDto(service) {
  if (!isSupportedCurrency(service.currency)) return service;
  return { ...service, price: normalizeMoneyAmount(service.price, service.currency) };
}
function bookingMoneyDto(booking) {
  if (!isSupportedCurrency(booking.currency)) return booking;
  return { ...booking, totalAmount: normalizeMoneyAmount(booking.totalAmount, booking.currency), advanceAmount: normalizeMoneyAmount(booking.advanceAmount, booking.currency) };
}

// server/addresses.ts
var owned = (owner) => owner.companyId != null ? eq4(addresses.companyId, owner.companyId) : and3(eq4(addresses.providerId, owner.providerId), isNull3(addresses.companyId));
function serviceLocation(service, location) {
  return { ...serviceMoneyDto(service), ...currentLocation({
    address: location?.address ?? null,
    latitude: location?.latitude ?? null,
    longitude: location?.longitude ?? null,
    countryCode: location?.countryCode ?? null,
    locationSource: location?.locationSource ?? "legacy",
    locationKey: location?.locationKey ?? null,
    locationPlaceId: location?.locationPlaceId ?? null,
    locationExpiresAt: location?.locationExpiresAt ?? null,
    locationAddressSource: location?.locationAddressSource ?? "user"
  }) };
}
var addressStore = {
  async list(owner) {
    const rows = await db.select().from(addresses).where(owned(owner)).orderBy(asc2(addresses.id));
    return rows.map((row) => currentLocation(row));
  },
  async get(id2, owner) {
    const [row] = await db.select().from(addresses).where(and3(eq4(addresses.id, id2), owned(owner)));
    if (!row) throw new AccessError(403, "Choose an address from this workspace.");
    return currentLocation(row);
  },
  async save(location, owner, id2) {
    const values = {
      address: location.address,
      latitude: location.latitude,
      longitude: location.longitude,
      countryCode: location.countryCode ?? null,
      ...location.pricingCurrency !== void 0 ? { pricingCurrency: location.pricingCurrency } : {},
      locationSource: location.locationSource,
      locationKey: location.locationKey,
      locationPlaceId: location.locationPlaceId,
      locationExpiresAt: location.locationExpiresAt,
      locationAddressSource: location.locationAddressSource
    };
    if (id2 != null) {
      const [row2] = await db.update(addresses).set({ ...values, updatedAt: /* @__PURE__ */ new Date() }).where(and3(eq4(addresses.id, id2), owned(owner))).returning();
      if (!row2) throw new AccessError(403, "Choose an address from this workspace.");
      return currentLocation(row2);
    }
    const [row] = await db.insert(addresses).values({ ...values, providerId: owner.providerId, companyId: owner.companyId ?? null }).returning();
    return currentLocation(row);
  },
  async remove(id2, owner) {
    const [row] = await db.delete(addresses).where(and3(eq4(addresses.id, id2), owned(owner))).returning();
    if (!row) throw new AccessError(403, "Choose an address from this workspace.");
  }
};

// server/storage.ts
init_context();
init_events();
init_capture();

// shared/scheduling.ts
var OCCUPYING_BOOKING_STATUSES = ["confirmed", "completed"];
function availableCapacity(service, bookings2, start) {
  const duration = service.duration, cleanup = service.cleanupTime ?? 0;
  const capacity = service.serviceType === "group" ? service.maxCapacity ?? 1 : 1;
  const end = start.getTime() + (duration + cleanup) * 6e4;
  let occupied = 0;
  for (const booking of bookings2) {
    if (!OCCUPYING_BOOKING_STATUSES.some((status) => status === booking.status)) continue;
    const busyStart = new Date(booking.scheduledDate).getTime();
    const busyDuration = booking.bookingDuration ?? 60, busyCleanup = booking.bookingCleanupTime ?? 0;
    if (start.getTime() >= busyStart + (busyDuration + busyCleanup) * 6e4 || end <= busyStart) continue;
    if (service.serviceType !== "group" || booking.serviceId !== service.id || busyStart !== start.getTime() || busyDuration !== duration || busyCleanup !== cleanup) return 0;
    occupied += booking.participantCount ?? 1;
  }
  return Math.max(0, capacity - occupied);
}
var formatters = /* @__PURE__ */ new Map();
function validTimezone(value) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
function validDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
function parts(value, zone) {
  let formatter = formatters.get(zone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-GB", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
    formatters.set(zone, formatter);
  }
  return Object.fromEntries(formatter.formatToParts(value).map((part) => [part.type, part.value]));
}
function dateInZone(value, zone) {
  const p = parts(value, zone);
  return `${p.year}-${p.month}-${p.day}`;
}
function timeInZone(value, zone) {
  const p = parts(value, zone);
  return `${p.hour}:${p.minute}`;
}
function addDateDays(date3, days) {
  const value = /* @__PURE__ */ new Date(`${date3}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
function localInstants(date3, time2, zone, offsets) {
  const wall = Date.parse(`${date3}T${time2}:00Z`);
  return offsets.map((offset) => new Date(wall - offset)).filter((value) => dateInZone(value, zone) === date3 && timeInZone(value, zone) === time2);
}
function zoneOffsets(date3, zone) {
  const noon = Date.parse(`${date3}T12:00:00Z`);
  return Array.from(new Set([-24, 0, 24].map((hours) => {
    const instant2 = new Date(noon + hours * 36e5), p = parts(instant2, zone);
    return Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`) - instant2.getTime();
  })));
}
var minutes = (time2) => Number(time2.slice(0, 2)) * 60 + Number(time2.slice(3, 5));
var time = (value) => `${Math.floor(value / 60).toString().padStart(2, "0")}:${(value % 60).toString().padStart(2, "0")}`;
function scheduleDate(schedule) {
  return schedule.specificDate ? new Date(schedule.specificDate).toISOString().slice(0, 10) : null;
}
function workingRanges(schedule) {
  let ranges = [{ startTime: schedule.startTime, endTime: schedule.endTime }].filter((range) => range.startTime < range.endTime);
  for (const pause of schedule.breaks || []) {
    ranges = ranges.flatMap((range) => {
      if (pause.endTime <= range.startTime || pause.startTime >= range.endTime) return [range];
      return [
        { startTime: range.startTime, endTime: pause.startTime < range.endTime ? pause.startTime : range.endTime },
        { startTime: pause.endTime > range.startTime ? pause.endTime : range.startTime, endTime: range.endTime }
      ].filter((item) => item.startTime < item.endTime);
    });
  }
  return ranges;
}
function withinRecurrence(schedule, day) {
  if (schedule.recurrenceEndType === "on_date" && schedule.recurrenceEndValue && day > schedule.recurrenceEndValue.slice(0, 10)) return false;
  if (schedule.recurrenceEndType === "after_events" && schedule.createdAt) {
    const start = dateInZone(new Date(schedule.createdAt), schedule.timezone);
    const elapsed = Math.floor((Date.parse(day) - Date.parse(start)) / 864e5);
    const limit = Number(schedule.recurrenceEndValue);
    if (elapsed < 0 || !Number.isFinite(limit) || limit <= 0) return false;
    const weekday = new Date(start).getUTCDay();
    const count = Math.floor((elapsed + 1) / 7) * (schedule.daysOfWeek?.length || 0) + Array.from({ length: (elapsed + 1) % 7 }, (_, index2) => (weekday + index2) % 7).filter((value) => schedule.daysOfWeek?.includes(value)).length;
    if (count > limit) return false;
  }
  return true;
}
function bookableSlots({ service, schedules, bookings: bookings2, date: date3, timezone, participantCount = 1, now = /* @__PURE__ */ new Date() }) {
  const relevant = schedules.filter((item) => item.isActive !== false && (item.serviceId == null || item.serviceId === service.id));
  const result = /* @__PURE__ */ new Map();
  const duration = service.duration;
  const occupiedDuration = duration + (service.cleanupTime ?? 0);
  if (duration <= 0) return [];
  const zones = Array.from(new Set(relevant.map((item) => item.timezone))).filter(validTimezone);
  for (const zone of zones) {
    const inZone = relevant.filter((item) => item.timezone === zone);
    for (const delta of [-2, -1, 0, 1, 2]) {
      const day = addDateDays(date3, delta), weekday = new Date(day).getUTCDay();
      const serviceExceptions = inZone.filter((item) => item.serviceId === service.id && item.scheduleType === "specific" && scheduleDate(item) === day);
      const generalExceptions = inZone.filter((item) => item.serviceId == null && item.scheduleType === "specific" && scheduleDate(item) === day);
      const serviceWeekly = inZone.filter((item) => item.serviceId === service.id && item.scheduleType === "recurring");
      const generalWeekly = inZone.filter((item) => item.serviceId == null && item.scheduleType === "recurring");
      const selected3 = relevant.some((item) => item.serviceId === service.id && item.scheduleType === "specific" && scheduleDate(item) === day) ? serviceExceptions : relevant.some((item) => item.serviceId == null && item.scheduleType === "specific" && scheduleDate(item) === day) ? generalExceptions : (relevant.some((item) => item.serviceId === service.id && item.scheduleType === "recurring") ? serviceWeekly : generalWeekly).filter((item) => item.daysOfWeek?.includes(weekday) && withinRecurrence(item, day));
      const offsets = zoneOffsets(day, zone);
      for (const schedule of selected3) for (const range of workingRanges(schedule)) {
        for (let start = minutes(range.startTime); start + occupiedDuration <= minutes(range.endTime); start += 15) {
          for (const instant2 of localInstants(day, time(start), zone, offsets)) {
            const end = new Date(instant2.getTime() + duration * 6e4);
            const occupiedEnd = new Date(instant2.getTime() + occupiedDuration * 6e4);
            if (instant2 <= now || dateInZone(instant2, timezone) !== date3 || dateInZone(occupiedEnd, zone) !== day || timeInZone(occupiedEnd, zone) > range.endTime || timeInZone(occupiedEnd, zone) < range.startTime) continue;
            if (offsets.length > 1 && Array.from({ length: Math.ceil(occupiedDuration / 15) }, (_, index2) => new Date(instant2.getTime() + index2 * 15 * 6e4)).some((point) => dateInZone(point, zone) !== day || timeInZone(point, zone) < range.startTime || timeInZone(point, zone) >= range.endTime)) continue;
            const capacity = availableCapacity(service, bookings2, instant2);
            if (capacity < participantCount) continue;
            result.set(instant2.toISOString(), { startsAt: instant2.toISOString(), endsAt: end.toISOString(), timezone, startTime: timeInZone(instant2, timezone), endTime: timeInZone(end, timezone), slotDuration: duration, available: true, availableCapacity: capacity });
          }
        }
      }
    }
  }
  return Array.from(result.values()).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

// shared/reviews.ts
import { z as z8 } from "zod";
var reviewSchema = z8.object({
  rating: z8.number().int().min(1, "Choose a rating from 1 to 5.").max(5),
  comment: z8.string().trim().max(2e3, "Comments must be 2,000 characters or fewer.").default("")
}).strict().refine((value) => value.rating >= 3 || value.comment.length > 0, {
  path: ["comment"],
  message: "Please add a comment for a rating below 3 stars."
});
var ReviewError = class extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
};

// server/searchInput.ts
import { z as z9 } from "zod";
var MAX_SEARCH_DAYS = 31;
var MAX_SEARCH_CANDIDATES = 500;
var MAX_SEARCH_SCHEDULES = 5e3;
var MAX_SEMANTIC_RESULTS = 100;
var SearchError = class extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
};
var date2 = z9.string().refine(validDateKey, "Choose a valid date in YYYY-MM-DD format.");
var clock = z9.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Choose a valid time in HH:mm format.");
var ageGroup = z9.enum(["children", "teens", "adults", "seniors"]);
var filterShape = {
  limit: z9.number().int().min(1).max(50).optional(),
  category: z9.string().trim().min(1).max(64).optional(),
  serviceType: z9.enum(["one_to_one", "group"]).optional(),
  ageGroups: z9.array(ageGroup).max(4).optional(),
  latitude: z9.number().finite().min(-90).max(90).optional(),
  longitude: z9.number().finite().min(-180).max(180).optional(),
  radius: z9.number().finite().positive().max(2e4).optional(),
  date: date2.optional(),
  dateEnd: date2.optional(),
  time: clock.optional(),
  timeEnd: clock.optional(),
  availableOnly: z9.boolean().optional(),
  searchQuery: z9.string().trim().max(200).optional(),
  companyId: z9.number().int().positive().max(2147483647).optional(),
  providerId: z9.string().trim().min(1).max(128).optional(),
  serviceIds: z9.array(z9.number().int().positive()).max(MAX_SEARCH_CANDIDATES).optional()
};
var filterObject = z9.object(filterShape).strict();
function checkRanges(value, context) {
  const issue = (path7, message) => context.addIssue({ code: "custom", path: [path7], message });
  if (value.dateEnd && !value.date) issue("dateEnd", "Choose a start date before an end date.");
  if (value.availableOnly && !value.date) issue("date", "Choose a date when filtering by availability.");
  if (value.date && value.dateEnd) {
    const days = (Date.parse(value.dateEnd) - Date.parse(value.date)) / 864e5 + 1;
    if (days < 1 || days > MAX_SEARCH_DAYS) issue("dateEnd", `Choose a date range of at most ${MAX_SEARCH_DAYS} days.`);
  }
  if (value.time && value.timeEnd && value.timeEnd <= value.time) issue("timeEnd", "End time must be after start time.");
  const locationFields2 = [value.latitude, value.longitude, value.radius].filter((item) => item !== void 0).length;
  if (locationFields2 !== 0 && locationFields2 !== 3) issue("latitude", "Provide latitude, longitude, and radius together.");
}
var searchFiltersSchema = filterObject.superRefine(checkRanges);
var numericQuery = (schema) => z9.preprocess((value) => typeof value === "string" && value.trim() !== "" ? Number(value) : value, schema.optional());
var queryShape = {
  ...filterShape,
  limit: numericQuery(z9.number().int().min(1).max(50)),
  latitude: numericQuery(z9.number().finite().min(-90).max(90)),
  longitude: numericQuery(z9.number().finite().min(-180).max(180)),
  radius: numericQuery(z9.number().finite().positive().max(2e4)),
  ageGroups: z9.union([ageGroup, z9.array(ageGroup).max(4)]).transform((value) => typeof value === "string" ? [value] : value).optional(),
  availableOnly: z9.enum(["true", "false"]).transform((value) => value === "true").optional()
};
var publicQuery = z9.object(queryShape).omit({ companyId: true, providerId: true, serviceIds: true });
var publicSearchSchema = publicQuery.strict().superRefine(checkRanges);
var semanticSearchSchema = publicQuery.omit({ searchQuery: true }).extend({
  query: z9.string().trim().min(1).max(200)
}).strict().superRefine(checkRanges);
function assertSearchSize(size, maximum = MAX_SEARCH_CANDIDATES) {
  if (size > maximum) throw new SearchError(422, "SEARCH_TOO_BROAD", "This search is too broad. Narrow the category, location, or search text.");
}

// server/notifications/repository.ts
import { randomUUID as randomUUID3 } from "node:crypto";
import { and as and4, asc as asc3, desc, eq as eq5, gt as gt2, inArray as inArray2, isNull as isNull4, lt, ne, notExists, or as or2 } from "drizzle-orm";

// shared/notifications.ts
import { z as z10 } from "zod";
var communicationMethods = ["email", "sms", "whatsapp"];
var notificationLanguages = ["en", "lv", "ru", "ar", "zh", "fr", "de", "hi", "ja", "pt", "es"];
var communicationPatchSchema = z10.object({
  phone: z10.string().regex(/^\+[1-9]\d{7,14}$/, "Use an international phone number, including + and country code.").nullable().optional(),
  preferredMethod: z10.enum(communicationMethods).nullable().optional(),
  language: z10.enum(notificationLanguages).optional(),
  smsOptIn: z10.boolean().optional(),
  whatsappOptIn: z10.boolean().optional()
}).strict();
var notificationTimezoneSchema = z10.string().max(100).refine(validTimezone, "Choose a valid timezone.").default("UTC");
var NotificationError = class extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
};

// server/notifications/policy.ts
var defaultPreferences = { phone: null, phoneVerifiedAt: null, preferredMethod: null, language: "en", smsOptIn: false, whatsappOptIn: false };
function channelReason(channel, prefs, email) {
  if (channel === "email") return prefs.emailSuppressed ? "email_suppressed" : email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? null : "missing_email";
  if (!prefs.phone) return "missing_phone";
  if (!prefs.phoneVerifiedAt) return "unverified_phone";
  return (channel === "sms" ? prefs.smsOptIn : prefs.whatsappOptIn) ? null : "missing_permission";
}
function statusAction(previous, next) {
  return previous === "pending" && next === "confirmed" ? "accepted" : previous === "pending" && next === "cancelled" ? "rejected" : null;
}
function reminderDue(appointment, hours, now) {
  const due = new Date(appointment.getTime() - hours * 36e5);
  return due.getTime() > now.getTime() ? due : null;
}
var copy = {
  en: { subject: "Appointment update", accepted: "Your requested service {service} on {date} has been accepted.", rejected: "Your requested service {service} on {date} has been rejected.", rescheduled: "Your requested service {service} has been rescheduled from {old} to {date}.", reminder: "Reminder: your appointment for {service} is on {date}.", from: "FitsMyTime" },
  lv: { subject: "Pieraksta izmai\u0146as", accepted: "J\u016Bsu piepras\u012Btais pakalpojums {service} {date} ir apstiprin\u0101ts.", rejected: "J\u016Bsu piepras\u012Btais pakalpojums {service} {date} ir noraid\u012Bts.", rescheduled: "J\u016Bsu piepras\u012Btais pakalpojums {service} ir p\u0101rcelts no {old} uz {date}.", reminder: "Atg\u0101din\u0101jums: J\u016Bsu pieraksts pakalpojumam {service} ir {date}.", from: "FitsMyTime" },
  ru: { subject: "\u0418\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435 \u0437\u0430\u043F\u0438\u0441\u0438", accepted: "\u0412\u0430\u0448 \u0437\u0430\u043F\u0440\u043E\u0441 \u043D\u0430 \u0443\u0441\u043B\u0443\u0433\u0443 {service} \u043D\u0430 {date} \u043F\u0440\u0438\u043D\u044F\u0442.", rejected: "\u0412\u0430\u0448 \u0437\u0430\u043F\u0440\u043E\u0441 \u043D\u0430 \u0443\u0441\u043B\u0443\u0433\u0443 {service} \u043D\u0430 {date} \u043E\u0442\u043A\u043B\u043E\u043D\u0451\u043D.", rescheduled: "\u0412\u0430\u0448\u0430 \u0437\u0430\u043F\u0438\u0441\u044C \u043D\u0430 \u0443\u0441\u043B\u0443\u0433\u0443 {service} \u043F\u0435\u0440\u0435\u043D\u0435\u0441\u0435\u043D\u0430 \u0441 {old} \u043D\u0430 {date}.", reminder: "\u041D\u0430\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u0435: \u0432\u0430\u0448\u0430 \u0437\u0430\u043F\u0438\u0441\u044C \u043D\u0430 \u0443\u0441\u043B\u0443\u0433\u0443 {service} \u0441\u043E\u0441\u0442\u043E\u0438\u0442\u0441\u044F {date}.", from: "FitsMyTime" },
  ar: { subject: "\u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0645\u0648\u0639\u062F", accepted: "\u062A\u0645 \u0642\u0628\u0648\u0644 \u0637\u0644\u0628 \u0627\u0644\u062E\u062F\u0645\u0629 {service} \u0641\u064A {date}.", rejected: "\u062A\u0645 \u0631\u0641\u0636 \u0637\u0644\u0628 \u0627\u0644\u062E\u062F\u0645\u0629 {service} \u0641\u064A {date}.", rescheduled: "\u062A\u0645 \u062A\u063A\u064A\u064A\u0631 \u0645\u0648\u0639\u062F \u0627\u0644\u062E\u062F\u0645\u0629 {service} \u0645\u0646 {old} \u0625\u0644\u0649 {date}.", reminder: "\u062A\u0630\u0643\u064A\u0631: \u0645\u0648\u0639\u062F \u0627\u0644\u062E\u062F\u0645\u0629 {service} \u0641\u064A {date}.", from: "FitsMyTime" },
  zh: { subject: "\u9884\u7EA6\u66F4\u65B0", accepted: "\u60A8\u7533\u8BF7\u7684\u670D\u52A1 {service}\uFF08{date}\uFF09\u5DF2\u88AB\u63A5\u53D7\u3002", rejected: "\u60A8\u7533\u8BF7\u7684\u670D\u52A1 {service}\uFF08{date}\uFF09\u5DF2\u88AB\u62D2\u7EDD\u3002", rescheduled: "\u60A8\u7684\u670D\u52A1 {service} \u5DF2\u4ECE {old} \u6539\u671F\u81F3 {date}\u3002", reminder: "\u63D0\u9192\uFF1A\u60A8\u9884\u7EA6\u7684\u670D\u52A1 {service} \u5C06\u4E8E {date} \u5F00\u59CB\u3002", from: "FitsMyTime" },
  fr: { subject: "Mise \xE0 jour du rendez-vous", accepted: "Votre demande de service {service} le {date} a \xE9t\xE9 accept\xE9e.", rejected: "Votre demande de service {service} le {date} a \xE9t\xE9 refus\xE9e.", rescheduled: "Votre service {service} a \xE9t\xE9 reprogramm\xE9 du {old} au {date}.", reminder: "Rappel : votre rendez-vous pour {service} est le {date}.", from: "FitsMyTime" },
  de: { subject: "Terminaktualisierung", accepted: "Ihre angefragte Leistung {service} am {date} wurde angenommen.", rejected: "Ihre angefragte Leistung {service} am {date} wurde abgelehnt.", rescheduled: "Ihr Termin f\xFCr {service} wurde vom {old} auf den {date} verschoben.", reminder: "Erinnerung: Ihr Termin f\xFCr {service} ist am {date}.", from: "FitsMyTime" },
  hi: { subject: "\u0905\u092A\u0949\u0907\u0902\u091F\u092E\u0947\u0902\u091F \u0905\u092A\u0921\u0947\u091F", accepted: "{date} \u0915\u094B \u0906\u092A\u0915\u0940 \u0905\u0928\u0941\u0930\u094B\u0927\u093F\u0924 \u0938\u0947\u0935\u093E {service} \u0938\u094D\u0935\u0940\u0915\u093E\u0930 \u0915\u0930 \u0932\u0940 \u0917\u0908 \u0939\u0948\u0964", rejected: "{date} \u0915\u094B \u0906\u092A\u0915\u0940 \u0905\u0928\u0941\u0930\u094B\u0927\u093F\u0924 \u0938\u0947\u0935\u093E {service} \u0905\u0938\u094D\u0935\u0940\u0915\u093E\u0930 \u0915\u0930 \u0926\u0940 \u0917\u0908 \u0939\u0948\u0964", rescheduled: "\u0906\u092A\u0915\u0940 \u0938\u0947\u0935\u093E {service} \u0915\u093E \u0938\u092E\u092F {old} \u0938\u0947 {date} \u0915\u0930 \u0926\u093F\u092F\u093E \u0917\u092F\u093E \u0939\u0948\u0964", reminder: "\u0930\u093F\u092E\u093E\u0907\u0902\u0921\u0930: \u0938\u0947\u0935\u093E {service} \u0915\u0947 \u0932\u093F\u090F \u0906\u092A\u0915\u093E \u0905\u092A\u0949\u0907\u0902\u091F\u092E\u0947\u0902\u091F {date} \u0915\u094B \u0939\u0948\u0964", from: "FitsMyTime" },
  ja: { subject: "\u4E88\u7D04\u306E\u66F4\u65B0", accepted: "\u3054\u4F9D\u983C\u306E\u30B5\u30FC\u30D3\u30B9 {service}\uFF08{date}\uFF09\u304C\u627F\u8A8D\u3055\u308C\u307E\u3057\u305F\u3002", rejected: "\u3054\u4F9D\u983C\u306E\u30B5\u30FC\u30D3\u30B9 {service}\uFF08{date}\uFF09\u306F\u5374\u4E0B\u3055\u308C\u307E\u3057\u305F\u3002", rescheduled: "\u30B5\u30FC\u30D3\u30B9 {service} \u306E\u4E88\u7D04\u304C {old} \u304B\u3089 {date} \u306B\u5909\u66F4\u3055\u308C\u307E\u3057\u305F\u3002", reminder: "\u30EA\u30DE\u30A4\u30F3\u30C0\u30FC\uFF1A\u30B5\u30FC\u30D3\u30B9 {service} \u306E\u3054\u4E88\u7D04\u306F {date} \u3067\u3059\u3002", from: "FitsMyTime" },
  pt: { subject: "Atualiza\xE7\xE3o do agendamento", accepted: "O servi\xE7o solicitado {service} em {date} foi aceite.", rejected: "O servi\xE7o solicitado {service} em {date} foi recusado.", rescheduled: "O servi\xE7o {service} foi reagendado de {old} para {date}.", reminder: "Lembrete: o seu agendamento para {service} \xE9 em {date}.", from: "FitsMyTime" },
  es: { subject: "Actualizaci\xF3n de la cita", accepted: "Su solicitud del servicio {service} el {date} ha sido aceptada.", rejected: "Su solicitud del servicio {service} el {date} ha sido rechazada.", rescheduled: "Su servicio {service} se ha reprogramado del {old} al {date}.", reminder: "Recordatorio: su cita para {service} es el {date}.", from: "FitsMyTime" }
};
function renderMessage(input) {
  const language = copy[input.language] ? input.language : "en", words = copy[language];
  const format = (value) => `${new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short", hourCycle: "h23", timeZone: input.timeZone }).format(value)} (${input.timeZone})`;
  const replacements = { service: input.service.slice(0, 250), date: format(input.date), old: input.oldDate ? format(input.oldDate) : "" };
  const text3 = words[input.kind].replace(/\{(service|date|old)\}/g, (_match, key) => replacements[key]);
  return { subject: words.subject, message: `${text3}
${words.from}`, date: format(input.date), oldDate: input.oldDate ? format(input.oldDate) : "" };
}
function manualPreview(input) {
  const channels = {};
  for (const channel of ["email", "sms", "whatsapp"]) {
    const reasonCode = channelReason(channel, input.preferences, input.email);
    const href = reasonCode ? null : channel === "email" ? `mailto:${encodeURIComponent(input.email)}?subject=${encodeURIComponent(input.subject)}&body=${encodeURIComponent(input.message)}` : channel === "sms" ? `sms:${input.preferences.phone}?body=${encodeURIComponent(input.message)}` : `https://wa.me/${input.preferences.phone.slice(1)}?text=${encodeURIComponent(input.message)}`;
    channels[channel] = { href, reasonCode };
  }
  return { customerName: input.customerName, subject: input.subject, message: input.message, channels };
}
function deliveryTransition(current, next) {
  if (current === "delivered" || current === "cancelled" || current === "skipped") return current;
  if (next === "delivered") return "delivered";
  if (current === "failed" && next === "accepted") return current;
  return next;
}

// server/notifications/transports.ts
import { createHash as createHash2, createHmac, randomUUID as randomUUID2, sign, timingSafeEqual } from "node:crypto";
function notificationConfig(env = process.env) {
  const enabled = env.NOTIFICATIONS_ENABLED === "true";
  const config = {
    enabled,
    automationEnabled: enabled && env.NOTIFICATIONS_AUTOMATION_ENABLED === "true",
    applicationId: env.VONAGE_APPLICATION_ID ?? "",
    privateKey: (env.VONAGE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    apiKey: env.VONAGE_API_KEY ?? "",
    signatureSecret: env.VONAGE_SIGNATURE_SECRET ?? "",
    smsFrom: env.VONAGE_SMS_FROM ?? "",
    whatsappFrom: env.VONAGE_WHATSAPP_FROM ?? "",
    whatsappTemplates: env.VONAGE_WHATSAPP_TEMPLATES_JSON ?? "{}",
    resendKey: env.RESEND_API_KEY ?? "",
    emailFrom: env.NOTIFICATIONS_EMAIL_FROM ?? "",
    resendSecret: env.NOTIFICATIONS_RESEND_WEBHOOK_SECRET ?? "",
    verificationEnabled: enabled && env.NOTIFICATIONS_VERIFICATION_ENABLED === "true"
  };
  return config;
}
function templateFor(config, language, kind) {
  try {
    const value = JSON.parse(config.whatsappTemplates)[`${language}:${kind}`];
    return value && [value.name, value.language, value.namespace].every((v) => typeof v === "string" && /^[a-zA-Z0-9_-]{1,150}$/.test(v)) ? value : null;
  } catch {
    return null;
  }
}
function transportReady(config, channel, language = "en", kind = "reminder") {
  if (!config.automationEnabled) return false;
  if (channel === "email") return Boolean(config.resendKey && config.emailFrom && config.resendSecret);
  const common = Boolean(config.applicationId && config.privateKey && config.apiKey && config.signatureSecret);
  return common && (channel === "sms" ? Boolean(config.smsFrom) : Boolean(config.whatsappFrom && templateFor(config, language, kind)));
}
function verificationReady(config) {
  return config.verificationEnabled && Boolean(config.applicationId && config.privateKey);
}
function jwt(config) {
  const now = Math.floor(Date.now() / 1e3), head = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ application_id: config.applicationId, iat: now, exp: now + 120, jti: randomUUID2() })).toString("base64url");
  return `${head}.${payload}.${sign("RSA-SHA256", Buffer.from(`${head}.${payload}`), config.privateKey).toString("base64url")}`;
}
var TransportError = class extends Error {
  constructor(outcome, code) {
    super(code);
    this.outcome = outcome;
    this.code = code;
  }
};
function createTransports(config, fetcher = fetch) {
  async function post(url, auth, body, idempotencyKey) {
    try {
      const response = await fetcher(url, { method: "POST", redirect: "error", signal: AbortSignal.timeout(1e4), headers: {
        Authorization: `Bearer ${auth}`,
        "Content-Type": "application/json",
        ...idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}
      }, body: JSON.stringify(body) });
      if (!response.ok) {
        await response.body?.cancel();
        throw new TransportError(response.status >= 500 ? "unknown" : "failed", response.status === 429 ? "rate_limited" : "provider_rejected");
      }
      const reader = response.body?.getReader();
      if (!reader) throw new TransportError("unknown", "invalid_response");
      const parts2 = [];
      let size = 0;
      for (; ; ) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 16384) {
          await reader.cancel();
          throw new TransportError("unknown", "invalid_response");
        }
        parts2.push(value);
      }
      return JSON.parse(Buffer.concat(parts2).toString("utf8"));
    } catch (error) {
      if (error instanceof TransportError) throw error;
      throw new TransportError("unknown", "transport_unknown");
    }
  }
  return {
    async startVerification(phone) {
      if (!verificationReady(config)) throw new TransportError("failed", "not_configured");
      const result = await post("https://api.nexmo.com/v2/verify", jwt(config), { brand: "FitsMyTime", code_length: 6, channel_timeout: 300, workflow: [{ channel: "sms", to: phone.slice(1) }] });
      if (typeof result.request_id !== "string" || !/^[a-f0-9-]{36}$/i.test(result.request_id)) throw new TransportError("unknown", "invalid_response");
      return result.request_id;
    },
    async checkVerification(requestId, code) {
      const result = await post(`https://api.nexmo.com/v2/verify/${encodeURIComponent(requestId)}`, jwt(config), { code });
      return result.status === "completed" && result.request_id === requestId;
    },
    async send(input) {
      if (!transportReady(config, input.channel, input.language, input.kind)) throw new TransportError("failed", "not_configured");
      if (input.channel === "email") {
        const result2 = await post("https://api.resend.com/emails", config.resendKey, { from: config.emailFrom, to: [input.recipient], subject: input.subject, text: input.message }, input.jobId);
        if (typeof result2.id !== "string" || result2.id.length > 255) throw new TransportError("unknown", "invalid_response");
        return { provider: "resend", messageId: result2.id };
      }
      const template = templateFor(config, input.language, input.kind);
      const message = input.channel === "sms" ? { channel: "sms", message_type: "text", text: input.message, from: config.smsFrom } : {
        channel: "whatsapp",
        message_type: "template",
        from: config.whatsappFrom,
        whatsapp: { policy: "deterministic", locale: template.language },
        template: { name: `${template.namespace}:${template.name}`, parameters: [input.service, input.date, ...input.kind === "rescheduled" ? [input.oldDate] : []] }
      };
      const result = await post("https://api.nexmo.com/v1/messages", jwt(config), { ...message, to: input.recipient.replace(/^\+/, ""), client_ref: input.jobId });
      if (typeof result.message_uuid !== "string" || result.message_uuid.length > 255) throw new TransportError("unknown", "invalid_response");
      return { provider: "vonage", messageId: result.message_uuid };
    }
  };
}
function equal(a, b) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
function verifyVonage(raw2, authorization, config, now = Date.now()) {
  try {
    if (!config.signatureSecret || authorization.length > 8192) return null;
    const token = authorization.replace(/^Bearer /, "");
    const parts2 = token.split(".");
    if (parts2.length !== 3) return null;
    const header = JSON.parse(Buffer.from(parts2[0], "base64url").toString()), data = JSON.parse(Buffer.from(parts2[1], "base64url").toString());
    if (header.alg !== "HS256" || !equal(createHmac("sha256", config.signatureSecret).update(`${parts2[0]}.${parts2[1]}`).digest("base64url"), parts2[2])) return null;
    if (data.iss !== "Vonage" || data.api_key !== config.apiKey || data.application_id && data.application_id !== config.applicationId || typeof data.iat !== "number" || Math.abs(now / 1e3 - data.iat) > 300 || typeof data.jti !== "string" || data.jti.length > 255 || !equal(createHash2("sha256").update(raw2).digest("hex"), data.payload_hash ?? "")) return null;
    return data.jti;
  } catch {
    return null;
  }
}
function verifyResend(raw2, headers, secret, now = Date.now()) {
  if (!secret || !headers.id || headers.id.length > 255 || !/^\d{10}$/.test(headers.timestamp) || Math.abs(now / 1e3 - Number(headers.timestamp)) > 300 || headers.signature.length > 4096) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${headers.id}.${headers.timestamp}.`).update(raw2).digest("base64");
  return headers.signature.split(" ").some((value) => value.startsWith("v1,") && equal(value.slice(3), expected));
}

// server/notifications/repository.ts
async function workspacePro(database, workspace, now = Date.now()) {
  if (workspace.companyId != null) {
    const [company] = await database.select({ active: companies.isActive }).from(companies).where(eq5(companies.id, workspace.companyId));
    if (!company?.active) return false;
  }
  const [subscription] = await database.select().from(providerSubscriptions).where(workspace.companyId != null ? eq5(providerSubscriptions.companyId, workspace.companyId) : and4(eq5(providerSubscriptions.userId, workspace.providerId), isNull4(providerSubscriptions.companyId)));
  return hasPro(subscription ?? null, now);
}
async function assertReminderConfiguration(database, workspace, updates, previous) {
  const changed = previous ? updates.reminderEnabled !== void 0 && updates.reminderEnabled !== previous.reminderEnabled || updates.reminderMethod !== void 0 && updates.reminderMethod !== previous.reminderMethod || updates.reminderHours !== void 0 && updates.reminderHours !== previous.reminderHours : updates.reminderEnabled === true || updates.reminderMethod !== void 0 && updates.reminderMethod !== "email" || updates.reminderHours !== void 0 && updates.reminderHours !== 24;
  if (changed && !await workspacePro(database, workspace)) throw new NotificationError(403, "pro_required", "An active PRO subscription is required to change automatic reminders.");
}
async function preferencesFor(database, userId) {
  const [preferences] = await database.select().from(userCommunicationPreferences).where(eq5(userCommunicationPreferences.userId, userId));
  return preferences ?? { ...defaultPreferences, userId };
}
async function captureStatusEvent(database, booking, kind, timeZone, previousDate) {
  if (!notificationConfig().enabled) return { mode: "none", reasonCode: "feature_disabled" };
  const automatic = await workspacePro(database, booking);
  const [event] = await database.insert(notificationEvents).values({
    id: randomUUID3(),
    bookingId: booking.id,
    bookingRevision: booking.notificationRevision,
    kind,
    scheduledDate: booking.scheduledDate,
    previousScheduledDate: previousDate,
    timezone: timeZone,
    automatic
  }).onConflictDoNothing().returning();
  if (!event) return { mode: "none" };
  let state = "manual", reasonCode = null;
  if (automatic) {
    const prefs = await preferencesFor(database, booking.seekerId);
    const [customer] = await database.select({ email: users.email }).from(users).where(eq5(users.id, booking.seekerId));
    const channel = prefs.preferredMethod ?? "email";
    reasonCode = channelReason(channel, prefs, customer?.email ?? null) ?? (transportReady(notificationConfig(), channel, prefs.language, kind) ? null : "not_configured");
    state = reasonCode ? "skipped" : "queued";
    await database.insert(notificationJobs).values({ id: randomUUID3(), eventId: event.id, channel, state: reasonCode ? "skipped" : "queued", reasonCode, dueAt: /* @__PURE__ */ new Date(), expiresAt: new Date(Date.now() + 30 * 6e4) });
  }
  return { mode: automatic ? "automatic" : "manual", eventId: event.id, state, reasonCode };
}
async function reconcileBookingReminder(database, booking, now = /* @__PURE__ */ new Date(), timeZone, recalculate = false) {
  if (!notificationConfig().enabled) return;
  const [service] = await database.select().from(services).where(eq5(services.id, booking.serviceId));
  await database.update(notificationJobs).set({ state: "cancelled", reasonCode: "booking_changed", updatedAt: now, leaseToken: null, leaseUntil: null }).where(and4(inArray2(notificationJobs.state, ["queued", "leased"]), isNull4(notificationJobs.attemptedAt), inArray2(
    notificationJobs.eventId,
    database.select({ id: notificationEvents.id }).from(notificationEvents).where(and4(
      eq5(notificationEvents.bookingId, booking.id),
      eq5(notificationEvents.kind, "reminder"),
      booking.status === "confirmed" && service?.reminderEnabled ? ne(notificationEvents.scheduledDate, booking.scheduledDate) : void 0
    ))
  )));
  if (!service?.reminderEnabled || booking.status !== "confirmed" || booking.scheduledDate <= now || !await workspacePro(database, booking, now.getTime())) return;
  const dueAt = reminderDue(booking.scheduledDate, service.reminderHours, now);
  const [existing] = await database.select({ event: notificationEvents, job: notificationJobs }).from(notificationEvents).leftJoin(notificationJobs, eq5(notificationJobs.eventId, notificationEvents.id)).where(and4(eq5(notificationEvents.bookingId, booking.id), eq5(notificationEvents.kind, "reminder"), eq5(notificationEvents.scheduledDate, booking.scheduledDate)));
  if (existing?.job?.attemptedAt) return;
  if (!recalculate && existing?.job && (existing.job.state === "queued" || existing.job.state === "leased")) return;
  if (!dueAt) {
    if (existing?.job) await database.update(notificationJobs).set({ state: "skipped", reasonCode: "past_due", updatedAt: now, leaseToken: null, leaseUntil: null }).where(and4(eq5(notificationJobs.id, existing.job.id), isNull4(notificationJobs.attemptedAt)));
    return;
  }
  const prefs = await preferencesFor(database, booking.seekerId), channel = prefs.preferredMethod ?? service.reminderMethod;
  let event = existing?.event;
  if (!event) {
    if (!timeZone) {
      const [previousEvent] = await database.select({ timezone: notificationEvents.timezone }).from(notificationEvents).where(eq5(notificationEvents.bookingId, booking.id)).orderBy(desc(notificationEvents.createdAt)).limit(1);
      const [schedule] = previousEvent ? [] : await database.select({ timezone: availability.timezone }).from(availability).where(and4(
        eq5(availability.isActive, true),
        booking.companyId != null ? eq5(availability.companyId, booking.companyId) : and4(eq5(availability.providerId, booking.providerId), isNull4(availability.companyId)),
        or2(eq5(availability.serviceId, booking.serviceId), isNull4(availability.serviceId))
      )).orderBy(desc(availability.serviceId)).limit(1);
      timeZone = previousEvent?.timezone ?? schedule?.timezone ?? "UTC";
    }
    [event] = await database.insert(notificationEvents).values({
      id: randomUUID3(),
      bookingId: booking.id,
      bookingRevision: booking.notificationRevision,
      kind: "reminder",
      scheduledDate: booking.scheduledDate,
      timezone: timeZone,
      automatic: true
    }).onConflictDoNothing().returning();
    if (!event) return;
  }
  if (existing?.job?.state === "queued" && existing.job.dueAt.getTime() === dueAt.getTime() && existing.job.channel === channel) return;
  await database.insert(notificationJobs).values({ id: randomUUID3(), eventId: event.id, channel, state: "queued", dueAt, expiresAt: new Date(dueAt.getTime() + 3e5) }).onConflictDoUpdate({
    target: notificationJobs.eventId,
    set: { channel, state: "queued", dueAt, expiresAt: new Date(dueAt.getTime() + 3e5), reasonCode: null, leaseToken: null, leaseUntil: null, updatedAt: now },
    setWhere: and4(isNull4(notificationJobs.attemptedAt), inArray2(notificationJobs.state, ["queued", "leased", "cancelled", "skipped"]))
  });
}
async function reconcileServiceReminders(database, serviceId2) {
  if (!notificationConfig().enabled) return;
  const rows = await database.select().from(bookings).where(and4(eq5(bookings.serviceId, serviceId2), gt2(bookings.scheduledDate, /* @__PURE__ */ new Date()))).orderBy(asc3(bookings.id)).for("update");
  for (const booking of rows) await reconcileBookingReminder(database, booking, /* @__PURE__ */ new Date(), void 0, true);
}
async function bookingNotificationState(database, booking) {
  const pro = await workspacePro(database, booking);
  const [status] = await database.select({ event: notificationEvents, job: notificationJobs }).from(notificationEvents).leftJoin(notificationJobs, eq5(notificationJobs.eventId, notificationEvents.id)).where(and4(eq5(notificationEvents.bookingId, booking.id), ne(notificationEvents.kind, "reminder"))).orderBy(desc(notificationEvents.createdAt)).limit(1);
  const [reminder] = await database.select({ event: notificationEvents, job: notificationJobs }).from(notificationEvents).leftJoin(notificationJobs, eq5(notificationJobs.eventId, notificationEvents.id)).where(and4(eq5(notificationEvents.bookingId, booking.id), eq5(notificationEvents.kind, "reminder"), eq5(notificationEvents.scheduledDate, booking.scheduledDate))).limit(1);
  const [service] = await database.select().from(services).where(eq5(services.id, booking.serviceId));
  const job = reminder?.job;
  const preferences = job ? await preferencesFor(database, booking.seekerId) : null;
  const [customer] = job && !job.attemptedAt ? await database.select({ email: users.email }).from(users).where(eq5(users.id, booking.seekerId)) : [];
  return {
    notification: status ? { mode: status.event.automatic ? "automatic" : "manual", eventId: status.event.id, state: status.job?.state ?? "manual", reasonCode: status.job?.reasonCode } : { mode: "none" },
    reminder: summarizeReminder(pro, service, job, preferences, customer?.email ?? null)
  };
}
function summarizeReminder(pro, service, job, preferences, email) {
  const channel = job?.attemptedAt ? job.channel : preferences?.preferredMethod ?? service?.reminderMethod ?? job?.channel;
  const unavailableReason = job && !job.attemptedAt && channel && preferences ? channelReason(channel, preferences, email) ?? (transportReady(notificationConfig(), channel, preferences.language, "reminder") ? null : "not_configured") : null;
  const state = job?.state === "delivered" || job?.state === "accepted" ? "sent" : job?.state === "failed" || job?.state === "unknown" ? "failed" : !service?.reminderEnabled ? "off" : !pro ? "paused" : !notificationConfig().automationEnabled || unavailableReason ? "unavailable" : job?.state === "queued" || job?.state === "leased" ? "scheduled" : "unavailable";
  return { state, ...job ? { dueAt: job.dueAt.toISOString(), channel, reasonCode: unavailableReason ?? job.reasonCode } : {} };
}
async function bookingReminderSummaries(database, rows) {
  const result = /* @__PURE__ */ new Map();
  if (!rows.length) return result;
  const pro = await workspacePro(database, rows[0]);
  for (let offset = 0; offset < rows.length; offset += 200) {
    const batch = rows.slice(offset, offset + 200);
    const events = await database.select({ event: notificationEvents, job: notificationJobs }).from(notificationEvents).leftJoin(notificationJobs, eq5(notificationJobs.eventId, notificationEvents.id)).where(and4(inArray2(notificationEvents.bookingId, batch.map((booking) => booking.id)), eq5(notificationEvents.kind, "reminder")));
    const preferences = await database.select().from(userCommunicationPreferences).where(inArray2(userCommunicationPreferences.userId, Array.from(new Set(batch.map((booking) => booking.seekerId)))));
    const preferencesByUser = new Map(preferences.map((value) => [value.userId, value]));
    const jobsByInstant = new Map(events.map((value) => [`${value.event.bookingId}:${value.event.scheduledDate.toISOString()}`, value.job]));
    for (const booking of batch) result.set(booking.id, summarizeReminder(
      pro,
      booking.service,
      jobsByInstant.get(`${booking.id}:${booking.scheduledDate.toISOString()}`),
      preferencesByUser.get(booking.seekerId) ?? defaultPreferences,
      booking.seeker.email
    ));
  }
  return result;
}

// server/storage.ts
import { randomUUID as randomUUID4 } from "node:crypto";
function searchDurationLimit(filters) {
  if (!filters.time && !filters.timeEnd) return void 0;
  const minutes2 = (time2) => Number(time2.slice(0, 2)) * 60 + Number(time2.slice(3, 5));
  return minutes2(filters.timeEnd ?? "23:59") - minutes2(filters.time ?? "00:00");
}
function searchDistance(filters) {
  if (filters.latitude === void 0 || filters.longitude === void 0) return void 0;
  const radians = sql5`pi() / 180`;
  const a = sql5`least(1.0, greatest(0.0,
    power(sin((${addresses.latitude} - ${filters.latitude}) * ${radians} / 2), 2)
    + cos(${filters.latitude} * ${radians}) * cos(${addresses.latitude} * ${radians})
    * power(sin((${addresses.longitude} - ${filters.longitude}) * ${radians} / 2), 2)))`;
  return sql5`CASE WHEN ${addresses.latitude} IS NOT NULL AND ${addresses.longitude} IS NOT NULL
    AND (${addresses.locationSource} IS DISTINCT FROM 'google' OR ${addresses.locationExpiresAt} > now())
    THEN (6371 * 2 * atan2(sqrt(${a}), sqrt(1 - ${a})))::float8 END`;
}
function publicSearchConditions(filters) {
  const conditions = [eq6(services.isActive, true), sql5`(${companies.id} IS NULL OR ${companies.isActive} = true)`];
  const durationLimit = searchDurationLimit(filters);
  if (durationLimit !== void 0) conditions.push(lte(services.duration, durationLimit));
  if (filters.companyId !== void 0) conditions.push(eq6(services.companyId, filters.companyId));
  if (filters.providerId !== void 0) conditions.push(eq6(services.providerId, filters.providerId), isNull5(services.companyId));
  if (filters.serviceIds) conditions.push(inArray3(services.id, filters.serviceIds));
  if (filters.category) conditions.push(eq6(services.category, filters.category));
  if (filters.serviceType) conditions.push(eq6(services.serviceType, filters.serviceType));
  if (filters.ageGroups?.length) conditions.push(sql5`${services.ageGroups} ?| ARRAY[${sql5.join(filters.ageGroups.map((group) => sql5`${group}`), sql5`, `)}]::text[]`);
  if (filters.searchQuery?.trim()) {
    const term = `%${filters.searchQuery.trim().toLowerCase()}%`;
    conditions.push(sql5`(LOWER(${services.name}) LIKE ${term} OR LOWER(${services.description}) LIKE ${term}
      OR LOWER(${companies.name}) LIKE ${term} OR (${employees.showName} = true AND LOWER(${employees.name}) LIKE ${term}))`);
  }
  const distance = searchDistance(filters);
  if (distance && filters.radius !== void 0) conditions.push(sql5`${distance} <= ${filters.radius}`);
  return conditions;
}
var workspaceKey = (item) => item.companyId != null ? `company:${item.companyId}` : `user:${item.providerId}`;
var reviewStats = db.select({
  serviceId: bookings.serviceId,
  rating: sql5`avg(${serviceReviews.rating})::float8`.as("rating"),
  reviewCount: sql5`count(*)::int`.as("review_count")
}).from(serviceReviews).innerJoin(bookings, eq6(serviceReviews.bookingId, bookings.id)).groupBy(bookings.serviceId).as("review_stats");
var BookingConflictError = class extends Error {
};
async function assertResourceAvailable(tx, service, candidate) {
  const start = candidate.scheduledDate;
  const end = new Date(start.getTime() + (candidate.bookingDuration + candidate.bookingCleanupTime) * 6e4);
  const overlapping = await tx.select({ booking: bookings, duration: services.duration }).from(bookings).leftJoin(services, eq6(bookings.serviceId, services.id)).where(and5(
    candidate.id === void 0 ? void 0 : ne2(bookings.id, candidate.id),
    eq6(bookings.providerId, candidate.providerId),
    inArray3(bookings.status, [...OCCUPYING_BOOKING_STATUSES]),
    candidate.employeeId != null ? eq6(bookings.employeeId, candidate.employeeId) : isNull5(bookings.employeeId),
    sql5`${bookings.scheduledDate} < ${end.toISOString()}::timestamp`,
    sql5`${bookings.scheduledDate} + (COALESCE(${bookings.bookingDuration}, ${services.duration}, 60) + COALESCE(${bookings.bookingCleanupTime}, 0)) * interval '1 minute' > ${start.toISOString()}::timestamp`
  ));
  const count = candidate.participantCount ?? 1;
  const remaining = availableCapacity(
    { ...service, duration: candidate.bookingDuration, cleanupTime: candidate.bookingCleanupTime },
    overlapping.map((row) => ({ ...row.booking, bookingDuration: row.booking.bookingDuration ?? row.duration ?? 60 })),
    start
  );
  if (!Number.isInteger(count) || count < 1 || count > remaining) throw new BookingConflictError("This time slot is no longer available.");
}
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Math.round(distance * 10) / 10;
}
var DatabaseStorage = class {
  // User operations
  async getUser(id2) {
    const [user] = await db.select().from(users).where(eq6(users.id, id2));
    return user;
  }
  async upsertUser(userData) {
    const [user] = await db.insert(users).values(userData).onConflictDoUpdate({
      target: users.id,
      set: {
        ...userData,
        updatedAt: /* @__PURE__ */ new Date()
      }
    }).returning();
    return user;
  }
  async updateUserNames(id2, names) {
    const [user] = await db.update(users).set({
      firstName: names.firstName || null,
      lastName: names.lastName || null,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq6(users.id, id2)).returning();
    return user;
  }
  async updateUserRole(id2, role, audit) {
    if (audit) return db.transaction(async (tx) => {
      assertAuditContext(audit);
      const [previous] = await tx.select().from(users).where(eq6(users.id, id2)).for("update");
      if (!previous || audit.actor.kind !== "user" || audit.actor.userId !== id2) throw new Error("Account unavailable");
      if (previous.currentRole !== "seeker" && previous.currentRole !== "provider") throw new AuditCaptureUnavailable();
      const [user2] = await tx.update(users).set({ currentRole: role, updatedAt: /* @__PURE__ */ new Date() }).where(eq6(users.id, id2)).returning();
      const before = previous.currentRole;
      const actionContext = createAuditContext({ ...audit, actor: { ...audit.actor, effectiveRole: before } });
      const event = createAuditEvent(actionContext, {
        eventName: "account.active_role_changed.v1",
        outcome: "succeeded",
        ...before === role ? { reasonCode: "NO_CHANGE" } : {},
        changes: before === role ? [] : [{ field: "currentRole", before, after: role }]
      });
      await enqueueDrizzleAudit(tx, event);
      return user2;
    });
    const [user] = await db.update(users).set({ currentRole: role, updatedAt: /* @__PURE__ */ new Date() }).where(eq6(users.id, id2)).returning();
    return user;
  }
  // Service operations
  async updateProviderProfile(id2, profile) {
    const [user] = await db.update(users).set({ ...profile, updatedAt: /* @__PURE__ */ new Date() }).where(eq6(users.id, id2)).returning();
    return user;
  }
  async getEmployees(providerId2, companyId) {
    return db.select().from(employees).where(companyId != null ? eq6(employees.companyId, companyId) : and5(eq6(employees.providerId, providerId2), isNull5(employees.companyId))).orderBy(asc4(employees.name));
  }
  async saveEmployee(providerId2, employee, id2, companyId) {
    if (id2 !== void 0) {
      const [updated] = await db.update(employees).set({ ...employee, updatedAt: /* @__PURE__ */ new Date() }).where(and5(eq6(employees.id, id2), companyId != null ? eq6(employees.companyId, companyId) : and5(eq6(employees.providerId, providerId2), isNull5(employees.companyId)))).returning();
      return updated;
    }
    const [created] = await db.insert(employees).values({ ...employee, providerId: providerId2, companyId }).returning();
    return created;
  }
  async deleteEmployee(providerId2, id2, companyId) {
    const removed = await db.delete(employees).where(and5(eq6(employees.id, id2), companyId != null ? eq6(employees.companyId, companyId) : and5(eq6(employees.providerId, providerId2), isNull5(employees.companyId)))).returning();
    return removed.length > 0;
  }
  async createService(service) {
    service = { ...service, ...serviceMoneyChanges(service) };
    const newService = await db.transaction(async (tx) => {
      await assertReminderConfiguration(tx, service, service);
      const [created] = await tx.insert(services).values(service).returning();
      return created;
    });
    return serviceLocation(newService, newService.addressId == null ? null : (await db.select().from(addresses).where(eq6(addresses.id, newService.addressId)))[0]);
  }
  async copyService(serviceId2, providerId2, companyId) {
    const copy2 = await db.transaction(async (tx) => {
      const [source] = await tx.select().from(services).where(and5(eq6(services.id, serviceId2), companyId != null ? eq6(services.companyId, companyId) : and5(eq6(services.providerId, providerId2), isNull5(services.companyId))));
      if (!source) return void 0;
      const { id: id2, createdAt, updatedAt, ...listing } = source;
      const [copy3] = await tx.insert(services).values({
        ...listing,
        name: `${source.name} (copy)`,
        isActive: false,
        reminderEnabled: false
      }).returning();
      return copy3;
    });
    return copy2 ? serviceLocation(copy2, copy2.addressId == null ? null : (await db.select().from(addresses).where(eq6(addresses.id, copy2.addressId)))[0]) : void 0;
  }
  async getServicesByProvider(providerId2, companyId) {
    const rows = await db.select().from(services).leftJoin(addresses, eq6(services.addressId, addresses.id)).where(companyId != null ? eq6(services.companyId, companyId) : and5(eq6(services.providerId, providerId2), isNull5(services.companyId))).orderBy(desc2(services.createdAt));
    return rows.map((row) => serviceLocation(row.services, row.addresses));
  }
  async getServiceById(id2) {
    const [result] = await db.select().from(services).leftJoin(addresses, eq6(services.addressId, addresses.id)).leftJoin(users, eq6(services.providerId, users.id)).leftJoin(employees, eq6(services.employeeId, employees.id)).leftJoin(companies, eq6(services.companyId, companies.id)).leftJoin(reviewStats, eq6(services.id, reviewStats.serviceId)).where(eq6(services.id, id2));
    if (!result) return void 0;
    const slugs = await storefrontStore.slugs([result.services]);
    return {
      ...serviceLocation(result.services, result.addresses),
      storefrontSlug: slugs.get(result.services.companyId != null ? `company:${result.services.companyId}` : `user:${result.services.providerId}`) ?? null,
      rating: result.review_stats?.rating ?? null,
      reviewCount: result.review_stats?.reviewCount ?? 0,
      provider: publicProvider(result.users, result.companies),
      companyActive: result.companies?.isActive ?? true,
      employee: result.employees ? { id: result.employees.id, name: result.employees.showName ? result.employees.name : null } : null
    };
  }
  async updateService(id2, updates) {
    const service = await db.transaction(async (tx) => {
      const [previous] = await tx.select().from(services).where(eq6(services.id, id2)).for("update");
      if (!previous) throw new BookingConflictError("Service not found.");
      updates = { ...updates, ...serviceMoneyChanges(updates, previous) };
      await assertReminderConfiguration(tx, previous, updates, previous);
      const [updated] = await tx.update(services).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq6(services.id, id2)).returning();
      if (updated.reminderEnabled !== previous.reminderEnabled || updated.reminderMethod !== previous.reminderMethod || updated.reminderHours !== previous.reminderHours) await reconcileServiceReminders(tx, id2);
      return updated;
    });
    return serviceLocation(service, service.addressId == null ? null : (await db.select().from(addresses).where(eq6(addresses.id, service.addressId)))[0]);
  }
  async deleteService(id2) {
    await db.delete(services).where(eq6(services.id, id2));
  }
  async searchServices(filters) {
    filters = searchFiltersSchema.parse(filters);
    if (filters.serviceIds?.length === 0) return [];
    const conditions = publicSearchConditions(filters);
    const distance = searchDistance(filters);
    const bounded = filters.companyId === void 0 && filters.providerId === void 0;
    const query = db.select().from(services).leftJoin(addresses, eq6(services.addressId, addresses.id)).leftJoin(users, eq6(services.providerId, users.id)).leftJoin(employees, eq6(services.employeeId, employees.id)).leftJoin(companies, eq6(services.companyId, companies.id)).leftJoin(reviewStats, eq6(services.id, reviewStats.serviceId)).where(and5(...conditions)).orderBy(...distance ? [asc4(distance)] : [], desc2(services.createdAt), desc2(services.id));
    const queryLimit = filters.limit && !filters.availableOnly ? filters.limit : MAX_SEARCH_CANDIDATES + 1;
    const results = bounded ? await query.limit(queryLimit) : await query;
    if (bounded) assertSearchSize(results.length);
    const slugs = await storefrontStore.slugs(results.map((result) => result.services));
    let servicesWithProviders = results.map((result) => ({
      ...serviceLocation(result.services, result.addresses),
      storefrontSlug: slugs.get(result.services.companyId != null ? `company:${result.services.companyId}` : `user:${result.services.providerId}`) ?? null,
      rating: result.review_stats?.rating ?? null,
      reviewCount: result.review_stats?.reviewCount ?? 0,
      provider: publicProvider(result.users, result.companies),
      companyActive: result.companies?.isActive ?? true,
      employee: result.employees ? { id: result.employees.id, name: result.employees.showName ? result.employees.name : null } : null
    }));
    const durationLimit = searchDurationLimit(filters);
    if (durationLimit !== void 0) servicesWithProviders = servicesWithProviders.filter((service) => service.duration <= durationLimit);
    if (filters.ageGroups && filters.ageGroups.length > 0) {
      servicesWithProviders = servicesWithProviders.filter((service) => {
        if (!service.ageGroups || service.ageGroups.length === 0) return false;
        return filters.ageGroups.some((ag) => service.ageGroups?.includes(ag));
      });
    }
    if (filters.latitude !== void 0 && filters.longitude !== void 0) {
      servicesWithProviders = servicesWithProviders.map((service) => {
        let distance2;
        if (service.latitude !== null && service.longitude !== null) {
          distance2 = calculateDistance(
            filters.latitude,
            filters.longitude,
            service.latitude,
            service.longitude
          );
        }
        return {
          ...service,
          distance: distance2
        };
      });
      if (filters.radius !== void 0) {
        servicesWithProviders = servicesWithProviders.filter(
          (service) => service.distance !== void 0 && service.distance <= filters.radius
        );
      }
      servicesWithProviders.sort((a, b) => {
        if (a.distance === void 0) return 1;
        if (b.distance === void 0) return -1;
        return a.distance - b.distance;
      });
    }
    if (filters.availableOnly && filters.date) {
      const startDate = new Date(filters.date);
      const endDate = filters.dateEnd ? new Date(filters.dateEnd) : startDate;
      if (!servicesWithProviders.length) return [];
      const companyIds = Array.from(new Set(servicesWithProviders.flatMap((service) => service.companyId == null ? [] : [service.companyId])));
      const personalIds = Array.from(new Set(servicesWithProviders.filter((service) => service.companyId == null).map((service) => service.providerId)));
      const allAvailability = await db.select().from(availability).where(and5(
        eq6(availability.isActive, true),
        or3(
          companyIds.length ? inArray3(availability.companyId, companyIds) : void 0,
          personalIds.length ? and5(isNull5(availability.companyId), inArray3(availability.providerId, personalIds)) : void 0
        ),
        or3(isNull5(availability.serviceId), inArray3(availability.serviceId, servicesWithProviders.map((service) => service.id))),
        or3(eq6(availability.scheduleType, "recurring"), and5(
          eq6(availability.scheduleType, "specific"),
          sql5`${availability.specificDate} >= ${filters.date}::date`,
          sql5`${availability.specificDate} < ${filters.dateEnd ?? filters.date}::date + interval '1 day'`
        ))
      )).orderBy(asc4(availability.id)).limit(MAX_SEARCH_SCHEDULES + 1);
      assertSearchSize(allAvailability.length, MAX_SEARCH_SCHEDULES);
      const providerAvailability = /* @__PURE__ */ new Map();
      for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
        const currentDate = new Date(d);
        const dayOfWeek = currentDate.getUTCDay();
        const dateStr = currentDate.toISOString().split("T")[0];
        for (const schedule of allAvailability) {
          if (!schedule.isActive) continue;
          const scheduleKey = `${workspaceKey(schedule)}:${schedule.serviceId ?? "all"}`;
          const scheduleApplies = schedule.scheduleType === "specific" && schedule.specificDate && new Date(schedule.specificDate).toISOString().split("T")[0] === dateStr || schedule.scheduleType === "recurring" && schedule.daysOfWeek && schedule.daysOfWeek.includes(dayOfWeek);
          if (!scheduleApplies) continue;
          const schedStart = schedule.startTime || "00:00";
          const schedEnd = schedule.endTime || "23:59";
          const breaks = schedule.breaks || [];
          if (filters.time || filters.timeEnd) {
            const filterStart = filters.time || "00:00";
            const filterEnd = filters.timeEnd || "23:59";
            const hasOverlap = filterStart < schedEnd && filterEnd > schedStart;
            if (hasOverlap) {
              const overlapsWithBreak = breaks.some(
                (brk) => filterStart < brk.endTime && filterEnd > brk.startTime
              );
              if (!overlapsWithBreak) {
                providerAvailability.set(scheduleKey, true);
              } else {
                const scheduleCoversBeforeBreak = breaks.every(
                  (brk) => filterEnd <= brk.startTime || filterStart >= brk.endTime
                );
                if (scheduleCoversBeforeBreak) {
                  providerAvailability.set(scheduleKey, true);
                }
              }
            }
          } else {
            providerAvailability.set(scheduleKey, true);
          }
        }
      }
      servicesWithProviders = servicesWithProviders.filter(
        (service) => providerAvailability.get(`${workspaceKey(service)}:all`) === true || providerAvailability.get(`${workspaceKey(service)}:${service.id}`) === true
      );
    }
    return filters.limit ? servicesWithProviders.slice(0, filters.limit) : servicesWithProviders;
  }
  // Booking operations
  async createBooking(booking, initialMessage, expectedPrice) {
    return db.transaction(async (tx) => {
      await tx.execute(sql5`SELECT id FROM users WHERE id = ${booking.providerId} FOR UPDATE`);
      const [service] = await tx.select().from(services).where(eq6(services.id, booking.serviceId)).for("share");
      if (!service?.isActive || service.providerId !== booking.providerId || service.companyId !== (booking.companyId ?? null) || service.employeeId !== (booking.employeeId ?? null)) throw new BookingConflictError("The service has changed. Please choose a time again.");
      const expected = expectedPrice ?? { expectedPrice: serviceMoneyDto(service).price, expectedCurrency: booking.currency, expectedAdvancePaymentPercent: service.advancePaymentPercent ?? 0 };
      const schedules = await tx.select().from(availability).where(and5(
        service.companyId != null ? eq6(availability.companyId, service.companyId) : and5(eq6(availability.providerId, service.providerId), isNull5(availability.companyId)),
        eq6(availability.isActive, true)
      ));
      const offered = bookableSlots({ service, schedules, bookings: [], date: booking.scheduledDate.toISOString().slice(0, 10), timezone: "UTC" });
      if (!offered.some((slot) => slot.startsAt === booking.scheduledDate.toISOString())) throw new BookingConflictError("This time is outside the available working hours.");
      await assertResourceAvailable(tx, service, { ...booking, bookingDuration: service.duration, bookingCleanupTime: service.cleanupTime });
      const snapshot = bookingPriceSnapshot(service, booking.participantCount ?? 1, expected);
      const createdAt = /* @__PURE__ */ new Date();
      const [created] = await tx.insert(bookings).values({ ...booking, ...snapshot, notes: null, createdAt, bookingDuration: service.duration, bookingCleanupTime: service.cleanupTime }).returning();
      if (initialMessage) {
        await tx.insert(bookingMessages).values({
          id: randomUUID4(),
          bookingId: created.id,
          authorId: created.seekerId,
          authorRole: "customer",
          body: initialMessage,
          clientRequestId: randomUUID4(),
          broadcastId: null,
          createdAt
        });
      }
      await reconcileBookingReminder(tx, created, /* @__PURE__ */ new Date(), schedules.find((item) => item.serviceId === service.id)?.timezone ?? schedules[0]?.timezone ?? "UTC");
      return bookingMoneyDto(created);
    });
  }
  async getServiceReviews(serviceId2, page) {
    const service = await this.getServiceById(serviceId2);
    if (!service?.isActive || !service.companyActive) return void 0;
    const pageSize = 20;
    const results = await db.select({
      id: serviceReviews.id,
      rating: serviceReviews.rating,
      comment: serviceReviews.comment,
      createdAt: serviceReviews.createdAt,
      firstName: users.firstName,
      lastName: users.lastName
    }).from(serviceReviews).innerJoin(bookings, eq6(serviceReviews.bookingId, bookings.id)).leftJoin(users, eq6(bookings.seekerId, users.id)).where(eq6(bookings.serviceId, serviceId2)).orderBy(desc2(serviceReviews.createdAt), desc2(serviceReviews.id)).limit(pageSize + 1).offset((page - 1) * pageSize);
    return {
      page,
      hasMore: results.length > pageSize,
      reviews: results.slice(0, pageSize).map((review) => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        reviewerName: [review.firstName?.trim(), review.lastName?.trim()].filter(Boolean).join(" ") || null,
        createdAt: review.createdAt.toISOString()
      }))
    };
  }
  async createReview(bookingId, seekerId, input) {
    const values = reviewSchema.parse(input);
    return db.transaction(async (tx) => {
      const [booking] = await tx.select().from(bookings).where(and5(eq6(bookings.id, bookingId), eq6(bookings.seekerId, seekerId))).for("update");
      if (!booking) throw new ReviewError(404, "Booking not found.");
      if (booking.status !== "completed") throw new ReviewError(409, "Only completed bookings can be reviewed.");
      const [review] = await tx.insert(serviceReviews).values({ bookingId, ...values }).onConflictDoNothing({ target: serviceReviews.bookingId }).returning();
      if (!review) throw new ReviewError(409, "This booking has already been reviewed.");
      return review;
    });
  }
  async updateReview(bookingId, seekerId, input) {
    const values = reviewSchema.parse(input);
    const [review] = await db.update(serviceReviews).set(values).where(and5(
      eq6(serviceReviews.bookingId, bookingId),
      inArray3(serviceReviews.bookingId, db.select({ id: bookings.id }).from(bookings).where(and5(eq6(bookings.seekerId, seekerId), eq6(bookings.status, "completed"))))
    )).returning();
    if (!review) throw new ReviewError(404, "Review not found.");
    return review;
  }
  async deleteReview(bookingId, seekerId) {
    const [review] = await db.delete(serviceReviews).where(and5(
      eq6(serviceReviews.bookingId, bookingId),
      inArray3(serviceReviews.bookingId, db.select({ id: bookings.id }).from(bookings).where(eq6(bookings.seekerId, seekerId)))
    )).returning({ id: serviceReviews.id });
    if (!review) throw new ReviewError(404, "Review not found.");
  }
  async getBookingsBySeeker(seekerId) {
    const results = await db.select().from(bookings).leftJoin(services, eq6(bookings.serviceId, services.id)).leftJoin(addresses, eq6(services.addressId, addresses.id)).leftJoin(users, eq6(bookings.providerId, users.id)).leftJoin(employees, eq6(bookings.employeeId, employees.id)).leftJoin(companies, eq6(bookings.companyId, companies.id)).leftJoin(serviceReviews, eq6(serviceReviews.bookingId, bookings.id)).where(eq6(bookings.seekerId, seekerId)).orderBy(desc2(bookings.createdAt));
    return results.map((result) => ({
      ...bookingMoneyDto(result.bookings),
      review: result.service_reviews,
      service: serviceLocation(result.services, result.addresses),
      seeker: { id: seekerId },
      provider: publicProvider(result.users, result.companies),
      employee: result.employees ? { id: result.employees.id, name: result.employees.showName ? result.employees.name : null } : null
    }));
  }
  async getBookingsByProvider(providerId2, companyId) {
    const results = await db.select().from(bookings).leftJoin(services, eq6(bookings.serviceId, services.id)).leftJoin(addresses, eq6(services.addressId, addresses.id)).leftJoin(users, eq6(bookings.seekerId, users.id)).where(companyId != null ? eq6(bookings.companyId, companyId) : and5(eq6(bookings.providerId, providerId2), isNull5(bookings.companyId))).orderBy(desc2(bookings.createdAt));
    return results.map((result) => ({
      ...bookingMoneyDto(result.bookings),
      service: serviceLocation(result.services, result.addresses),
      seeker: result.users,
      provider: { id: providerId2 }
    }));
  }
  async getBookingById(id2) {
    const [result] = await db.select().from(bookings).leftJoin(services, eq6(bookings.serviceId, services.id)).leftJoin(addresses, eq6(services.addressId, addresses.id)).leftJoin(users, eq6(bookings.seekerId, users.id)).where(eq6(bookings.id, id2));
    if (!result) return void 0;
    return {
      ...bookingMoneyDto(result.bookings),
      service: serviceLocation(result.services, result.addresses),
      seeker: result.users,
      provider: { id: result.bookings.providerId }
    };
  }
  async updateBookingStatus(id2, status, seekerId, timeZone = "UTC") {
    return db.transaction(async (tx) => {
      const [initial] = await tx.select().from(bookings).where(eq6(bookings.id, id2));
      if (!initial) throw new BookingConflictError("Reservation not found.");
      await tx.execute(sql5`SELECT id FROM users WHERE id = ${initial.providerId} FOR UPDATE`);
      const [booking] = await tx.select().from(bookings).where(eq6(bookings.id, id2)).for("update");
      if (seekerId !== void 0) {
        assertCustomerBookingChange(booking, seekerId);
        if (status !== "cancelled") throw new BookingConflictError("Customers can only cancel their reservations.");
      }
      if ((booking.status === "cancelled" || booking.status === "completed") && status !== booking.status) throw new BookingConflictError("Closed reservations cannot be changed.");
      if (OCCUPYING_BOOKING_STATUSES.some((value) => value === status) && !OCCUPYING_BOOKING_STATUSES.some((value) => value === booking.status)) {
        const [service] = await tx.select().from(services).where(eq6(services.id, booking.serviceId));
        if (!service) throw new BookingConflictError("The service is no longer available.");
        await assertResourceAvailable(tx, service, { ...booking, bookingDuration: booking.bookingDuration ?? service.duration, bookingCleanupTime: booking.bookingCleanupTime ?? 0 });
      }
      if (booking.status === status) return { ...bookingMoneyDto(booking), notification: { mode: "none" } };
      const [updated] = await tx.update(bookings).set({
        status,
        notificationRevision: booking.notificationRevision + 1,
        closedAt: status === "completed" || status === "cancelled" ? booking.closedAt ?? /* @__PURE__ */ new Date() : null,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq6(bookings.id, id2)).returning();
      await tx.update(bookingRescheduleRequests).set({ state: "superseded" }).where(and5(eq6(bookingRescheduleRequests.bookingId, id2), eq6(bookingRescheduleRequests.state, "pending")));
      const action = seekerId === void 0 ? statusAction(booking.status, updated.status) : null;
      const notification = action ? await captureStatusEvent(tx, updated, action, timeZone) : { mode: "none" };
      await reconcileBookingReminder(tx, updated, /* @__PURE__ */ new Date(), timeZone);
      return { ...bookingMoneyDto(updated), notification };
    });
  }
  async updateBookingPayment(id2, paymentStatus) {
    const [booking] = await db.update(bookings).set({ paymentStatus, updatedAt: /* @__PURE__ */ new Date() }).where(eq6(bookings.id, id2)).returning();
    return bookingMoneyDto(booking);
  }
  async rescheduleBooking(id2, date3, seekerId, timeZone = "UTC") {
    return db.transaction(async (tx) => {
      const [initial] = await tx.select().from(bookings).where(eq6(bookings.id, id2));
      if (!initial) throw new BookingConflictError("Reservation not found.");
      await tx.execute(sql5`SELECT id FROM users WHERE id = ${initial.providerId} FOR UPDATE`);
      const [booking] = await tx.select().from(bookings).where(eq6(bookings.id, id2)).for("update");
      if (seekerId !== void 0) assertCustomerBookingChange(booking, seekerId);
      if (!(date3.getTime() > Date.now())) throw new BookingConflictError("Choose a future appointment time.");
      if (booking.status !== "pending" && booking.status !== "confirmed") throw new BookingConflictError("Only pending or confirmed reservations can be rescheduled.");
      if (booking.scheduledDate.getTime() === date3.getTime()) return { ...bookingMoneyDto(booking), notification: { mode: "none" } };
      const [service] = await tx.select().from(services).where(eq6(services.id, booking.serviceId));
      const schedules = await tx.select().from(availability).where(and5(
        booking.companyId != null ? eq6(availability.companyId, booking.companyId) : and5(eq6(availability.providerId, booking.providerId), isNull5(availability.companyId)),
        eq6(availability.isActive, true)
      ));
      const offered = bookableSlots({ service: { ...service, duration: booking.bookingDuration ?? service.duration, cleanupTime: booking.bookingCleanupTime ?? 0 }, schedules, bookings: [], date: date3.toISOString().slice(0, 10), timezone: "UTC" });
      if (!offered.some((slot) => slot.startsAt === date3.toISOString())) throw new BookingConflictError("Choose a time within the available working hours.");
      await assertResourceAvailable(tx, service, { ...booking, scheduledDate: date3, bookingDuration: booking.bookingDuration ?? service.duration, bookingCleanupTime: booking.bookingCleanupTime ?? 0 });
      const [updated] = await tx.update(bookings).set({ scheduledDate: date3, notificationRevision: booking.notificationRevision + 1, updatedAt: /* @__PURE__ */ new Date() }).where(eq6(bookings.id, id2)).returning();
      const notification = seekerId === void 0 ? await captureStatusEvent(tx, updated, "rescheduled", timeZone, booking.scheduledDate) : { mode: "none" };
      await reconcileBookingReminder(tx, updated, /* @__PURE__ */ new Date(), timeZone);
      return { ...bookingMoneyDto(updated), notification };
    });
  }
  async getBookingsForServiceOnDate(serviceId2, date3) {
    const startOfDay = new Date(date3);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date3);
    endOfDay.setHours(23, 59, 59, 999);
    return await db.select().from(bookings).where(
      and5(
        eq6(bookings.serviceId, serviceId2),
        gte(bookings.scheduledDate, startOfDay),
        lte(bookings.scheduledDate, endOfDay),
        inArray3(bookings.status, [...OCCUPYING_BOOKING_STATUSES])
      )
    ).orderBy(asc4(bookings.scheduledDate));
  }
  async getBookingsForProviderOnDate(providerId2, date3) {
    const startOfDay = new Date(date3);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date3);
    endOfDay.setHours(23, 59, 59, 999);
    return await db.select().from(bookings).where(
      and5(
        eq6(bookings.providerId, providerId2),
        gte(bookings.scheduledDate, startOfDay),
        lte(bookings.scheduledDate, endOfDay),
        inArray3(bookings.status, [...OCCUPYING_BOOKING_STATUSES])
      )
    ).orderBy(asc4(bookings.scheduledDate));
  }
  // Availability operations
  async getBookingsForResourceOnDate(service, date3) {
    const start = new Date(date3);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return this.getBookingsForResourceRange(service, start, end);
  }
  async getBookingsForResourceRange(service, start, end) {
    const rows = await db.select({ booking: bookings, duration: services.duration }).from(bookings).leftJoin(services, eq6(bookings.serviceId, services.id)).where(and5(
      eq6(bookings.providerId, service.providerId),
      inArray3(bookings.status, [...OCCUPYING_BOOKING_STATUSES]),
      service.employeeId != null ? eq6(bookings.employeeId, service.employeeId) : sql5`${bookings.employeeId} IS NULL`,
      sql5`${bookings.scheduledDate} < ${end.toISOString()}::timestamp`,
      sql5`${bookings.scheduledDate} + (COALESCE(${bookings.bookingDuration}, ${services.duration}, 60) + COALESCE(${bookings.bookingCleanupTime}, 0)) * interval '1 minute' > ${start.toISOString()}::timestamp`
    ));
    return rows.map((row) => ({ ...row.booking, bookingDuration: row.booking.bookingDuration ?? row.duration ?? 60 }));
  }
  async createAvailability(availabilityData) {
    const [newAvailability] = await db.insert(availability).values(availabilityData).returning();
    return newAvailability;
  }
  async replaceAvailability(providerId2, companyId, serviceId2, type, rows, date3) {
    await db.transaction(async (tx) => {
      await tx.execute(sql5`SELECT id FROM users WHERE id = ${providerId2} FOR UPDATE`);
      await tx.update(availability).set({ isActive: false, updatedAt: /* @__PURE__ */ new Date() }).where(and5(
        companyId != null ? eq6(availability.companyId, companyId) : and5(eq6(availability.providerId, providerId2), isNull5(availability.companyId)),
        serviceId2 == null ? isNull5(availability.serviceId) : eq6(availability.serviceId, serviceId2),
        eq6(availability.scheduleType, type),
        ...date3 ? [sql5`${availability.specificDate}::date = ${date3.toISOString().slice(0, 10)}::date`] : []
      ));
      if (rows.length) await tx.insert(availability).values(rows);
    });
  }
  async getAvailabilityByService(serviceId2) {
    return await db.select().from(availability).where(
      and5(
        eq6(availability.serviceId, serviceId2),
        eq6(availability.isActive, true)
      )
    ).orderBy(asc4(availability.startTime));
  }
  async getAvailabilityByProvider(providerId2, companyId) {
    return await db.select().from(availability).where(
      and5(
        companyId != null ? eq6(availability.companyId, companyId) : and5(eq6(availability.providerId, providerId2), isNull5(availability.companyId)),
        eq6(availability.isActive, true)
      )
    ).orderBy(asc4(availability.createdAt));
  }
  async updateAvailability(id2, updates) {
    const [updated] = await db.update(availability).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq6(availability.id, id2)).returning();
    return updated;
  }
  async deleteAvailability(id2, providerId2, companyId) {
    await db.update(availability).set({ isActive: false, updatedAt: /* @__PURE__ */ new Date() }).where(
      and5(
        eq6(availability.id, id2),
        companyId != null ? eq6(availability.companyId, companyId) : and5(eq6(availability.providerId, providerId2), isNull5(availability.companyId))
      )
    );
  }
  // Embedding operations for semantic search
  async upsertServiceEmbedding(embeddingData) {
    const [embedding] = await db.insert(serviceEmbeddings).values(embeddingData).onConflictDoUpdate({
      target: serviceEmbeddings.serviceId,
      set: {
        embedding: embeddingData.embedding,
        textContent: embeddingData.textContent,
        updatedAt: /* @__PURE__ */ new Date()
      }
    }).returning();
    return embedding;
  }
  async getServiceEmbedding(serviceId2) {
    const [embedding] = await db.select().from(serviceEmbeddings).where(eq6(serviceEmbeddings.serviceId, serviceId2));
    return embedding;
  }
  async getAllServiceEmbeddings() {
    return await db.select().from(serviceEmbeddings);
  }
  async getPublicServiceEmbeddings(filters) {
    filters = searchFiltersSchema.parse(filters);
    const candidates = await db.select({ serviceId: serviceEmbeddings.serviceId, embedding: serviceEmbeddings.embedding }).from(serviceEmbeddings).innerJoin(services, eq6(serviceEmbeddings.serviceId, services.id)).leftJoin(addresses, eq6(services.addressId, addresses.id)).leftJoin(employees, eq6(services.employeeId, employees.id)).leftJoin(companies, eq6(services.companyId, companies.id)).where(and5(...publicSearchConditions(filters))).orderBy(desc2(services.createdAt), desc2(services.id)).limit(MAX_SEARCH_CANDIDATES + 1);
    assertSearchSize(candidates.length);
    return candidates;
  }
  async deleteServiceEmbedding(serviceId2) {
    await db.delete(serviceEmbeddings).where(eq6(serviceEmbeddings.serviceId, serviceId2));
  }
};
var storage = new DatabaseStorage();

// server/auth.ts
import session from "express-session";

// shared/navigation.ts
var providerDestinations = /* @__PURE__ */ new Set([
  "/my-services",
  "/my-services/appointments",
  "/my-services/services",
  "/my-services/services/new",
  "/my-services/upcoming-appointments",
  "/my-services/past-appointments",
  "/my-services/availability",
  "/my-services/settings",
  "/my-services/settings/team",
  "/my-services/settings/storefront"
]);
function isAllowedAuthReturnTo(value) {
  return typeof value === "string" && (value === "/search" || value === "/wishlist" || value === "/inbox" || /^\/search\?service=[1-9]\d{0,9}$/.test(value) && Number(value.split("=")[1]) <= 2147483647 || value === "/account" || value === "/my-bookings" || value === "/administration" || providerDestinations.has(value) || /^\/providers\/(?=[a-z0-9-]{3,64}(?:\?|$))[a-z0-9]+(?:-[a-z0-9]+)*(?:\?book=[1-9]\d{0,9})?$/.test(value) || /^\/my-services\/services\/\d+\/edit$/.test(value) || /^\/invite(?:\?|$)/.test(value));
}

// shared/social-auth.ts
var socialProviders = ["google", "facebook", "apple", "microsoft"];

// server/social-auth.ts
var providerSettings = {
  google: { provider: "google", flag: "SUPABASE_GOOGLE_ENABLED" },
  facebook: { provider: "facebook", flag: "SUPABASE_FACEBOOK_ENABLED", scopes: "email" },
  apple: { provider: "apple", flag: "SUPABASE_APPLE_ENABLED" },
  microsoft: { provider: "azure", flag: "SUPABASE_MICROSOFT_ENABLED", scopes: "email" }
};
function enabledAuthProviders() {
  return Object.fromEntries(socialProviders.map((provider) => [provider, process.env[providerSettings[provider].flag] === "true"]));
}
function oauthSettings(provider) {
  const { provider: supabaseProvider, scopes } = providerSettings[provider];
  return { provider: supabaseProvider, scopes };
}
function loginFailureUrl(error, returnTo) {
  const params = new URLSearchParams({ error });
  if (isAllowedAuthReturnTo(returnTo)) params.set("returnTo", returnTo);
  return `/login?${params}`;
}
var metadataText = (value) => typeof value === "string" ? value.trim().slice(0, 100) || null : null;
function authProfileNames(user, existing) {
  return {
    firstName: typeof user.user_metadata.first_name === "string" ? metadataText(user.user_metadata.first_name) : existing ? existing.firstName : metadataText(user.user_metadata.given_name),
    lastName: typeof user.user_metadata.last_name === "string" ? metadataText(user.user_metadata.last_name) : existing ? existing.lastName : metadataText(user.user_metadata.family_name)
  };
}

// shared/password.ts
import { z as z11 } from "zod";
var fields = z11.object({
  currentPassword: z11.string().min(1, "Enter your current password.").max(128, "Password must be 128 characters or fewer."),
  newPassword: z11.string().min(8, "Use at least 8 characters for your new password.").max(128, "Password must be 128 characters or fewer.")
}).strict();
var differentPassword = (value) => value.currentPassword !== value.newPassword;
var differentMessage = { message: "Choose a password different from your current password.", path: ["newPassword"] };
var passwordChangeSchema = fields.refine(differentPassword, differentMessage);
var passwordChangeFormSchema = fields.extend({ confirmPassword: z11.string() }).strict().refine((value) => value.newPassword === value.confirmPassword, { message: "New passwords do not match.", path: ["confirmPassword"] }).refine(differentPassword, differentMessage);
var passwordChangeResultSchema = z11.object({ success: z11.literal(true), requiresSignIn: z11.boolean() });

// server/supabase.ts
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
var supabaseUrl = process.env.SUPABASE_URL;
var publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
var secretKey = process.env.SUPABASE_SECRET_KEY;
var storageBucket = process.env.SUPABASE_STORAGE_BUCKET || "service-images";
var appUrl = new URL(process.env.APP_URL || "http://localhost:5000").origin;
if (!supabaseUrl || !publishableKey || !secretKey) {
  throw new Error("Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SECRET_KEY in .env.");
}
function createAuthClient(storage2) {
  return createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: Boolean(storage2),
      flowType: "pkce",
      storage: storage2
    }
  });
}
var supabaseAdmin = createClient(supabaseUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
});

// server/audit/http.ts
init_context();
init_events();
init_capture();
import { randomUUID as randomUUID5 } from "node:crypto";
var correlations = /* @__PURE__ */ new WeakMap();
var runtime;
var injected;
var injectedReady;
var injectedAuthEvents = true;
var auditEnabled = () => injected !== void 0 || process.env.AUDIT_ENABLED === "true";
var serviceViewAuditEnabled = () => auditEnabled() && process.env.AUDIT_SERVICE_VIEWS_ENABLED === "true";
var auditAuthEventsEnabled = () => injected !== void 0 && injectedAuthEvents;
function auditGap() {
  console.error("Audit capture gap", "CAPTURE_UNAVAILABLE");
}
async function closeAuditCapture() {
  if (runtime) {
    const active2 = runtime;
    runtime = void 0;
    await (await active2).close();
  }
}
function captureRuntime() {
  runtime ??= Promise.resolve().then(() => (init_runtime(), runtime_exports)).then((module) => module.createCaptureRuntime(process.env)).catch((error) => {
    runtime = void 0;
    throw error;
  });
  return runtime;
}
async function requireAuditAvailability() {
  if (!auditAuthEventsEnabled()) return;
  try {
    if (injected) await injectedReady?.();
    else await (await captureRuntime()).ready();
  } catch {
    auditGap();
    throw new AuditCaptureUnavailable();
  }
}
function identity(req) {
  let value = correlations.get(req);
  if (!value) {
    value = { requestId: randomUUID5(), operationId: randomUUID5() };
    correlations.set(req, value);
  }
  return value;
}
async function recordServiceView(req, serviceId2, actor2) {
  if (!serviceViewAuditEnabled()) return;
  try {
    const context = createAuditContext({
      ...identity(req),
      actor: actor2,
      scope: { kind: "unknown" },
      target: { type: "service", id: String(serviceId2) },
      source: { application: "fitsmytime", environment: injected ? "development" : process.env.AUDIT_ENVIRONMENT, component: "service" }
    });
    const event = createAuditEvent(context, { eventName: "service.viewed.v1", outcome: "succeeded", changes: [] });
    if (injected) await injected(event);
    else await (await captureRuntime()).capture(event);
  } catch {
    auditGap();
  }
}
function requestAuditContext(req, component, userId) {
  if (!auditEnabled()) return;
  const verified = userId ?? req.user?.claims.sub;
  if (verified && !req.auditPersonalRole) throw new AuditCaptureUnavailable();
  return createAuditContext({
    ...identity(req),
    actor: verified ? { kind: "user", userId: verified, effectiveRole: req.auditPersonalRole } : { kind: "anonymous" },
    scope: verified ? { kind: "personal", workspaceId: verified } : { kind: "unknown" },
    target: component === "authorization" || !verified ? { type: "request" } : { type: "user", id: verified },
    source: { application: "fitsmytime", environment: injected ? "development" : process.env.AUDIT_ENVIRONMENT, component }
  });
}
async function recordAudit(req, action, userId) {
  if (!auditEnabled()) return;
  if (action.eventName.startsWith("auth.") && !auditAuthEventsEnabled()) return;
  try {
    const context = requestAuditContext(req, action.eventName === "security.action_denied.v1" ? "authorization" : "auth", userId);
    const event = createAuditEvent(context, action);
    if (injected) await injected(event);
    else {
      await (await captureRuntime()).capture(event);
    }
  } catch {
    auditGap();
    throw new AuditCaptureUnavailable();
  }
}
async function recordDenial(req, reasonCode) {
  try {
    await recordAudit(req, { eventName: "security.action_denied.v1", outcome: "denied", reasonCode, changes: [] });
  } catch {
  }
}
function denyWithAudit(req, reason, respond) {
  if (!auditEnabled()) return respond();
  return recordDenial(req, reason).then(respond);
}

// server/password.ts
init_capture();
var sessionOperation = (req, operation) => new Promise((resolve, reject) => req.session[operation]((error) => error ? reject(error) : resolve()));
var updatePassword = async (req, res) => {
  const parsed = passwordChangeSchema.safeParse(req.body);
  if (!parsed.success) {
    try {
      await recordAudit(req, { eventName: "auth.password_changed.v1", outcome: "rejected", reasonCode: "INVALID_INPUT", changes: [] });
    } catch {
      return res.status(503).json({ message: "Password updates are temporarily unavailable." });
    }
    return res.status(400).json({ message: parsed.error.issues[0].message });
  }
  if (!req.user?.email || !req.session.auth) {
    await recordDenial(req, "UNAUTHENTICATED");
    return res.status(401).json({ message: "Sign in again to update your password." });
  }
  try {
    await requireAuditAvailability();
  } catch {
    return res.status(503).json({ message: "Password updates are temporarily unavailable." });
  }
  const client2 = createAuthClient();
  let verifiedSession = false;
  let passwordChanged = false;
  let keepSession = false;
  let updateAttempted = false;
  try {
    const verified = await client2.auth.signInWithPassword({ email: req.user.email, password: parsed.data.currentPassword });
    verifiedSession = Boolean(verified.data.session);
    if (verified.error) {
      const status = verified.error.status;
      try {
        await recordAudit(req, {
          eventName: "auth.password_changed.v1",
          changes: [],
          outcome: status && status >= 500 ? "failed" : "denied",
          reasonCode: status && status >= 500 ? "PROVIDER_UNAVAILABLE" : status === 429 ? "RATE_LIMITED" : "INVALID_CREDENTIALS"
        });
      } catch {
      }
      return res.status(status === 429 ? 429 : status && status >= 500 ? 503 : 400).json({
        message: status === 429 ? "Too many attempts. Please try again later." : status && status >= 500 ? "Unable to verify your password. Please try again." : "Current password is incorrect."
      });
    }
    if (!verified.data.session || verified.data.user?.id !== req.user.claims.sub) {
      await recordDenial(req, "FORBIDDEN");
      return res.status(403).json({ message: "Unable to verify this account." });
    }
    updateAttempted = true;
    const updated = await client2.auth.updateUser({ password: parsed.data.newPassword, current_password: parsed.data.currentPassword });
    if (updated.error) {
      const status = updated.error.status;
      await recordAudit(req, {
        eventName: "auth.password_changed.v1",
        changes: [],
        outcome: status && status >= 500 ? "failed" : status === 429 ? "denied" : "rejected",
        reasonCode: status && status >= 500 ? "PROVIDER_UNAVAILABLE" : status === 429 ? "RATE_LIMITED" : "INVALID_INPUT"
      });
      const message = updated.error.code === "same_password" ? "Choose a password different from your current password." : updated.error.code === "weak_password" ? "Choose a stronger password that meets your account's password requirements." : status === 429 ? "Too many attempts. Please try again later." : status && status >= 500 ? "Unable to update your password. Please try again." : "Unable to update your password. Check the password requirements and try again.";
      return res.status(status === 429 ? 429 : status && status >= 500 ? 503 : 400).json({ message });
    }
    passwordChanged = true;
    await recordAudit(req, { eventName: "auth.password_changed.v1", outcome: "succeeded", changes: [] });
    const { data, error } = await client2.auth.getSession();
    if (error || !data.session || data.session.user.id !== req.user.claims.sub) throw new Error("Unable to restore session");
    const activeCompanyId = req.session.activeCompanyId;
    await sessionOperation(req, "regenerate");
    req.session.auth = {
      userId: data.session.user.id,
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at ?? 0
    };
    req.session.activeCompanyId = activeCompanyId;
    await sessionOperation(req, "save");
    keepSession = true;
    return res.json({ success: true, requiresSignIn: false });
  } catch (error) {
    if (passwordChanged) {
      await sessionOperation(req, "destroy").catch(() => {
      });
      res.clearCookie("wellness.sid", { path: "/" });
      if (error instanceof AuditCaptureUnavailable) return res.status(503).json({ message: "Your password was saved. Sign in again to continue." });
      return res.json({ success: true, requiresSignIn: true });
    }
    if (updateAttempted && !(error instanceof AuditCaptureUnavailable)) {
      try {
        await recordAudit(req, { eventName: "auth.password_changed.v1", outcome: "unknown", reasonCode: "PROVIDER_TIMEOUT", changes: [] });
      } catch {
      }
    }
    return res.status(503).json({ message: "Unable to update your password. Please try again." });
  } finally {
    if (verifiedSession && !keepSession) await client2.auth.signOut({ scope: "local" }).catch(() => {
    });
  }
};

// server/auth.ts
import connectPg from "connect-pg-simple";
import { rateLimit } from "express-rate-limit";
import { z as z13 } from "zod";
import { and as and6, eq as eq7, gt as gt3, isNull as isNull6 } from "drizzle-orm";
init_capture();
var credentials = z13.object({ email: z13.string().email().max(254), password: z13.string().min(8).max(128) });
var save = (req) => new Promise((resolve, reject) => req.session.save((error) => error ? reject(error) : resolve()));
var regenerate = (req) => new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
var destroy = (req) => new Promise((resolve, reject) => req.session.destroy((error) => error ? reject(error) : resolve()));
var socialCompanySchema = z13.object({ companyName: z13.string().trim().min(1).max(150), returnTo: z13.string().max(512).default("/") }).strict();
var socialCompanyIntentSchema = z13.object({ companyName: z13.string().trim().min(1).max(150), expiresAt: z13.number().finite() }).strict();
function pkceClient(req) {
  req.session.oauthStorage ||= {};
  return createAuthClient({
    getItem: (key) => req.session.oauthStorage?.[key] ?? null,
    setItem: (key, value) => {
      req.session.oauthStorage ||= {};
      req.session.oauthStorage[key] = value;
    },
    removeItem: (key) => {
      delete req.session.oauthStorage?.[key];
    }
  });
}
async function establishSession(req, tokens, socialCompanyName, provisionCompany = ensureCompany, authEvent) {
  const { data, error } = await createAuthClient().auth.getUser(tokens.access_token);
  if (error || !data.user) throw new Error("Unable to verify login");
  const user = data.user;
  const existing = await storage.getUser(user.id);
  const requestedCompany = z13.string().trim().min(1).max(150).safeParse(user.user_metadata.requested_company_name);
  const newCompanyName = socialCompanyName ?? (requestedCompany.success ? requestedCompany.data : void 0);
  const profile = await storage.upsertUser({
    id: user.id,
    email: user.email,
    ...authProfileNames(user, existing),
    profileImageUrl: existing?.profileImageUrl || (typeof user.user_metadata.avatar_url === "string" ? user.user_metadata.avatar_url : null),
    ...!existing && newCompanyName ? { providerType: "company", companyName: newCompanyName, currentRole: "provider" } : {}
  });
  if (auditAuthEventsEnabled()) {
    if (profile.currentRole !== "provider" && profile.currentRole !== "seeker") {
      auditGap();
      throw new AuditCaptureUnavailable();
    }
    req.auditPersonalRole = profile.currentRole;
    if (authEvent) await recordAudit(req, { eventName: authEvent, outcome: "succeeded", changes: [] }, user.id);
  }
  const companyName = profile.providerType === "company" && profile.companyName ? profile.companyName : socialCompanyName;
  if (companyName) {
    await provisionCompany(user.id, companyName);
    if (auditAuthEventsEnabled()) {
      const current = await storage.getUser(user.id);
      if (!current || current.currentRole !== "seeker" && current.currentRole !== "provider") {
        auditGap();
        throw new AuditCaptureUnavailable();
      }
      req.auditPersonalRole = current.currentRole;
    }
  }
  await regenerate(req);
  req.session.auth = {
    userId: user.id,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: tokens.expires_at ?? 0
  };
  await save(req);
  await recordAudit(req, { eventName: "auth.session_established.v1", outcome: "succeeded", changes: [] }, user.id);
  return user;
}
var requireSameOrigin = (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (req.get("Sec-Fetch-Site") === "cross-site" || req.get("Origin") && req.get("Origin") !== appUrl) {
    return denyWithAudit(req, "WRONG_ORIGIN", () => res.status(403).json({ message: "Request origin is not allowed" }));
  }
  next();
};
async function setupAuth(app2, provisionSocialCompany = ensureCompany) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters.");
  if (process.env.NODE_ENV === "production" && !appUrl.startsWith("https://")) throw new Error("APP_URL must use HTTPS in production.");
  app2.set("trust proxy", 1);
  app2.use("/api", requireSameOrigin);
  const PgStore = connectPg(session);
  app2.use(session({
    name: "wellness.sid",
    secret,
    store: new PgStore({ pool, tableName: "sessions", createTableIfMissing: false, ttl: 7 * 24 * 60 * 60 }),
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: appUrl.startsWith("https://"), sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1e3 }
  }));
  const authLimit = rateLimit({
    windowMs: 10 * 60 * 1e3,
    limit: 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (req, res) => denyWithAudit(req, "RATE_LIMITED", () => res.status(429).json({ message: "Too many login attempts. Please try again later." }))
  });
  app2.get("/api/login", (_req, res) => res.redirect("/login"));
  app2.get("/api/auth/providers", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json(enabledAuthProviders());
  });
  app2.post("/api/auth/password", isAuthenticated, authLimit, updatePassword);
  app2.post("/api/auth/login", authLimit, async (req, res, next) => {
    const parsed = credentials.safeParse(req.body);
    if (!parsed.success) {
      try {
        await recordAudit(req, { eventName: "auth.login.v1", outcome: "rejected", reasonCode: "INVALID_INPUT", changes: [] });
      } catch (error) {
        return next(error);
      }
      return res.status(400).json({ message: "Enter a valid email and a password with at least 8 characters." });
    }
    try {
      await requireAuditAvailability();
      const { data, error } = await createAuthClient().auth.signInWithPassword(parsed.data);
      if (error || !data.session) {
        try {
          await recordAudit(req, {
            eventName: "auth.login.v1",
            outcome: error?.status && error.status >= 500 ? "failed" : "denied",
            reasonCode: error?.status && error.status >= 500 ? "PROVIDER_UNAVAILABLE" : error?.status === 429 ? "RATE_LIMITED" : "INVALID_CREDENTIALS",
            changes: []
          });
        } catch {
        }
        return res.status(401).json({ message: "Invalid email or password, or email not confirmed." });
      }
      await establishSession(req, data.session, void 0, ensureCompany, "auth.login.v1");
      res.json({ success: true });
    } catch (error) {
      next(error instanceof AuditCaptureUnavailable || !auditAuthEventsEnabled() ? error : new AuditCaptureUnavailable());
    }
  });
  app2.post("/api/auth/signup", authLimit, async (req, res, next) => {
    const parsed = credentials.extend({ firstName: z13.string().trim().max(100).default(""), lastName: z13.string().trim().max(100).default(""), accountType: z13.enum(["personal", "company"]).default("personal"), companyName: z13.string().trim().max(150).default("") }).refine((data) => data.accountType !== "company" || Boolean(data.companyName), { message: "Company name is required" }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message });
    try {
      const { email, password, firstName, lastName, accountType, companyName } = parsed.data;
      delete req.session.socialCompanySignup;
      if (isAllowedAuthReturnTo(req.body.returnTo)) req.session.authReturnTo = req.body.returnTo.slice(0, 512);
      const { data, error } = await pkceClient(req).auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${appUrl}/api/callback`, data: { first_name: firstName, last_name: lastName, ...accountType === "company" ? { requested_company_name: companyName } : {} } }
      });
      if (error) return res.status(400).json({ message: "Unable to create your account. Check the details or try again later." });
      if (data.session) {
        await establishSession(req, data.session);
        return res.json({ signedIn: true });
      }
      await save(req);
      res.json({ signedIn: false, message: "Check your email to confirm your account. Open the link in this browser." });
    } catch (error) {
      next(error);
    }
  });
  const startSocialSignIn = async (req, provider, returnTo, companyName) => {
    await requireAuditAvailability();
    req.session.authReturnTo = returnTo;
    req.session.oauthStorage = {};
    delete req.session.invitationRecoveryEmail;
    if (companyName) req.session.socialCompanySignup = { companyName, expiresAt: Date.now() + 60 * 6e4 };
    else delete req.session.socialCompanySignup;
    const { provider: supabaseProvider, scopes } = oauthSettings(provider);
    const { data, error } = await pkceClient(req).auth.signInWithOAuth({ provider: supabaseProvider, options: {
      redirectTo: `${appUrl}/api/callback`,
      skipBrowserRedirect: true,
      ...scopes ? { scopes } : {}
    } });
    if (error || !data.url) throw new Error("Unable to start social sign-in");
    await save(req);
    await recordAudit(req, { eventName: "auth.oauth_started.v1", outcome: "succeeded", changes: [] });
    return data.url;
  };
  const clearSocialAttempt = (req) => {
    delete req.session.oauthStorage;
    delete req.session.authReturnTo;
    delete req.session.socialCompanySignup;
  };
  for (const provider of socialProviders) {
    app2.get(`/api/auth/${provider}`, authLimit, async (req, res) => {
      const returnTo = isAllowedAuthReturnTo(req.query.returnTo) ? req.query.returnTo.slice(0, 512) : "/";
      if (!enabledAuthProviders()[provider]) {
        try {
          await recordAudit(req, { eventName: "auth.oauth_started.v1", outcome: "rejected", reasonCode: "PROVIDER_DISABLED", changes: [] });
        } catch {
          return res.status(503).json({ message: "Sign-in is temporarily unavailable." });
        }
        return res.redirect(loginFailureUrl("social_disabled", returnTo));
      }
      try {
        res.redirect(await startSocialSignIn(req, provider, returnTo));
      } catch (error) {
        clearSocialAttempt(req);
        if (error instanceof AuditCaptureUnavailable) return res.status(503).json({ message: "Sign-in is temporarily unavailable." });
        try {
          await recordAudit(req, { eventName: "auth.oauth_started.v1", outcome: "failed", reasonCode: "LOCAL_FAILURE", changes: [] });
        } catch {
          return res.status(503).json({ message: "Sign-in is temporarily unavailable." });
        }
        res.redirect(loginFailureUrl("login_failed", returnTo));
      }
    });
    app2.post(`/api/auth/${provider}`, authLimit, async (req, res) => {
      const parsed = socialCompanySchema.safeParse(req.body);
      if (!parsed.success) {
        try {
          await recordAudit(req, { eventName: "auth.oauth_started.v1", outcome: "rejected", reasonCode: "INVALID_INPUT", changes: [] });
        } catch {
          return res.status(503).json({ message: "Sign-in is temporarily unavailable." });
        }
        return res.status(400).json({ message: "Enter a company name of 1 to 150 characters." });
      }
      if (!enabledAuthProviders()[provider]) {
        try {
          await recordAudit(req, { eventName: "auth.oauth_started.v1", outcome: "rejected", reasonCode: "PROVIDER_DISABLED", changes: [] });
        } catch {
        }
        return res.status(503).json({ message: "This sign-in option is currently unavailable. Choose another option." });
      }
      const returnTo = isAllowedAuthReturnTo(parsed.data.returnTo) ? parsed.data.returnTo : "/";
      try {
        res.json({ url: await startSocialSignIn(req, provider, returnTo, parsed.data.companyName) });
      } catch {
        clearSocialAttempt(req);
        res.status(503).json({ message: "Unable to start sign-in. Please try again." });
      }
    });
  }
  app2.post("/api/auth/invite-recovery", authLimit, async (req, res) => {
    const parsed = z13.object({ email: z13.string().trim().email().max(254).transform((value) => value.toLowerCase()), returnTo: z13.string().max(512).regex(/^\/invite(?:\?|$)/).default("/invite") }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Enter your invited email address." });
    try {
      const pending = await db.select({ id: companyInvitations.id }).from(companyInvitations).where(and6(eq7(companyInvitations.email, parsed.data.email), isNull6(companyInvitations.acceptedAt), isNull6(companyInvitations.revokedAt), gt3(companyInvitations.expiresAt, /* @__PURE__ */ new Date()))).limit(1);
      if (pending.length) {
        delete req.session.socialCompanySignup;
        const { error } = await pkceClient(req).auth.signInWithOtp({ email: parsed.data.email, options: { shouldCreateUser: false, emailRedirectTo: `${appUrl}/api/callback` } });
        if (error) return res.status(503).json({ message: "Unable to send a sign-in email. Please try again later." });
        req.session.invitationRecoveryEmail = parsed.data.email;
        req.session.authReturnTo = parsed.data.returnTo;
        await save(req);
      }
      res.json({ message: "If this address has an active invitation and an account, a fresh sign-in email will arrive. Open the newest link in this browser to set your password." });
    } catch {
      res.status(503).json({ message: "Unable to send a sign-in email. Please try again later." });
    }
  });
  app2.get("/api/callback", authLimit, async (req, res) => {
    const returnTo = isAllowedAuthReturnTo(req.session.authReturnTo) ? req.session.authReturnTo : "/";
    const fail2 = async (error) => {
      clearSocialAttempt(req);
      delete req.session.invitationRecoveryEmail;
      try {
        await recordAudit(req, {
          eventName: "auth.oauth_callback.v1",
          outcome: "rejected",
          reasonCode: error === "social_cancelled" ? "OAUTH_CANCELLED" : "SESSION_EXPIRED",
          changes: []
        });
      } catch {
        return res.status(503).json({ message: "Sign-in completion is temporarily unavailable." });
      }
      return res.redirect(loginFailureUrl(error, returnTo));
    };
    if (req.query.error) return fail2(req.query.error === "access_denied" ? "social_cancelled" : "login_failed");
    if (typeof req.query.code !== "string") return res.redirect("/invite");
    if (!req.query.code || req.query.code.length > 4096 || !req.session.oauthStorage) return fail2("social_session_expired");
    const companyIntent = req.session.socialCompanySignup === void 0 ? void 0 : socialCompanyIntentSchema.safeParse(req.session.socialCompanySignup);
    if (companyIntent && (!companyIntent.success || companyIntent.data.expiresAt <= Date.now())) return fail2("social_session_expired");
    try {
      await requireAuditAvailability();
      const { data, error } = await pkceClient(req).auth.exchangeCodeForSession(req.query.code);
      if (error || !data.session) return fail2("social_session_expired");
      const recoveryEmail = req.session.invitationRecoveryEmail;
      const user = await establishSession(req, data.session, companyIntent?.success ? companyIntent.data.companyName : void 0, provisionSocialCompany, "auth.oauth_callback.v1");
      if (recoveryEmail && user.email_confirmed_at && user.email?.toLowerCase() === recoveryEmail) {
        const pending = await db.select({ id: companyInvitations.id }).from(companyInvitations).where(and6(eq7(companyInvitations.email, recoveryEmail), isNull6(companyInvitations.acceptedAt), isNull6(companyInvitations.revokedAt), gt3(companyInvitations.expiresAt, /* @__PURE__ */ new Date()))).limit(1);
        req.session.canSetInvitationPassword = pending.length > 0;
        await save(req);
      }
      res.redirect(returnTo);
    } catch (error) {
      if (error instanceof AuditCaptureUnavailable) return res.status(503).json({ message: "Sign-in completion is temporarily unavailable." });
      return res.redirect(loginFailureUrl("login_failed", returnTo));
    }
  });
  app2.post("/api/auth/invite-session", authLimit, async (req, res) => {
    const parsed = z13.object({ refreshToken: z13.string().min(1).max(4096) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid invitation sign-in" });
    try {
      const { data, error } = await createAuthClient().auth.refreshSession({ refresh_token: parsed.data.refreshToken });
      if (error || !data.session || !data.user?.email_confirmed_at || !data.user.email) return res.status(401).json({ message: "The sign-in link has expired. Sign in or request a new invitation." });
      const pending = await db.select({ id: companyInvitations.id }).from(companyInvitations).where(and6(eq7(companyInvitations.email, data.user.email.toLowerCase()), isNull6(companyInvitations.acceptedAt), isNull6(companyInvitations.revokedAt), gt3(companyInvitations.expiresAt, /* @__PURE__ */ new Date()))).limit(1);
      if (!pending.length) return res.status(403).json({ message: "No active team invitation exists for this account." });
      await establishSession(req, data.session);
      req.session.canSetInvitationPassword = true;
      await save(req);
      res.json({ success: true, needsPassword: true });
    } catch {
      res.status(503).json({ message: "Unable to finish invitation sign-in. Please try again." });
    }
  });
  app2.post("/api/auth/invite-password", isAuthenticated, authLimit, async (req, res) => {
    if (!req.session.canSetInvitationPassword) return res.status(403).json({ message: "Use the invitation sign-in link to set your password." });
    const parsed = z13.object({ password: z13.string().min(8).max(128) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Use a password with at least 8 characters." });
    try {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(req.user.claims.sub, { password: parsed.data.password });
      if (error) return res.status(400).json({ message: "Unable to set password. Check the password strength and try again." });
      const { data, error: signInError } = await createAuthClient().auth.signInWithPassword({ email: req.user.email, password: parsed.data.password });
      if (signInError || !data.session || data.user?.id !== req.user.claims.sub) return res.status(503).json({ message: "Your password was saved. Sign in with your new password to accept the invitation." });
      await establishSession(req, data.session);
      req.session.canSetInvitationPassword = false;
      await save(req);
      res.json({ success: true });
    } catch {
      res.status(503).json({ message: "Unable to set your password. Please try again." });
    }
  });
  app2.get("/api/auth/invite-status", isAuthenticated, (req, res) => res.json({ needsPassword: Boolean(req.session.canSetInvitationPassword) }));
  app2.post("/api/logout", async (req, res, next) => {
    try {
      let verifiedUser;
      if (auditAuthEventsEnabled() && req.session.auth) {
        const checked = await createAuthClient().auth.getUser(req.session.auth.accessToken);
        if (!checked.error && checked.data.user?.id === req.session.auth.userId) {
          verifiedUser = checked.data.user.id;
          try {
            const profile = await storage.getUser(verifiedUser);
            if (profile && (profile.currentRole === "provider" || profile.currentRole === "seeker")) req.auditPersonalRole = profile.currentRole;
            else {
              auditGap();
              verifiedUser = void 0;
            }
          } catch {
            auditGap();
            verifiedUser = void 0;
          }
        }
      }
      const revoked = req.session.auth ? await supabaseAdmin.auth.admin.signOut(req.session.auth.accessToken, "local") : void 0;
      await destroy(req);
      res.clearCookie("wellness.sid", { httpOnly: true, secure: appUrl.startsWith("https://"), sameSite: "lax", path: "/" });
      if (verifiedUser) await recordAudit(req, {
        eventName: "auth.logout.v1",
        outcome: revoked?.error ? "failed" : "succeeded",
        ...revoked?.error ? { reasonCode: "PROVIDER_UNAVAILABLE" } : {},
        changes: []
      }, verifiedUser);
      res.json({ success: true });
    } catch (error) {
      next(auditAuthEventsEnabled() ? new AuditCaptureUnavailable() : error);
    }
  });
}
var refreshing = /* @__PURE__ */ new Map();
var isAuthenticated = async (req, res, next) => {
  let auth = req.session.auth;
  if (!auth) return denyWithAudit(req, "UNAUTHENTICATED", () => res.status(401).json({ message: "Unauthorized" }));
  try {
    if (auth.expiresAt <= Date.now() / 1e3 + 60) {
      let pending = refreshing.get(req.sessionID);
      if (!pending) {
        const refreshToken = auth.refreshToken;
        const userId = auth.userId;
        pending = (async () => {
          const { data: data2, error: error2 } = await createAuthClient().auth.refreshSession({ refresh_token: refreshToken });
          if (error2 || !data2.session || data2.session.user.id !== userId) throw new Error("Session expired");
          return { userId, accessToken: data2.session.access_token, refreshToken: data2.session.refresh_token, expiresAt: data2.session.expires_at ?? 0 };
        })();
        refreshing.set(req.sessionID, pending);
      }
      try {
        auth = await pending;
      } finally {
        refreshing.delete(req.sessionID);
      }
      req.session.auth = auth;
      await save(req);
    }
    const { data, error } = await createAuthClient().auth.getUser(auth.accessToken);
    if (error || !data.user || data.user.id !== auth.userId) {
      if (error && error.status && error.status >= 500) return res.status(503).json({ message: "Authentication is temporarily unavailable" });
      await destroy(req);
      await recordDenial(req, "SESSION_EXPIRED");
      return res.status(401).json({ message: "Unauthorized" });
    }
    req.user = { claims: { sub: data.user.id }, email: data.user.email, emailVerified: Boolean(data.user.email_confirmed_at) };
    if (auditEnabled()) {
      try {
        const profile = await storage.getUser(data.user.id);
        if (!profile || profile.currentRole !== "seeker" && profile.currentRole !== "provider") throw new AuditCaptureUnavailable();
        req.auditPersonalRole = profile.currentRole;
      } catch {
        auditGap();
        return res.status(503).json({ message: "Authentication is temporarily unavailable" });
      }
    }
    next();
  } catch {
    await destroy(req).catch(() => {
    });
    await recordDenial(req, "SESSION_EXPIRED");
    res.status(401).json({ message: "Unauthorized" });
  }
};

// server/routes.ts
import { z as z37 } from "zod";

// server/imageStorage.ts
import { randomUUID as randomUUID6 } from "node:crypto";
import { and as and7, eq as eq8, or as or4 } from "drizzle-orm";
var MAX_IMAGE_SIZE = 10 * 1024 * 1024;
var extensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
var objectPattern = /^\/objects\/([a-zA-Z0-9_-]+)\/([a-f0-9-]{36}\.(?:jpg|png|webp|gif))$/;
var ImageStorageError = class extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
};
function objectKey(objectPath) {
  if (!objectPattern.test(objectPath)) throw new ImageStorageError(400, "Invalid image path");
  return objectPath.slice("/objects/".length);
}
function assertImageOwner(objectPath, userId) {
  const key = objectKey(objectPath);
  if (key.split("/")[0] !== userId) throw new ImageStorageError(403, "You do not own this image");
  return key;
}
async function createImageUpload(userId, contentType, size) {
  if (!extensions[contentType] || !Number.isInteger(size) || size < 1 || size > MAX_IMAGE_SIZE) {
    throw new ImageStorageError(400, "Choose a JPEG, PNG, WebP, or GIF image up to 10 MB");
  }
  const path7 = `${userId}/${randomUUID6()}.${extensions[contentType]}`;
  const { data, error } = await supabaseAdmin.storage.from(storageBucket).createSignedUploadUrl(path7, { upsert: false });
  if (error || !data) throw new ImageStorageError(503, "Image storage is unavailable");
  return { signedUrl: data.signedUrl, objectPath: `/objects/${path7}` };
}
function imageType(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6))) return "image/gif";
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}
async function downloadImage(objectPath) {
  const { data, error } = await supabaseAdmin.storage.from(storageBucket).download(objectKey(objectPath));
  if (error || !data) throw new ImageStorageError(404, "Image not found");
  if (data.size > MAX_IMAGE_SIZE || data.size < 1) throw new ImageStorageError(400, "Invalid image size");
  const bytes = Buffer.from(await data.arrayBuffer());
  const contentType = imageType(bytes);
  if (!contentType || !objectPath.endsWith(`.${extensions[contentType]}`)) throw new ImageStorageError(400, "The uploaded file is not a supported image");
  return { bytes, contentType };
}
async function validateOwnedImage(objectPath, userId) {
  assertImageOwner(objectPath, userId);
  await downloadImage(objectPath);
}
async function validateServiceImage(objectPath, userId, companyId) {
  const key = objectKey(objectPath);
  if (key.split("/")[0] !== userId) {
    const linked = companyId == null ? [] : await db.select({ id: services.id }).from(services).where(and7(eq8(services.companyId, companyId), eq8(services.imageUrl, objectPath))).limit(1);
    if (!linked.length) throw new ImageStorageError(403, "Choose an image uploaded by you or already used by this company.");
  }
  await downloadImage(objectPath);
}
async function canReadImage(objectPath, userId, workspace) {
  const key = objectKey(objectPath);
  const linked = await db.select({ service: services, company: companies }).from(services).leftJoin(companies, eq8(services.companyId, companies.id)).where(eq8(services.imageUrl, objectPath));
  if (linked.some(({ service, company }) => {
    if (service.isActive && (!company || company.isActive)) return true;
    if (!userId) return false;
    return service.companyId == null && service.providerId === userId || workspace?.company != null && workspace.company.id === service.companyId && (workspace.permissions.readAll || workspace.membership?.employeeId != null && service.employeeId === workspace.membership.employeeId);
  })) return true;
  const branded = await db.select({ userId: providerSubscriptions.userId, companyId: providerSubscriptions.companyId }).from(storefronts).innerJoin(providerSubscriptions, eq8(storefronts.subscriptionId, providerSubscriptions.id)).leftJoin(companies, eq8(providerSubscriptions.companyId, companies.id)).where(and7(
    or4(eq8(storefronts.logoUrl, objectPath), eq8(storefronts.coverUrl, objectPath)),
    or4(
      publishedStorefrontConditions(),
      userId ? eq8(providerSubscriptions.userId, userId) : void 0,
      workspace?.company && workspace.permissions.manageServices ? eq8(providerSubscriptions.companyId, workspace.company.id) : void 0
    )
  ));
  if (branded.length) return true;
  return !linked.length && Boolean(userId && key.split("/")[0] === userId);
}

// server/embeddings.ts
import OpenAI from "openai";

// server/vectors.ts
function cosineSimilarity(a, b) {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length");
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// server/embeddings.ts
var openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
async function generateEmbedding(text3, options) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text3,
    dimensions: 1536
  }, options);
  return response.data[0].embedding;
}

// server/publicSearch.ts
import { rateLimit as rateLimit2 } from "express-rate-limit";
import { z as z16 } from "zod";

// server/search-pagination/routes.ts
import { z as z15 } from "zod";

// shared/search-pagination.ts
var SEARCH_SORTS = ["default", "distance-asc", "distance-desc", "price-asc", "price-desc", "rating-asc", "rating-desc"];

// server/search-pagination/service.ts
import { createHash as createHash3, createHmac as createHmac2, randomBytes, randomUUID as randomUUID7, timingSafeEqual as timingSafeEqual2 } from "node:crypto";
import { z as z14 } from "zod";
var cursorSchema = z14.object({ v: z14.literal(1), hash: z14.string().regex(/^[a-f0-9]{64}$/), mode: z14.enum(["text", "semantic", "text-fallback"]), effectiveSort: z14.enum(SEARCH_SORTS).optional(), position: z14.array(z14.union([z14.number().finite(), z14.string().max(40), z14.null()])).min(2).max(3), expires: z14.number().int().positive(), context: z14.string().uuid().optional() }).strict();
var vector = z14.array(z14.number().finite().min(-1e100).max(1e100)).min(1).max(8192).refine((values) => {
  const norm = values.reduce((sum, value) => sum + value * value, 0);
  return norm > 0 && Number.isFinite(norm);
});
var invalid = () => new SearchError(400, "INVALID_SEARCH_CURSOR", "Search continuation does not match this search. Start again.");
var expired = () => new SearchError(410, "SEARCH_EXPIRED", "This search continuation expired. Start the search again.");
function createSearchPageService(store, embed, options = {}) {
  const now = options.now ?? Date.now, secret = options.secret ?? randomBytes(32), ttl = options.ttlMs ?? 6e5, maxContexts = options.maxContexts ?? 100;
  const contexts2 = /* @__PURE__ */ new Map();
  const signature = (body) => createHmac2("sha256", secret).update(body).digest("base64url");
  const encode = (payload) => {
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return body + "." + signature(body);
  };
  function decode(token) {
    try {
      const parts2 = token.split(".");
      if (parts2.length !== 2 || !parts2.every((part) => /^[A-Za-z0-9_-]+$/.test(part))) throw invalid();
      const supplied = Buffer.from(parts2[1], "base64url"), expected = Buffer.from(signature(parts2[0]), "base64url");
      if (supplied.length !== expected.length || !timingSafeEqual2(supplied, expected)) throw invalid();
      return cursorSchema.parse(JSON.parse(Buffer.from(parts2[0], "base64url").toString("utf8")));
    } catch {
      throw invalid();
    }
  }
  return {
    async page(input) {
      const filters = { ...input.filters };
      delete filters.limit;
      const normalized = { ...filters, ...filters.ageGroups ? { ageGroups: [...filters.ageGroups].sort() } : {}, sort: input.sort, semanticQuery: input.semanticQuery ?? null };
      const hash3 = createHash3("sha256").update(JSON.stringify(Object.fromEntries(Object.entries(normalized).sort(([a], [b]) => a.localeCompare(b))))).digest("hex");
      for (const [id2, context] of Array.from(contexts2)) if (context.expires <= now()) contexts2.delete(id2);
      const continuation = input.cursor ? decode(input.cursor) : void 0;
      if (continuation && continuation.hash !== hash3) throw invalid();
      if (continuation && continuation.expires <= now()) throw expired();
      let mode = continuation?.mode ?? "text", contextId = continuation?.context, embedding, rows;
      const expiresAt = continuation?.expires ?? now() + ttl;
      const exactFilters = input.semanticQuery ? { ...filters, searchQuery: input.semanticQuery } : filters;
      let effectiveSort = continuation?.effectiveSort ?? input.sort, priceSortAvailable = true;
      const read = async (request) => {
        let found = await store.rows({ ...request, sort: effectiveSort });
        priceSortAvailable = found.every((row) => row.priceSortAvailable !== false);
        if (effectiveSort.startsWith("price-") && !priceSortAvailable) {
          if (request.position) throw new SearchError(409, "SEARCH_CURRENCY_CHANGED", "Search currencies changed. Start this search again.");
          effectiveSort = "default";
          found = await store.rows({ ...request, sort: effectiveSort });
        }
        return found;
      };
      if (continuation?.mode === "semantic") {
        const context = contextId ? contexts2.get(contextId) : void 0;
        if (!context || context.hash !== hash3 || context.expires <= now()) throw expired();
        embedding = context.embedding;
        rows = await read({ filters, sort: effectiveSort, limit: input.limit, position: continuation.position, embedding });
      } else if (continuation) {
        rows = await read({ filters: exactFilters, sort: effectiveSort, limit: input.limit, position: continuation.position });
      } else {
        rows = await read({ filters: exactFilters, sort: effectiveSort, limit: input.limit });
        if (input.semanticQuery && !rows.length) {
          if (!(await store.rows({ filters, sort: input.sort, limit: 1, requireEmbedding: true })).length) return { services: [], nextCursor: null, mode: "semantic", priceSortAvailable: true, effectiveSort };
          try {
            embedding = vector.parse(await embed(input.semanticQuery, input.signal));
          } catch (error) {
            if (error instanceof SearchError) throw error;
            mode = "text-fallback";
            embedding = void 0;
            contextId = void 0;
            rows = await read({ filters: exactFilters, sort: effectiveSort, limit: input.limit });
          }
          if (embedding) {
            mode = "semantic";
            contextId = randomUUID7();
            while (contexts2.size >= maxContexts) contexts2.delete(contexts2.keys().next().value);
            contexts2.set(contextId, { embedding, hash: hash3, expires: expiresAt });
            rows = await read({ filters, sort: effectiveSort, limit: input.limit, embedding });
          }
        }
      }
      const selected3 = rows.slice(0, input.limit), hydrated = await store.hydrate(selected3.map((row) => row.id));
      const byId = new Map(hydrated.map((service) => [service.id, service]));
      const services4 = selected3.flatMap((row) => {
        const service = byId.get(row.id);
        if (!service?.isActive || !service.companyActive) return [];
        if (row.currency !== void 0 && row.currency !== service.currency) throw new SearchError(409, "SEARCH_CURRENCY_CHANGED", "Search currencies changed. Start this search again.");
        const dto = currentLocation({ ...service, ...row.distance != null ? { distance: Math.round(row.distance * 10) / 10 } : {} });
        return filters.latitude !== void 0 && dto.distance === void 0 ? [] : [dto];
      });
      const last = selected3.at(-1);
      const nextCursor = rows.length > input.limit && last ? encode({ v: 1, hash: hash3, mode, effectiveSort, position: last.keys, expires: expiresAt, ...contextId ? { context: contextId } : {} }) : null;
      return { services: services4, nextCursor, mode, priceSortAvailable, effectiveSort };
    }
  };
}

// server/search-pagination/routes.ts
function setupSearchPageRoutes(app2, deps, policy, readLimits, semanticLimits) {
  let active2 = 0;
  const pager = deps.searchPageStore ? createSearchPageService(deps.searchPageStore, async (query, signal) => {
    if (active2 >= policy.concurrentEmbeddings) throw new SearchError(429, "SEARCH_RATE_LIMITED", "Search is busy. Please try again shortly.");
    active2++;
    try {
      return await deps.generateEmbedding(query, { timeout: 8e3, maxRetries: 0, signal });
    } finally {
      active2--;
    }
  }) : void 0;
  const controls = z15.object({ sort: z15.enum(SEARCH_SORTS).default("default"), cursor: z15.string().max(4e3).optional(), limit: z15.preprocess((value) => typeof value === "string" && value.trim() !== "" ? Number(value) : value, z15.number().int().min(1).max(50).default(24)) }).strict();
  function route(semantic) {
    return (req, res) => {
      void (async () => {
        res.set("Cache-Control", "no-store");
        const controller = new AbortController();
        const close = () => {
          if (!res.writableEnded) controller.abort();
        };
        res.on("close", close);
        try {
          if (!pager) throw new SearchError(503, "SEARCH_UNAVAILABLE", "Search is temporarily unavailable.");
          const { sort, cursor: cursor2, limit, ...raw2 } = req.query;
          const input = controls.parse({ ...sort !== void 0 ? { sort } : {}, ...cursor2 !== void 0 ? { cursor: cursor2 } : {}, ...limit !== void 0 ? { limit } : {} });
          const parsed = semantic ? semanticSearchSchema.parse(raw2) : publicSearchSchema.parse(raw2);
          const semanticQuery = "query" in parsed ? parsed.query : void 0;
          const filters = "query" in parsed ? (({ query, ...rest }) => rest)(parsed) : parsed;
          const page = await pager.page({ ...input, filters, semanticQuery, signal: controller.signal });
          res.json(page);
        } catch (error) {
          if (error instanceof SearchError) {
            if (error.status === 429) res.set("Retry-After", "1");
            res.status(error.status).json({ code: error.code, message: error.message });
          } else res.status(error instanceof z15.ZodError ? 400 : 503).json({ code: error instanceof z15.ZodError ? "INVALID_SEARCH" : "SEARCH_UNAVAILABLE", message: error instanceof z15.ZodError ? "Choose valid search filters." : "Search is temporarily unavailable. Please try again." });
        } finally {
          res.off("close", close);
        }
      })();
    };
  }
  app2.get("/api/services/search/page", ...readLimits, route(false));
  const firstPageBudget = semanticLimits.map((limit) => (req, res, next) => req.query.cursor ? next() : limit(req, res, next));
  app2.get("/api/services/semantic-search/page", ...readLimits, ...firstPageBudget, route(true));
}

// server/publicSearch.ts
var defaultPolicy = {
  windowMs: 6e4,
  readsPerIp: 60,
  readsPerProcess: 300,
  semanticPerIp: 10,
  semanticPerProcess: 30,
  concurrentEmbeddings: 2
};
function failure(error, res) {
  if (error instanceof z16.ZodError) return res.status(400).json({ code: "INVALID_SEARCH", message: "Choose valid search filters, a query up to 200 characters, and a date range of at most 31 days." });
  if (error instanceof SearchError) return res.status(error.status).json({ code: error.code, message: error.message });
  return res.status(503).json({ code: "SEARCH_UNAVAILABLE", message: "Search is temporarily unavailable. Please try again." });
}
function setupPublicSearchRoutes(app2, dependencies, policy = defaultPolicy) {
  const limiter = (limit, global = false) => rateLimit2({
    windowMs: policy.windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    ...global ? { keyGenerator: () => "process" } : {},
    handler: (_req, res) => res.status(429).json({ code: "SEARCH_RATE_LIMITED", message: "Too many searches. Please wait before trying again." })
  });
  const readLimit = limiter(policy.readsPerIp), processReadLimit = limiter(policy.readsPerProcess, true);
  const semanticLimit = limiter(policy.semanticPerIp), processSemanticLimit = limiter(policy.semanticPerProcess, true);
  const noStore = (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  };
  let activeEmbeddings = 0;
  setupSearchPageRoutes(app2, { ...dependencies, generateEmbedding: async (text3, options) => {
    if (activeEmbeddings >= policy.concurrentEmbeddings) throw new SearchError(429, "SEARCH_RATE_LIMITED", "Search is busy. Please try again shortly.");
    activeEmbeddings++;
    try {
      return await dependencies.generateEmbedding(text3, options);
    } finally {
      activeEmbeddings--;
    }
  } }, policy, [noStore, readLimit, processReadLimit], [semanticLimit, processSemanticLimit]);
  app2.get("/api/services/search", noStore, readLimit, processReadLimit, async (req, res) => {
    try {
      const filters = { limit: 50, ...publicSearchSchema.parse(req.query) };
      const services4 = await dependencies.searchServices(filters);
      assertSearchSize(services4.length);
      res.json(services4.slice(0, filters.limit));
    } catch (error) {
      failure(error, res);
    }
  });
  app2.get("/api/services/semantic-search", noStore, readLimit, processReadLimit, semanticLimit, processSemanticLimit, async (req, res) => {
    const parsed = semanticSearchSchema.safeParse(req.query);
    if (!parsed.success) return failure(parsed.error, res);
    const { query, ...filters } = parsed.data;
    const exactFilters = { ...filters, searchQuery: query };
    try {
      const textMatches = await dependencies.searchServices(exactFilters);
      assertSearchSize(textMatches.length);
      if (textMatches.length) return res.json(textMatches.slice(0, filters.limit ?? 50));
      const candidates = await dependencies.getPublicServiceEmbeddings(filters);
      assertSearchSize(candidates.length);
      if (!candidates.length) return res.json([]);
      if (activeEmbeddings >= policy.concurrentEmbeddings) {
        res.set("Retry-After", "1");
        throw new SearchError(429, "SEARCH_RATE_LIMITED", "Search is busy. Please try again shortly.");
      }
      activeEmbeddings++;
      const controller = new AbortController();
      const onClose = () => {
        if (!res.writableEnded) controller.abort();
      };
      res.on("close", onClose);
      let queryEmbedding;
      try {
        queryEmbedding = await dependencies.generateEmbedding(query, { timeout: 8e3, maxRetries: 0, signal: controller.signal });
      } finally {
        activeEmbeddings--;
        res.off("close", onClose);
      }
      const scored = candidates.map((candidate) => ({ serviceId: candidate.serviceId, score: cosineSimilarity(queryEmbedding, candidate.embedding) })).filter((item) => Number.isFinite(item.score) && item.score >= 0.3).sort((a, b) => b.score - a.score || a.serviceId - b.serviceId);
      const resultLimit = Math.min(filters.limit ?? 50, MAX_SEMANTIC_RESULTS);
      res.set("X-Search-Truncated", String(scored.length > resultLimit));
      const ids = scored.slice(0, resultLimit).map((item) => item.serviceId);
      if (!ids.length) return res.json([]);
      const services4 = await dependencies.searchServices({ ...filters, serviceIds: ids });
      const positions = new Map(ids.map((id2, index2) => [id2, index2]));
      res.json(services4.filter((service) => positions.has(service.id)).sort((a, b) => positions.get(a.id) - positions.get(b.id)));
    } catch (error) {
      if (error instanceof SearchError || error instanceof z16.ZodError) return failure(error, res);
      try {
        const services4 = await dependencies.searchServices(exactFilters);
        assertSearchSize(services4.length);
        res.set("X-Search-Fallback", "true").json(services4.slice(0, filters.limit ?? 50));
      } catch (fallbackError) {
        failure(fallbackError, res);
      }
    }
  });
}

// server/searchLocationRoutes.ts
import { rateLimit as rateLimit3 } from "express-rate-limit";

// shared/search-location.ts
import { z as z17 } from "zod";
var searchLocationSchema = z17.discriminatedUnion("source", [
  z17.object({ source: z17.literal("device"), latitude: z17.number().finite().min(-90).max(90), longitude: z17.number().finite().min(-180).max(180) }).strict(),
  z17.object({ source: z17.literal("address"), inputText: z17.string().trim().min(1).max(300), placeId: z17.string().trim().min(1).max(512).optional() }).strict()
]);
var SEARCH_LOCATION_MAX_AGE = 180 * 24 * 60 * 60;

// server/searchLocationRoutes.ts
function setupSearchLocationRoutes(app2, authenticate, store) {
  const path7 = "/api/account/search-location";
  const limit = rateLimit3({ windowMs: 6e4, limit: 30, standardHeaders: "draft-7", legacyHeaders: false });
  app2.use(path7, (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app2.get(path7, limit, authenticate, async (req, res) => {
    try {
      res.json(await store.get(req.user.claims.sub));
    } catch {
      res.status(503).json({ code: "LOCATION_PREFERENCE_UNAVAILABLE" });
    }
  });
  app2.put(path7, authenticate, limit, async (req, res) => {
    const parsed = searchLocationSchema.safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ code: "INVALID_LOCATION_PREFERENCE" });
    try {
      await store.put(req.user.claims.sub, parsed.data);
      res.sendStatus(204);
    } catch {
      res.status(503).json({ code: "LOCATION_PREFERENCE_UNAVAILABLE" });
    }
  });
  app2.post(path7 + "/adopt", authenticate, limit, async (req, res) => {
    const parsed = searchLocationSchema.safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ code: "INVALID_LOCATION_PREFERENCE" });
    try {
      res.json(await store.adopt(req.user.claims.sub, parsed.data));
    } catch {
      res.status(503).json({ code: "LOCATION_PREFERENCE_UNAVAILABLE" });
    }
  });
  app2.delete(path7, authenticate, limit, async (req, res) => {
    try {
      await store.remove(req.user.claims.sub);
      res.sendStatus(204);
    } catch {
      res.status(503).json({ code: "LOCATION_PREFERENCE_UNAVAILABLE" });
    }
  });
}

// server/searchLocations.ts
import { eq as eq9 } from "drizzle-orm";
function locationFields(preference) {
  const value = searchLocationSchema.parse(preference);
  return value.source === "device" ? { source: value.source, latitude: value.latitude, longitude: value.longitude, inputText: null, placeId: null } : { source: value.source, inputText: value.inputText, placeId: value.placeId ?? null, latitude: null, longitude: null };
}
var searchLocationStore = {
  async get(userId) {
    const [row] = await db.select().from(userSearchLocations).where(eq9(userSearchLocations.userId, userId));
    if (!row) return null;
    return searchLocationSchema.parse(row.source === "device" ? { source: "device", latitude: row.latitude, longitude: row.longitude } : { source: "address", inputText: row.inputText, ...row.placeId ? { placeId: row.placeId } : {} });
  },
  async put(userId, preference) {
    const fields2 = locationFields(preference);
    await db.insert(userSearchLocations).values({ userId, ...fields2 }).onConflictDoUpdate({ target: userSearchLocations.userId, set: { ...fields2, updatedAt: /* @__PURE__ */ new Date() } });
  },
  async adopt(userId, preference) {
    await db.insert(userSearchLocations).values({ userId, ...locationFields(preference) }).onConflictDoNothing({ target: userSearchLocations.userId });
    return searchLocationStore.get(userId);
  },
  async remove(userId) {
    await db.delete(userSearchLocations).where(eq9(userSearchLocations.userId, userId));
  }
};

// server/payments.ts
function setupPaymentRoutes(app2, authenticate) {
  app2.post("/api/payments/process", authenticate, (_req, res) => {
    res.set("Cache-Control", "no-store").status(501).json({
      code: "PAYMENTS_UNAVAILABLE",
      message: "Online payment collection is not available."
    });
  });
}

// server/geocoding.ts
var GeocodingError = class extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
};
async function lookup(input, request) {
  if (typeof input !== "string" || !input.trim() || input.length > 500) {
    throw new GeocodingError(400, "INVALID_ADDRESS", "Enter an address of up to 500 characters.");
  }
  const key = process.env.GOOGLE_GEOCODING_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new GeocodingError(503, "NOT_CONFIGURED", "Address lookup is not configured.");
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", input.trim());
  url.searchParams.set("key", key);
  let response;
  let data;
  try {
    response = await request(url, { signal: AbortSignal.timeout(15e3) });
    data = await response.json();
  } catch {
    throw new GeocodingError(503, "UNAVAILABLE", "Address lookup is temporarily unavailable. Please try again.");
  }
  if (!data || typeof data !== "object") {
    throw new GeocodingError(503, "UNAVAILABLE", "Address lookup returned an invalid response.");
  }
  if (data.status === "ZERO_RESULTS") {
    throw new GeocodingError(404, "ZERO_RESULTS", "Address not found. Try the street address, town, and country.");
  }
  if (data.status === "REQUEST_DENIED") {
    const referrerRestricted = /refer(?:er|rer) restrictions/i.test(data.error_message || "");
    throw new GeocodingError(503, "REQUEST_DENIED", referrerRestricted ? "Address lookup is misconfigured: the backend needs a Geocoding API key with server IP restrictions, not website restrictions." : "Address lookup was denied by Google. Check the server API key, Geocoding API access, and billing.");
  }
  if (["OVER_QUERY_LIMIT", "OVER_DAILY_LIMIT"].includes(data.status) || response.status === 429) {
    throw new GeocodingError(503, data.status || "OVER_QUERY_LIMIT", "Address lookup has reached its quota or billing limit. Please try again later.");
  }
  if (data.status === "INVALID_REQUEST") {
    throw new GeocodingError(400, "INVALID_REQUEST", "Google could not process this address. Try the full street address.");
  }
  const result = data.results?.[0];
  const location = result?.geometry?.location;
  if (!response.ok || data.status !== "OK" || !Array.isArray(data.results) || !Number.isFinite(location?.lat) || !Number.isFinite(location?.lng)) {
    throw new GeocodingError(503, "UNAVAILABLE", "Address lookup is temporarily unavailable. Please try again.");
  }
  if (Math.abs(location.lat) > 90 || Math.abs(location.lng) > 180) {
    throw new GeocodingError(503, "UNAVAILABLE", "Address lookup returned invalid coordinates.");
  }
  return data.results;
}
async function geocodeRegisteredAddress(input, request = fetch) {
  const results = await lookup(input, request);
  const result = results[0];
  if (results.length !== 1 || result.partial_match || typeof result.place_id !== "string" || !result.place_id.trim() || !["ROOFTOP", "RANGE_INTERPOLATED"].includes(result.geometry.location_type || "") || !Array.isArray(result.types) || !result.types.some((type) => ["street_address", "premise", "subpremise", "establishment", "point_of_interest"].includes(type))) {
    throw new GeocodingError(422, "UNCERTAIN_MATCH", "The address did not match a specific location confidently. Add the street, building number, town and country, or enter coordinates manually.");
  }
  return { latitude: result.geometry.location.lat, longitude: result.geometry.location.lng, placeId: result.place_id };
}

// server/registeredLocations.ts
import { createHash as createHash4 } from "node:crypto";
import { and as and8, eq as eq10, isNull as isNull7, sql as sql6 } from "drizzle-orm";
var GOOGLE_COORDINATE_TTL = 29 * 24 * 60 * 60 * 1e3;
function databaseStore(connection2) {
  const store = {
    async manual(address, owner) {
      const rows = await connection2.select().from(addresses).where(and8(
        eq10(addresses.locationSource, "manual"),
        owner.companyId != null ? eq10(addresses.companyId, owner.companyId) : and8(eq10(addresses.providerId, owner.providerId), isNull7(addresses.companyId))
      ));
      return rows.find((row) => row.address && normalizeAddress(row.address) === normalizeAddress(address) && validCoordinates(row.latitude, row.longitude));
    },
    async get(key) {
      return (await connection2.select().from(geocodingCache).where(eq10(geocodingCache.addressKey, key)))[0];
    },
    async put(location) {
      await connection2.insert(geocodingCache).values(location).onConflictDoUpdate({ target: geocodingCache.addressKey, set: location });
    },
    async locked(key, action) {
      return connection2.transaction(async (tx) => {
        await tx.execute(sql6`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
        return action(databaseStore(tx));
      });
    }
  };
  return store;
}
var locationStore = databaseStore(db);
var addressKey = (address) => createHash4("sha256").update(normalizeAddress(address)).digest("hex");
var eligible = (row) => Boolean(row && row.expiresAt.getTime() > Date.now() && validCoordinates(row.latitude, row.longitude));
var googleLocation = (row) => ({
  latitude: row.latitude,
  longitude: row.longitude,
  locationSource: "google",
  locationKey: row.addressKey,
  locationPlaceId: row.placeId,
  locationExpiresAt: row.expiresAt,
  locationAddressSource: "user"
});
var inFlight = /* @__PURE__ */ new Map();
async function registerLocation(input, owner, store = locationStore, lookup2 = geocodeRegisteredAddress) {
  const error = addressError(input);
  if (error) throw new GeocodingError(400, "INVALID_ADDRESS", error);
  const address = input.trim();
  const manual = await store.manual(address, owner);
  if (manual) return {
    latitude: manual.latitude,
    longitude: manual.longitude,
    locationSource: "manual",
    locationKey: null,
    locationPlaceId: null,
    locationExpiresAt: null,
    reused: true
  };
  const key = addressKey(address);
  const cached = await store.get(key);
  if (eligible(cached)) return { ...googleLocation(cached), reused: true };
  const pending = inFlight.get(key);
  if (pending) return pending;
  const operation = store.locked(key, async (locked) => {
    const cached2 = await locked.get(key);
    if (eligible(cached2)) return { ...googleLocation(cached2), reused: true };
    const startedAt = Date.now();
    const result = await lookup2(address);
    const row = { addressKey: key, ...result, expiresAt: new Date(startedAt + GOOGLE_COORDINATE_TTL) };
    await locked.put(row);
    return { ...googleLocation(row), reused: false };
  });
  inFlight.set(key, operation);
  try {
    return await operation;
  } finally {
    if (inFlight.get(key) === operation) inFlight.delete(key);
  }
}
async function resolveServiceLocation(input, body, existing, store = locationStore) {
  if (body.locationSource !== void 0 && !["manual", "google", "legacy"].includes(String(body.locationSource))) {
    throw new GeocodingError(400, "INVALID_LOCATION", "Choose a valid coordinate source.");
  }
  if (existing && !["address", "latitude", "longitude", "locationSource", "locationKey"].some((key) => key in body)) return {};
  const address = input.address === void 0 ? existing?.address : input.address;
  const latitude = input.latitude === void 0 ? existing?.latitude : input.latitude;
  const longitude = input.longitude === void 0 ? existing?.longitude : input.longitude;
  if (existing && address === existing.address && latitude === existing.latitude && longitude === existing.longitude && body.locationSource !== "manual" && (body.locationKey == null || body.locationKey === existing.locationKey)) {
    return {
      locationSource: existing.locationSource,
      locationKey: existing.locationKey,
      locationPlaceId: existing.locationPlaceId,
      locationExpiresAt: existing.locationExpiresAt,
      locationAddressSource: existing.locationAddressSource
    };
  }
  const error = addressError(address);
  if (error || !validCoordinates(latitude, longitude)) throw new GeocodingError(400, "INVALID_LOCATION", error || "Provide valid latitude (\u221290 to 90) and longitude (\u2212180 to 180).");
  const changedAddress = existing && normalizeAddress(address) !== normalizeAddress(existing.address || "");
  if ((changedAddress || existing?.locationSource === "google" && body.locationSource === "manual") && !validCoordinates(input.latitude, input.longitude)) {
    throw new GeocodingError(400, "VERIFY_LOCATION", "A changed address or manual location needs a complete new coordinate pair.");
  }
  if (body.locationSource === "google") {
    const key = addressKey(address);
    const cached = body.locationKey === key ? await store.get(key) : void 0;
    if (!eligible(cached) || Math.abs(cached.latitude - latitude) > 1e-5 || Math.abs(cached.longitude - longitude) > 1e-5) {
      throw new GeocodingError(409, "LOCATION_EXPIRED", "Address verification has expired or changed. Verify the address again.");
    }
    return googleLocation(cached);
  }
  if (existing?.locationSource === "google" && body.locationSource !== "manual") {
    throw new GeocodingError(400, "VERIFY_LOCATION", "Verify the changed address or explicitly enter coordinates manually.");
  }
  return {
    address: address.trim(),
    latitude,
    longitude,
    locationSource: "manual",
    locationKey: null,
    locationPlaceId: null,
    locationExpiresAt: null,
    locationAddressSource: "user"
  };
}

// server/companyRoutes.ts
import { randomBytes as randomBytes2, randomUUID as randomUUID8, createHash as createHash5 } from "node:crypto";
import { and as and9, eq as eq11, gt as gt4, isNull as isNull8, ne as ne3, sql as sql7 } from "drizzle-orm";
import { z as z18 } from "zod";

// server/invitationEmail.ts
var failureReasons = {
  email_address_not_authorized: "recipient_restricted",
  over_email_send_rate_limit: "rate_limited",
  email_exists: "existing_account",
  user_already_exists: "existing_account"
};
function invitationEmailDiagnostic(error) {
  const details = typeof error === "object" && error !== null ? error : {};
  const providerCode = typeof details.code === "string" && Object.hasOwn(failureReasons, details.code) ? details.code : "other";
  return {
    event: "company_invitation_email_failed",
    reason: providerCode === "other" ? "provider_error" : failureReasons[providerCode],
    providerCode,
    status: typeof details.status === "number" && Number.isInteger(details.status) && details.status >= 400 && details.status <= 599 ? details.status : null
  };
}
async function sendInvitationEmailOnce(send, warn = (diagnostic) => console.warn("Company invitation email failed:", diagnostic)) {
  let failure6;
  try {
    const { error } = await send();
    if (!error) return true;
    failure6 = error;
  } catch (error) {
    failure6 = error;
  }
  try {
    warn(invitationEmailDiagnostic(failure6));
  } catch {
  }
  return false;
}

// server/companyRoutes.ts
var roleSchema2 = z18.enum(["admin", "provider", "viewer"]);
var assignmentSchema = z18.object({ role: roleSchema2, employeeId: z18.number().int().positive().nullable().default(null) }).refine((data) => data.role === "admin" || data.employeeId != null, { message: "Assign an employee for provider or read-only access." });
var hash = (token) => createHash5("sha256").update(token).digest("hex");
var tokenSchema = z18.string().regex(/^[a-f0-9]{64}$/);
var safe = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    const duplicate = error.code === "23505";
    const status = error instanceof AccessError ? error.status : error instanceof z18.ZodError ? 400 : duplicate ? 409 : 500;
    if (status === 500) console.error("Company request failed:", error.code ?? "Error");
    res.status(status).json({ message: error instanceof AccessError ? error.message : error instanceof z18.ZodError ? error.issues[0].message : duplicate ? "This employee or account is already assigned." : "Unable to complete the company request." });
  }
};
async function manager(tx, companyId, userId, ownerOnly = false) {
  const [company] = await tx.select().from(companies).where(eq11(companies.id, companyId)).for("update");
  const [membership] = await tx.select().from(companyMemberships).where(and9(eq11(companyMemberships.companyId, companyId), eq11(companyMemberships.userId, userId)));
  if (!company || !membership || (ownerOnly ? membership.role !== "owner" : !["owner", "admin"].includes(membership.role))) throw new AccessError(403, "Your access level does not allow this action.");
  return company;
}
async function assignment(tx, companyId, employeeId, exceptUserId) {
  if (employeeId == null) return;
  const [employee] = await tx.select().from(employees).where(and9(eq11(employees.id, employeeId), eq11(employees.companyId, companyId)));
  if (!employee) throw new AccessError(400, "Choose an employee from this company.");
  const [used] = await tx.select().from(companyMemberships).where(eq11(companyMemberships.employeeId, employeeId));
  if (used && used.userId !== exceptUserId) throw new AccessError(409, "This employee already has a team login.");
}
function setupCompanyRoutes(app2) {
  app2.use("/api", async (req, _res, next) => {
    if (req.session.auth) {
      try {
        req.workspace = await workspaceContext(req.session.auth.userId, req.session.activeCompanyId);
      } catch (error) {
        return next(error);
      }
    }
    next();
  });
  app2.get("/api/company/context", isAuthenticated, safe(async (req, res) => {
    const ctx = await workspaceContext(req.user.claims.sub, req.session.activeCompanyId);
    if (ctx.invalid) {
      req.session.activeCompanyId = null;
      await saveWorkspaceSession(req);
      res.json(await workspaceContext(req.user.claims.sub, null));
    } else res.json(ctx);
  }));
  app2.post("/api/company/context", isAuthenticated, safe(async (req, res) => {
    const id2 = z18.object({ companyId: z18.number().int().positive().nullable() }).parse(req.body).companyId;
    const ctx = await workspaceContext(req.user.claims.sub, id2);
    if (ctx.invalid) throw new AccessError(403, "You do not belong to this company.");
    req.session.activeCompanyId = id2;
    await saveWorkspaceSession(req);
    res.json(ctx);
  }));
  app2.get("/api/company/team", isAuthenticated, safe(async (req, res) => {
    const current = scope(req);
    if (!current.ctx.permissions.manageTeam && !current.ctx.permissions.isOwner) throw new AccessError(403, "Only company managers can view the team.");
    if (!current.companyId) throw new AccessError(400, "Choose a company workspace.");
    const members = await db.select({ userId: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName, role: companyMemberships.role, employeeId: companyMemberships.employeeId }).from(companyMemberships).innerJoin(users, eq11(users.id, companyMemberships.userId)).where(eq11(companyMemberships.companyId, current.companyId));
    const invitations = await db.select({ id: companyInvitations.id, email: companyInvitations.email, role: companyInvitations.role, employeeId: companyInvitations.employeeId, expiresAt: companyInvitations.expiresAt }).from(companyInvitations).where(and9(eq11(companyInvitations.companyId, current.companyId), isNull8(companyInvitations.acceptedAt), isNull8(companyInvitations.revokedAt), gt4(companyInvitations.expiresAt, /* @__PURE__ */ new Date())));
    res.json({ members, invitations });
  }));
  app2.post("/api/company/invitations", isAuthenticated, safe(async (req, res) => {
    const current = scope(req, "manageTeam");
    if (!current.companyId) throw new AccessError(400, "Choose a company workspace.");
    const data = assignmentSchema.and(z18.object({ email: z18.string().trim().email().max(254).transform((email) => email.toLowerCase()), sendEmail: z18.boolean().default(true) })).parse(req.body);
    const token = randomBytes2(32).toString("hex");
    const id2 = randomUUID8();
    await db.transaction(async (tx) => {
      await manager(tx, current.companyId, current.userId);
      await assignment(tx, current.companyId, data.employeeId);
      const [existing] = await tx.select().from(companyMemberships).innerJoin(users, eq11(companyMemberships.userId, users.id)).where(and9(eq11(companyMemberships.companyId, current.companyId), sql7`lower(${users.email}) = ${data.email}`));
      if (existing) throw new AccessError(409, "This user is already a company member. Edit their access instead.");
      await tx.update(companyInvitations).set({ revokedAt: /* @__PURE__ */ new Date() }).where(and9(eq11(companyInvitations.companyId, current.companyId), eq11(companyInvitations.email, data.email), isNull8(companyInvitations.acceptedAt), isNull8(companyInvitations.revokedAt)));
      if (data.employeeId != null) {
        const [pending] = await tx.select().from(companyInvitations).where(and9(eq11(companyInvitations.employeeId, data.employeeId), isNull8(companyInvitations.acceptedAt), isNull8(companyInvitations.revokedAt), gt4(companyInvitations.expiresAt, /* @__PURE__ */ new Date())));
        if (pending) throw new AccessError(409, "This employee already has a pending invitation.");
      }
      await tx.insert(companyInvitations).values({ id: id2, companyId: current.companyId, email: data.email, role: data.role, employeeId: data.employeeId, tokenHash: hash(token), invitedBy: current.userId, expiresAt: new Date(Date.now() + 7 * 864e5) });
    });
    let emailSent = false;
    if (data.sendEmail) {
      emailSent = await sendInvitationEmailOnce(() => supabaseAdmin.auth.admin.inviteUserByEmail(data.email, { redirectTo: `${appUrl}/api/callback` }));
    }
    res.status(201).json({ id: id2, invitationUrl: `${appUrl}/invite?token=${token}`, emailSent, message: emailSent ? "Invitation emailed." : "Invitation created. Share the invitation link with this email address." });
  }));
  app2.patch("/api/company/invitations/:id", isAuthenticated, safe(async (req, res) => {
    const current = scope(req, "manageTeam");
    if (!current.companyId) throw new AccessError(400, "Choose a company workspace.");
    const id2 = z18.string().uuid().parse(req.params.id);
    const data = assignmentSchema.parse(req.body);
    await db.transaction(async (tx) => {
      const company = await manager(tx, current.companyId, current.userId);
      if (!company.isActive) throw new AccessError(403, "This company is not active.");
      const [invite] = await tx.select().from(companyInvitations).where(and9(eq11(companyInvitations.id, id2), eq11(companyInvitations.companyId, company.id))).for("update");
      if (!invite) throw new AccessError(404, "Invitation not found.");
      if (invite.acceptedAt || invite.revokedAt || invite.expiresAt <= /* @__PURE__ */ new Date()) throw new AccessError(410, "Invitation is no longer available.");
      const [inviter] = await tx.select().from(companyMemberships).where(and9(eq11(companyMemberships.companyId, company.id), eq11(companyMemberships.userId, invite.invitedBy)));
      if (!inviter || !["owner", "admin"].includes(inviter.role)) throw new AccessError(410, "The invitation sender no longer manages this company.");
      await assignment(tx, company.id, data.employeeId);
      if (data.employeeId != null) {
        const [pending] = await tx.select().from(companyInvitations).where(and9(eq11(companyInvitations.companyId, company.id), eq11(companyInvitations.employeeId, data.employeeId), ne3(companyInvitations.id, id2), isNull8(companyInvitations.acceptedAt), isNull8(companyInvitations.revokedAt), gt4(companyInvitations.expiresAt, /* @__PURE__ */ new Date())));
        if (pending) throw new AccessError(409, "This employee already has a pending invitation.");
      }
      const updated = await tx.update(companyInvitations).set(data).where(and9(eq11(companyInvitations.id, id2), eq11(companyInvitations.companyId, company.id), isNull8(companyInvitations.acceptedAt), isNull8(companyInvitations.revokedAt), gt4(companyInvitations.expiresAt, /* @__PURE__ */ new Date()))).returning({ id: companyInvitations.id });
      if (!updated.length) throw new AccessError(410, "Invitation is no longer available.");
    });
    res.json({ success: true });
  }));
  app2.delete("/api/company/invitations/:id", isAuthenticated, safe(async (req, res) => {
    const current = scope(req, "manageTeam");
    const result = await db.update(companyInvitations).set({ revokedAt: /* @__PURE__ */ new Date() }).where(and9(eq11(companyInvitations.id, req.params.id), eq11(companyInvitations.companyId, current.companyId), isNull8(companyInvitations.acceptedAt))).returning();
    if (!result.length) throw new AccessError(404, "Invitation not found.");
    res.json({ success: true });
  }));
  app2.get("/api/company/invitation", safe(async (req, res) => {
    const token = tokenSchema.parse(req.query.token);
    const [result] = await db.select({ invitation: companyInvitations, company: companies }).from(companyInvitations).innerJoin(companies, eq11(companyInvitations.companyId, companies.id)).where(eq11(companyInvitations.tokenHash, hash(token)));
    if (!result || result.invitation.acceptedAt || result.invitation.revokedAt || result.invitation.expiresAt < /* @__PURE__ */ new Date() || !result.company.isActive) throw new AccessError(410, "This invitation has expired or is no longer available.");
    res.json({ id: result.invitation.id, companyName: result.company.name, role: result.invitation.role, emailHint: result.invitation.email.replace(/^(.).*(@.*)$/, "$1***$2") });
  }));
  app2.get("/api/company/my-invitations", isAuthenticated, safe(async (req, res) => {
    if (!req.user.emailVerified || !req.user.email) throw new AccessError(403, "Verify your email before joining a company.");
    const invitations = await db.select({ id: companyInvitations.id, companyName: companies.name, role: companyInvitations.role }).from(companyInvitations).innerJoin(companies, eq11(companies.id, companyInvitations.companyId)).where(and9(eq11(companyInvitations.email, req.user.email.toLowerCase()), isNull8(companyInvitations.acceptedAt), isNull8(companyInvitations.revokedAt), gt4(companyInvitations.expiresAt, /* @__PURE__ */ new Date()), eq11(companies.isActive, true)));
    res.json(invitations);
  }));
  app2.post("/api/company/invitations/accept", isAuthenticated, safe(async (req, res) => {
    const { id: id2 } = z18.object({ id: z18.string().uuid() }).parse(req.body);
    if (req.session.canSetInvitationPassword) throw new AccessError(403, "Set your password before accepting this invitation.");
    if (!req.user.emailVerified || !req.user.email) throw new AccessError(403, "Verify the invited email address before joining.");
    const companyId = await db.transaction(async (tx) => {
      const [lookup2] = await tx.select().from(companyInvitations).where(eq11(companyInvitations.id, id2));
      if (!lookup2) throw new AccessError(410, "Invitation is no longer available.");
      const [company] = await tx.select().from(companies).where(eq11(companies.id, lookup2.companyId)).for("update");
      const [invite] = await tx.select().from(companyInvitations).where(eq11(companyInvitations.id, id2)).for("update");
      if (!company?.isActive || invite.acceptedAt || invite.revokedAt || invite.expiresAt < /* @__PURE__ */ new Date()) throw new AccessError(410, "Invitation is no longer available.");
      if (invite.email !== req.user.email.toLowerCase()) throw new AccessError(403, "Sign in with the email address this invitation was sent to.");
      const [inviter] = await tx.select().from(companyMemberships).where(and9(eq11(companyMemberships.companyId, company.id), eq11(companyMemberships.userId, invite.invitedBy)));
      if (!inviter || !["owner", "admin"].includes(inviter.role)) throw new AccessError(410, "The invitation sender no longer manages this company.");
      await assignment(tx, company.id, invite.employeeId);
      await tx.insert(companyMemberships).values({ companyId: company.id, userId: req.user.claims.sub, role: invite.role, employeeId: invite.employeeId });
      await tx.update(companyInvitations).set({ acceptedAt: /* @__PURE__ */ new Date() }).where(eq11(companyInvitations.id, id2));
      await tx.update(users).set({ currentRole: "provider" }).where(eq11(users.id, req.user.claims.sub));
      return company.id;
    });
    req.session.activeCompanyId = companyId;
    await saveWorkspaceSession(req);
    res.json({ success: true });
  }));
  app2.patch("/api/company/members/:userId", isAuthenticated, safe(async (req, res) => {
    const current = scope(req, "manageTeam");
    const data = assignmentSchema.parse(req.body);
    await db.transaction(async (tx) => {
      await manager(tx, current.companyId, current.userId);
      const [target2] = await tx.select().from(companyMemberships).where(and9(eq11(companyMemberships.companyId, current.companyId), eq11(companyMemberships.userId, req.params.userId)));
      if (!target2) throw new AccessError(404, "Member not found.");
      if (target2.role === "owner") throw new AccessError(409, "Transfer ownership before changing the owner's access.");
      await assignment(tx, current.companyId, data.employeeId, target2.userId);
      await tx.update(companyMemberships).set(data).where(and9(eq11(companyMemberships.companyId, current.companyId), eq11(companyMemberships.userId, target2.userId)));
      if (!["owner", "admin"].includes(data.role)) await tx.update(companyInvitations).set({ revokedAt: /* @__PURE__ */ new Date() }).where(and9(eq11(companyInvitations.companyId, current.companyId), eq11(companyInvitations.invitedBy, target2.userId), isNull8(companyInvitations.acceptedAt)));
    });
    res.json({ success: true });
  }));
  app2.delete("/api/company/members/:userId", isAuthenticated, safe(async (req, res) => {
    const current = scope(req, "manageTeam");
    await db.transaction(async (tx) => {
      await manager(tx, current.companyId, current.userId);
      const [target2] = await tx.select().from(companyMemberships).where(and9(eq11(companyMemberships.companyId, current.companyId), eq11(companyMemberships.userId, req.params.userId)));
      if (!target2) throw new AccessError(404, "Member not found.");
      if (target2.role === "owner") throw new AccessError(409, "The company must retain an owner.");
      await tx.delete(companyMemberships).where(and9(eq11(companyMemberships.companyId, current.companyId), eq11(companyMemberships.userId, target2.userId)));
      await tx.update(companyInvitations).set({ revokedAt: /* @__PURE__ */ new Date() }).where(and9(eq11(companyInvitations.companyId, current.companyId), eq11(companyInvitations.invitedBy, target2.userId), isNull8(companyInvitations.acceptedAt)));
    });
    res.json({ success: true });
  }));
  app2.post("/api/company/transfer", isAuthenticated, safe(async (req, res) => {
    const current = scope(req, "isOwner");
    const userId = z18.object({ userId: z18.string().min(1) }).parse(req.body).userId;
    await db.transaction(async (tx) => {
      await manager(tx, current.companyId, current.userId, true);
      const [target2] = await tx.select().from(companyMemberships).where(and9(eq11(companyMemberships.companyId, current.companyId), eq11(companyMemberships.userId, userId)));
      if (!target2 || target2.userId === current.userId) throw new AccessError(400, "Choose another company member.");
      await tx.update(companyMemberships).set({ role: "admin" }).where(and9(eq11(companyMemberships.companyId, current.companyId), eq11(companyMemberships.userId, current.userId)));
      await tx.update(companyMemberships).set({ role: "owner" }).where(and9(eq11(companyMemberships.companyId, current.companyId), eq11(companyMemberships.userId, userId)));
      await tx.update(companies).set({ ownerId: userId }).where(eq11(companies.id, current.companyId));
    });
    res.json({ success: true });
  }));
  app2.patch("/api/company/active", isAuthenticated, safe(async (req, res) => {
    const current = scope(req, "isOwner");
    const active2 = z18.object({ isActive: z18.boolean() }).parse(req.body).isActive;
    await db.transaction(async (tx) => {
      await manager(tx, current.companyId, current.userId, true);
      await tx.update(companies).set({ isActive: active2 }).where(eq11(companies.id, current.companyId));
      if (!active2) await tx.update(companyInvitations).set({ revokedAt: /* @__PURE__ */ new Date() }).where(and9(eq11(companyInvitations.companyId, current.companyId), isNull8(companyInvitations.acceptedAt)));
    });
    res.json({ success: true });
  }));
}

// server/schedulingRoutes.ts
import { z as z19 } from "zod";
var timezoneSchema = z19.string().max(100).refine(validTimezone, "Choose a valid timezone.");
var dateSchema = z19.string().refine(validDateKey, "Choose a valid date.");
var monthSchema = z19.string().regex(/^(?:19|20|21)\d{2}-(?:0[1-9]|1[0-2])$/);
function monthBounds(month) {
  return { first: `${month}-01`, last: new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10) };
}
var clock2 = z19.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Use a time in HH:MM format.");
var intervals = z19.array(z19.object({ startTime: clock2, endTime: clock2 }).refine((value) => value.startTime < value.endTime, "End time must be after start time.")).max(8).refine((ranges) => [...ranges].sort((a, b) => a.startTime.localeCompare(b.startTime)).every((range, index2, sorted) => index2 === 0 || sorted[index2 - 1].endTime <= range.startTime), "Working hours must not overlap.");
var target = { serviceId: z19.number().int().positive().nullable(), timezone: timezoneSchema };
function failure2(error, res) {
  res.status(error instanceof AccessError || error instanceof CustomerBookingError ? error.status : error instanceof z19.ZodError ? 400 : 500).json({ message: error instanceof AccessError || error instanceof CustomerBookingError ? error.message : error instanceof z19.ZodError ? error.issues[0].message : "Unable to update availability. Please try again." });
}
async function serviceSlotData(serviceId2, first, last = first) {
  const service = await storage.getServiceById(serviceId2);
  if (!service?.isActive || !service.companyActive) throw new AccessError(404, "Service not found");
  const [schedules, bookings2] = await Promise.all([
    storage.getAvailabilityByProvider(service.providerId, service.companyId ?? void 0),
    storage.getBookingsForResourceRange(service, /* @__PURE__ */ new Date(`${addDateDays(first, -1)}T00:00:00Z`), /* @__PURE__ */ new Date(`${addDateDays(last, 2)}T00:00:00Z`))
  ]);
  return { service, schedules, bookings: bookings2 };
}
function setupSchedulingRoutes(app2) {
  app2.get("/api/availability/month/:serviceId", async (req, res) => {
    try {
      const id2 = z19.coerce.number().int().positive().parse(req.params.serviceId);
      const month = monthSchema.parse(req.query.month);
      const timezone = timezoneSchema.parse(req.query.timezone ?? "UTC");
      const { first, last } = monthBounds(month);
      const data = await serviceSlotData(id2, first, last), days = [];
      const now = /* @__PURE__ */ new Date();
      for (let date3 = first; date3 <= last; date3 = addDateDays(date3, 1)) days.push({ date: date3, availableSlots: bookableSlots({ ...data, date: date3, timezone, now }).length });
      res.json({ month, timezone, days });
    } catch (error) {
      failure2(error, res);
    }
  });
  app2.get("/api/availability/slots/:serviceId", async (req, res) => {
    try {
      const id2 = z19.coerce.number().int().positive().parse(req.params.serviceId);
      const date3 = dateSchema.parse(req.query.date), timezone = timezoneSchema.parse(req.query.timezone ?? "UTC");
      const data = await serviceSlotData(id2, date3);
      const slots = bookableSlots({ ...data, date: date3, timezone });
      res.json({ date: date3, timezone, serviceId: id2, serviceDuration: data.service.duration, slots, totalSlots: slots.length, availableSlots: slots.length });
    } catch (error) {
      failure2(error, res);
    }
  });
  app2.get("/api/bookings/:id/available-times", isAuthenticated, async (req, res) => {
    try {
      const id2 = z19.coerce.number().int().positive().parse(req.params.id);
      const booking = await storage.getBookingById(id2);
      assertBookingChange(req, booking);
      const timezone = timezoneSchema.parse(req.query.timezone ?? "UTC");
      const month = req.query.month == null ? null : monthSchema.parse(req.query.month);
      const { first, last } = month ? monthBounds(month) : { first: dateSchema.parse(req.query.date), last: dateSchema.parse(req.query.date) };
      const service = { ...booking.service, providerId: booking.providerId, companyId: booking.companyId, employeeId: booking.employeeId, duration: booking.bookingDuration ?? booking.service.duration, cleanupTime: booking.bookingCleanupTime ?? 0 };
      const [schedules, allBookings] = await Promise.all([
        storage.getAvailabilityByProvider(service.providerId, service.companyId ?? void 0),
        storage.getBookingsForResourceRange(service, /* @__PURE__ */ new Date(`${addDateDays(first, -1)}T00:00:00Z`), /* @__PURE__ */ new Date(`${addDateDays(last, 2)}T00:00:00Z`))
      ]);
      const bookings2 = allBookings.filter((row) => row.id !== id2), now = /* @__PURE__ */ new Date();
      if (month) {
        const days = [];
        for (let date3 = first; date3 <= last; date3 = addDateDays(date3, 1)) days.push({ date: date3, availableSlots: bookableSlots({ service, schedules, bookings: bookings2, date: date3, timezone, participantCount: booking.participantCount ?? 1, now }).length });
        res.json({ month, timezone, days });
      } else res.json({ slots: bookableSlots({ service, schedules, bookings: bookings2, date: first, timezone, participantCount: booking.participantCount ?? 1, now }) });
    } catch (error) {
      failure2(error, res);
    }
  });
  app2.put("/api/availability/weekly", isAuthenticated, async (req, res) => {
    try {
      const current = scope(req, "manageSchedules");
      const body = z19.object({ ...target, inherit: z19.boolean().default(false), days: z19.array(z19.object({ day: z19.number().int().min(0).max(6), intervals })).length(7).refine((days) => new Set(days.map((item) => item.day)).size === 7, "Include each weekday once.") }).parse(req.body);
      if (body.serviceId != null) assertService(req, await storage.getServiceById(body.serviceId), true);
      if (body.inherit && body.serviceId == null) throw new AccessError(400, "General working hours cannot inherit another schedule.");
      const rows = body.days.flatMap((day) => day.intervals.map((range) => ({ ...range, providerId: current.providerId, companyId: current.companyId ?? null, serviceId: body.serviceId, timezone: body.timezone, scheduleType: "recurring", daysOfWeek: [day.day], breaks: [], recurrenceEndType: "never", isActive: true })));
      if (!rows.length && !body.inherit) rows.push({ startTime: "00:00", endTime: "00:00", providerId: current.providerId, companyId: current.companyId ?? null, serviceId: body.serviceId, timezone: body.timezone, scheduleType: "recurring", daysOfWeek: [], breaks: [], recurrenceEndType: "never", isActive: true });
      await storage.replaceAvailability(current.providerId, current.companyId, body.serviceId, "recurring", body.inherit ? [] : rows);
      res.json({ success: true });
    } catch (error) {
      failure2(error, res);
    }
  });
  app2.put("/api/availability/override", isAuthenticated, async (req, res) => {
    try {
      const current = scope(req, "manageSchedules");
      const body = z19.object({ ...target, date: dateSchema, intervals }).parse(req.body);
      if (body.serviceId != null) assertService(req, await storage.getServiceById(body.serviceId), true);
      const specificDate = /* @__PURE__ */ new Date(`${body.date}T00:00:00Z`);
      const rows = (body.intervals.length ? body.intervals : [{ startTime: "00:00", endTime: "00:00" }]).map((range) => ({ ...range, providerId: current.providerId, companyId: current.companyId ?? null, serviceId: body.serviceId, timezone: body.timezone, scheduleType: "specific", specificDate, breaks: [], isActive: true }));
      await storage.replaceAvailability(current.providerId, current.companyId, body.serviceId, "specific", rows, specificDate);
      res.json({ success: true });
    } catch (error) {
      failure2(error, res);
    }
  });
  app2.delete("/api/availability/override", isAuthenticated, async (req, res) => {
    try {
      const current = scope(req, "manageSchedules");
      const serviceId2 = req.query.serviceId === "all" ? null : z19.coerce.number().int().positive().parse(req.query.serviceId);
      const date3 = dateSchema.parse(req.query.date);
      if (serviceId2 != null) assertService(req, await storage.getServiceById(serviceId2), true);
      await storage.replaceAvailability(current.providerId, current.companyId, serviceId2, "specific", [], /* @__PURE__ */ new Date(`${date3}T00:00:00Z`));
      res.json({ success: true });
    } catch (error) {
      failure2(error, res);
    }
  });
}

// server/adminRoutes.ts
import { z as z21 } from "zod";

// server/appAdmin.ts
function isAppAdmin(userId) {
  return Boolean(userId && (process.env.APP_ADMIN_USER_IDS ?? "").split(",").some((id2) => id2.trim() === userId));
}
var requireAppAdmin = (req, res, next) => {
  if (!req.user?.claims.sub) return denyWithAudit(req, "UNAUTHENTICATED", () => res.status(401).json({ message: "Unauthorized" }));
  if (!isAppAdmin(req.user.claims.sub)) return denyWithAudit(req, "FORBIDDEN", () => res.status(403).json({ message: "Application support access is required." }));
  next();
};

// shared/admin.ts
import { z as z20 } from "zod";
var adminUserFiltersSchema = z20.object({
  search: z20.string().trim().max(200).default(""),
  company: z20.string().trim().max(150).default(""),
  emailStatus: z20.enum(["all", "verified", "pending"]).default("all"),
  accountStatus: z20.enum(["all", "active", "blocked"]).default("all"),
  registeredFrom: z20.string().refine((value) => !value || validDateKey(value), "Choose a valid start date.").default(""),
  registeredTo: z20.string().refine((value) => !value || validDateKey(value), "Choose a valid end date.").default(""),
  timezone: z20.string().max(100).refine(validTimezone, "Choose a valid timezone.").default("UTC"),
  sortBy: z20.enum(["name", "registeredAt"]).default("registeredAt"),
  sortDirection: z20.enum(["asc", "desc"]).default("desc")
});
var defaultAdminUserFilters = adminUserFiltersSchema.parse({});

// server/admin-directory.ts
import { inArray as inArray4, or as or5 } from "drizzle-orm";
function companyAffiliations(records, memberships) {
  const byCompany = new Map(records.map((company) => [company.id, company]));
  const byUser = /* @__PURE__ */ new Map();
  function add(userId, company, role) {
    if (!byUser.has(userId)) byUser.set(userId, /* @__PURE__ */ new Map());
    byUser.get(userId).set(company.id, { id: company.id, name: company.name, isActive: company.isActive, role });
  }
  for (const membership of memberships) {
    const company = byCompany.get(membership.companyId);
    if (company) add(membership.userId, company, membership.role);
  }
  for (const company of records) add(company.ownerId, company, "owner");
  return new Map(Array.from(byUser, ([id2, values]) => [id2, Array.from(values.values()).sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id)]));
}
async function loadDirectorySubscriptions(userIds, companyIds) {
  if (!userIds.length && !companyIds.length) return /* @__PURE__ */ new Map();
  const rows = await db.select({
    userId: providerSubscriptions.userId,
    companyId: providerSubscriptions.companyId,
    plan: providerSubscriptions.plan,
    proUntil: providerSubscriptions.proUntil
  }).from(providerSubscriptions).where(or5(
    userIds.length ? inArray4(providerSubscriptions.userId, userIds) : void 0,
    companyIds.length ? inArray4(providerSubscriptions.companyId, companyIds) : void 0
  ));
  const now = Date.now();
  return new Map(rows.map((row) => [
    row.companyId != null ? `company:${row.companyId}` : `user:${row.userId}`,
    { enabled: hasPro(row, now), proUntil: row.proUntil?.toISOString() ?? null }
  ]));
}
var noPro = () => ({ enabled: false, proUntil: null });
async function loadCompanyAffiliations() {
  const [records, memberships] = await Promise.all([
    db.select({ id: companies.id, name: companies.name, ownerId: companies.ownerId, isActive: companies.isActive }).from(companies),
    db.select({ companyId: companyMemberships.companyId, userId: companyMemberships.userId, role: companyMemberships.role }).from(companyMemberships)
  ]);
  return companyAffiliations(records, memberships);
}
var text2 = (value) => typeof value === "string" ? value.trim().slice(0, 200) : "";
function directoryUser(user, now) {
  return {
    id: user.id,
    name: [text2(user.user_metadata?.first_name ?? user.user_metadata?.given_name), text2(user.user_metadata?.last_name ?? user.user_metadata?.family_name)].filter(Boolean).join(" ") || text2(user.user_metadata?.full_name ?? user.user_metadata?.name) || null,
    email: user.email || null,
    emailVerified: Boolean(user.email_confirmed_at),
    accountStatus: user.deleted_at || user.banned_until && Date.parse(user.banned_until) > now ? "blocked" : "active",
    proSubscription: noPro(),
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at || null,
    companies: []
  };
}
async function loadRegisteredUsers() {
  const result = /* @__PURE__ */ new Map();
  const batchSize = 1e3;
  const now = Date.now();
  for (let page = 1; ; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: batchSize });
    if (error) throw error;
    for (const user of data.users) result.set(user.id, directoryUser(user, now));
    if (data.users.length < batchSize) break;
  }
  return Array.from(result.values());
}
async function registeredUserDirectory(filters, requestedPage, pageSize, loadCompanies = loadCompanyAffiliations, loadSubscriptions = loadDirectorySubscriptions) {
  const [registered, affiliations] = await Promise.all([loadRegisteredUsers(), loadCompanies()]);
  const search = filters.search.toLocaleLowerCase();
  const companySearch = filters.company.toLocaleLowerCase();
  const filtered = registered.filter((user) => {
    user.companies = (affiliations.get(user.id) ?? []).map((company) => ({ ...company, proSubscription: noPro() }));
    if (search && ![user.name, user.email].some((value) => value?.toLocaleLowerCase().includes(search))) return false;
    if (companySearch && !user.companies.some((company) => company.name.toLocaleLowerCase().includes(companySearch))) return false;
    if (filters.emailStatus !== "all" && user.emailVerified !== (filters.emailStatus === "verified")) return false;
    if (filters.accountStatus !== "all" && user.accountStatus !== filters.accountStatus) return false;
    if (filters.registeredFrom || filters.registeredTo) {
      const day = dateInZone(new Date(user.createdAt), filters.timezone);
      if (filters.registeredFrom && day < filters.registeredFrom) return false;
      if (filters.registeredTo && day > filters.registeredTo) return false;
    }
    return true;
  });
  const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });
  const direction = filters.sortDirection === "asc" ? 1 : -1;
  filtered.sort((a, b) => {
    if (filters.sortBy === "name" && Boolean(a.name) !== Boolean(b.name)) return a.name ? -1 : 1;
    const comparison = filters.sortBy === "name" ? collator.compare(a.name ?? "", b.name ?? "") : Date.parse(a.createdAt) - Date.parse(b.createdAt);
    return comparison * direction || a.id.localeCompare(b.id);
  });
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const subscriptions = await loadSubscriptions(visible.map((user) => user.id), Array.from(new Set(visible.flatMap((user) => user.companies.map((company) => company.id)))));
  const users2 = visible.map((user) => ({
    ...user,
    proSubscription: subscriptions.get(`user:${user.id}`) ?? noPro(),
    companies: user.companies.map((company) => ({ ...company, proSubscription: subscriptions.get(`company:${company.id}`) ?? noPro() }))
  }));
  return { users: users2, page, pageSize, total, totalPages, hasNextPage: page < totalPages };
}

// server/adminRoutes.ts
var querySchema = adminUserFiltersSchema.extend({
  page: z21.coerce.number().int().min(1).max(1e5).default(1),
  pageSize: z21.coerce.number().refine((value) => [25, 50, 100].includes(value)).default(50)
}).strict().refine(
  (value) => !value.registeredFrom || !value.registeredTo || value.registeredFrom <= value.registeredTo,
  "The registration end date must be on or after the start date."
);
function setupAdminRoutes(app2, loadCompanies = loadCompanyAffiliations, loadSubscriptions = loadDirectorySubscriptions) {
  app2.get("/api/admin/access", isAuthenticated, (req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({ isAdmin: isAppAdmin(req.user.claims.sub) });
  });
  app2.get("/api/admin/users", isAuthenticated, requireAppAdmin, async (req, res) => {
    res.set("Cache-Control", "no-store");
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ message: "Choose valid directory filters, dates, and paging options." });
    try {
      const { page, pageSize, ...filters } = parsed.data;
      res.json(await registeredUserDirectory(filters, page, pageSize, loadCompanies, loadSubscriptions));
    } catch {
      res.status(503).json({ message: "Unable to load registered users. Please try again." });
    }
  });
}

// server/categoryRoutes.ts
import { z as z23 } from "zod";

// shared/categories.ts
import { z as z22 } from "zod";
var categoryKeySchema = z22.string().min(1).max(64).regex(/^[a-z][a-z0-9_]*$/, "Use lowercase letters, numbers, and underscores; start with a letter.").refine((value) => value !== "all", "This key is reserved.");
var categoryDetailsSchema = z22.object({
  name: z22.string().trim().min(1, "Category name is required.").max(100),
  icon: z22.string().trim().max(16).default(""),
  searchKeywords: z22.string().trim().max(1e3).default("")
}).strict();
var createCategorySchema = categoryDetailsSchema.extend({ key: categoryKeySchema });
var CategoryError = class extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
};

// server/categories.ts
import { asc as asc5, eq as eq12 } from "drizzle-orm";
var categoryStore = {
  list: () => db.select().from(categories).orderBy(asc5(categories.name), asc5(categories.key)),
  async create(input) {
    const [category] = await db.insert(categories).values(input).returning();
    return category;
  },
  async update(key, input) {
    const [category] = await db.update(categories).set(input).where(eq12(categories.key, key)).returning();
    if (!category) throw new CategoryError(404, "Category not found.");
    return category;
  },
  async remove(key) {
    const [category] = await db.delete(categories).where(eq12(categories.key, key)).returning();
    if (!category) throw new CategoryError(404, "Category not found.");
  }
};

// server/categoryRoutes.ts
function failure3(error, res) {
  const code = error?.cause?.code ?? error?.code;
  const status = error instanceof CategoryError ? error.status : error instanceof z23.ZodError ? 400 : ["23505", "23503"].includes(code) ? 409 : 503;
  res.status(status).json({ message: error instanceof CategoryError ? error.message : error instanceof z23.ZodError ? error.issues[0].message : code === "23505" ? "A category with this key or name already exists." : code === "23503" ? "This category is used by services. Reassign those services before deleting it." : "Unable to update or load categories. Please try again." });
}
function setupCategoryRoutes(app2, store = categoryStore) {
  app2.use(["/api/categories", "/api/admin/categories"], (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app2.get("/api/categories", async (_req, res) => {
    try {
      res.json(await store.list());
    } catch (error) {
      failure3(error, res);
    }
  });
  app2.post("/api/admin/categories", isAuthenticated, requireAppAdmin, async (req, res) => {
    try {
      res.status(201).json(await store.create(createCategorySchema.parse(req.body)));
    } catch (error) {
      failure3(error, res);
    }
  });
  app2.patch("/api/admin/categories/:key", isAuthenticated, requireAppAdmin, async (req, res) => {
    try {
      res.json(await store.update(categoryKeySchema.parse(req.params.key), categoryDetailsSchema.parse(req.body)));
    } catch (error) {
      failure3(error, res);
    }
  });
  app2.delete("/api/admin/categories/:key", isAuthenticated, requireAppAdmin, async (req, res) => {
    try {
      await store.remove(categoryKeySchema.parse(req.params.key));
      res.json({ message: "Category deleted." });
    } catch (error) {
      failure3(error, res);
    }
  });
}

// server/reviewRoutes.ts
import { z as z24 } from "zod";
function setupReviewRoutes(app2) {
  app2.patch("/api/bookings/:id/review", isAuthenticated, async (req, res) => {
    res.set("Cache-Control", "no-store");
    try {
      const id2 = z24.coerce.number().int().positive().max(2147483647).parse(req.params.id);
      const input = reviewSchema.parse(req.body);
      res.json(await storage.updateReview(id2, req.user.claims.sub, input));
    } catch (error) {
      res.status(error instanceof ReviewError ? error.status : error instanceof z24.ZodError ? 400 : 500).json({ message: error instanceof ReviewError ? error.message : error instanceof z24.ZodError ? error.issues[0].message : "Unable to save your review. Please try again." });
    }
  });
  app2.delete("/api/bookings/:id/review", isAuthenticated, async (req, res) => {
    res.set("Cache-Control", "no-store");
    try {
      const id2 = z24.coerce.number().int().positive().max(2147483647).parse(req.params.id);
      await storage.deleteReview(id2, req.user.claims.sub);
      res.status(204).end();
    } catch (error) {
      res.status(error instanceof ReviewError ? error.status : error instanceof z24.ZodError ? 400 : 500).json({ message: error instanceof ReviewError ? error.message : "Unable to delete your review. Please try again." });
    }
  });
  app2.get("/api/services/:id/reviews", async (req, res) => {
    res.set("Cache-Control", "no-store");
    try {
      const id2 = z24.coerce.number().int().positive().max(2147483647).parse(req.params.id);
      const { page } = z24.object({ page: z24.coerce.number().int().min(1).max(1e5).default(1) }).strict().parse(req.query);
      const result = await storage.getServiceReviews(id2, page);
      if (!result) return res.status(404).json({ message: "Service not found." });
      res.json(result);
    } catch (error) {
      res.status(error instanceof z24.ZodError ? 400 : 500).json({ message: "Unable to load reviews. Please try again." });
    }
  });
  app2.post("/api/bookings/:id/review", isAuthenticated, async (req, res) => {
    res.set("Cache-Control", "no-store");
    try {
      const id2 = z24.coerce.number().int().positive().max(2147483647).parse(req.params.id);
      const input = reviewSchema.parse(req.body);
      const review = await storage.createReview(id2, req.user.claims.sub, input);
      res.status(201).json(review);
    } catch (error) {
      res.status(error instanceof ReviewError ? error.status : error instanceof z24.ZodError ? 400 : 500).json({ message: error instanceof ReviewError ? error.message : error instanceof z24.ZodError ? error.issues[0].message : "Unable to save your review. Please try again." });
    }
  });
}

// shared/provider-catalog.ts
import { z as z25 } from "zod";
var providerCatalogSchema = z25.union([
  z25.object({ companyId: z25.coerce.number().int().positive().max(2147483647) }).strict(),
  z25.object({ providerId: z25.string().trim().min(1).max(128) }).strict()
]);

// server/providerCatalogRoutes.ts
function setupProviderCatalogRoutes(app2) {
  app2.get("/api/services/catalog", async (req, res) => {
    res.set("Cache-Control", "no-store");
    const parsed = providerCatalogSchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ message: "Choose one company or service provider." });
    try {
      res.json(await storage.searchServices(parsed.data));
    } catch {
      res.status(500).json({ message: "Unable to load this provider's services. Please try again." });
    }
  });
}

// server/storefrontRoutes.ts
import { z as z26 } from "zod";
function failure4(error, res) {
  const known = error instanceof StorefrontError || error instanceof AccessError || error instanceof ImageStorageError;
  const conflict2 = (error?.cause?.code ?? error?.code) === "23505";
  res.status(known ? error.status : error instanceof z26.ZodError ? 400 : conflict2 ? 409 : 503).json({ message: known ? error.message : error instanceof z26.ZodError ? error.issues[0].message : conflict2 ? "That storefront address is already taken." : "Unable to load or save storefront information. Please try again." });
}
function setupStorefrontRoutes(app2, store = storefrontStore, catalog = storage, validateImage = validateOwnedImage) {
  app2.use(["/api/storefronts", "/api/provider/storefront", "/api/admin/subscriptions"], (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app2.get("/api/storefronts/:slug", async (req, res) => {
    try {
      const { source, ...page } = await store.publicPage(storefrontSlugSchema.parse(req.params.slug));
      res.json({ ...page, services: await catalog.searchServices(source) });
    } catch (error) {
      failure4(error, res);
    }
  });
  const workspaceTarget = (req) => {
    const current = scope(req, "manageServices");
    return current.companyId != null ? { kind: "company", id: current.companyId } : { kind: "user", id: current.userId };
  };
  app2.get("/api/provider/storefront", isAuthenticated, async (req, res) => {
    try {
      res.json(await store.settings(workspaceTarget(req)));
    } catch (error) {
      failure4(error, res);
    }
  });
  app2.put("/api/provider/storefront", isAuthenticated, async (req, res) => {
    try {
      const target2 = workspaceTarget(req);
      const input = storefrontSchema.parse(req.body);
      const settings = await store.settings(target2);
      if (!settings.hasPro) throw new StorefrontError(403, "An active Pro subscription is required.");
      for (const field of ["logoUrl", "coverUrl"]) {
        if (input[field] && input[field] !== settings.storefront?.[field]) await validateImage(input[field], req.user.claims.sub);
      }
      res.json(await store.save(target2, input));
    } catch (error) {
      failure4(error, res);
    }
  });
  app2.get("/api/admin/subscriptions/options", isAuthenticated, requireAppAdmin, async (req, res) => {
    try {
      res.json(await store.adminOptions(subscriptionOptionsSchema.parse(req.query)));
    } catch (error) {
      failure4(error, res);
    }
  });
  app2.get("/api/admin/subscriptions", isAuthenticated, requireAppAdmin, async (req, res) => {
    try {
      res.json(await store.adminGet(subscriptionTargetSchema.parse(req.query)));
    } catch (error) {
      failure4(error, res);
    }
  });
  app2.put("/api/admin/subscriptions", isAuthenticated, requireAppAdmin, async (req, res) => {
    try {
      res.json(await store.adminUpdate(subscriptionUpdateSchema.parse(req.body), req.user.claims.sub));
    } catch (error) {
      failure4(error, res);
    }
  });
}

// server/routes.ts
import { eq as eq17 } from "drizzle-orm";
init_capture();

// server/serviceViewRoutes.ts
import { rateLimit as rateLimit4 } from "express-rate-limit";
import { z as z27 } from "zod";
var empty = z27.object({}).strict();
var serviceId = z27.string().regex(/^[1-9][0-9]{0,9}$/).refine((value) => Number(value) <= 2147483647);
function setupServiceViewRoutes(app2, dependencies) {
  const limit = rateLimit4({ windowMs: 6e4, limit: 60, standardHeaders: "draft-7", legacyHeaders: false });
  app2.post("/api/services/:id/view", limit, async (req, res) => {
    res.set("Cache-Control", "no-store");
    const parsed = serviceId.safeParse(req.params.id);
    if (!parsed.success || !empty.safeParse(req.body === void 0 ? {} : req.body).success || !empty.safeParse(req.query).success) {
      return void res.status(400).json({ message: "Invalid service view notification" });
    }
    const id2 = Number(parsed.data);
    let service;
    try {
      service = await dependencies.getService(id2);
    } catch {
      return void res.status(503).json({ message: "Service is temporarily unavailable" });
    }
    if (!service || service.id !== id2 || !service.isActive || !service.companyActive) {
      return void res.status(404).json({ message: "Service not found" });
    }
    if (serviceViewAuditEnabled() || dependencies.recordProductView) {
      let actor2 = { kind: "anonymous" };
      const auth = req.session?.auth;
      if (typeof auth?.accessToken === "string" && auth.accessToken && typeof auth.userId === "string") {
        try {
          actor2 = await dependencies.verifyActor(auth.accessToken, auth.userId);
        } catch {
        }
      }
      if (serviceViewAuditEnabled()) await recordServiceView(req, id2, actor2);
      if (dependencies.recordProductView) {
        try {
          await dependencies.recordProductView(id2, actor2.kind === "user" ? actor2.userId : null);
        } catch {
          console.error("Product service-view capture unavailable.");
        }
      }
    }
    res.sendStatus(204);
  });
}

// server/notifications/routes.ts
import { rateLimit as rateLimit5 } from "express-rate-limit";
import { and as and11, desc as desc4, eq as eq14, ne as ne4 } from "drizzle-orm";
import { z as z28 } from "zod";

// server/notifications/preferences.ts
import { randomUUID as randomUUID9 } from "node:crypto";
import { and as and10, desc as desc3, eq as eq13, gt as gt5, sql as sql8 } from "drizzle-orm";
async function getCommunicationSettings(userId) {
  const prefs = await preferencesFor(db, userId);
  return {
    phone: prefs.phone,
    phoneVerified: Boolean(prefs.phoneVerifiedAt),
    preferredMethod: prefs.preferredMethod,
    language: prefs.language,
    smsOptIn: prefs.smsOptIn,
    whatsappOptIn: prefs.whatsappOptIn,
    verificationAvailable: verificationReady(notificationConfig())
  };
}
async function updateCommunicationSettings(userId, input) {
  const patch = communicationPatchSchema.parse(input);
  await db.transaction(async (tx) => {
    await tx.insert(userCommunicationPreferences).values({ userId }).onConflictDoNothing();
    const [current] = await tx.select().from(userCommunicationPreferences).where(eq13(userCommunicationPreferences.userId, userId)).for("update");
    const phoneChanged = patch.phone !== void 0 && patch.phone !== current.phone;
    const next = { ...current, ...patch, ...phoneChanged ? { phoneVerifiedAt: null, smsOptIn: false, whatsappOptIn: false, preferredMethod: "email" } : {}, updatedAt: /* @__PURE__ */ new Date() };
    if ((!next.phoneVerifiedAt || !next.phone) && (next.smsOptIn || next.whatsappOptIn)) throw new NotificationError(400, "unverified_phone", "Verify your phone number before enabling phone communications.");
    if (patch.preferredMethod === void 0 && (next.preferredMethod === "sms" && !next.smsOptIn || next.preferredMethod === "whatsapp" && !next.whatsappOptIn)) next.preferredMethod = "email";
    if (next.preferredMethod && next.preferredMethod !== "email" && channelReason(next.preferredMethod, next, null)) throw new NotificationError(400, "missing_permission", "Verify your phone and allow the selected communication method.");
    await tx.update(userCommunicationPreferences).set(next).where(eq13(userCommunicationPreferences.userId, userId));
    if (phoneChanged) await tx.update(phoneVerificationChallenges).set({ status: "expired", updatedAt: /* @__PURE__ */ new Date() }).where(and10(eq13(phoneVerificationChallenges.userId, userId), eq13(phoneVerificationChallenges.status, "pending")));
  });
  return getCommunicationSettings(userId);
}
async function startPhoneVerification(userId) {
  const config = notificationConfig();
  if (!verificationReady(config)) throw new NotificationError(503, "not_configured", "Phone verification is not available yet.");
  const challenge = await db.transaction(async (tx) => {
    await tx.insert(userCommunicationPreferences).values({ userId }).onConflictDoNothing();
    const [prefs] = await tx.select().from(userCommunicationPreferences).where(eq13(userCommunicationPreferences.userId, userId)).for("update");
    if (!prefs.phone) throw new NotificationError(400, "missing_phone", "Save an international phone number first.");
    if (prefs.phoneVerifiedAt) throw new NotificationError(409, "already_verified", "This phone number is already verified.");
    await tx.execute(sql8`SELECT pg_advisory_xact_lock(hashtextextended(${prefs.phone}, 32032))`);
    const now = /* @__PURE__ */ new Date();
    const recent = await tx.select().from(phoneVerificationChallenges).where(and10(eq13(phoneVerificationChallenges.userId, userId), gt5(phoneVerificationChallenges.createdAt, new Date(now.getTime() - 864e5)))).orderBy(desc3(phoneVerificationChallenges.createdAt)).limit(11);
    const phoneRecent = await tx.select({ id: phoneVerificationChallenges.id }).from(phoneVerificationChallenges).where(and10(eq13(phoneVerificationChallenges.phone, prefs.phone), gt5(phoneVerificationChallenges.createdAt, new Date(now.getTime() - 36e5)))).limit(6);
    if (recent.length >= 10 || phoneRecent.length >= 5 || recent.some((value) => value.nextSendAt > now)) throw new NotificationError(429, "rate_limited", "Wait before requesting another verification code.");
    await tx.update(phoneVerificationChallenges).set({ status: "expired", updatedAt: now }).where(and10(eq13(phoneVerificationChallenges.userId, userId), eq13(phoneVerificationChallenges.status, "pending")));
    const [created] = await tx.insert(phoneVerificationChallenges).values({
      id: randomUUID9(),
      userId,
      phone: prefs.phone,
      expiresAt: new Date(now.getTime() + 3e5),
      nextSendAt: new Date(now.getTime() + 6e4),
      createdAt: now
    }).returning();
    return created;
  });
  try {
    const requestId = await createTransports(config).startVerification(challenge.phone);
    await db.update(phoneVerificationChallenges).set({ providerRequestId: requestId, updatedAt: /* @__PURE__ */ new Date() }).where(and10(eq13(phoneVerificationChallenges.id, challenge.id), eq13(phoneVerificationChallenges.status, "pending")));
    return { status: "pending", expiresAt: challenge.expiresAt.toISOString(), nextSendAt: challenge.nextSendAt.toISOString() };
  } catch (error) {
    await db.update(phoneVerificationChallenges).set({ status: error instanceof TransportError && error.outcome === "failed" ? "failed" : "unknown", updatedAt: /* @__PURE__ */ new Date() }).where(eq13(phoneVerificationChallenges.id, challenge.id));
    throw new NotificationError(503, "verification_failed", "Verification could not be started. Wait before trying again.");
  }
}
async function checkPhoneVerification(userId, code) {
  const config = notificationConfig();
  if (!verificationReady(config)) throw new NotificationError(503, "not_configured", "Phone verification is not available yet.");
  const challenge = await db.transaction(async (tx) => {
    await tx.select().from(userCommunicationPreferences).where(eq13(userCommunicationPreferences.userId, userId)).for("update");
    const [current] = await tx.select().from(phoneVerificationChallenges).where(and10(eq13(phoneVerificationChallenges.userId, userId), eq13(phoneVerificationChallenges.status, "pending"))).orderBy(desc3(phoneVerificationChallenges.createdAt)).limit(1).for("update");
    if (!current?.providerRequestId || current.expiresAt <= /* @__PURE__ */ new Date() || current.attemptCount >= 3) throw new NotificationError(400, "verification_expired", "Request a new verification code.");
    await tx.update(phoneVerificationChallenges).set({ attemptCount: current.attemptCount + 1, updatedAt: /* @__PURE__ */ new Date() }).where(eq13(phoneVerificationChallenges.id, current.id));
    return current;
  });
  let valid = false;
  try {
    valid = await createTransports(config).checkVerification(challenge.providerRequestId, code);
  } catch (error) {
    if (error instanceof TransportError && error.outcome === "unknown") {
      await db.update(phoneVerificationChallenges).set({ status: "unknown", updatedAt: /* @__PURE__ */ new Date() }).where(eq13(phoneVerificationChallenges.id, challenge.id));
      throw new NotificationError(503, "verification_unknown", "Verification result is unknown. Request a new code later.");
    }
  }
  if (!valid) throw new NotificationError(400, "incorrect_code", "The verification code is incorrect or expired.");
  await db.transaction(async (tx) => {
    const [prefs] = await tx.select().from(userCommunicationPreferences).where(eq13(userCommunicationPreferences.userId, userId)).for("update");
    const [current] = await tx.select().from(phoneVerificationChallenges).where(eq13(phoneVerificationChallenges.id, challenge.id)).for("update");
    if (prefs?.phone !== challenge.phone || current?.status !== "pending" || current.expiresAt <= /* @__PURE__ */ new Date()) throw new NotificationError(409, "phone_changed", "The phone number or verification request has changed.");
    await tx.update(userCommunicationPreferences).set({ phoneVerifiedAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() }).where(eq13(userCommunicationPreferences.userId, userId));
    await tx.update(phoneVerificationChallenges).set({ status: "verified", updatedAt: /* @__PURE__ */ new Date() }).where(eq13(phoneVerificationChallenges.id, challenge.id));
  });
  return { status: "verified" };
}

// server/notifications/routes.ts
function handle(action) {
  return (req, res) => {
    void (async () => {
      res.set("Cache-Control", "private, no-store");
      try {
        await action(req, res);
      } catch (error) {
        const known = error instanceof NotificationError || error instanceof AccessError;
        res.status(known ? error.status : error instanceof z28.ZodError ? 400 : 500).json({ message: known ? error.message : error instanceof z28.ZodError ? error.issues[0].message : "Unable to process notifications.", ...error instanceof NotificationError ? { code: error.code } : {} });
      }
    })();
  };
}
function setupNotificationRoutes(app2) {
  const requireEnabled = (_req, res, next) => {
    if (!notificationConfig().enabled) return void res.status(503).json({ code: "feature_disabled", message: "Notifications are not available yet." });
    next();
  };
  const verificationLimit = rateLimit5({ windowMs: 36e5, limit: 30, standardHeaders: "draft-8", legacyHeaders: false });
  app2.get("/api/account/communication", isAuthenticated, requireEnabled, handle(async (req, res) => res.json(await getCommunicationSettings(req.user.claims.sub))));
  app2.patch("/api/account/communication", isAuthenticated, requireEnabled, handle(async (req, res) => res.json(await updateCommunicationSettings(req.user.claims.sub, req.body))));
  app2.post("/api/account/communication/verify/start", isAuthenticated, requireEnabled, verificationLimit, handle(async (req, res) => {
    z28.object({}).strict().parse(req.body);
    res.json(await startPhoneVerification(req.user.claims.sub));
  }));
  app2.post("/api/account/communication/verify/check", isAuthenticated, requireEnabled, verificationLimit, handle(async (req, res) => {
    const { code } = z28.object({ code: z28.string().regex(/^\d{6}$/) }).strict().parse(req.body);
    res.json(await checkPhoneVerification(req.user.claims.sub, code));
  }));
  app2.get("/api/notifications/capabilities", isAuthenticated, handle(async (req, res) => {
    const current = scope(req), config = notificationConfig();
    const capability = {
      hasPro: await workspacePro(db, current),
      automationEnabled: config.automationEnabled,
      channels: { email: transportReady(config, "email"), sms: transportReady(config, "sms"), whatsapp: transportReady(config, "whatsapp") }
    };
    res.json(capability);
  }));
  app2.get("/api/bookings/:id/notifications", isAuthenticated, requireEnabled, handle(async (req, res) => {
    const id2 = z28.coerce.number().int().positive().parse(req.params.id), booking = await storage.getBookingById(id2);
    assertBooking(req, booking, true);
    res.json(await bookingNotificationState(db, booking));
  }));
  app2.post("/api/bookings/:id/notification-preview", isAuthenticated, requireEnabled, handle(async (req, res) => {
    const id2 = z28.coerce.number().int().positive().parse(req.params.id);
    const input = z28.object({ kind: z28.enum(["status", "reminder"]), eventId: z28.string().uuid().optional(), timeZone: notificationTimezoneSchema }).strict().parse(req.body);
    const booking = await storage.getBookingById(id2);
    assertBooking(req, booking, true);
    if (await workspacePro(db, booking) && (input.kind !== "reminder" || booking.service.reminderEnabled !== false)) {
      throw new NotificationError(409, "automatic_mode", "This workspace uses automatic notifications.");
    }
    let kind = "reminder", oldDate = null, date3 = booking.scheduledDate, timeZone = input.timeZone;
    if (input.kind === "reminder") {
      if (booking.status !== "confirmed" || booking.scheduledDate <= /* @__PURE__ */ new Date()) throw new NotificationError(409, "reminder_ineligible", "Only future confirmed appointments can receive a reminder.");
    } else {
      const [event] = await db.select().from(notificationEvents).where(and11(
        eq14(notificationEvents.bookingId, id2),
        ne4(notificationEvents.kind, "reminder"),
        eq14(notificationEvents.bookingRevision, booking.notificationRevision),
        input.eventId ? eq14(notificationEvents.id, input.eventId) : void 0
      )).orderBy(desc4(notificationEvents.createdAt)).limit(1);
      if (!event || event.createdAt.getTime() < Date.now() - 30 * 864e5) throw new NotificationError(409, "superseded", "This booking update is no longer available.");
      kind = event.kind;
      oldDate = event.previousScheduledDate;
      date3 = event.scheduledDate;
      timeZone = event.timezone;
    }
    const preferences = await preferencesFor(db, booking.seekerId);
    const rendered = renderMessage({ kind, service: booking.service.name, date: date3, oldDate, language: preferences.language, timeZone });
    res.json(manualPreview({ ...rendered, preferences, email: booking.seeker.email, customerName: [booking.seeker.firstName, booking.seeker.lastName].filter(Boolean).join(" ") || "Customer" }));
  }));
}

// server/appointments/routes.ts
import { rateLimit as rateLimit6 } from "express-rate-limit";
import { z as z30 } from "zod";

// shared/appointment-collaboration.ts
import { z as z29 } from "zod";
var messageInputSchema = z29.object({ body: z29.string().trim().min(1).max(4e3), clientRequestId: z29.string().uuid() }).strict();
var eventBookingIdsSchema = z29.array(z29.number().int().positive()).min(1).max(500).refine((ids) => new Set(ids).size === ids.length, "Duplicate booking IDs are not allowed.");
var rescheduleInputSchema = z29.object({
  scheduledDate: z29.string().datetime(),
  fallback: z29.enum(["keep_original", "cancel_booking"]),
  note: z29.string().trim().max(2e3).optional(),
  timeZone: z29.string().min(1).max(100).refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }),
  clientRequestId: z29.string().uuid()
}).strict();
function appointmentEventKey(booking) {
  if (booking.service?.serviceType !== "group") return `booking:${booking.id}`;
  return JSON.stringify([
    booking.companyId ?? null,
    booking.providerId,
    booking.serviceId,
    booking.employeeId ?? null,
    new Date(booking.scheduledDate).toISOString(),
    booking.bookingDuration ?? booking.service.duration,
    booking.bookingCleanupTime ?? 0
  ]);
}

// server/appointments/repository.ts
import { randomUUID as randomUUID10 } from "node:crypto";
import { and as and12, asc as asc6, desc as desc5, eq as eq15, inArray as inArray5, isNotNull, isNull as isNull9, lt as lt2, ne as ne5, or as or6, sql as sql9 } from "drizzle-orm";
var AppointmentError = class extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
};
var active = (booking) => booking.status === "confirmed" || booking.status === "pending";
var fail = (status, code, message) => {
  throw new AppointmentError(status, code, message);
};
function createAppointmentRepository(database, now = () => /* @__PURE__ */ new Date()) {
  async function load(database2, id2) {
    const [booking] = await database2.select().from(bookings).where(eq15(bookings.id, id2));
    if (!booking) return fail(404, "booking_not_found", "Reservation not found.");
    const [service] = await database2.select().from(services).where(eq15(services.id, booking.serviceId));
    if (!service) return fail(409, "service_unavailable", "The service is no longer available.");
    return { ...booking, service };
  }
  async function authorize2(database2, actor2, booking, write) {
    if (actor2.role === "customer") {
      if (actor2.id !== booking.seekerId) fail(403, "forbidden", "This conversation does not belong to you.");
      return;
    }
    if (booking.companyId == null) {
      if (actor2.companyId != null || booking.providerId !== actor2.id) fail(403, "forbidden", "Reservation is not in this workspace.");
      return;
    }
    if (actor2.companyId !== booking.companyId) fail(403, "forbidden", "Reservation is not in this workspace.");
    const [company] = await database2.select().from(companies).where(eq15(companies.id, booking.companyId));
    const [membership] = await database2.select().from(companyMemberships).where(and12(eq15(companyMemberships.companyId, booking.companyId), eq15(companyMemberships.userId, actor2.id)));
    if (!company?.isActive || !membership || write && membership.role === "viewer") fail(403, "forbidden", "Your access level does not allow this action.");
    if (membership.role !== "owner" && membership.role !== "admin" && (membership.employeeId == null || membership.employeeId !== booking.employeeId)) fail(403, "forbidden", "This reservation is not assigned to you.");
  }
  async function locked(actor2, id2, action) {
    return database.transaction(async (tx) => {
      const initial = await load(tx, id2);
      await tx.execute(sql9`SELECT id FROM users WHERE id = ${initial.providerId} FOR UPDATE`);
      const [row] = await tx.select().from(bookings).where(eq15(bookings.id, id2)).for("update");
      if (!row) return fail(404, "booking_not_found", "Reservation not found.");
      const [service] = await tx.select().from(services).where(eq15(services.id, row.serviceId));
      if (!service) return fail(409, "service_unavailable", "The service is no longer available.");
      const booking = { ...row, service };
      await authorize2(tx, actor2, booking, true);
      return action(tx, booking);
    });
  }
  async function eventRows(tx, actor2, anchor, action, expected, allowClosedRetry = false) {
    if (actor2.role !== "provider") fail(403, "forbidden", "Only the provider can manage a whole event.");
    if (anchor.service.serviceType !== "group") fail(409, "not_group", "This reservation is not a group event.");
    const rows = await tx.select().from(bookings).where(and12(
      eq15(bookings.providerId, anchor.providerId),
      eq15(bookings.serviceId, anchor.serviceId),
      eq15(bookings.scheduledDate, anchor.scheduledDate),
      anchor.companyId == null ? isNull9(bookings.companyId) : eq15(bookings.companyId, anchor.companyId),
      anchor.employeeId == null ? isNull9(bookings.employeeId) : eq15(bookings.employeeId, anchor.employeeId)
    )).orderBy(asc6(bookings.id)).limit(501);
    if (rows.length > 500) fail(409, "event_too_large", "This event has too many bookings for one operation.");
    const key = appointmentEventKey(anchor);
    const matching = rows.filter((row) => appointmentEventKey({ ...row, service: anchor.service }) === key);
    const selected3 = matching.filter((row) => action === "complete" ? row.status === "confirmed" : active(row));
    if (expected) {
      const requested = [...expected].sort((a, b) => a - b), actual = selected3.map((row) => row.id).sort((a, b) => a - b);
      if (requested.length !== actual.length || requested.some((id2, index2) => id2 !== actual[index2])) {
        const closed = matching.filter((row) => requested.includes(row.id));
        if (allowClosedRetry && closed.length === requested.length && closed.every((row) => row.status === (action === "complete" ? "completed" : "cancelled"))) return closed;
        fail(409, "event_changed", "The event's bookings changed. Review the affected bookings again.");
      }
    }
    if (!selected3.length) fail(409, "no_eligible_bookings", "No active bookings are eligible for this action.");
    return selected3;
  }
  async function invalidate(tx, bookingId) {
    await tx.update(bookingRescheduleRequests).set({ state: "superseded" }).where(and12(eq15(bookingRescheduleRequests.bookingId, bookingId), eq15(bookingRescheduleRequests.state, "pending")));
  }
  function requestView(request, actor2, booking) {
    const valid = request.state === "pending" && active(booking) && request.baseRevision === booking.notificationRevision && request.originalScheduledDate.getTime() === booking.scheduledDate.getTime();
    return {
      id: request.id,
      bookingId: request.bookingId,
      requestedById: request.requestedById,
      requestedByRole: request.requestedByRole,
      originalScheduledDate: request.originalScheduledDate.toISOString(),
      proposedScheduledDate: request.proposedScheduledDate.toISOString(),
      fallback: request.fallback,
      state: request.state === "pending" && !valid ? "superseded" : request.state,
      note: request.note,
      timezone: request.timezone,
      createdAt: request.createdAt.toISOString(),
      respondedAt: request.respondedAt?.toISOString() ?? null,
      canRespond: valid && actor2.role !== request.requestedByRole,
      canWithdraw: valid && actor2.id === request.requestedById,
      batchId: actor2.role === "provider" ? request.batchId : null
    };
  }
  async function validateNewTime(tx, booking, date3) {
    if (!active(booking)) fail(409, "booking_closed", "Only pending or confirmed bookings can be rescheduled.");
    if (!(date3 > now()) || date3.getTime() === booking.scheduledDate.getTime()) fail(409, "invalid_time", "Choose a different future appointment time.");
    const schedules = await tx.select().from(availability).where(and12(booking.companyId != null ? eq15(availability.companyId, booking.companyId) : and12(eq15(availability.providerId, booking.providerId), isNull9(availability.companyId)), eq15(availability.isActive, true)));
    const snapshot = { ...booking.service, duration: booking.bookingDuration ?? booking.service.duration, cleanupTime: booking.bookingCleanupTime ?? 0 };
    const offered = bookableSlots({ service: snapshot, schedules, bookings: [], date: date3.toISOString().slice(0, 10), timezone: "UTC", now: now() });
    if (!offered.some((slot) => slot.startsAt === date3.toISOString())) fail(409, "time_unavailable", "Choose a time within the available working hours.");
    const end = new Date(date3.getTime() + (snapshot.duration + snapshot.cleanupTime) * 6e4);
    const occupied = await tx.select().from(bookings).where(and12(
      ne5(bookings.id, booking.id),
      eq15(bookings.providerId, booking.providerId),
      inArray5(bookings.status, ["confirmed", "completed"]),
      booking.employeeId == null ? isNull9(bookings.employeeId) : eq15(bookings.employeeId, booking.employeeId),
      lt2(bookings.scheduledDate, end),
      sql9`${bookings.scheduledDate} + (COALESCE(${bookings.bookingDuration}, (SELECT ${services.duration} FROM ${services} WHERE ${services.id} = ${bookings.serviceId}), 60) + COALESCE(${bookings.bookingCleanupTime}, 0)) * interval '1 minute' > ${date3.toISOString()}::timestamp`
    )).limit(5001);
    if (occupied.length > 5e3) fail(409, "time_unavailable", "Availability needs to be reviewed. Choose another time.");
    const legacyServiceIds = Array.from(new Set(occupied.filter((row) => row.bookingDuration == null).map((row) => row.serviceId)));
    const legacyServices = legacyServiceIds.length ? await tx.select({ id: services.id, duration: services.duration }).from(services).where(inArray5(services.id, legacyServiceIds)) : [];
    const capacity = availableCapacity(snapshot, occupied.filter((row) => row.id !== booking.id).map((row) => ({
      ...row,
      bookingDuration: row.bookingDuration ?? legacyServices.find((service) => service.id === row.serviceId)?.duration ?? 60
    })), date3);
    if ((booking.participantCount ?? 1) > capacity) fail(409, "time_unavailable", "The proposed time is no longer available. Your original reservation is unchanged.");
    return capacity;
  }
  async function writeMessage(tx, actor2, bookingId, body, clientRequestId, broadcastId) {
    const [existing] = await tx.select().from(bookingMessages).where(and12(eq15(bookingMessages.bookingId, bookingId), eq15(bookingMessages.authorId, actor2.id), eq15(bookingMessages.clientRequestId, clientRequestId)));
    if (existing) {
      if (existing.body !== body) fail(409, "idempotency_conflict", "This send identifier already belongs to another message.");
      return existing;
    }
    const [message] = await tx.insert(bookingMessages).values({ id: randomUUID10(), bookingId, authorId: actor2.id, authorRole: actor2.role, body, clientRequestId, broadcastId, createdAt: now() }).returning();
    return message;
  }
  function messageView(message, author) {
    const authorName = [author?.firstName, author?.lastName].filter(Boolean).join(" ") || (message.authorRole === "provider" ? "Service provider" : "Customer");
    return {
      id: message.id,
      bookingId: message.bookingId,
      authorId: message.authorId,
      authorRole: message.authorRole,
      authorName,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
      broadcastId: null
    };
  }
  async function createRequest(tx, actor2, booking, input, batchId, availabilityValidated = false) {
    const [duplicate] = await tx.select().from(bookingRescheduleRequests).where(and12(
      eq15(bookingRescheduleRequests.bookingId, booking.id),
      eq15(bookingRescheduleRequests.requestedById, actor2.id),
      eq15(bookingRescheduleRequests.clientRequestId, input.clientRequestId)
    ));
    if (duplicate) {
      if (duplicate.proposedScheduledDate.toISOString() !== input.scheduledDate || duplicate.fallback !== input.fallback || (duplicate.note ?? "") !== (input.note ?? "")) fail(409, "idempotency_conflict", "This request identifier has already been used.");
      return requestView(duplicate, actor2, booking);
    }
    const [current] = await tx.select().from(bookingRescheduleRequests).where(and12(eq15(bookingRescheduleRequests.bookingId, booking.id), eq15(bookingRescheduleRequests.state, "pending")));
    if (current) {
      if (current.baseRevision === booking.notificationRevision && current.originalScheduledDate.getTime() === booking.scheduledDate.getTime() && active(booking)) {
        fail(409, "request_pending", "A reschedule request is already awaiting a response. Review or withdraw it first.");
      }
      await invalidate(tx, booking.id);
    }
    if (actor2.role === "customer" && !(booking.scheduledDate > now())) fail(409, "booking_started", "Only future reservations can be changed.");
    if (!availabilityValidated) await validateNewTime(tx, booking, new Date(input.scheduledDate));
    const [request] = await tx.insert(bookingRescheduleRequests).values({
      id: randomUUID10(),
      bookingId: booking.id,
      requestedById: actor2.id,
      requestedByRole: actor2.role,
      originalScheduledDate: booking.scheduledDate,
      proposedScheduledDate: new Date(input.scheduledDate),
      fallback: input.fallback,
      state: "pending",
      note: input.note || null,
      timezone: input.timeZone,
      clientRequestId: input.clientRequestId,
      batchId,
      baseRevision: booking.notificationRevision,
      createdAt: now(),
      respondedAt: null,
      respondedById: null
    }).returning();
    return requestView(request, actor2, booking);
  }
  return {
    async conversation(actor2, id2, before) {
      const booking = await load(database, id2);
      await authorize2(database, actor2, booking, false);
      let cursor2;
      if (before) {
        [cursor2] = await database.select().from(bookingMessages).where(and12(eq15(bookingMessages.id, before), eq15(bookingMessages.bookingId, id2)));
        if (!cursor2) fail(400, "invalid_cursor", "This message page is not available.");
      }
      const rows = await database.select().from(bookingMessages).where(and12(eq15(bookingMessages.bookingId, id2), cursor2 ? or6(
        lt2(bookingMessages.createdAt, cursor2.createdAt),
        and12(eq15(bookingMessages.createdAt, cursor2.createdAt), lt2(bookingMessages.id, cursor2.id))
      ) : void 0)).orderBy(desc5(bookingMessages.createdAt), desc5(bookingMessages.id)).limit(51);
      const page = rows.slice(0, 50).reverse();
      const authorIds = Array.from(new Set(page.map((row) => row.authorId)));
      const authors = authorIds.length ? await database.select({ id: users.id, firstName: users.firstName, lastName: users.lastName }).from(users).where(inArray5(users.id, authorIds)) : [];
      const byAuthor = new Map(authors.map((author) => [author.id, author]));
      return { messages: page.map((row) => messageView(row, byAuthor.get(row.authorId))), nextCursor: rows.length > 50 ? page[0].id : null };
    },
    sendMessage(actor2, id2, input) {
      return locked(actor2, id2, async (tx, booking) => {
        const message = await writeMessage(tx, actor2, booking.id, input.body, input.clientRequestId, null);
        const [author] = await tx.select({ firstName: users.firstName, lastName: users.lastName }).from(users).where(eq15(users.id, actor2.id));
        return messageView(message, author);
      });
    },
    previewEvent(actor2, id2, action) {
      return locked(actor2, id2, async (tx, booking) => {
        const rows = await eventRows(tx, actor2, booking, action);
        const hasPro2 = await workspacePro(tx, booking, now().getTime());
        const customers = await tx.select({ id: users.id, firstName: users.firstName, lastName: users.lastName }).from(users).where(inArray5(users.id, Array.from(new Set(rows.map((row) => row.seekerId)))));
        const byCustomer = new Map(customers.map((customer) => [customer.id, customer]));
        const recipients = rows.map((row) => {
          const customer = byCustomer.get(row.seekerId);
          return { bookingId: row.id, customerName: [customer?.firstName, customer?.lastName].filter(Boolean).join(" ") || "Customer", status: row.status, participantCount: row.participantCount ?? 1 };
        });
        return { bookingIds: rows.map((row) => row.id), bookingCount: rows.length, participantCount: rows.reduce((sum, row) => sum + (row.participantCount ?? 1), 0), hasPro: hasPro2, recipients };
      });
    },
    updateEvent(actor2, id2, input) {
      return locked(actor2, id2, async (tx, booking) => {
        const rows = await eventRows(tx, actor2, booking, input.status === "completed" ? "complete" : "cancel", input.bookingIds, true);
        const updated = [];
        for (const row of rows) {
          if (row.status === input.status) {
            updated.push(row);
            continue;
          }
          const [changed] = await tx.update(bookings).set({ status: input.status, closedAt: row.closedAt ?? now(), notificationRevision: row.notificationRevision + 1, updatedAt: now() }).where(eq15(bookings.id, row.id)).returning();
          await invalidate(tx, row.id);
          const action = statusAction(row.status, changed.status);
          if (action) await captureStatusEvent(tx, changed, action, input.timeZone);
          await reconcileBookingReminder(tx, changed, now(), input.timeZone);
          updated.push(changed);
        }
        return { bookings: updated.map(bookingMoneyDto) };
      });
    },
    broadcast(actor2, id2, input) {
      return locked(actor2, id2, async (tx, booking) => {
        if (!await workspacePro(tx, booking, now().getTime())) fail(403, "pro_required", "An active PRO subscription is required to message a group.");
        const rows = await eventRows(tx, actor2, booking, "message", input.bookingIds);
        for (const row of rows) await writeMessage(tx, actor2, row.id, input.body, input.clientRequestId, input.clientRequestId);
        return { saved: rows.length, customerCount: new Set(rows.map((row) => row.seekerId)).size };
      });
    },
    async requests(actor2, id2) {
      const booking = await load(database, id2);
      await authorize2(database, actor2, booking, false);
      const rows = await database.select().from(bookingRescheduleRequests).where(eq15(bookingRescheduleRequests.bookingId, id2)).orderBy(desc5(bookingRescheduleRequests.createdAt), desc5(bookingRescheduleRequests.id)).limit(50);
      return { requests: rows.map((row) => requestView(row, actor2, booking)) };
    },
    async eventRequests(actor2, id2) {
      const booking = await load(database, id2);
      await authorize2(database, actor2, booking, false);
      if (actor2.role !== "provider") fail(403, "forbidden", "Only the provider can view group response outcomes.");
      const [latest] = await database.select().from(bookingRescheduleRequests).where(and12(eq15(bookingRescheduleRequests.bookingId, id2), isNotNull(bookingRescheduleRequests.batchId))).orderBy(desc5(bookingRescheduleRequests.createdAt), desc5(bookingRescheduleRequests.id)).limit(1);
      if (!latest?.batchId) return { requests: [] };
      const rows = await database.select().from(bookingRescheduleRequests).where(eq15(bookingRescheduleRequests.batchId, latest.batchId)).orderBy(asc6(bookingRescheduleRequests.bookingId)).limit(501);
      if (rows.length > 500) fail(409, "event_too_large", "This event has too many requests to display.");
      const requests = [];
      const linkedRows = rows.length ? await database.select().from(bookings).where(inArray5(bookings.id, rows.map((row) => row.bookingId))) : [];
      const byBooking = new Map(linkedRows.map((row) => [row.id, row]));
      const authorizedAssignments = /* @__PURE__ */ new Set();
      for (const row of rows) {
        const linked = byBooking.get(row.bookingId);
        if (!linked) throw new AppointmentError(404, "booking_not_found", "Reservation not found.");
        const assignment2 = JSON.stringify([linked.providerId, linked.companyId, linked.employeeId]);
        if (!authorizedAssignments.has(assignment2)) {
          await authorize2(database, actor2, linked, false);
          authorizedAssignments.add(assignment2);
        }
        requests.push(requestView(row, actor2, linked));
      }
      return { requests };
    },
    request(actor2, id2, input, bookingIds) {
      return locked(actor2, id2, async (tx, booking) => {
        const rows = bookingIds ? await eventRows(tx, actor2, booking, "reschedule", bookingIds) : [booking];
        if (bookingIds) {
          const capacity = await validateNewTime(tx, booking, new Date(input.scheduledDate));
          const confirmedPlaces = rows.filter((row) => row.status === "confirmed").reduce((sum, row) => sum + (row.participantCount ?? 1), 0);
          if (confirmedPlaces > capacity) fail(409, "time_unavailable", "The proposed time cannot fit all confirmed places in this event.");
        }
        const requests = [];
        for (const row of rows) requests.push(await createRequest(tx, actor2, { ...row, service: booking.service }, input, bookingIds ? input.clientRequestId : null, Boolean(bookingIds)));
        return { requests };
      });
    },
    respond(actor2, id2, requestId, decision) {
      return locked(actor2, id2, async (tx, booking) => {
        const [request] = await tx.select().from(bookingRescheduleRequests).where(and12(eq15(bookingRescheduleRequests.id, requestId), eq15(bookingRescheduleRequests.bookingId, id2))).for("update");
        if (!request) fail(404, "request_not_found", "Reschedule request not found.");
        if (actor2.role === request.requestedByRole) fail(403, "wrong_recipient", "Only the other party can respond to this request.");
        if (request.state === (decision === "accept" ? "accepted" : "declined")) return { request: requestView(request, actor2, booking), booking: { ...bookingMoneyDto(booking), service: serviceMoneyDto(booking.service) } };
        if (!requestView(request, actor2, booking).canRespond) fail(409, "request_superseded", "This reschedule request is no longer actionable.");
        let changed = booking;
        if (decision === "accept") {
          await validateNewTime(tx, booking, request.proposedScheduledDate);
          [changed] = await tx.update(bookings).set({ scheduledDate: request.proposedScheduledDate, notificationRevision: booking.notificationRevision + 1, updatedAt: now() }).where(eq15(bookings.id, id2)).returning();
          await captureStatusEvent(tx, changed, "rescheduled", request.timezone, booking.scheduledDate);
          await reconcileBookingReminder(tx, changed, now(), request.timezone);
        } else if (request.fallback === "cancel_booking") {
          [changed] = await tx.update(bookings).set({ status: "cancelled", closedAt: booking.closedAt ?? now(), notificationRevision: booking.notificationRevision + 1, updatedAt: now() }).where(eq15(bookings.id, id2)).returning();
          const action = statusAction(booking.status, changed.status);
          if (action) await captureStatusEvent(tx, changed, action, request.timezone);
          await reconcileBookingReminder(tx, changed, now(), request.timezone);
        }
        const [responded] = await tx.update(bookingRescheduleRequests).set({ state: decision === "accept" ? "accepted" : "declined", respondedAt: now(), respondedById: actor2.id }).where(eq15(bookingRescheduleRequests.id, request.id)).returning();
        return { request: requestView(responded, actor2, changed), booking: bookingMoneyDto(changed) };
      });
    },
    withdraw(actor2, id2, requestId) {
      return locked(actor2, id2, async (tx, booking) => {
        const [request] = await tx.select().from(bookingRescheduleRequests).where(and12(eq15(bookingRescheduleRequests.id, requestId), eq15(bookingRescheduleRequests.bookingId, id2))).for("update");
        if (!request) fail(404, "request_not_found", "Reschedule request not found.");
        if (request.requestedById !== actor2.id) fail(403, "forbidden", "Only the requester can withdraw this request.");
        if (request.state === "withdrawn") return { request: requestView(request, actor2, booking) };
        if (!requestView(request, actor2, booking).canWithdraw) fail(409, "request_superseded", "This request is no longer actionable.");
        const [withdrawn] = await tx.update(bookingRescheduleRequests).set({ state: "withdrawn", respondedAt: now(), respondedById: actor2.id }).where(eq15(bookingRescheduleRequests.id, requestId)).returning();
        return { request: requestView(withdrawn, actor2, booking) };
      });
    }
  };
}

// server/appointments/routes.ts
function setupAppointmentRoutes(app2) {
  const repository = createAppointmentRepository(db);
  const writeLimit = rateLimit6({
    windowMs: 6e4,
    limit: 60,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { code: "rate_limited", message: "Too many booking updates. Please try again shortly." }
  });
  const id2 = (req) => z30.coerce.number().int().positive().parse(req.params.id);
  async function actor2(req, write) {
    const booking = await storage.getBookingById(id2(req));
    if (!booking) throw new AppointmentError(404, "booking_not_found", "Reservation not found.");
    try {
      const workspace = assertBooking(req, booking, write);
      return { id: req.user.claims.sub, role: "provider", companyId: workspace.companyId };
    } catch (error) {
      if (!(error instanceof AccessError) || booking.seekerId !== req.user?.claims.sub) throw error;
      return { id: req.user.claims.sub, role: "customer" };
    }
  }
  function handler(action) {
    return (req, res) => {
      void (async () => {
        res.set("Cache-Control", "private, no-store");
        try {
          res.json(await action(req));
        } catch (error) {
          const known = error instanceof AppointmentError || error instanceof AccessError;
          res.status(known ? error.status : error instanceof z30.ZodError ? 400 : 500).json({
            message: known ? error.message : error instanceof z30.ZodError ? error.issues[0].message : "Unable to process this booking request.",
            code: error instanceof AppointmentError ? error.code : error instanceof z30.ZodError ? "invalid_input" : known ? "forbidden" : "unavailable"
          });
        }
      })();
    };
  }
  app2.get("/api/bookings/:id/conversation", isAuthenticated, handler(async (req) => {
    const query = z30.object({ before: z30.string().uuid().optional() }).strict().parse(req.query);
    return repository.conversation(await actor2(req, false), id2(req), query.before);
  }));
  app2.post("/api/bookings/:id/conversation", isAuthenticated, writeLimit, handler(async (req) => repository.sendMessage(await actor2(req, true), id2(req), messageInputSchema.parse(req.body))));
  app2.get("/api/bookings/:id/reschedule-requests", isAuthenticated, handler(async (req) => repository.requests(await actor2(req, false), id2(req))));
  app2.post("/api/bookings/:id/reschedule-requests", isAuthenticated, writeLimit, handler(async (req) => repository.request(await actor2(req, true), id2(req), rescheduleInputSchema.parse(req.body))));
  app2.post("/api/bookings/:id/reschedule-requests/:requestId/respond", isAuthenticated, writeLimit, handler(async (req) => {
    const input = z30.object({ decision: z30.enum(["accept", "decline"]) }).strict().parse(req.body), requestId = z30.string().uuid().parse(req.params.requestId);
    return repository.respond(await actor2(req, true), id2(req), requestId, input.decision);
  }));
  app2.post("/api/bookings/:id/reschedule-requests/:requestId/withdraw", isAuthenticated, writeLimit, handler(async (req) => {
    z30.object({}).strict().parse(req.body);
    return repository.withdraw(await actor2(req, true), id2(req), z30.string().uuid().parse(req.params.requestId));
  }));
  app2.post("/api/bookings/:id/event/preview", isAuthenticated, handler(async (req) => {
    const input = z30.object({ action: z30.enum(["complete", "cancel", "reschedule", "message"]) }).strict().parse(req.body);
    return repository.previewEvent(await actor2(req, true), id2(req), input.action);
  }));
  app2.get("/api/bookings/:id/event/reschedule-requests", isAuthenticated, handler(async (req) => repository.eventRequests(await actor2(req, false), id2(req))));
  app2.post("/api/bookings/:id/event/status", isAuthenticated, writeLimit, handler(async (req) => {
    const input = z30.object({ status: z30.enum(["completed", "cancelled"]), bookingIds: eventBookingIdsSchema, timeZone: notificationTimezoneSchema }).strict().parse(req.body);
    return repository.updateEvent(await actor2(req, true), id2(req), input);
  }));
  app2.post("/api/bookings/:id/event/messages", isAuthenticated, writeLimit, handler(async (req) => {
    const input = messageInputSchema.extend({ bookingIds: eventBookingIdsSchema }).parse(req.body);
    return repository.broadcast(await actor2(req, true), id2(req), input);
  }));
  app2.post("/api/bookings/:id/event/reschedule-requests", isAuthenticated, writeLimit, handler(async (req) => {
    const { bookingIds, ...input } = rescheduleInputSchema.extend({ bookingIds: eventBookingIdsSchema }).parse(req.body);
    return repository.request(await actor2(req, true), id2(req), input, bookingIds);
  }));
}

// server/wishlist/routes.ts
import { rateLimit as rateLimit7 } from "express-rate-limit";
import { z as z33 } from "zod";

// shared/wishlist.ts
import { z as z31 } from "zod";
var positiveServiceId = z31.string().regex(/^[1-9]\d{0,9}$/).refine((value) => Number(value) <= 2147483647).transform(Number);
var wishlistPageSchema = z31.object({ cursor: z31.string().max(300).optional(), limit: z31.coerce.number().int().min(1).max(50).default(24) }).strict();
var inboxScopeSchema = z31.object({ scope: z31.enum(["customer", "provider", "all"]), companyId: positiveServiceId.optional() }).strict();
var messageReadSchema = z31.object({ messageIds: z31.array(z31.string().uuid()).min(1).max(100).refine((ids) => new Set(ids).size === ids.length) }).strict();
var notificationReadSchema = z31.object({ items: z31.array(z31.object({ id: z31.string().uuid(), revision: z31.number().int().positive() }).strict()).min(1).max(100).refine((items) => new Set(items.map((item) => item.id)).size === items.length) }).strict();

// server/wishlist/service.ts
import { randomUUID as randomUUID11 } from "node:crypto";
import { z as z32 } from "zod";
var WishlistError = class extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
};
var retentionExpiry = (at) => new Date(at.getTime() + 90 * 864e5);
var reportingDay = (at) => at.toISOString().slice(0, 10);
var cursorSchema2 = z32.object({ serviceId: z32.number().int().positive(), savedAt: z32.string().datetime() }).strict();
function readWishlistCursor(cursor2) {
  if (!cursor2) return null;
  try {
    const parsed = cursorSchema2.parse(JSON.parse(Buffer.from(cursor2, "base64url").toString("utf8")));
    return { ...parsed, savedAt: new Date(parsed.savedAt) };
  } catch {
    throw new WishlistError(400, "invalid_cursor");
  }
}
function createWishlistService(store, hydrate, now = () => /* @__PURE__ */ new Date()) {
  const event = (service, userId, kind, at) => ({
    id: randomUUID11(),
    kind,
    userId,
    serviceId: service.id,
    providerId: service.providerId,
    companyId: service.companyId,
    reportingDay: reportingDay(at),
    occurredAt: at,
    expiresAt: retentionExpiry(at)
  });
  return {
    async list(userId, cursor2, limit) {
      const rows = await store.list(userId, readWishlistCursor(cursor2), limit + 1);
      const page = rows.slice(0, limit);
      const items = await Promise.all(page.map(async (row) => {
        const service = await hydrate(row.serviceId);
        const base = { serviceId: row.serviceId, savedAt: row.savedAt.toISOString() };
        return service?.isActive && service.companyActive ? { ...base, available: true, service } : { ...base, available: false };
      }));
      const last = page.at(-1);
      return { items, nextCursor: rows.length > limit && last ? Buffer.from(JSON.stringify({ serviceId: last.serviceId, savedAt: last.savedAt.toISOString() })).toString("base64url") : null };
    },
    async membership(userId, ids) {
      return { serviceIds: await store.membership(userId, ids) };
    },
    async save(userId, serviceId2) {
      return store.transaction(async (tx) => {
        await tx.lock(userId, serviceId2);
        const service = await tx.service(serviceId2);
        if (!service?.isActive || !service.companyActive) throw new WishlistError(404, "service_unavailable");
        const at = now();
        const inserted = await tx.insert(userId, serviceId2, at);
        if (inserted && userId !== service.providerId && !await tx.isTeam(userId, service)) await tx.activity(event(service, userId, "wishlist_additions", at));
      });
    },
    async remove(userId, serviceId2) {
      return store.transaction(async (tx) => {
        await tx.lock(userId, serviceId2);
        await tx.remove(userId, serviceId2);
      });
    },
    async recordView(serviceId2, userId) {
      return store.transaction(async (tx) => {
        const service = await tx.service(serviceId2);
        if (!service?.isActive || !service.companyActive || userId === service.providerId || userId && await tx.isTeam(userId, service)) return;
        await tx.activity(event(service, userId, "service_views", now()));
      });
    }
  };
}

// server/wishlist/routes.ts
function setupWishlistRoutes(app2, authenticate, wishlist, inbox, getUser) {
  const limit = rateLimit7({ windowMs: 6e4, limit: 120, standardHeaders: "draft-7", legacyHeaders: false, message: { code: "rate_limited", message: "Please try again shortly." } });
  app2.use(["/api/wishlist", "/api/inbox"], (_req, res, next) => {
    res.set("Cache-Control", "private, no-store");
    next();
  });
  const handle2 = (action, empty3 = false) => (req, res) => {
    void (async () => {
      try {
        const result = await action(req);
        if (empty3) res.sendStatus(204);
        else res.json(result);
      } catch (error) {
        const known = error instanceof WishlistError;
        res.status(known ? error.status : error instanceof z33.ZodError ? 400 : 503).json({ code: known ? error.code : error instanceof z33.ZodError ? "invalid_input" : "inbox_unavailable", message: "Unable to complete this request." });
      }
    })();
  };
  const user = (req) => req.user.claims.sub;
  const id2 = (req) => positiveServiceId.parse(req.params.id);
  const page = (req) => wishlistPageSchema.parse({ ...req.query.cursor !== void 0 ? { cursor: req.query.cursor } : {}, ...req.query.limit !== void 0 ? { limit: req.query.limit } : {} });
  async function actor2(req) {
    const parsed = inboxScopeSchema.parse({ scope: req.query.scope, ...req.query.companyId !== void 0 ? { companyId: req.query.companyId } : {} });
    if (parsed.scope === "customer") {
      if (parsed.companyId != null) throw new WishlistError(400, "invalid_scope");
      return { ...parsed, userId: user(req) };
    }
    const profile = await getUser(user(req));
    const ctx = req.workspace;
    if (!profile || !["provider", "seeker"].includes(profile.currentRole ?? "") || !ctx || ctx.invalid || ctx.company?.isActive === false || (ctx.company?.id ?? null) !== (parsed.companyId ?? null)) throw new WishlistError(403, "invalid_scope");
    return { ...parsed, userId: user(req) };
  }
  const scopeQuery = z33.object({ scope: z33.enum(["customer", "provider", "all"]), companyId: z33.string().optional(), cursor: z33.string().max(300).optional(), limit: z33.coerce.number().int().min(1).max(50).optional() }).strict();
  async function explicitActor(req) {
    const current = await actor2(req);
    if (current.scope === "all") throw new WishlistError(400, "explicit_scope_required");
    return current;
  }
  const empty2 = z33.object({}).strict();
  app2.get("/api/wishlist/services", authenticate, limit, handle2(async (req) => {
    const q = wishlistPageSchema.parse(req.query);
    return wishlist.list(user(req), q.cursor, q.limit);
  }));
  app2.get("/api/wishlist/membership", authenticate, limit, handle2(async (req) => {
    const q = z33.object({ serviceIds: z33.string().max(1200) }).strict().parse(req.query);
    const ids = z33.array(positiveServiceId).min(1).max(100).parse(q.serviceIds.split(","));
    if (new Set(ids).size !== ids.length) throw new WishlistError(400, "invalid_input");
    return wishlist.membership(user(req), ids);
  }));
  app2.put("/api/wishlist/services/:id", authenticate, limit, handle2(async (req) => {
    empty2.parse(req.query);
    empty2.parse(req.body ?? {});
    await wishlist.save(user(req), id2(req));
  }, true));
  app2.delete("/api/wishlist/services/:id", authenticate, limit, handle2(async (req) => {
    empty2.parse(req.query);
    empty2.parse(req.body ?? {});
    await wishlist.remove(user(req), id2(req));
  }, true));
  app2.get("/api/inbox/summary", authenticate, limit, handle2(async (req) => {
    inboxScopeSchema.parse(req.query);
    return inbox.summary(await actor2(req));
  }));
  app2.get("/api/inbox/messages", authenticate, limit, handle2(async (req) => {
    scopeQuery.parse(req.query);
    const q = page(req);
    return inbox.messages(await actor2(req), q.cursor, q.limit);
  }));
  app2.get("/api/inbox/messages/:id", authenticate, limit, handle2(async (req) => {
    inboxScopeSchema.parse(req.query);
    return inbox.booking(await explicitActor(req), id2(req));
  }));
  app2.post("/api/inbox/messages/:id/read", authenticate, limit, handle2(async (req) => {
    inboxScopeSchema.parse(req.query);
    const body = messageReadSchema.parse(req.body);
    await inbox.readMessages(await explicitActor(req), id2(req), body.messageIds);
  }, true));
  app2.get("/api/inbox/notifications", authenticate, limit, handle2(async (req) => {
    scopeQuery.parse(req.query);
    const q = page(req);
    return inbox.notifications(await actor2(req), q.cursor, q.limit);
  }));
  app2.post("/api/inbox/notifications/read", authenticate, limit, handle2(async (req) => {
    inboxScopeSchema.parse(req.query);
    await inbox.readNotifications(await actor2(req), notificationReadSchema.parse(req.body).items);
  }, true));
}

// server/wishlist/postgres.ts
import { sql as sql10 } from "drizzle-orm";
async function queryRows(db2, query) {
  return (await db2.execute(query)).rows;
}
function createWishlistStore(database) {
  function adapter(tx) {
    return {
      async lock(userId, id2) {
        await tx.execute(sql10`SELECT pg_advisory_xact_lock(hashtextextended(${`wishlist:${userId}:${id2}`},0))`);
      },
      async service(id2) {
        const [row] = await queryRows(tx, sql10`SELECT s.id,s.provider_id AS "providerId",s.company_id AS "companyId",s.is_active AS "isActive",
          (c.id IS NULL OR c.is_active) AS "companyActive" FROM public.services s LEFT JOIN public.companies c ON c.id=s.company_id WHERE s.id=${id2} FOR SHARE OF s`);
        return row;
      },
      async isTeam(userId, service) {
        if (service.companyId == null) return false;
        const rows = await queryRows(tx, sql10`SELECT 1 FROM public.company_memberships WHERE company_id=${service.companyId} AND user_id=${userId} LIMIT 1`);
        return rows.length > 0;
      },
      async insert(userId, id2, at) {
        return (await queryRows(tx, sql10`INSERT INTO public.wishlist_services(user_id,service_id,saved_at) VALUES(${userId},${id2},${at.toISOString()}::timestamptz)
          ON CONFLICT(user_id,service_id) DO NOTHING RETURNING service_id`)).length > 0;
      },
      async remove(userId, id2) {
        await tx.execute(sql10`DELETE FROM public.wishlist_services WHERE user_id=${userId} AND service_id=${id2}`);
      },
      async activity(row) {
        await tx.execute(sql10`INSERT INTO public.product_activity_events(id,kind,user_id,service_id,provider_id,company_id,reporting_day,occurred_at,expires_at)
          VALUES(${row.id}::uuid,${row.kind},${row.userId},${row.serviceId},${row.providerId},${row.companyId},${row.reportingDay}::date,${row.occurredAt.toISOString()}::timestamptz,${row.expiresAt.toISOString()}::timestamptz)
          ON CONFLICT DO NOTHING`);
      }
    };
  }
  return {
    transaction: (action) => database.transaction((tx) => action(adapter(tx))),
    async list(userId, before, limit) {
      const rows = await queryRows(database, sql10`SELECT service_id AS "serviceId",saved_at AS "savedAt" FROM public.wishlist_services
        WHERE user_id=${userId} ${before ? sql10`AND (saved_at,service_id)<(${before.savedAt.toISOString()}::timestamptz,${before.serviceId})` : sql10``}
        ORDER BY saved_at DESC,service_id DESC LIMIT ${limit}`);
      return rows.map((row) => ({ ...row, savedAt: new Date(row.savedAt) }));
    },
    async membership(userId, ids) {
      if (!ids.length) return [];
      return (await queryRows(database, sql10`SELECT service_id AS "serviceId" FROM public.wishlist_services WHERE user_id=${userId}
        AND service_id IN (${sql10.join(ids.map((id2) => sql10`${id2}`), sql10`,`)}) ORDER BY service_id`)).map((row) => row.serviceId);
    }
  };
}

// server/wishlist/inbox.ts
import { sql as sql11 } from "drizzle-orm";
import { z as z34 } from "zod";
var contextKey = (actor2) => actor2.scope === "customer" ? "customer" : actor2.companyId == null ? "provider:personal" : `provider:company:${actor2.companyId}`;
function bookingAccess(actor2) {
  if (actor2.scope === "customer") return sql11`b.seeker_id=${actor2.userId}`;
  if (actor2.scope === "all") return sql11`(b.seeker_id=${actor2.userId} OR (${bookingAccess({ ...actor2, scope: "provider" })}))`;
  if (actor2.companyId == null) return sql11`b.provider_id=${actor2.userId} AND b.company_id IS NULL`;
  return sql11`b.company_id=${actor2.companyId} AND EXISTS(SELECT 1 FROM public.company_memberships m JOIN public.companies c ON c.id=m.company_id
    WHERE c.is_active AND m.company_id=b.company_id AND m.user_id=${actor2.userId}
    AND (m.role IN ('owner','admin') OR m.employee_id=b.employee_id))`;
}
function groupAccess(actor2) {
  if (actor2.scope === "customer") return sql11`false`;
  if (actor2.companyId == null) return sql11`g.provider_id=${actor2.userId} AND g.company_id IS NULL AND s.company_id IS NULL AND s.provider_id=${actor2.userId}`;
  return sql11`g.company_id=${actor2.companyId} AND s.company_id=g.company_id AND EXISTS(SELECT 1 FROM public.company_memberships m JOIN public.companies c ON c.id=m.company_id
    WHERE c.is_active AND m.company_id=g.company_id AND m.user_id=${actor2.userId} AND (m.role IN ('owner','admin') OR m.employee_id=s.employee_id))`;
}
var unread = (actor2) => sql11`bm.author_id<>${actor2.userId} AND NOT EXISTS(SELECT 1 FROM public.booking_message_reads r
  WHERE r.message_id=bm.id AND r.user_id=${actor2.userId} ${actor2.scope === "all" ? sql11`` : sql11`AND r.context_key=${contextKey(actor2)}`})`;
var cursorShape = z34.object({ date: z34.string().datetime(), id: z34.union([z34.number().int().positive(), z34.string().uuid()]) }).strict();
function readCursor(value) {
  if (!value) return null;
  try {
    return cursorShape.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
  } catch {
    throw new WishlistError(400, "invalid_cursor");
  }
}
function cursor(date3, id2) {
  return Buffer.from(JSON.stringify({ date: date3, id: id2 })).toString("base64url");
}
function createInboxService(database, hydrateBooking, now = () => /* @__PURE__ */ new Date()) {
  async function requireBooking(actor2, id2, query = database) {
    const rows = await queryRows(query, sql11`SELECT b.id FROM public.bookings b WHERE b.id=${id2} AND (${bookingAccess(actor2)})`);
    if (!rows.length) throw new WishlistError(403, "conversation_unavailable");
  }
  return {
    async summary(actor2) {
      const [messages] = await queryRows(database, sql11`SELECT count(*)::int AS count FROM public.booking_messages bm JOIN public.bookings b ON b.id=bm.booking_id
        WHERE (${bookingAccess(actor2)}) AND (${unread(actor2)})`);
      const [notifications] = await queryRows(database, sql11`SELECT count(*)::int AS count FROM public.service_activity_groups g JOIN public.services s ON s.id=g.service_id
        LEFT JOIN public.service_activity_reads r ON r.group_id=g.id AND r.user_id=${actor2.userId}
        WHERE (${groupAccess(actor2)}) AND g.expires_at>${now().toISOString()}::timestamptz AND COALESCE(r.read_revision,0)<g.revision`);
      return { unreadMessages: messages.count, unreadNotifications: notifications.count };
    },
    async messages(actor2, before, limit) {
      const after = readCursor(before);
      if (after && typeof after.id !== "number") throw new WishlistError(400, "invalid_cursor");
      const customerView = actor2.scope === "all" ? sql11`b.seeker_id=${actor2.userId}` : actor2.scope === "customer" ? sql11`true` : sql11`false`;
      const rows = await queryRows(database, sql11`SELECT b.id AS "bookingId",s.name AS "serviceName",b.scheduled_date AS "scheduledDate",
        CASE WHEN ${customerView} THEN 'customer' ELSE 'provider' END AS viewer,
        CASE WHEN ${customerView} THEN NULL ELSE b.company_id END AS "companyId",
        COALESCE(NULLIF(trim(COALESCE(u.first_name,'')||' '||COALESCE(u.last_name,'')),''),CASE WHEN ${customerView} THEN 'Service provider' ELSE 'Customer' END) AS "counterpartName",
        max(bm.created_at) AS "updatedAt",count(*) FILTER(WHERE ${unread(actor2)})::int AS "unreadCount",
        CASE WHEN ${customerView} THEN true ELSE ${actor2.companyId == null ? sql11`true` : sql11`EXISTS(SELECT 1 FROM public.company_memberships cm WHERE cm.company_id=b.company_id AND cm.user_id=${actor2.userId} AND cm.role<>'viewer')`} END AS "canSend"
        FROM public.bookings b JOIN public.services s ON s.id=b.service_id JOIN public.booking_messages bm ON bm.booking_id=b.id
        LEFT JOIN public.users u ON u.id=CASE WHEN ${customerView} THEN b.provider_id ELSE b.seeker_id END
        WHERE (${bookingAccess(actor2)}) GROUP BY b.id,s.name,u.first_name,u.last_name
        ${after ? sql11`HAVING (max(bm.created_at),b.id)<(${after.date}::timestamptz,${after.id})` : sql11``}
        ORDER BY max(bm.created_at) DESC,b.id DESC LIMIT ${limit + 1}`);
      const items = rows.slice(0, limit).map((row) => ({ ...row, scheduledDate: new Date(row.scheduledDate).toISOString(), updatedAt: new Date(row.updatedAt).toISOString() }));
      const last = items.at(-1);
      return { items, nextCursor: rows.length > limit && last ? cursor(last.updatedAt, last.bookingId) : null };
    },
    async booking(actor2, id2) {
      if (actor2.scope === "all") throw new WishlistError(400, "explicit_scope_required");
      await requireBooking(actor2, id2);
      const booking = await hydrateBooking(id2);
      if (!booking) throw new WishlistError(404, "conversation_unavailable");
      return booking;
    },
    async readMessages(actor2, id2, messageIds) {
      if (actor2.scope === "all") throw new WishlistError(400, "explicit_scope_required");
      await database.transaction(async (tx) => {
        await requireBooking(actor2, id2, tx);
        const ids = sql11.join(messageIds.map((value) => sql11`${value}::uuid`), sql11`, `);
        const valid = await queryRows(tx, sql11`SELECT bm.id FROM public.booking_messages bm WHERE bm.booking_id=${id2} AND bm.id IN (${ids})`);
        if (valid.length !== messageIds.length) throw new WishlistError(400, "invalid_messages");
        await tx.execute(sql11`INSERT INTO public.booking_message_reads(user_id,message_id,context_key)
          SELECT ${actor2.userId},bm.id,${contextKey(actor2)} FROM public.booking_messages bm JOIN public.bookings b ON b.id=bm.booking_id
          WHERE b.id=${id2} AND (${bookingAccess(actor2)}) AND bm.id IN (${ids}) AND bm.author_id<>${actor2.userId} ON CONFLICT DO NOTHING`);
      });
    },
    async notifications(actor2, before, limit) {
      const after = readCursor(before);
      if (after && typeof after.id !== "string") throw new WishlistError(400, "invalid_cursor");
      const rows = await queryRows(database, sql11`SELECT g.id,g.kind,g.service_id AS "serviceId",CASE WHEN s.is_active THEN s.name ELSE NULL END AS "serviceName",
        g.reporting_day::text AS "reportingDay",g.count,g.revision,COALESCE(r.read_revision,0)>=g.revision AS read,s.is_active AS available,g.updated_at AS "updatedAt"
        FROM public.service_activity_groups g JOIN public.services s ON s.id=g.service_id
        LEFT JOIN public.service_activity_reads r ON r.group_id=g.id AND r.user_id=${actor2.userId}
        WHERE (${groupAccess(actor2)}) AND g.expires_at>${now().toISOString()}::timestamptz
        ${after ? sql11`AND (g.updated_at,g.id)<(${after.date}::timestamptz,${after.id}::uuid)` : sql11``}
        ORDER BY g.updated_at DESC,g.id DESC LIMIT ${limit + 1}`);
      const items = rows.slice(0, limit).map((row) => ({ ...row, updatedAt: new Date(row.updatedAt).toISOString() }));
      const last = items.at(-1);
      return { items, nextCursor: rows.length > limit && last ? cursor(last.updatedAt, last.id) : null };
    },
    async readNotifications(actor2, items) {
      await database.transaction(async (tx) => {
        for (const item of items) {
          const allowed = await queryRows(tx, sql11`SELECT g.revision FROM public.service_activity_groups g JOIN public.services s ON s.id=g.service_id
            WHERE g.id=${item.id}::uuid AND (${groupAccess(actor2)}) AND g.expires_at>${now().toISOString()}::timestamptz`);
          if (!allowed.length) throw new WishlistError(403, "notification_unavailable");
          if (item.revision > allowed[0].revision) throw new WishlistError(400, "invalid_revision");
          await tx.execute(sql11`INSERT INTO public.service_activity_reads(user_id,group_id,read_revision) VALUES(${actor2.userId},${item.id}::uuid,${item.revision})
            ON CONFLICT(user_id,group_id) DO UPDATE SET read_revision=GREATEST(service_activity_reads.read_revision,EXCLUDED.read_revision)`);
        }
      });
    }
  };
}

// server/search-pagination/store.ts
import { sql as sql13 } from "drizzle-orm";

// server/search-pagination/query.ts
import { sql as sql12 } from "drizzle-orm";
function orderKeys(request) {
  const { filters, sort, embedding } = request;
  if (sort === "default") {
    if (embedding) return [{ name: "score_key", direction: "DESC", type: "float8" }, { name: "id", direction: "ASC", type: "integer" }];
    return [...filters.latitude !== void 0 ? [{ name: "distance_key", direction: "ASC", type: "float8" }] : [], { name: "created_key", direction: "DESC", type: "timestamp" }, { name: "id", direction: "DESC", type: "integer" }];
  }
  return [{ name: sort.startsWith("price-") ? "price_key" : sort.startsWith("rating-") ? "rating_key" : "distance_key", direction: sort.endsWith("-desc") ? "DESC" : "ASC", type: "float8" }, { name: "id", direction: "ASC", type: "integer" }];
}
function column(name) {
  return sql12.raw(`e.${name}`);
}
function searchPageSQL(request) {
  const { filters, limit, embedding, position } = request;
  const conditions = [sql12`s.is_active=true`, sql12`(c.id IS NULL OR c.is_active=true)`];
  if (filters.category) conditions.push(sql12`s.category=${filters.category}`);
  if (filters.serviceType) conditions.push(sql12`s.service_type=${filters.serviceType}`);
  if (filters.ageGroups?.length) conditions.push(sql12`s.age_groups ?| ARRAY[${sql12.join(filters.ageGroups.map((group) => sql12`${group}`), sql12`, `)}]::text[]`);
  if (filters.searchQuery?.trim()) {
    const term = `%${filters.searchQuery.trim().toLowerCase()}%`;
    conditions.push(sql12`(lower(s.name) LIKE ${term} OR lower(s.description) LIKE ${term} OR lower(c.name) LIKE ${term} OR (em.show_name=true AND lower(em.name) LIKE ${term}))`);
  }
  if (filters.time || filters.timeEnd) {
    const minutes2 = (value) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
    conditions.push(sql12`s.duration<=${minutes2(filters.timeEnd ?? "23:59") - minutes2(filters.time ?? "00:00")}`);
  }
  const haversine = filters.latitude === void 0 ? null : sql12`least(1.0,greatest(0.0,power(sin(radians(a.latitude-${filters.latitude})/2),2)+cos(radians(${filters.latitude}))*cos(radians(a.latitude))*power(sin(radians(a.longitude-${filters.longitude})/2),2)))`;
  const distance = haversine ? sql12`CASE WHEN a.latitude IS NOT NULL AND a.longitude IS NOT NULL AND (a.location_source IS DISTINCT FROM 'google' OR a.location_expires_at>now()) THEN (6371*2*atan2(sqrt(${haversine}),sqrt(1-${haversine})))::float8 ELSE NULL END` : sql12`NULL::float8`;
  if (filters.availableOnly && filters.date) {
    const time2 = filters.time || filters.timeEnd;
    conditions.push(sql12`EXISTS(SELECT 1 FROM public.availability av
   WHERE av.is_active=true AND ((s.company_id IS NOT NULL AND av.company_id=s.company_id) OR (s.company_id IS NULL AND av.company_id IS NULL AND av.provider_id=s.provider_id))
   AND (av.service_id IS NULL OR av.service_id=s.id)
   AND EXISTS(SELECT 1 FROM generate_series(${filters.date}::date,${filters.dateEnd ?? filters.date}::date,interval '1 day') AS dates(day)
    WHERE (av.schedule_type='specific' AND av.specific_date::date=day::date) OR (av.schedule_type='recurring' AND av.days_of_week @> jsonb_build_array(extract(dow FROM day)::integer)))
   ${time2 ? sql12`AND ${filters.time ?? "00:00"}<COALESCE(av.end_time,'23:59') AND ${filters.timeEnd ?? "23:59"}>COALESCE(av.start_time,'00:00')
    AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(av.breaks)='array' THEN av.breaks ELSE '[]'::jsonb END) br
     WHERE ${filters.time ?? "00:00"}<(br->>'endTime') AND ${filters.timeEnd ?? "23:59"}>(br->>'startTime'))` : sql12``})`);
  }
  let vectorJoin = sql12``, score = sql12`NULL::float8`;
  if (request.requireEmbedding && !embedding) vectorJoin = sql12`JOIN public.service_embeddings se ON se.service_id=s.id`;
  if (embedding) {
    vectorJoin = sql12`JOIN public.service_embeddings se ON se.service_id=s.id
   CROSS JOIN LATERAL (SELECT CASE WHEN jsonb_typeof(se.embedding)='array' THEN CASE WHEN jsonb_array_length(se.embedding)=${embedding.length} THEN se.embedding ELSE '[]'::jsonb END ELSE '[]'::jsonb END AS vector) safe_vector
   CROSS JOIN LATERAL (SELECT sum(component*q.value) AS dot,sum(component*component) AS norm
    FROM (SELECT v.ordinality,CASE WHEN jsonb_typeof(v.value)='number' THEN CASE WHEN abs((v.value#>>'{}')::numeric)<=1e100 THEN (v.value#>>'{}')::float8 ELSE NULL END ELSE NULL END AS component
     FROM jsonb_array_elements(safe_vector.vector) WITH ORDINALITY v(value,ordinality)) vector_values
    JOIN unnest(${`{${embedding.join(",")}}`}::float8[]) WITH ORDINALITY q(value,ordinality) USING(ordinality)
    HAVING count(*)=${embedding.length} AND count(component)=${embedding.length} AND jsonb_array_length(safe_vector.vector)=${embedding.length}) scored`;
    const queryNorm = embedding.reduce((sum, value) => sum + value * value, 0);
    score = sql12`CASE WHEN scored.norm>0 THEN scored.dot/(sqrt(scored.norm)*${Math.sqrt(queryNorm)}) ELSE NULL END`;
  }
  const keys = orderKeys(request);
  if (position && position.length !== keys.length) throw new Error("INVALID_SEARCH_POSITION");
  const continuation = [];
  if (position) for (let index2 = 0; index2 < keys.length; index2++) {
    const key = keys[index2], value = position[index2];
    if (value === null) continue;
    const equal2 = keys.slice(0, index2).map((previous, i) => position[i] === null ? sql12`${column(previous.name)} IS NULL` : sql12`${column(previous.name)} IS NOT DISTINCT FROM ${position[i]}::${sql12.raw(previous.type)}`);
    const after = sql12`(${column(key.name)} ${sql12.raw(key.direction === "ASC" ? ">" : "<")} ${value}::${sql12.raw(key.type)} OR ${column(key.name)} IS NULL)`;
    continuation.push(sql12`(${sql12.join([...equal2, after], sql12` AND `)})`);
  }
  return sql12`WITH candidates AS (SELECT s.id,s.currency,s.created_at AS created_key,CASE WHEN s.price>=0 THEN s.price::float8 ELSE NULL END AS price_key,
  reviews.rating AS rating_key,${distance} AS distance_key,${score} AS score_key
  FROM public.services s LEFT JOIN public.addresses a ON a.id=s.address_id
  LEFT JOIN public.companies c ON c.id=s.company_id LEFT JOIN public.employees em ON em.id=s.employee_id
  LEFT JOIN (SELECT b.service_id,avg(r.rating)::float8 AS rating FROM public.service_reviews r JOIN public.bookings b ON b.id=r.booking_id GROUP BY b.service_id) reviews ON reviews.service_id=s.id
  ${vectorJoin} WHERE ${sql12.join(conditions, sql12` AND `)}),
  matched AS (SELECT * FROM candidates e WHERE true ${filters.radius !== void 0 ? sql12`AND e.distance_key<=${filters.radius}` : sql12``}
    ${embedding ? sql12`AND e.score_key>=0.30 AND e.score_key<'Infinity'::float8 AND e.score_key<>'NaN'::float8` : sql12``}),
  currency_state AS (SELECT count(DISTINCT currency)<=1 AND coalesce(bool_and(currency IS NOT NULL AND currency IN (${sql12.join(SUPPORTED_CURRENCIES.map((code) => sql12`${code}`), sql12`, `)})),true) AS price_sort_available FROM matched),
  eligible AS (SELECT m.id,m.currency,m.created_key,m.rating_key,m.distance_key,m.score_key,
    CASE WHEN cs.price_sort_available THEN m.price_key ELSE NULL END AS price_key,cs.price_sort_available FROM matched m CROSS JOIN currency_state cs)
  SELECT e.id,e.currency,jsonb_build_array(${sql12.join(keys.map((key) => column(key.name)), sql12`, `)}) AS keys,e.distance_key AS distance,e.price_sort_available AS "priceSortAvailable"
  FROM eligible e WHERE true
  ${position ? sql12`AND (${continuation.length ? sql12.join(continuation, sql12` OR `) : sql12`false`})` : sql12``}
  ORDER BY ${sql12.join(keys.map((key) => sql12`${column(key.name)} ${sql12.raw(key.direction)} NULLS LAST`), sql12`, `)} LIMIT ${limit + 1}`;
}

// server/search-pagination/store.ts
function createSearchPageStore(database, hydrate) {
  return {
    async rows(request) {
      return database.transaction(async (tx) => {
        await tx.execute(sql13`SET TRANSACTION READ ONLY`);
        await tx.execute(sql13`SET LOCAL statement_timeout='8000ms'`);
        return (await tx.execute(searchPageSQL(request))).rows;
      });
    },
    hydrate: (ids) => ids.length ? hydrate(ids) : Promise.resolve([])
  };
}

// server/workspace-pricing/routes.ts
import { z as z36 } from "zod";

// shared/workspace-pricing.ts
import { z as z35 } from "zod";
var pricingWorkspaceSchema = z35.discriminatedUnion("kind", [
  z35.object({ kind: z35.literal("user"), id: z35.string().min(1).max(128) }).strict(),
  z35.object({ kind: z35.literal("company"), id: z35.number().int().positive().max(2147483647) }).strict()
]);
var currency = z35.string().refine(isSupportedCurrency, "Choose a supported currency.");
var country = z35.string().refine(isSupportedCountry, "Choose a supported country.");
var workspacePricingViewSchema = z35.object({
  workspace: pricingWorkspaceSchema,
  defaultCurrency: currency.nullable(),
  businessCountryCode: country.nullable(),
  revision: z35.number().int().min(0).max(2147483647),
  canEdit: z35.boolean()
}).strict();
var workspacePricingSettingsViewSchema = workspacePricingViewSchema;
var workspacePricingUpdateSchema = z35.object({
  // Comparison binding only. The server always selects the target workspace.
  expectedWorkspace: pricingWorkspaceSchema,
  expectedRevision: z35.number().int().min(0).max(2147483646),
  defaultCurrency: currency.nullable().optional(),
  businessCountryCode: country.nullable().optional()
}).strict().refine((input) => input.defaultCurrency !== void 0 || input.businessCountryCode !== void 0, "Choose a setting to update.");
var WorkspacePricingError = class extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
};
var samePricingWorkspace = (left, right) => left.kind === right.kind && left.id === right.id;

// server/workspace-pricing/routes.ts
function setupWorkspacePricingRoutes(app2, dependencies) {
  app2.use("/api/workspace/pricing-settings", (_req, res, next) => {
    res.set("Cache-Control", "private, no-store");
    next();
  });
  function handler(write) {
    return (req, res) => {
      void (async () => {
        res.set("Cache-Control", "private, no-store");
        try {
          const actor2 = dependencies.currentWorkspace(req, write);
          if (write) res.json(await dependencies.store.patch(actor2, workspacePricingUpdateSchema.parse(req.body)));
          else {
            z36.object({}).strict().parse(req.query);
            res.json(await dependencies.store.get(actor2));
          }
        } catch (error) {
          const known = error instanceof WorkspacePricingError;
          res.status(known ? error.status : error instanceof z36.ZodError ? 400 : 503).json({
            code: known ? error.code : error instanceof z36.ZodError ? "INVALID_WORKSPACE_PRICING" : "WORKSPACE_PRICING_UNAVAILABLE",
            message: known ? error.message : error instanceof z36.ZodError ? "Choose valid workspace pricing settings." : "Workspace pricing settings are temporarily unavailable."
          });
        }
      })();
    };
  }
  app2.get("/api/workspace/pricing-settings", dependencies.authenticate, handler(false));
  app2.patch("/api/workspace/pricing-settings", dependencies.authenticate, handler(true));
}

// server/workspace-pricing/store.ts
import { randomUUID as randomUUID12 } from "node:crypto";
import { and as and13, eq as eq16, isNull as isNull10 } from "drizzle-orm";
var forbidden = () => {
  throw new WorkspacePricingError(403, "WORKSPACE_PRICING_FORBIDDEN", "Your access level does not allow this action.");
};
var conflict = () => {
  throw new WorkspacePricingError(409, "WORKSPACE_PRICING_CHANGED", "These workspace settings changed. Refresh and review them before saving.");
};
function pricingWorkspace(actor2) {
  return actor2.companyId != null ? { kind: "company", id: actor2.companyId } : { kind: "user", id: actor2.userId };
}
function owned2(actor2) {
  return actor2.companyId != null ? and13(eq16(workspacePricingSettings.companyId, actor2.companyId), isNull10(workspacePricingSettings.userId)) : and13(eq16(workspacePricingSettings.userId, actor2.userId), isNull10(workspacePricingSettings.companyId));
}
async function authorize(database, actor2, lock = false) {
  if (actor2.companyId == null) {
    let query = database.select().from(users).where(eq16(users.id, actor2.userId));
    const [user] = await (lock ? query.for("update") : query);
    if (!user) forbidden();
    return;
  }
  const companyQuery = database.select().from(companies).where(eq16(companies.id, actor2.companyId));
  const [company] = await (lock ? companyQuery.for("update") : companyQuery);
  const memberQuery = database.select().from(companyMemberships).where(and13(eq16(companyMemberships.companyId, actor2.companyId), eq16(companyMemberships.userId, actor2.userId)));
  const [membership] = await (lock ? memberQuery.for("share") : memberQuery);
  if (!company?.isActive || !membership || !["owner", "admin"].includes(membership.role)) forbidden();
}
function view(actor2, row) {
  return workspacePricingSettingsViewSchema.parse({ workspace: pricingWorkspace(actor2), defaultCurrency: row?.defaultCurrency ?? null, businessCountryCode: row?.businessCountryCode ?? null, revision: row?.revision ?? 0, canEdit: true });
}
function createWorkspacePricingStore(database) {
  return {
    async get(actor2) {
      await authorize(database, actor2);
      const [row] = await database.select().from(workspacePricingSettings).where(owned2(actor2));
      return view(actor2, row);
    },
    async patch(actor2, input) {
      if (!samePricingWorkspace(pricingWorkspace(actor2), input.expectedWorkspace)) throw new WorkspacePricingError(409, "WORKSPACE_CHANGED", "The active workspace changed. Refresh its settings before saving.");
      return database.transaction(async (tx) => {
        await authorize(tx, actor2, true);
        const [previous] = await tx.select().from(workspacePricingSettings).where(owned2(actor2)).for("update");
        if ((previous?.revision ?? 0) !== input.expectedRevision) conflict();
        if (previous && previous.revision >= 2147483647) conflict();
        const changes = {
          ...input.defaultCurrency !== void 0 ? { defaultCurrency: input.defaultCurrency } : {},
          ...input.businessCountryCode !== void 0 ? { businessCountryCode: input.businessCountryCode } : {},
          updatedAt: /* @__PURE__ */ new Date()
        };
        if (previous) {
          const [updated] = await tx.update(workspacePricingSettings).set({ ...changes, revision: previous.revision + 1 }).where(and13(owned2(actor2), eq16(workspacePricingSettings.id, previous.id), eq16(workspacePricingSettings.revision, input.expectedRevision))).returning();
          if (!updated) conflict();
          return view(actor2, updated);
        }
        const [created] = await tx.insert(workspacePricingSettings).values({
          id: randomUUID12(),
          userId: actor2.companyId == null ? actor2.userId : null,
          companyId: actor2.companyId ?? null,
          defaultCurrency: null,
          businessCountryCode: null,
          ...changes,
          revision: 1
        }).onConflictDoNothing().returning();
        if (!created) conflict();
        return view(actor2, created);
      });
    }
  };
}

// server/routes.ts
var initialBookingMessageSchema = z37.object({
  initialMessage: z37.string().trim().max(4e3).nullish(),
  notes: z37.string().trim().max(4e3).nullish()
}).superRefine((input, context) => {
  if (input.initialMessage && input.notes && input.initialMessage !== input.notes) {
    context.addIssue({ code: z37.ZodIssueCode.custom, path: ["initialMessage"], message: "Provide one initial message for this reservation." });
  }
}).transform((input) => input.initialMessage || input.notes || null);
function apiFailure(error, res, fallback) {
  if (error instanceof PriceChangedError) return res.status(409).json({ code: error.code, message: error.message, currentPrice: error.currentPrice, currentCurrency: error.currentCurrency, currentAdvancePaymentPercent: error.currentAdvancePaymentPercent });
  const pgError = error?.cause ?? error;
  if (pgError?.code === "23503" && pgError?.constraint === "services_category_categories_key_fk") {
    return res.status(400).json({ message: "Choose an existing category." });
  }
  const known = error instanceof AccessError || error instanceof CustomerBookingError || error instanceof ImageStorageError || error instanceof GeocodingError || error instanceof CategoryError || error instanceof AuditCaptureUnavailable || error instanceof NotificationError || error instanceof MoneyInputError;
  res.status(known ? error.status : error instanceof z37.ZodError ? 400 : error instanceof BookingConflictError ? 409 : 500).json({ message: known || error instanceof BookingConflictError ? error.message : error instanceof z37.ZodError ? error.issues[0].message : fallback });
}
async function enrichEmbeddingText(name, description, category) {
  const details = (await categoryStore.list()).find((item) => item.key === category);
  let text3 = `${name} ${description || ""} ${category} ${details?.name ?? ""} ${details?.searchKeywords ?? ""}`.trim();
  const latvianToEnglish = {
    "pirts": "sauna bathhouse steam bath traditional bathing ritual",
    "mas\u0101\u017Ea": "massage therapy bodywork",
    "matem\u0101tika": "math mathematics arithmetic algebra calculus",
    "priv\u0101tstundas": "private lessons tutoring one-on-one teaching",
    "joga": "yoga stretching meditation wellness",
    "fizika": "physics science",
    "\u0137\u012Bmija": "chemistry science",
    "valoda": "language learning speaking",
    "ang\u013Cu": "english language",
    "v\u0101cu": "german language",
    "krievu": "russian language",
    "m\u016Bzika": "music lessons instrument playing",
    "m\u0101ksla": "art drawing painting creative",
    "sports": "sports fitness training exercise",
    "dejas": "dance dancing lessons",
    "frizieris": "hairdresser haircut styling barber",
    "skaistumkop\u0161ana": "beauty care cosmetics skincare"
  };
  const lowerText = text3.toLowerCase();
  for (const [latvian, english] of Object.entries(latvianToEnglish)) {
    if (lowerText.includes(latvian)) {
      text3 += ` ${english}`;
    }
  }
  return text3;
}
async function registerRoutes(app2, billing) {
  await setupAuth(app2);
  app2.use(["/api/services", "/api/bookings", "/api/geocode", "/api/addresses"], (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  setupAdminRoutes(app2);
  setupCategoryRoutes(app2);
  setupCompanyRoutes(app2);
  setupWorkspacePricingRoutes(app2, { authenticate: isAuthenticated, store: createWorkspacePricingStore(db), currentWorkspace(req, write) {
    try {
      const current = scope(req, "manageServices");
      if (write && current.companyId != null && !current.ctx.permissions.manageCompany) throw new AccessError(403, "Your access level does not allow this action.");
      return { userId: current.userId, companyId: current.companyId };
    } catch (error) {
      if (error instanceof AccessError) throw new WorkspacePricingError(403, "WORKSPACE_PRICING_FORBIDDEN", error.message);
      throw error;
    }
  } });
  setupNotificationRoutes(app2);
  setupAppointmentRoutes(app2);
  const wishlist = createWishlistService(createWishlistStore(db), (id2) => storage.getServiceById(id2));
  setupWishlistRoutes(app2, isAuthenticated, wishlist, createInboxService(db, (id2) => storage.getBookingById(id2)), (id2) => storage.getUser(id2));
  billing?.mountAuthenticated(app2);
  setupSchedulingRoutes(app2);
  setupReviewRoutes(app2);
  setupProviderCatalogRoutes(app2);
  setupStorefrontRoutes(app2);
  setupPublicSearchRoutes(app2, {
    searchPageStore: createSearchPageStore(db, (ids) => storage.searchServices({ serviceIds: ids })),
    searchServices: (filters) => storage.searchServices(filters),
    getPublicServiceEmbeddings: (filters) => storage.getPublicServiceEmbeddings(filters),
    generateEmbedding
  });
  setupPaymentRoutes(app2, isAuthenticated);
  setupSearchLocationRoutes(app2, isAuthenticated, searchLocationStore);
  setupServiceViewRoutes(app2, {
    getService: (id2) => storage.getServiceById(id2),
    recordProductView: process.env.PRODUCT_ACTIVITY_ENABLED === "true" ? (id2, userId) => wishlist.recordView(id2, userId) : void 0,
    verifyActor: async (token, expectedUserId) => {
      const { data, error } = await createAuthClient().auth.getUser(token);
      if (error || !data.user || data.user.id !== expectedUserId) return { kind: "anonymous" };
      const profile = await storage.getUser(data.user.id);
      if (!profile || profile.currentRole !== "seeker" && profile.currentRole !== "provider") return { kind: "anonymous" };
      return { kind: "user", userId: data.user.id, effectiveRole: profile.currentRole };
    }
  });
  app2.post("/api/objects/upload", isAuthenticated, async (req, res) => {
    try {
      scope(req, "manageServices");
      const upload = await createImageUpload(req.user.claims.sub, req.body.contentType, req.body.size);
      res.json(upload);
    } catch (error) {
      console.error("Error getting upload URL:", error);
      apiFailure(error, res, "Failed to get upload URL");
    }
  });
  app2.get("/objects/:objectPath(*)", async (req, res, next) => {
    try {
      if (await canReadImage(req.path)) return next();
      return isAuthenticated(req, res, next);
    } catch (error) {
      return apiFailure(error, res, "Unable to load image");
    }
  }, async (req, res) => {
    const userId = req.user?.claims?.sub;
    try {
      if (userId) {
        const workspace = await workspaceContext(userId, req.session.activeCompanyId);
        if (!await canReadImage(req.path, userId, workspace)) return res.sendStatus(403);
      }
      const image = await downloadImage(req.path);
      res.set({ "Content-Type": image.contentType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
      res.send(image.bytes);
    } catch (error) {
      console.error("Error checking object access:", error);
      return apiFailure(error, res, "Unable to load image");
    }
  });
  app2.put("/api/service-images", isAuthenticated, async (req, res) => {
    if (typeof req.body.objectPath !== "string") {
      return res.status(400).json({ message: "objectPath is required" });
    }
    const userId = req.user?.claims?.sub;
    try {
      scope(req, "manageServices");
      const objectPath = req.body.objectPath;
      await validateOwnedImage(objectPath, userId);
      res.status(200).json({
        objectPath
      });
    } catch (error) {
      console.error("Error setting service image:", error);
      apiFailure(error, res, "Failed to confirm image");
    }
  });
  app2.get("/api/auth/user", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      apiFailure(error, res, "Failed to fetch user");
    }
  });
  app2.patch("/api/auth/user", isAuthenticated, async (req, res) => {
    try {
      const names = accountDetailsSchema.parse(req.body);
      const userId = req.user.claims.sub;
      if (!await storage.getUser(userId)) return res.status(404).json({ message: "Account not found." });
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: { first_name: names.firstName, last_name: names.lastName }
      });
      if (error) return res.status(503).json({ message: "Unable to save account details. Please try again." });
      res.json(await storage.updateUserNames(userId, names));
    } catch (error) {
      apiFailure(error, res, "Unable to save account details. Please try again.");
    }
  });
  app2.get("/api/config/maps", async (req, res) => {
    res.json({
      apiKey: process.env.GOOGLE_MAPS_API_KEY || ""
    });
  });
  app2.post("/api/geocode", isAuthenticated, async (req, res) => {
    try {
      const current = scope(req, "manageServices");
      res.json(await registerLocation(req.body.address, current));
    } catch (error) {
      apiFailure(error, res, "Address lookup is temporarily unavailable.");
    }
  });
  app2.get("/api/addresses", isAuthenticated, async (req, res) => {
    try {
      res.json(await addressStore.list(scope(req, "manageServices")));
    } catch (error) {
      apiFailure(error, res, "Unable to load saved addresses.");
    }
  });
  const saveAddress = async (req, res) => {
    try {
      const owner = scope(req, "manageServices");
      const id2 = req.params.id ? z37.coerce.number().int().positive().parse(req.params.id) : void 0;
      const existing = id2 == null ? void 0 : await addressStore.get(id2, owner);
      const input = addressInputSchema.parse(req.body);
      const metadata = await resolveServiceLocation(input, req.body, existing);
      res.status(id2 == null ? 201 : 200).json(await addressStore.save({ ...input, ...metadata }, owner, id2));
    } catch (error) {
      apiFailure(error, res, "Unable to save address.");
    }
  };
  app2.post("/api/addresses", isAuthenticated, saveAddress);
  app2.patch("/api/addresses/:id", isAuthenticated, saveAddress);
  app2.delete("/api/addresses/:id", isAuthenticated, async (req, res) => {
    try {
      const owner = scope(req, "manageServices");
      await addressStore.remove(z37.coerce.number().int().positive().parse(req.params.id), owner);
      res.sendStatus(204);
    } catch (error) {
      if ((error?.cause ?? error)?.code === "23503") return void res.status(409).json({ message: "This address is used by services. Choose another address for those services before removing it." });
      apiFailure(error, res, "Unable to remove address.");
    }
  });
  app2.patch("/api/users/role", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const { role } = req.body;
      if (!["seeker", "provider"].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }
      const user = await storage.updateUserRole(userId, role, requestAuditContext(req, "account"));
      res.json(user);
    } catch (error) {
      console.error("Error updating user role:", error instanceof AuditCaptureUnavailable ? "AUDIT_CAPTURE_UNAVAILABLE" : "ROLE_UPDATE_FAILED");
      apiFailure(error, res, "Failed to update user role");
    }
  });
  app2.patch("/api/provider/profile", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = providerProfileSchema.parse(req.body);
      const current = scope(req);
      if (current.companyId) {
        scope(req, "manageCompany");
        if (profile.providerType !== "company") throw new AccessError(409, "Choose Personal workspace to manage individual offers.");
        await db.update(companies).set({ name: profile.companyName }).where(eq17(companies.id, current.companyId));
        return res.json({ ...await storage.getUser(userId), providerType: "company", companyName: profile.companyName });
      }
      if (profile.providerType === "company") {
        const company = await ensureCompany(userId, profile.companyName);
        req.session.activeCompanyId = company.id;
        await saveWorkspaceSession(req);
        return res.json(await storage.getUser(userId));
      }
      if (profile.providerType === "individual") {
        const listings = await storage.getServicesByProvider(userId);
        if (listings.some((service) => service.employeeId != null)) {
          return res.status(409).json({ message: "Remove employee assignments from your services before switching to an individual profile." });
        }
      }
      res.json(await storage.updateProviderProfile(userId, {
        providerType: profile.providerType,
        companyName: null
      }));
    } catch (error) {
      apiFailure(error, res, "Unable to save provider profile");
    }
  });
  app2.get("/api/provider/employees", isAuthenticated, async (req, res) => {
    try {
      const current = scope(req);
      const employees2 = await storage.getEmployees(current.providerId, current.companyId);
      res.json(current.ctx.permissions.readAll ? employees2 : employees2.filter((employee) => employee.id === current.employeeId));
    } catch (error) {
      apiFailure(error, res, "Unable to load employees");
    }
  });
  const saveEmployee = async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const current = scope(req);
      if (!current.companyId) return void res.status(400).json({ message: "Set up a company profile before adding employees." });
      scope(req, "manageTeam");
      const id2 = req.params.id ? z37.coerce.number().int().positive().parse(req.params.id) : void 0;
      const employee = await storage.saveEmployee(current.providerId, employeeSchema.parse(req.body), id2, current.companyId);
      if (!employee) return void res.status(404).json({ message: "Employee not found" });
      res.status(id2 ? 200 : 201).json(employee);
    } catch (error) {
      apiFailure(error, res, "Unable to save employee");
    }
  };
  app2.post("/api/provider/employees", isAuthenticated, saveEmployee);
  app2.patch("/api/provider/employees/:id", isAuthenticated, saveEmployee);
  app2.delete("/api/provider/employees/:id", isAuthenticated, async (req, res) => {
    try {
      const id2 = z37.coerce.number().int().positive().parse(req.params.id);
      const current = scope(req, "manageTeam");
      if (!await storage.deleteEmployee(current.providerId, id2, current.companyId)) return void res.status(404).json({ message: "Employee not found" });
      res.json({ message: "Employee removed" });
    } catch (error) {
      const referenced = error.code === "23503";
      if (error instanceof AccessError) return void apiFailure(error, res, "Unable to remove employee");
      res.status(referenced ? 409 : error instanceof z37.ZodError ? 400 : 500).json({ message: referenced ? "This employee is linked to services, bookings, or team access. Remove those links first; employees with booking history must be kept." : "Unable to remove employee" });
    }
  });
  async function validateEmployeeAssignment(employeeId, req) {
    if (employeeId == null) return;
    const current = scope(req);
    const employees2 = await storage.getEmployees(current.providerId, current.companyId);
    if (!current.companyId || !employees2.some((employee) => employee.id === employeeId)) {
      throw new z37.ZodError([{ code: "custom", path: ["employeeId"], message: "Choose an employee from your company." }]);
    }
  }
  async function validateAddressAssignment(addressId, req) {
    const address = await addressStore.get(addressId, scope(req, "manageServices"));
    if (!address.address?.trim()) throw new AccessError(400, "Update this saved address before using it for a service.");
  }
  app2.post("/api/services", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const current = scope(req, "manageServices");
      const serviceData = insertServiceSchema.parse({
        ...req.body,
        providerId: current.providerId,
        companyId: current.companyId ?? null
      });
      if (!(await categoryStore.list()).some((category) => category.key === serviceData.category)) throw new CategoryError(400, "Choose an existing category.");
      await validateAddressAssignment(serviceData.addressId, req);
      if (serviceData.imageUrl) await validateServiceImage(serviceData.imageUrl, userId, current.companyId);
      await validateEmployeeAssignment(serviceData.employeeId, req);
      const service = await storage.createService(serviceData);
      try {
        const textContent = await enrichEmbeddingText(service.name, service.description, service.category);
        const embedding = await generateEmbedding(textContent);
        await storage.upsertServiceEmbedding({
          serviceId: service.id,
          embedding,
          textContent
        });
      } catch (embeddingError) {
        console.error("Failed to generate embedding for new service:", embeddingError);
      }
      res.json(service);
    } catch (error) {
      console.error("Error creating service:", error instanceof Error ? error.name : "Error");
      apiFailure(error, res, "Failed to create service");
    }
  });
  app2.get("/api/services/provider", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const current = scope(req);
      const services4 = await storage.getServicesByProvider(current.providerId, current.companyId);
      res.json(current.ctx.permissions.readAll ? services4 : services4.filter((service) => current.employeeId != null && service.employeeId === current.employeeId));
    } catch (error) {
      console.error("Error fetching provider services:", error);
      apiFailure(error, res, "Failed to fetch services");
    }
  });
  app2.post("/api/services/:id/embedding", isAuthenticated, async (req, res) => {
    try {
      const serviceId2 = parseInt(req.params.id);
      const service = await storage.getServiceById(serviceId2);
      if (!service) {
        return res.status(404).json({ message: "Service not found" });
      }
      assertService(req, service, true);
      const textContent = await enrichEmbeddingText(service.name, service.description, service.category);
      const embedding = await generateEmbedding(textContent);
      const result = await storage.upsertServiceEmbedding({
        serviceId: serviceId2,
        embedding,
        textContent
      });
      res.json({ message: "Embedding generated successfully", id: result.id });
    } catch (error) {
      console.error("Error generating embedding:", error);
      apiFailure(error, res, "Failed to generate embedding");
    }
  });
  app2.post("/api/admin/generate-embeddings", isAuthenticated, async (req, res) => {
    try {
      const current = scope(req, "manageServices");
      const providerServices = await storage.getServicesByProvider(current.providerId, current.companyId);
      let generated = 0;
      let failed = 0;
      for (const service of providerServices) {
        try {
          const textContent = await enrichEmbeddingText(service.name, service.description, service.category);
          const embedding = await generateEmbedding(textContent);
          await storage.upsertServiceEmbedding({
            serviceId: service.id,
            embedding,
            textContent
          });
          generated++;
        } catch (err) {
          console.error(`Failed to generate embedding for service ${service.id}:`, err);
          failed++;
        }
      }
      res.json({
        message: "Embedding generation complete for your services",
        generated,
        failed,
        total: providerServices.length
      });
    } catch (error) {
      console.error("Error generating embeddings:", error);
      apiFailure(error, res, "Failed to generate embeddings");
    }
  });
  app2.get("/api/services/:id", async (req, res) => {
    try {
      const serviceId2 = parseInt(req.params.id);
      const service = await storage.getServiceById(serviceId2);
      if (!service || !service.isActive || !service.companyActive) {
        return res.status(404).json({ message: "Service not found" });
      }
      res.json(service);
    } catch (error) {
      console.error("Error fetching service:", error);
      apiFailure(error, res, "Failed to fetch service");
    }
  });
  app2.post("/api/services/:id/copy", isAuthenticated, async (req, res) => {
    const serviceId2 = Number(req.params.id);
    if (!Number.isSafeInteger(serviceId2) || serviceId2 < 1) {
      return res.status(400).json({ message: "Invalid service ID" });
    }
    try {
      const current = scope(req, "manageServices");
      const copy2 = await storage.copyService(serviceId2, current.providerId, current.companyId);
      if (!copy2) return res.status(404).json({ message: "Service not found" });
      res.status(201).json(copy2);
    } catch (error) {
      console.error("Failed to copy service:", error instanceof Error ? error.name : "Error");
      apiFailure(error, res, "Failed to copy service");
    }
  });
  app2.patch("/api/services/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const serviceId2 = parseInt(req.params.id);
      const service = await storage.getServiceById(serviceId2);
      const current = assertService(req, service, true);
      const updates = insertServiceSchema.omit({ providerId: true, companyId: true }).partial().parse(req.body);
      if (updates.category !== void 0 && !(await categoryStore.list()).some((category) => category.key === updates.category)) throw new CategoryError(400, "Choose an existing category.");
      if (updates.addressId !== void 0) await validateAddressAssignment(updates.addressId, req);
      if (updates.imageUrl) await validateServiceImage(updates.imageUrl, userId, current.companyId);
      await validateEmployeeAssignment(updates.employeeId, req);
      if (updates.employeeId !== void 0 && updates.employeeId !== service.employeeId) {
        const upcoming = (await storage.getBookingsByProvider(current.providerId, current.companyId)).some((booking) => booking.serviceId === serviceId2 && (booking.status === "pending" || booking.status === "confirmed") && new Date(booking.scheduledDate).getTime() + ((booking.bookingDuration ?? service.duration) + (booking.bookingCleanupTime ?? 0)) * 6e4 > Date.now());
        if (upcoming) return res.status(409).json({ message: "This service has upcoming bookings. Keep its assigned employee or resolve those bookings before changing the assignment." });
      }
      const updatedService = await storage.updateService(serviceId2, updates);
      res.json(updatedService);
    } catch (error) {
      console.error("Error updating service:", error instanceof Error ? error.name : "Error");
      apiFailure(error, res, "Failed to update service");
    }
  });
  app2.delete("/api/services/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const serviceId2 = parseInt(req.params.id);
      const service = await storage.getServiceById(serviceId2);
      assertService(req, service, true);
      await storage.deleteService(serviceId2);
      res.json({ message: "Service deleted successfully" });
    } catch (error) {
      console.error("Error deleting service:", error);
      apiFailure(error, res, "Failed to delete service");
    }
  });
  app2.post("/api/bookings", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const initialMessage = initialBookingMessageSchema.parse(req.body);
      const serviceId2 = z37.number().int().positive().parse(req.body.serviceId);
      const service = await storage.getServiceById(serviceId2);
      if (!service || !service.isActive || !service.companyActive) {
        return res.status(404).json({ message: "Service not found" });
      }
      const scheduledDate = z37.string().datetime().transform((value) => new Date(value)).refine((value) => value.getTime() > Date.now(), "Choose a future appointment time.").parse(req.body.scheduledDate);
      const participantCount = z37.number().int().min(1).max(service.serviceType === "group" ? service.maxCapacity ?? 1 : 1).parse(req.body.participantCount ?? 1);
      const expectedPrice = expectedPriceSchema.parse(req.body);
      const snapshot = bookingPriceSnapshot(service, participantCount, expectedPrice);
      const bookingData = insertBookingSchema.parse({
        serviceId: serviceId2,
        notes: null,
        seekerId: userId,
        providerId: service.providerId,
        companyId: service.companyId,
        employeeId: service.employeeId,
        bookingDuration: service.duration,
        bookingCleanupTime: service.cleanupTime,
        status: service.instantBooking ? "confirmed" : "pending",
        paymentStatus: "pending",
        scheduledDate,
        participantCount,
        ...snapshot
      });
      const booking = await storage.createBooking(bookingData, initialMessage, expectedPrice);
      res.json(bookingMoneyDto(booking));
    } catch (error) {
      console.error("Error creating booking:", error instanceof Error ? error.name : "Error");
      apiFailure(error, res, "Failed to create booking");
    }
  });
  app2.get("/api/bookings/seeker", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const bookings2 = await storage.getBookingsBySeeker(userId);
      res.json(bookings2);
    } catch (error) {
      console.error("Error fetching seeker bookings:", error);
      apiFailure(error, res, "Failed to fetch bookings");
    }
  });
  app2.get("/api/bookings/provider", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const current = scope(req);
      const bookings2 = await storage.getBookingsByProvider(current.providerId, current.companyId);
      const visible = current.ctx.permissions.readAll ? bookings2 : bookings2.filter((booking) => current.employeeId != null && booking.employeeId === current.employeeId);
      if (!notificationConfig().enabled) return res.json(visible);
      const reminders = await bookingReminderSummaries(db, visible);
      res.json(visible.map((booking) => ({ ...booking, reminder: reminders.get(booking.id) })));
    } catch (error) {
      console.error("Error fetching provider bookings:", error);
      apiFailure(error, res, "Failed to fetch bookings");
    }
  });
  app2.patch("/api/bookings/:id/status", isAuthenticated, async (req, res) => {
    try {
      const bookingId = z37.coerce.number().int().positive().parse(req.params.id);
      const { status } = z37.object({ status: z37.enum(["pending", "confirmed", "cancelled", "completed"]) }).parse(req.body);
      const booking = await storage.getBookingById(bookingId);
      const seekerId = assertBookingChange(req, booking);
      if (seekerId && status !== "cancelled") throw new AccessError(403, "Customers can only cancel their reservations.");
      const timeZone = notificationTimezoneSchema.parse(req.body.timeZone);
      const updatedBooking = await storage.updateBookingStatus(bookingId, status, seekerId, timeZone);
      res.json(updatedBooking);
    } catch (error) {
      console.error("Error updating booking status:", error);
      apiFailure(error, res, "Failed to update booking status");
    }
  });
  app2.patch("/api/bookings/:id/reschedule", isAuthenticated, async (req, res) => {
    try {
      const id2 = z37.coerce.number().int().positive().parse(req.params.id);
      z37.string().datetime().refine((value) => Date.parse(value) > Date.now(), "Choose a future appointment time.").parse(req.body.scheduledDate);
      const booking = await storage.getBookingById(id2);
      assertBookingChange(req, booking);
      res.status(409).json({ code: "consent_required", message: "Send a reschedule request. The other party must agree before the reservation changes." });
    } catch (error) {
      apiFailure(error, res, "Unable to reschedule reservation");
    }
  });
  app2.post("/api/availability", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const current = scope(req, "manageSchedules");
      const rawServiceId = req.body.serviceId;
      const serviceId2 = rawServiceId && rawServiceId !== "null" && rawServiceId !== "" ? parseInt(rawServiceId, 10) : null;
      if (serviceId2 !== null) {
        const service = await storage.getServiceById(serviceId2);
        assertService(req, service, true);
      }
      const availabilityData = {
        ...req.body,
        serviceId: serviceId2,
        // Use normalized value
        providerId: current.providerId,
        companyId: current.companyId ?? null,
        specificDate: req.body.specificDate ? new Date(req.body.specificDate) : null,
        daysOfWeek: req.body.daysOfWeek || null
      };
      const validated = insertAvailabilitySchema.parse(availabilityData);
      const availability2 = await storage.createAvailability(validated);
      res.json(availability2);
    } catch (error) {
      console.error("Error creating availability:", error);
      apiFailure(error, res, "Failed to create availability");
    }
  });
  app2.get("/api/availability/service/:serviceId", async (req, res) => {
    try {
      const serviceId2 = parseInt(req.params.serviceId);
      const service = await storage.getServiceById(serviceId2);
      if (!service?.isActive || !service.companyActive) return res.status(404).json({ message: "Service not found" });
      const availability2 = await storage.getAvailabilityByService(serviceId2);
      res.json(availability2);
    } catch (error) {
      console.error("Error fetching availability:", error);
      apiFailure(error, res, "Failed to fetch availability");
    }
  });
  app2.get("/api/availability/provider", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const current = scope(req);
      const availability2 = await storage.getAvailabilityByProvider(current.providerId, current.companyId);
      const assigned = current.ctx.permissions.readAll ? [] : await storage.getServicesByProvider(current.providerId, current.companyId);
      res.json(current.ctx.permissions.readAll ? availability2 : availability2.filter((schedule) => schedule.serviceId == null || assigned.some((service) => service.id === schedule.serviceId && service.employeeId === current.employeeId)));
    } catch (error) {
      console.error("Error fetching provider availability:", error);
      apiFailure(error, res, "Failed to fetch availability");
    }
  });
  app2.patch("/api/availability/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const availabilityId = parseInt(req.params.id);
      const current = scope(req, "manageSchedules");
      const existing = await storage.getAvailabilityByProvider(current.providerId, current.companyId);
      const availability2 = existing.find((a) => a.id === availabilityId);
      if (!availability2) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      const updates = insertAvailabilitySchema.omit({ providerId: true, companyId: true }).partial().parse({
        ...req.body,
        specificDate: req.body.specificDate ? new Date(req.body.specificDate) : void 0
      });
      if (updates.serviceId != null) assertService(req, await storage.getServiceById(updates.serviceId), true);
      const updated = await storage.updateAvailability(availabilityId, updates);
      res.json(updated);
    } catch (error) {
      console.error("Error updating availability:", error);
      apiFailure(error, res, "Failed to update availability");
    }
  });
  app2.delete("/api/availability/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const availabilityId = parseInt(req.params.id);
      const current = scope(req, "manageSchedules");
      const existing = await storage.getAvailabilityByProvider(current.providerId, current.companyId);
      if (!existing.some((schedule) => schedule.id === availabilityId)) throw new AccessError(403, "Schedule is not in this workspace.");
      await storage.deleteAvailability(availabilityId, current.providerId, current.companyId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting availability:", error);
      apiFailure(error, res, "Failed to delete availability");
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path3 from "path";
import { randomUUID as randomUUID13 } from "node:crypto";
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const [{ createServer: createViteServer, createLogger }, { default: viteConfig }] = await Promise.all([
    import("vite"),
    Promise.resolve().then(() => (init_vite_config(), vite_config_exports))
  ]);
  const viteLogger = createLogger();
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path3.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${randomUUID13()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path3.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path3.resolve(distPath, "index.html"));
  });
}

// server/api-fallback.ts
var apiNotFound = (_req, res) => {
  res.status(404).json({ message: "API endpoint not found." });
};

// server/billing/runtime.ts
import Stripe2 from "stripe";
import { rateLimit as rateLimit8 } from "express-rate-limit";

// server/billing/application.ts
import { randomUUID as randomUUID21 } from "node:crypto";
import { eq as eq24 } from "drizzle-orm";

// server/billing/pricing.ts
import { randomUUID as randomUUID14, createHash as createHash6 } from "node:crypto";
import { and as and14, eq as eq18 } from "drizzle-orm";
import { z as z38 } from "zod";
var adminAmountSchema = z38.string().regex(/^(?:0|[1-9]\d{0,5})\.\d{2}$/);
function amountToMinor2(input) {
  const amount = adminAmountSchema.parse(input);
  const [whole, cents] = amount.split(".");
  const value = Number(whole) * 100 + Number(cents);
  if (!Number.isSafeInteger(value) || value < 50 || value > 99999999) throw new BillingError("INVALID_INPUT");
  return value;
}
function displayAmount(minor) {
  return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, "0")}`;
}
async function readCurrentOffer(tx, lock = false) {
  const query = tx.select().from(billingOfferSettings).where(eq18(billingOfferSettings.singleton, true));
  const [setting] = lock ? await query.for("update") : await query;
  if (!setting) throw new BillingError("UNAVAILABLE");
  const [offer] = await tx.select().from(billingOfferRevisions).where(eq18(billingOfferRevisions.id, setting.currentOfferId));
  if (!offer) throw new BillingError("UNAVAILABLE");
  return { setting, offer };
}
async function assertCurrentOffer(tx, revision) {
  const { offer } = await readCurrentOffer(tx, true);
  if (offer.id !== revision) throw new BillingError("CONFLICT");
}
function createPricingService(db2, isAdmin, audit, now) {
  const view2 = (offer, revision) => ({
    amount: displayAmount(offer.amountMinor),
    revision: String(revision),
    currency: "EUR",
    interval: "month",
    taxIncluded: true
  });
  return {
    async read(actorId) {
      if (!isAdmin(actorId)) throw new BillingError("FORBIDDEN");
      return db2.transaction(async (tx) => {
        const { setting, offer } = await readCurrentOffer(tx);
        return view2(offer, setting.revision);
      });
    },
    async save(actorId, input) {
      const request = z38.object({ amount: adminAmountSchema, expectedRevision: z38.string().regex(/^[1-9]\d{0,9}$/).refine((value) => Number(value) <= 2147483647) }).strict().parse(input);
      const amountMinor = amountToMinor2(request.amount);
      return db2.transaction(async (tx) => {
        if (!isAdmin(actorId)) throw new BillingError("FORBIDDEN");
        const { setting, offer } = await readCurrentOffer(tx, true);
        if (String(setting.revision) !== request.expectedRevision) throw new BillingError("CONFLICT");
        if (offer.amountMinor === amountMinor) return view2(offer, setting.revision);
        if (setting.revision === 2147483647) throw new BillingError("UNAVAILABLE");
        const id2 = randomUUID14(), timestamp2 = new Date(now());
        await tx.insert(billingOfferRevisions).values({
          id: id2,
          version: setting.revision + 1,
          amountMinor,
          currency: "EUR",
          interval: "month",
          taxIncluded: true,
          issuedBy: actorId,
          createdAt: timestamp2
        });
        const [updated] = await tx.update(billingOfferSettings).set({
          currentOfferId: id2,
          revision: setting.revision + 1,
          updatedBy: actorId,
          updatedAt: timestamp2
        }).where(and14(
          eq18(billingOfferSettings.singleton, true),
          eq18(billingOfferSettings.revision, setting.revision)
        )).returning();
        if (!updated) throw new BillingError("CONFLICT");
        await audit(tx, "offer.changed", id2, { actorId });
        return view2({ amountMinor }, updated.revision);
      });
    }
  };
}
function createPriceMappingRepository(db2, audit, now) {
  return {
    async reserve(offer, authority, workspaceId) {
      if (authority.provider !== "stripe" || !offer.amountMinor || offer.taxIncluded !== true) throw new BillingError("INVALID_INPUT");
      return db2.transaction(async (tx) => {
        await tx.select().from(billingOfferSettings).where(eq18(billingOfferSettings.singleton, true)).for("update");
        const [revision] = await tx.select().from(billingOfferRevisions).where(eq18(billingOfferRevisions.id, offer.reference));
        if (!revision || revision.amountMinor !== offer.amountMinor) throw new BillingError("CONFLICT");
        const [mapping] = await tx.select().from(billingPriceMappings).where(and14(
          eq18(billingPriceMappings.offerId, offer.reference),
          eq18(billingPriceMappings.provider, "stripe"),
          eq18(billingPriceMappings.merchantAccount, authority.merchantAccount),
          eq18(billingPriceMappings.mode, authority.mode)
        ));
        if (mapping) return { id: mapping.id, priceId: mapping.state === "ready" ? mapping.processorPriceId : null, fresh: false };
        const id2 = randomUUID14(), timestamp2 = new Date(now());
        await tx.insert(billingPriceMappings).values({
          id: id2,
          offerId: offer.reference,
          provider: "stripe",
          merchantAccount: authority.merchantAccount,
          mode: authority.mode,
          state: "reserved",
          fingerprint: createHash6("sha256").update(JSON.stringify([offer.reference, offer.amountMinor, "eur", "month", "inclusive"])).digest("hex"),
          createdAt: timestamp2,
          updatedAt: timestamp2
        });
        await audit(tx, "price_mapping.changed", id2, { workspaceId });
        return { id: id2, priceId: null, fresh: true };
      });
    },
    async complete(id2, processorPriceId, workspaceId) {
      await db2.transaction(async (tx) => {
        const [mapping] = await tx.select().from(billingPriceMappings).where(eq18(billingPriceMappings.id, id2)).for("update");
        if (!mapping || mapping.processorPriceId && mapping.processorPriceId !== processorPriceId) throw new BillingError("CONFLICT");
        if (mapping.state === "ready") return;
        await tx.update(billingPriceMappings).set({ state: "ready", processorPriceId, updatedAt: new Date(now()) }).where(eq18(billingPriceMappings.id, id2));
        await audit(tx, "price_mapping.changed", id2, { workspaceId });
      });
    },
    async unknown(id2, workspaceId) {
      await db2.transaction(async (tx) => {
        const [mapping] = await tx.select().from(billingPriceMappings).where(eq18(billingPriceMappings.id, id2)).for("update");
        if (!mapping || mapping.state === "ready") return;
        await tx.update(billingPriceMappings).set({ state: "unknown", updatedAt: new Date(now()) }).where(eq18(billingPriceMappings.id, id2));
        await audit(tx, "price_mapping.changed", id2, { workspaceId });
      });
    }
  };
}

// server/billing/origin.ts
function billingReturnOrigin(value, context) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new BillingError("INVALID_INPUT");
  }
  const local = context?.localSandbox === true && context.environment === "development" && context.mode === "test" && url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.origin !== value || url.username || url.password || url.protocol !== "https:" && !local)
    throw new BillingError("INVALID_INPUT");
  return url;
}

// server/billing/stripe.ts
var STRIPE_API_VERSION = "2025-06-30.basil";
var STRIPE_HOSTED_ORIGINS = ["https://checkout.stripe.com", "https://billing.stripe.com"];
var id = (value) => typeof value === "string" ? value : value?.id;
function assertSandboxPortalConfiguration(portal, configurationId) {
  const retention2 = portal.features.subscription_cancel.retention;
  if (portal.id !== configurationId || portal.livemode || !portal.active || portal.application || portal.features.subscription_update.enabled || !portal.features.payment_method_update.enabled || !portal.features.subscription_cancel.enabled || retention2 !== void 0 && retention2 !== null || portal.features.subscription_cancel.mode !== "at_period_end" || portal.features.subscription_cancel.proration_behavior !== "none")
    throw new BillingError("POLICY_REVIEW");
}
function requiredId(value) {
  if (!value) throw new BillingError("UNTRUSTED_PROVIDER");
  return value;
}
function createStripeBillingAdapter(client2, mappings, config) {
  const origin = billingReturnOrigin(config.returnOrigin, { environment: config.environment ?? "production", mode: config.authority.mode, localSandbox: config.localSandbox === true });
  if (config.authority.provider !== "stripe")
    throw new BillingError("INVALID_INPUT");
  const guard = () => {
    if (!config.ready()) throw new BillingError("UNAVAILABLE");
  };
  const verifyMode = (livemode) => {
    if (livemode !== (config.authority.mode === "live")) throw new BillingError("BINDING_MISMATCH");
  };
  async function price(offer, workspaceId) {
    guard();
    if (!config.newCheckoutsReady()) throw new BillingError("UNAVAILABLE");
    if (!offer.amountMinor || offer.taxIncluded !== true) throw new BillingError("INVALID_INPUT");
    const reserved = await mappings.reserve(offer, config.authority, workspaceId);
    if (reserved.priceId) return { priceId: reserved.priceId, mappingId: reserved.id };
    if (!reserved.fresh) throw new BillingError("UNAVAILABLE");
    try {
      const created = await client2.prices.create(
        {
          currency: "eur",
          unit_amount: offer.amountMinor,
          recurring: { interval: "month", interval_count: 1 },
          tax_behavior: "inclusive",
          product_data: { name: "FitsMyTime Pro" },
          metadata: { offer_revision: offer.reference, operation_id: reserved.id }
        },
        { idempotencyKey: reserved.id, maxNetworkRetries: 0, timeout: 1e4 }
      );
      verifyMode(created.livemode);
      if (created.currency !== "eur" || created.unit_amount !== offer.amountMinor || created.tax_behavior !== "inclusive" || created.recurring?.interval !== "month" || created.recurring.interval_count !== 1) throw new BillingError("UNTRUSTED_PROVIDER");
      await mappings.complete(reserved.id, created.id, workspaceId);
      return { priceId: created.id, mappingId: reserved.id };
    } catch {
      await mappings.unknown(reserved.id, workspaceId).catch(() => {
      });
      throw new BillingError("UNAVAILABLE");
    }
  }
  const checkout = { async create(input) {
    guard();
    if (!config.newCheckoutsReady()) throw new BillingError("UNAVAILABLE");
    if (input.binding.provider !== config.authority.provider || input.binding.merchantAccount !== config.authority.merchantAccount || input.binding.mode !== config.authority.mode) throw new BillingError("BINDING_MISMATCH");
    const { priceId } = await price(input.offer, input.binding.workspaceId);
    const metadata = { operation_id: input.operationId, workspace_id: String(input.binding.workspaceId), offer_revision: input.offer.reference };
    const session2 = await client2.checkout.sessions.create(
      {
        mode: "subscription",
        ui_mode: "hosted",
        client_reference_id: input.operationId,
        ...input.customerId ? { customer: input.customerId } : {},
        line_items: [{ price: priceId, quantity: 1 }],
        allow_promotion_codes: false,
        automatic_tax: { enabled: config.automaticTaxEnabled },
        metadata,
        subscription_data: { metadata },
        success_url: `${origin.origin}/my-services/settings/billing?billing_return=1`,
        cancel_url: `${origin.origin}/my-services/settings/billing?billing_return=1`
      },
      { idempotencyKey: input.operationId, maxNetworkRetries: 0, timeout: 1e4 }
    );
    verifyMode(session2.livemode);
    if (session2.mode !== "subscription" || session2.client_reference_id !== input.operationId || !session2.url || input.customerId && id(session2.customer) !== input.customerId)
      throw new BillingError("UNTRUSTED_PROVIDER");
    return { remoteCheckoutId: session2.id, url: session2.url };
  } };
  return {
    checkout,
    verify(raw2, signature) {
      if (!raw2.byteLength || raw2.byteLength > 262144 || !signature || signature.length > 2048) throw new BillingError("INVALID_INPUT");
      let event;
      try {
        event = client2.webhooks.constructEvent(Buffer.from(raw2), signature, config.webhookSecret, 300, void 0, config.now());
      } catch {
        throw new BillingError("UNTRUSTED_PROVIDER");
      }
      verifyMode(event.livemode);
      if (event.account) throw new BillingError("BINDING_MISMATCH");
      return event;
    },
    async retrieveCheckout(sessionId) {
      guard();
      const session2 = await client2.checkout.sessions.retrieve(sessionId, { expand: ["subscription"] }, { maxNetworkRetries: 0, timeout: 1e4 });
      verifyMode(session2.livemode);
      if (session2.mode !== "subscription") throw new BillingError("BINDING_MISMATCH");
      return {
        session: session2,
        customerId: id(session2.customer),
        subscriptionId: id(session2.subscription),
        operationId: session2.client_reference_id,
        offerRevision: session2.metadata?.offer_revision,
        workspaceId: session2.metadata?.workspace_id
      };
    },
    async portal(customerId, operationId) {
      guard();
      if (!config.portalConfigurationId) throw new BillingError("UNAVAILABLE");
      const portal = await client2.billingPortal.configurations.retrieve(config.portalConfigurationId, {}, { maxNetworkRetries: 0, timeout: 1e4 });
      verifyMode(portal.livemode);
      assertSandboxPortalConfiguration(portal, config.portalConfigurationId);
      const session2 = await client2.billingPortal.sessions.create(
        {
          customer: customerId,
          configuration: config.portalConfigurationId,
          return_url: `${origin.origin}/my-services/settings/billing?billing_return=1`
        },
        { ...operationId ? { idempotencyKey: operationId } : {}, maxNetworkRetries: 0, timeout: 1e4 }
      );
      return { url: session2.url, sessionId: session2.id };
    },
    async fetchSubscription(subscriptionId) {
      guard();
      const deadline = config.now() + 25e3;
      const requestOptions = () => {
        const remaining = deadline - config.now();
        if (remaining <= 0) throw new BillingError("UNAVAILABLE");
        return { maxNetworkRetries: 0, timeout: Math.min(1e4, remaining) };
      };
      const subscription = await client2.subscriptions.retrieve(subscriptionId, { expand: ["items.data.price"] }, requestOptions());
      verifyMode(subscription.livemode);
      if (subscription.items.has_more || subscription.items.data.length !== 1) throw new BillingError("POLICY_REVIEW");
      const item = subscription.items.data[0], monthlyPrice = item.price;
      if (item.quantity !== 1 || monthlyPrice.currency !== "eur" || monthlyPrice.recurring?.interval !== "month" || monthlyPrice.recurring.interval_count !== 1 || monthlyPrice.tax_behavior !== "inclusive") throw new BillingError("POLICY_REVIEW");
      const invoices = await client2.invoices.list({ subscription: subscription.id, limit: 100, expand: ["data.payments"] }, requestOptions());
      if (invoices.has_more) throw new BillingError("UNAVAILABLE");
      const evidence = [];
      for (const invoice of invoices.data) {
        verifyMode(invoice.livemode);
        if (invoice.currency !== "eur" || id(invoice.customer) !== id(subscription.customer) || invoice.lines.has_more || invoice.lines.data.length !== 1 || invoice.post_payment_credit_notes_amount || invoice.pre_payment_credit_notes_amount || invoice.discounts?.length) throw new BillingError("POLICY_REVIEW");
        const line = invoice.lines.data[0];
        if (id(line.subscription ?? line.parent?.subscription_item_details?.subscription) !== subscription.id || line.currency !== "eur" || line.quantity !== 1 || line.pricing?.price_details?.price !== monthlyPrice.id || line.parent?.subscription_item_details?.proration)
          throw new BillingError("POLICY_REVIEW");
        const numbers = [invoice.amount_due, invoice.amount_paid];
        if (numbers.some((value) => !Number.isSafeInteger(value) || value < 0)) throw new BillingError("UNTRUSTED_PROVIDER");
        const payments = invoice.payments;
        if (payments?.has_more) throw new BillingError("UNAVAILABLE");
        const paid = payments?.data.filter((payment) => payment.status === "paid") ?? [];
        let paymentReference = null, amountRefunded = "0";
        if (invoice.amount_paid > 0) {
          if (paid.length !== 1 || paid[0].amount_paid !== invoice.amount_paid) throw new BillingError("POLICY_REVIEW");
          let charge;
          const payment = paid[0].payment;
          if (payment.type === "payment_intent") {
            const intent = await client2.paymentIntents.retrieve(requiredId(id(payment.payment_intent)), { expand: ["latest_charge"] }, requestOptions());
            verifyMode(intent.livemode);
            if (intent.status !== "succeeded" || typeof intent.latest_charge !== "object" || !intent.latest_charge) throw new BillingError("POLICY_REVIEW");
            charge = intent.latest_charge;
          } else charge = await client2.charges.retrieve(requiredId(id(payment.charge)), {}, requestOptions());
          verifyMode(charge.livemode);
          if (id(charge.customer) !== id(subscription.customer) || charge.currency !== "eur" || charge.status !== "succeeded" || !Number.isSafeInteger(charge.amount_refunded) || charge.amount_refunded < 0 || charge.amount_refunded > 0 || charge.disputed || charge.refunded) throw new BillingError("POLICY_REVIEW");
          amountRefunded = String(charge.amount_refunded);
          paymentReference = charge.id;
        } else if (invoice.status === "paid") throw new BillingError("POLICY_REVIEW");
        evidence.push({
          processorInvoiceId: requiredId(invoice.id),
          period: { start: line.period.start * 1e3, end: line.period.end * 1e3 },
          status: invoice.status === "paid" ? "paid" : "unpaid",
          currency: "EUR",
          amountDue: String(invoice.amount_due),
          amountPaid: String(invoice.amount_paid),
          amountRefunded,
          paymentReference,
          refundReferences: [],
          disputeReferences: [],
          exceptionsReviewed: true
        });
      }
      return {
        subscription,
        customerId: requiredId(id(subscription.customer)),
        priceId: monthlyPrice.id,
        period: { start: item.current_period_start * 1e3, end: item.current_period_end * 1e3 },
        invoices: evidence
      };
    }
  };
}

// server/billing/lifecycle.ts
import { randomUUID as randomUUID15 } from "node:crypto";
import { and as and15, eq as eq19, isNull as isNull11, ne as ne6, inArray as inArray6, sql as sql14 } from "drizzle-orm";
import { z as z39 } from "zod";

// server/billing/coverage.ts
function coverageAt(input, now) {
  if (!Number.isSafeInteger(now) || now < 0) throw new BillingError("INVALID_INPUT");
  if (input.length > 2e3) throw new BillingError("INVALID_INPUT");
  const periods = input.map((value) => periodSchema.parse(value)).sort((a, b) => a.start - b.start);
  const merged = [];
  for (const period of periods) {
    const previous = merged.at(-1);
    if (previous && period.start <= previous.end) previous.end = Math.max(previous.end, period.end);
    else merged.push({ ...period });
  }
  const current = merged.find((period) => period.start <= now && now < period.end);
  const next = merged.find((period) => period.start > now);
  return { proUntil: current?.end ?? null, nextChangeAt: current?.end ?? next?.start ?? null };
}
function invoiceCoverage(invoices, now, policy) {
  const byId = /* @__PURE__ */ new Map();
  if (invoices.length > 1e3) throw new BillingError("INVALID_INPUT");
  for (const value of invoices) {
    const invoice = invoiceSchema.parse(value);
    const previous = byId.get(invoice.processorInvoiceId);
    if (previous && (previous.status !== invoice.status || previous.period.start !== invoice.period.start || previous.period.end !== invoice.period.end)) throw new BillingError("CONFLICT");
    byId.set(invoice.processorInvoiceId, invoice);
  }
  const periods = [];
  for (const invoice of Array.from(byId.values())) {
    const decision = policy(invoice);
    if (decision === "review") throw new BillingError("POLICY_REVIEW");
    if (decision === "grant" && invoice.status === "paid") periods.push(invoice.period);
  }
  return coverageAt(periods, now);
}

// server/billing/lifecycle.ts
var confirmedCheckoutSchema = z39.object({
  operationId: z39.string().uuid(),
  sessionId: z39.string().min(1).max(255),
  workspaceId: z39.number().int().positive(),
  offerRevision: z39.string().uuid(),
  mode: z39.enum(["test", "live"]),
  status: z39.enum(["open", "complete", "expired"]),
  customerId: z39.string().min(1).max(255).nullable(),
  subscriptionId: z39.string().min(1).max(255).nullable(),
  priceId: z39.string().min(1).max(255).nullable(),
  processorStatus: z39.string().min(1).max(64).nullable(),
  period: z39.object({ start: z39.number().int().nonnegative(), end: z39.number().int().positive() }).strict().nullable()
}).strict();
function createLifecycleRepository(db2, config) {
  const timestamp2 = () => new Date(config.now());
  const workspaceLock = async (tx, workspaceId) => {
    const [workspace] = await tx.select().from(providerSubscriptions).where(eq19(providerSubscriptions.id, workspaceId)).for("update");
    if (!workspace) throw new BillingError("BINDING_MISMATCH");
    return workspace;
  };
  async function importSources(tx, workspace) {
    const [marker4] = await tx.select().from(billingSourceState).where(eq19(billingSourceState.workspaceId, workspace.id));
    if (marker4) return;
    const now = config.now();
    if (workspace.plan === "pro" && workspace.proUntil && workspace.proUntil.getTime() > now) {
      await tx.insert(manualProGrants).values({
        id: randomUUID15(),
        workspaceId: workspace.id,
        source: "legacy_manual",
        sourceReference: `legacy:${workspace.id}`,
        startsAt: new Date(now),
        endsAt: workspace.proUntil,
        issuedBy: null,
        legacyUpdatedBy: workspace.updatedBy,
        legacyUpdatedAt: workspace.updatedAt
      });
    }
    await tx.insert(billingSourceState).values({ workspaceId: workspace.id, importedAt: new Date(now), revision: 0 });
  }
  async function project(tx, workspaceId) {
    const manual = await tx.select().from(manualProGrants).where(and15(eq19(manualProGrants.workspaceId, workspaceId), isNull11(manualProGrants.revokedAt)));
    const paid = await tx.select().from(billingInvoices).where(and15(
      eq19(billingInvoices.workspaceId, workspaceId),
      eq19(billingInvoices.provider, config.authority.provider),
      eq19(billingInvoices.merchantAccount, config.authority.merchantAccount),
      eq19(billingInvoices.mode, config.authority.mode),
      eq19(billingInvoices.status, "paid")
    ));
    if (paid.some((invoice) => invoice.amountRefunded !== "0" || invoice.disputeReferences.length || invoice.refundReferences.length))
      throw new BillingError("POLICY_REVIEW");
    const coverage = coverageAt([
      ...manual.map((grant) => ({ start: grant.startsAt.getTime(), end: grant.endsAt.getTime() })),
      ...paid.map((invoice) => ({ start: invoice.periodStart.getTime(), end: invoice.periodEnd.getTime() }))
    ], config.now());
    await tx.update(providerSubscriptions).set({
      plan: coverage.proUntil === null ? "free" : "pro",
      proUntil: coverage.proUntil === null ? null : new Date(coverage.proUntil),
      updatedBy: "billing-worker",
      updatedAt: timestamp2()
    }).where(eq19(providerSubscriptions.id, workspaceId));
    await tx.update(billingSourceState).set({ revision: sql14`${billingSourceState.revision} + 1` }).where(eq19(billingSourceState.workspaceId, workspaceId));
    return coverage;
  }
  return {
    async updateManualEntitlement(actorId, input) {
      if (!config.sourcesReady() || !config.isAdmin(actorId)) throw new BillingError("UNAVAILABLE");
      const end = input.plan === "pro" ? Date.parse(input.proUntil ?? "") : null;
      if (input.plan === "pro" && (!Number.isFinite(end) || end <= config.now())) throw new BillingError("INVALID_INPUT");
      return db2.transaction(async (tx) => {
        const target2 = input.target;
        const owners = target2.kind === "company" ? await tx.select({ id: companies.id }).from(companies).where(eq19(companies.id, target2.id)) : await tx.select({ id: users.id }).from(users).where(eq19(users.id, target2.id));
        if (!owners.length) throw new BillingError("BINDING_MISMATCH");
        const where = target2.kind === "company" ? eq19(providerSubscriptions.companyId, target2.id) : eq19(providerSubscriptions.userId, target2.id);
        await tx.insert(providerSubscriptions).values({
          companyId: target2.kind === "company" ? target2.id : null,
          userId: target2.kind === "user" ? target2.id : null,
          plan: "free",
          updatedBy: actorId
        }).onConflictDoNothing();
        const [workspace] = await tx.select().from(providerSubscriptions).where(where).for("update");
        if (!workspace) throw new BillingError("BINDING_MISMATCH");
        await importSources(tx, workspace);
        const grants = await tx.select().from(manualProGrants).where(and15(eq19(manualProGrants.workspaceId, workspace.id), isNull11(manualProGrants.revokedAt)));
        for (const grant of grants) {
          await tx.update(manualProGrants).set({ revokedAt: timestamp2(), revokedBy: actorId }).where(eq19(manualProGrants.id, grant.id));
          await config.audit(tx, { kind: "manual_grant.changed", workspaceId: workspace.id, reference: grant.id, actorId });
        }
        if (end !== null) {
          const id2 = randomUUID15();
          await tx.insert(manualProGrants).values({
            id: id2,
            workspaceId: workspace.id,
            source: "administrator",
            sourceReference: id2,
            issuedBy: actorId,
            startsAt: timestamp2(),
            endsAt: new Date(end)
          });
          await config.audit(tx, { kind: "manual_grant.changed", workspaceId: workspace.id, reference: id2, actorId });
        }
        return project(tx, workspace.id);
      });
    },
    async resolveCheckout(input, eventId) {
      const fact = confirmedCheckoutSchema.parse(input);
      if (fact.mode !== config.authority.mode) throw new BillingError("BINDING_MISMATCH");
      return db2.transaction(async (tx) => {
        const [initial] = await tx.select().from(billingOperations).where(eq19(billingOperations.id, fact.operationId));
        if (!initial) throw new BillingError("BINDING_MISMATCH");
        assertAuthority(initial, config.authority);
        await workspaceLock(tx, initial.workspaceId);
        const [operation] = await tx.select().from(billingOperations).where(eq19(billingOperations.id, fact.operationId)).for("update");
        if (!operation || operation.kind !== "checkout" || operation.workspaceId !== fact.workspaceId || operation.approvedOfferRef !== fact.offerRevision || operation.remoteCheckoutId && operation.remoteCheckoutId !== fact.sessionId)
          throw new BillingError("BINDING_MISMATCH");
        const markEvent = async () => {
          if (!eventId) return;
          await tx.update(billingEvents).set({ state: "processed", processedAt: timestamp2(), leaseToken: null, leaseUntil: null }).where(and15(
            eq19(billingEvents.id, eventId),
            eq19(billingEvents.operationId, operation.id),
            eq19(billingEvents.workspaceId, operation.workspaceId),
            eq19(billingEvents.provider, operation.provider),
            eq19(billingEvents.merchantAccount, operation.merchantAccount),
            eq19(billingEvents.mode, operation.mode),
            inArray6(billingEvents.state, ["pending", "processing"])
          ));
        };
        if (fact.status === "open") return "pending";
        if (operation.resolvedAt) {
          await markEvent();
          return "resolved";
        }
        const [account] = await tx.select().from(billingAccounts).where(eq19(billingAccounts.id, operation.accountId)).for("update");
        if (!account || account.customerId && fact.customerId && account.customerId !== fact.customerId) throw new BillingError("BINDING_MISMATCH");
        if (fact.status === "complete") {
          if (!fact.customerId || !fact.subscriptionId || !fact.priceId || !fact.processorStatus || !fact.period || fact.period.start >= fact.period.end)
            throw new BillingError("UNTRUSTED_PROVIDER");
          const [mapping] = await tx.select().from(billingPriceMappings).where(and15(
            eq19(billingPriceMappings.offerId, fact.offerRevision),
            eq19(billingPriceMappings.provider, "stripe"),
            eq19(billingPriceMappings.merchantAccount, operation.merchantAccount),
            eq19(billingPriceMappings.mode, operation.mode),
            eq19(billingPriceMappings.processorPriceId, fact.priceId),
            eq19(billingPriceMappings.state, "ready")
          ));
          if (!mapping) throw new BillingError("BINDING_MISMATCH");
          const contracts = await tx.select().from(billingSubscriptions).where(and15(
            eq19(billingSubscriptions.workspaceId, operation.workspaceId),
            eq19(billingSubscriptions.mode, operation.mode),
            ne6(billingSubscriptions.state, "ended")
          ));
          if (contracts.some((contract) => contract.processorSubscriptionId !== fact.subscriptionId)) throw new BillingError("CONFLICT");
          if (!account.customerId) await tx.update(billingAccounts).set({ customerId: fact.customerId, updatedAt: timestamp2() }).where(eq19(billingAccounts.id, account.id));
          const [existing] = await tx.select().from(billingSubscriptions).where(and15(
            eq19(billingSubscriptions.provider, operation.provider),
            eq19(billingSubscriptions.merchantAccount, operation.merchantAccount),
            eq19(billingSubscriptions.mode, operation.mode),
            eq19(billingSubscriptions.processorSubscriptionId, fact.subscriptionId)
          ));
          if (existing && (existing.workspaceId !== operation.workspaceId || existing.accountId !== account.id || existing.approvedOfferRef !== fact.offerRevision))
            throw new BillingError("BINDING_MISMATCH");
          if (!existing) await tx.insert(billingSubscriptions).values({
            id: randomUUID15(),
            workspaceId: operation.workspaceId,
            provider: operation.provider,
            merchantAccount: operation.merchantAccount,
            mode: operation.mode,
            accountId: account.id,
            processorSubscriptionId: fact.subscriptionId,
            state: "pending",
            processorStatus: fact.processorStatus,
            approvedOfferRef: fact.offerRevision,
            offerRevisionId: fact.offerRevision,
            priceMappingId: mapping.id,
            currency: "EUR",
            interval: "month",
            periodStart: new Date(fact.period.start),
            periodEnd: new Date(fact.period.end),
            nextReconcileAt: timestamp2()
          });
          await tx.update(billingOperations).set({
            state: "completed",
            remoteCheckoutId: fact.sessionId,
            priceMappingId: mapping.id,
            resolvedAt: timestamp2(),
            updatedAt: timestamp2()
          }).where(eq19(billingOperations.id, operation.id));
        } else {
          if (fact.subscriptionId) throw new BillingError("POLICY_REVIEW");
          await tx.update(billingOperations).set({
            state: "failed",
            remoteCheckoutId: fact.sessionId,
            failureCode: "CHECKOUT_EXPIRED",
            resolvedAt: timestamp2(),
            updatedAt: timestamp2()
          }).where(eq19(billingOperations.id, operation.id));
        }
        await config.audit(tx, { kind: "checkout.resolved", workspaceId: operation.workspaceId, reference: operation.id });
        await markEvent();
        return "resolved";
      });
    },
    reconciliationFor(subscriptionId) {
      return {
        async claim(binding, now) {
          bindingSchema.parse(binding);
          assertAuthority(binding, config.authority);
          return db2.transaction(async (tx) => {
            await workspaceLock(tx, binding.workspaceId);
            const [contract] = await tx.select().from(billingSubscriptions).where(eq19(billingSubscriptions.id, subscriptionId)).for("update");
            if (!contract) throw new BillingError("BINDING_MISMATCH");
            assertBinding(contract, binding);
            if (contract.leaseUntil && contract.leaseUntil.getTime() > now) return null;
            const token = randomUUID15(), expiresAt = now + 6e4;
            await tx.update(billingSubscriptions).set({ leaseToken: token, leaseUntil: new Date(expiresAt) }).where(eq19(billingSubscriptions.id, contract.id));
            return {
              binding,
              processorSubscriptionId: contract.processorSubscriptionId,
              generation: contract.generation,
              revision: contract.revision,
              token,
              expiresAt,
              offerReference: contract.approvedOfferRef
            };
          });
        },
        async commit(lease, result) {
          if (!config.sourcesReady()) throw new BillingError("UNAVAILABLE");
          assertAuthority(lease.binding, config.authority);
          return db2.transaction(async (tx) => {
            const workspace = await workspaceLock(tx, lease.binding.workspaceId);
            const [contract] = await tx.select().from(billingSubscriptions).where(eq19(billingSubscriptions.id, subscriptionId)).for("update");
            if (!contract) throw new BillingError("BINDING_MISMATCH");
            assertBinding(contract, lease.binding);
            if (contract.processorSubscriptionId !== lease.processorSubscriptionId || contract.leaseToken !== lease.token || !contract.leaseUntil || contract.leaseUntil.getTime() <= config.now() || contract.generation !== lease.generation || contract.revision !== lease.revision)
              return false;
            const snapshot = result.snapshot;
            assertBinding(snapshot.binding, lease.binding);
            if (snapshot.requestedOffer !== contract.approvedOfferRef || !snapshot.evidenceComplete || !snapshot.state || !snapshot.processorStatus || !snapshot.period || snapshot.cancelAtPeriodEnd === void 0) throw new BillingError("UNTRUSTED_PROVIDER");
            await importSources(tx, workspace);
            for (const invoice of snapshot.invoices) {
              if (invoice.currency !== "EUR" || invoice.amountDue === void 0 || invoice.amountPaid === void 0 || invoice.amountRefunded === void 0 || invoice.exceptionsReviewed !== true || !invoice.refundReferences || !invoice.disputeReferences || BigInt(invoice.amountRefunded) > BigInt(invoice.amountPaid)) throw new BillingError("UNTRUSTED_PROVIDER");
              if (invoice.amountRefunded !== "0" || invoice.refundReferences.length || invoice.disputeReferences.length) throw new BillingError("POLICY_REVIEW");
              const values = {
                status: invoice.status,
                periodStart: new Date(invoice.period.start),
                periodEnd: new Date(invoice.period.end),
                currency: "EUR",
                amountDue: invoice.amountDue,
                amountPaid: invoice.amountPaid,
                amountRefunded: invoice.amountRefunded,
                paymentReference: invoice.paymentReference ?? null,
                refundReferences: invoice.refundReferences,
                disputeReferences: invoice.disputeReferences,
                reconciledAt: new Date(result.observedAt),
                updatedAt: timestamp2()
              };
              const [saved] = await tx.insert(billingInvoices).values({
                id: randomUUID15(),
                ...lease.binding,
                accountId: contract.accountId,
                subscriptionId: contract.id,
                processorInvoiceId: invoice.processorInvoiceId,
                ...values
              }).onConflictDoUpdate({
                target: [billingInvoices.provider, billingInvoices.merchantAccount, billingInvoices.mode, billingInvoices.processorInvoiceId],
                set: values,
                setWhere: and15(eq19(billingInvoices.subscriptionId, contract.id), eq19(billingInvoices.accountId, contract.accountId))
              }).returning({ id: billingInvoices.id });
              if (!saved) throw new BillingError("BINDING_MISMATCH");
            }
            const effective = await project(tx, workspace.id);
            await tx.update(billingSubscriptions).set({
              state: snapshot.state,
              processorStatus: snapshot.processorStatus,
              periodStart: new Date(snapshot.period.start),
              periodEnd: new Date(snapshot.period.end),
              cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd,
              paidThrough: result.coverage.proUntil === null ? null : new Date(result.coverage.proUntil),
              revision: contract.revision + 1,
              leaseToken: null,
              leaseUntil: null,
              reconciledAt: new Date(result.observedAt),
              nextReconcileAt: new Date(Math.min(config.now() + 864e5, effective.nextChangeAt ?? Infinity)),
              updatedAt: timestamp2()
            }).where(eq19(billingSubscriptions.id, contract.id));
            await tx.update(billingEvents).set({ state: "processed", processedAt: timestamp2(), leaseToken: null, leaseUntil: null }).where(and15(
              eq19(billingEvents.accountId, contract.accountId),
              eq19(billingEvents.workspaceId, workspace.id),
              eq19(billingEvents.provider, config.authority.provider),
              eq19(billingEvents.merchantAccount, config.authority.merchantAccount),
              eq19(billingEvents.mode, config.authority.mode),
              eq19(billingEvents.objectId, contract.processorSubscriptionId),
              inArray6(billingEvents.state, ["pending", "processing"])
            ));
            await config.audit(tx, { kind: "subscription.reconciled", workspaceId: workspace.id, reference: contract.id });
            return true;
          });
        }
      };
    },
    async revokeManualGrant(actorId, workspaceId, grantId) {
      if (!config.sourcesReady() || !config.isAdmin(actorId)) throw new BillingError("FORBIDDEN");
      return db2.transaction(async (tx) => {
        const workspace = await workspaceLock(tx, workspaceId);
        await importSources(tx, workspace);
        const [grant] = await tx.select().from(manualProGrants).where(and15(eq19(manualProGrants.id, grantId), eq19(manualProGrants.workspaceId, workspaceId))).for("update");
        if (!grant) throw new BillingError("BINDING_MISMATCH");
        if (grant.revokedAt) return;
        await tx.update(manualProGrants).set({ revokedAt: timestamp2(), revokedBy: actorId }).where(eq19(manualProGrants.id, grant.id));
        const effective = await project(tx, workspaceId);
        await config.audit(tx, { kind: "manual_grant.changed", workspaceId, reference: grant.id, actorId });
        return effective;
      });
    }
  };
}

// server/billing/dispatcher.ts
import { randomUUID as randomUUID16, createHash as createHash7 } from "node:crypto";
import { and as and16, eq as eq20, inArray as inArray7 } from "drizzle-orm";

// server/billing/reconcile.ts
async function reconcileBilling(bindingInput, deps) {
  const binding = bindingSchema.parse(bindingInput);
  assertAuthority(binding, authoritySchema.parse(deps.authority));
  const claimed = await deps.repository.claim(binding, deps.now());
  if (!claimed) return "idle";
  const lease = leaseSchema.parse(claimed);
  assertBinding(lease.binding, binding);
  if (lease.expiresAt <= deps.now()) return "stale";
  const snapshot = snapshotSchema.parse(await deps.provider.fetch(lease));
  assertBinding(snapshot.binding, binding);
  if (snapshot.processorSubscriptionId !== lease.processorSubscriptionId || snapshot.requestedOffer !== (lease.offerReference ?? deps.offerReference))
    throw new BillingError("BINDING_MISMATCH");
  const observedAt = deps.now();
  if (lease.expiresAt <= observedAt) return "stale";
  const coverage = invoiceCoverage(snapshot.invoices, observedAt, deps.policy);
  return await deps.repository.commit(lease, { snapshot, coverage, observedAt }) ? "committed" : "stale";
}

// server/billing/dispatcher.ts
var reference2 = (value) => typeof value === "string" ? value : value && typeof value === "object" && "id" in value && typeof value.id === "string" ? value.id : null;
var checkoutEvents = /* @__PURE__ */ new Set(["checkout.session.completed", "checkout.session.expired", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed"]);
var subscriptionEvents = /* @__PURE__ */ new Set(["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"]);
var invoiceEvents = /* @__PURE__ */ new Set(["invoice.paid", "invoice.payment_failed", "invoice.payment_action_required", "invoice.updated"]);
function normalizeStripeEvent(event) {
  if (!checkoutEvents.has(event.type) && !subscriptionEvents.has(event.type) && !invoiceEvents.has(event.type) && event.type !== "charge.refunded" && event.type !== "charge.dispute.created") return null;
  const object = event.data.object;
  const parent = object.parent;
  const metadata = object.metadata;
  const operation = checkoutEvents.has(event.type) ? object.client_reference_id ?? metadata?.operation_id : null;
  const objectId = reference2(object);
  if (!objectId) throw new BillingError("UNTRUSTED_PROVIDER");
  return {
    eventId: event.id,
    eventType: event.type,
    objectId,
    occurredAt: event.created * 1e3,
    customerId: reference2(object.customer),
    subscriptionId: subscriptionEvents.has(event.type) ? objectId : reference2(object.subscription ?? parent?.subscription_details?.subscription),
    operationId: typeof operation === "string" && /^[a-f0-9-]{36}$/.test(operation) ? operation : null,
    chargeId: event.type === "charge.refunded" ? objectId : event.type === "charge.dispute.created" ? reference2(object.charge) : null
  };
}
function createStripeInbox(db2, authority, audit, now) {
  return {
    async ingest(envelope) {
      const fingerprint = createHash7("sha256").update(JSON.stringify([
        envelope.eventId,
        envelope.eventType,
        envelope.objectId,
        envelope.occurredAt,
        envelope.customerId,
        envelope.subscriptionId,
        envelope.operationId,
        envelope.chargeId
      ])).digest("hex");
      return db2.transaction(async (tx) => {
        const [operation] = envelope.operationId ? await tx.select().from(billingOperations).where(and16(
          eq20(billingOperations.id, envelope.operationId),
          eq20(billingOperations.provider, authority.provider),
          eq20(billingOperations.merchantAccount, authority.merchantAccount),
          eq20(billingOperations.mode, authority.mode),
          eq20(billingOperations.kind, "checkout")
        )) : [];
        if (operation?.remoteCheckoutId && operation.remoteCheckoutId !== envelope.objectId) throw new BillingError("BINDING_MISMATCH");
        let [account] = operation ? await tx.select().from(billingAccounts).where(eq20(billingAccounts.id, operation.accountId)) : envelope.customerId ? await tx.select().from(billingAccounts).where(and16(
          eq20(billingAccounts.provider, authority.provider),
          eq20(billingAccounts.merchantAccount, authority.merchantAccount),
          eq20(billingAccounts.mode, authority.mode),
          eq20(billingAccounts.customerId, envelope.customerId)
        )) : [];
        let chargeInvoice;
        if (!account && envelope.chargeId) {
          [chargeInvoice] = await tx.select().from(billingInvoices).where(and16(
            eq20(billingInvoices.provider, authority.provider),
            eq20(billingInvoices.merchantAccount, authority.merchantAccount),
            eq20(billingInvoices.mode, authority.mode),
            eq20(billingInvoices.paymentReference, envelope.chargeId)
          ));
          if (chargeInvoice) [account] = await tx.select().from(billingAccounts).where(and16(
            eq20(billingAccounts.id, chargeInvoice.accountId),
            eq20(billingAccounts.workspaceId, chargeInvoice.workspaceId),
            eq20(billingAccounts.provider, authority.provider),
            eq20(billingAccounts.merchantAccount, authority.merchantAccount),
            eq20(billingAccounts.mode, authority.mode)
          ));
        }
        let contract;
        if (account) {
          await tx.select({ id: providerSubscriptions.id }).from(providerSubscriptions).where(eq20(providerSubscriptions.id, account.workspaceId)).for("update");
          if (envelope.subscriptionId) [contract] = await tx.select().from(billingSubscriptions).where(and16(
            eq20(billingSubscriptions.accountId, account.id),
            eq20(billingSubscriptions.processorSubscriptionId, envelope.subscriptionId)
          ));
          else if (envelope.chargeId) {
            const [invoice] = chargeInvoice ? [chargeInvoice] : await tx.select().from(billingInvoices).where(and16(eq20(billingInvoices.accountId, account.id), eq20(billingInvoices.paymentReference, envelope.chargeId)));
            if (invoice) [contract] = await tx.select().from(billingSubscriptions).where(eq20(billingSubscriptions.id, invoice.subscriptionId));
          }
        }
        const mapped = Boolean(operation || contract), id2 = randomUUID16();
        const [inserted] = await tx.insert(billingEvents).values({
          id: id2,
          ...authority,
          accountId: account?.id ?? null,
          workspaceId: account?.workspaceId ?? null,
          operationId: operation?.id ?? null,
          eventId: envelope.eventId,
          eventType: envelope.eventType,
          objectId: checkoutEvents.has(envelope.eventType) ? envelope.objectId : contract?.processorSubscriptionId ?? envelope.objectId,
          fingerprint,
          state: mapped ? "pending" : "quarantined",
          failureCode: mapped ? null : "UNMAPPED_BINDING",
          occurredAt: new Date(envelope.occurredAt),
          receivedAt: new Date(now()),
          nextAttemptAt: new Date(now())
        }).onConflictDoNothing({ target: [
          billingEvents.provider,
          billingEvents.merchantAccount,
          billingEvents.mode,
          billingEvents.eventId
        ] }).returning({ id: billingEvents.id });
        if (!inserted) {
          const [old] = await tx.select().from(billingEvents).where(and16(
            eq20(billingEvents.provider, authority.provider),
            eq20(billingEvents.merchantAccount, authority.merchantAccount),
            eq20(billingEvents.mode, authority.mode),
            eq20(billingEvents.eventId, envelope.eventId)
          )).for("update");
          if (!old) throw new BillingError("CONFLICT");
          if (old.fingerprint === fingerprint) return old.id;
          await tx.update(billingEvents).set({ state: "quarantined", processedAt: null, failureCode: "IDENTITY_CONFLICT", leaseToken: null, leaseUntil: null }).where(eq20(billingEvents.id, old.id));
          await audit(tx, { kind: "event.quarantined", workspaceId: old.workspaceId, reference: old.id });
          return old.id;
        }
        if (contract) await tx.update(billingSubscriptions).set({ generation: contract.generation + 1, nextReconcileAt: new Date(now()) }).where(eq20(billingSubscriptions.id, contract.id));
        await audit(tx, { kind: mapped ? "event.accepted" : "event.quarantined", workspaceId: account?.workspaceId ?? null, reference: id2 });
        return id2;
      });
    },
    async pending(id2) {
      const [event] = await db2.select().from(billingEvents).where(and16(
        eq20(billingEvents.id, id2),
        eq20(billingEvents.provider, authority.provider),
        eq20(billingEvents.merchantAccount, authority.merchantAccount),
        eq20(billingEvents.mode, authority.mode)
      ));
      return event && ["pending", "processing"].includes(event.state) ? event : null;
    },
    async contract(workspaceId, processorSubscriptionId) {
      const [contract] = await db2.select().from(billingSubscriptions).where(and16(
        eq20(billingSubscriptions.workspaceId, workspaceId),
        eq20(billingSubscriptions.provider, authority.provider),
        eq20(billingSubscriptions.merchantAccount, authority.merchantAccount),
        eq20(billingSubscriptions.mode, authority.mode),
        eq20(billingSubscriptions.processorSubscriptionId, processorSubscriptionId)
      ));
      if (!contract) throw new BillingError("BINDING_MISMATCH");
      return contract;
    },
    async finishCheckoutEvent(id2) {
      await db2.transaction(async (tx) => {
        const [initial] = await tx.select().from(billingEvents).where(eq20(billingEvents.id, id2));
        if (!initial?.workspaceId || !initial.operationId) throw new BillingError("BINDING_MISMATCH");
        await tx.select({ id: providerSubscriptions.id }).from(providerSubscriptions).where(eq20(providerSubscriptions.id, initial.workspaceId)).for("update");
        const [operation] = await tx.select().from(billingOperations).where(eq20(billingOperations.id, initial.operationId));
        if (!operation?.resolvedAt) return;
        await tx.update(billingEvents).set({ state: "processed", processedAt: new Date(now()), leaseToken: null, leaseUntil: null }).where(and16(eq20(billingEvents.id, id2), inArray7(billingEvents.state, ["pending", "processing"])));
      });
    }
  };
}
function createStripeDispatcher(deps) {
  async function reconcile(workspaceId, subscriptionId) {
    const contract = await deps.inbox.contract(workspaceId, subscriptionId);
    const binding = { ...deps.authority, workspaceId };
    return reconcileBilling(binding, {
      authority: deps.authority,
      offerReference: contract.approvedOfferRef,
      now: deps.now,
      policy: (invoice) => invoice.status === "paid" ? "grant" : "withhold",
      repository: deps.lifecycle.reconciliationFor(contract.id),
      provider: { async fetch() {
        const current = await deps.adapter.fetchSubscription(subscriptionId);
        if (current.subscription.metadata.offer_revision !== contract.approvedOfferRef) throw new BillingError("BINDING_MISMATCH");
        return {
          binding,
          processorSubscriptionId: subscriptionId,
          requestedOffer: contract.approvedOfferRef,
          currency: "EUR",
          interval: "month",
          evidenceComplete: true,
          invoices: current.invoices,
          state: ["canceled", "incomplete_expired"].includes(current.subscription.status) ? "ended" : current.subscription.status === "active" ? "running" : "attention",
          processorStatus: current.subscription.status,
          period: current.period,
          cancelAtPeriodEnd: current.subscription.cancel_at_period_end
        };
      } }
    });
  }
  return {
    async webhook(raw2, signature) {
      if (!deps.ready()) throw new BillingError("UNAVAILABLE");
      const envelope = normalizeStripeEvent(deps.adapter.verify(raw2, signature));
      if (envelope) await deps.inbox.ingest(envelope);
    },
    async process(eventId) {
      if (!deps.ready()) throw new BillingError("UNAVAILABLE");
      const event = await deps.inbox.pending(eventId);
      if (!event || event.workspaceId === null) return;
      if (checkoutEvents.has(event.eventType)) {
        const fact = await deps.adapter.retrieveCheckout(event.objectId);
        const session2 = fact.session;
        const subscription = typeof session2.subscription === "object" ? session2.subscription : null;
        const item = subscription?.items.data[0];
        await deps.lifecycle.resolveCheckout({
          operationId: fact.operationId,
          sessionId: session2.id,
          workspaceId: Number(fact.workspaceId),
          offerRevision: fact.offerRevision,
          mode: session2.livemode ? "live" : "test",
          status: session2.status,
          customerId: fact.customerId ?? null,
          subscriptionId: fact.subscriptionId ?? null,
          priceId: item?.price.id ?? null,
          processorStatus: subscription?.status ?? null,
          period: item ? { start: item.current_period_start * 1e3, end: item.current_period_end * 1e3 } : null
        }, event.id);
        if (fact.subscriptionId) await reconcile(event.workspaceId, fact.subscriptionId);
      } else await reconcile(event.workspaceId, event.objectId);
    },
    reconcile
  };
}

// server/billing/service.ts
import { randomUUID as randomUUID19, createHash as createHash9 } from "node:crypto";
import { and as and19, eq as eq23, isNull as isNull14, ne as ne8, sql as sql16 } from "drizzle-orm";

// server/billing/authorization.ts
import { and as and17, eq as eq21, gt as gt6, isNull as isNull12 } from "drizzle-orm";
import { z as z40 } from "zod";
function assertBillingOwner(actorId, target2, record, purpose = "view") {
  z40.string().uuid().parse(actorId);
  if (record.userId !== actorId) throw new BillingError("FORBIDDEN");
  if (target2.kind === "user") {
    if (target2.id !== actorId) throw new BillingError("FORBIDDEN");
  } else if (!record.company || record.company.id !== target2.id || record.company.ownerId !== actorId || record.company.membershipRole !== "owner" || purpose === "checkout" && !record.company.active)
    throw new BillingError("FORBIDDEN");
}
async function authorizeBillingTarget(tx, actorId, input, purpose = "view", lock = false) {
  const target2 = subscriptionTargetSchema.parse(input);
  const [user] = await tx.select().from(users).where(eq21(users.id, actorId));
  if (!user) throw new BillingError("FORBIDDEN");
  let company;
  if (target2.kind === "company") {
    const query = tx.select().from(companies).where(eq21(companies.id, target2.id));
    const [row] = lock ? await query.for("update") : await query;
    const [membership] = await tx.select().from(companyMemberships).where(and17(
      eq21(companyMemberships.companyId, target2.id),
      eq21(companyMemberships.userId, actorId)
    ));
    if (row) company = { id: row.id, ownerId: row.ownerId, active: row.isActive, membershipRole: membership?.role ?? null };
  }
  assertBillingOwner(actorId, target2, { userId: user.id, providerType: user.providerType, company }, purpose);
  const [workspace] = await tx.select().from(providerSubscriptions).where(target2.kind === "company" ? eq21(providerSubscriptions.companyId, target2.id) : eq21(providerSubscriptions.userId, actorId));
  return { target: target2, workspace };
}
async function assertManualGrantExpired(tx, workspaceId, now) {
  const [source] = await tx.select().from(billingSourceState).where(eq21(billingSourceState.workspaceId, workspaceId));
  if (!source) {
    const [legacy] = await tx.select().from(providerSubscriptions).where(eq21(providerSubscriptions.id, workspaceId));
    if (legacy?.plan === "pro" && legacy.proUntil && legacy.proUntil.getTime() > now)
      throw new BillingError("MANUAL_GRANT_ACTIVE");
  }
  const grants = await tx.select().from(manualProGrants).where(and17(
    eq21(manualProGrants.workspaceId, workspaceId),
    isNull12(manualProGrants.revokedAt),
    gt6(manualProGrants.endsAt, new Date(now))
  ));
  if (grants.some((grant) => grant.startsAt.getTime() <= now)) throw new BillingError("MANUAL_GRANT_ACTIVE");
}

// server/billing/repository.ts
import { randomUUID as randomUUID17 } from "node:crypto";
import { and as and18, eq as eq22, isNull as isNull13, ne as ne7, sql as sql15 } from "drizzle-orm";
import { z as z41 } from "zod";
var { providerSubscriptions: providerSubscriptions2, billingAccounts: billingAccounts2, billingOperations: billingOperations2, billingSubscriptions: billingSubscriptions2, billingEvents: billingEvents2 } = schema_exports;
function asOperation(row) {
  return operationSchema.parse({
    id: row.id,
    binding: { workspaceId: row.workspaceId, provider: row.provider, merchantAccount: row.merchantAccount, mode: row.mode },
    actorId: row.initiatorId,
    idempotencyKey: row.idempotencyKey,
    fingerprint: row.fingerprint,
    requestedOffer: row.approvedOfferRef,
    termsVersion: row.termsVersion,
    state: row.state,
    remoteCheckoutId: row.remoteCheckoutId,
    resolvedAt: row.resolvedAt?.getTime() ?? null
  });
}
function createBillingRepository(database, authorityInput, hooks, now) {
  const authority = authoritySchema.parse(authorityInput);
  const clock3 = () => {
    const value = now();
    if (!Number.isSafeInteger(value) || value < 0 || value > 864e13) throw new BillingError("INVALID_INPUT");
    return new Date(value);
  };
  const lockWorkspace = async (tx, workspaceId) => {
    const [workspace] = await tx.select({ id: providerSubscriptions2.id }).from(providerSubscriptions2).where(eq22(providerSubscriptions2.id, workspaceId)).for("update");
    if (!workspace) throw new BillingError("BINDING_MISMATCH");
  };
  const scopedOperation = async (tx, id2) => {
    const [initial] = await tx.select().from(billingOperations2).where(eq22(billingOperations2.id, id2));
    if (!initial || initial.kind !== "checkout") throw new BillingError("BINDING_MISMATCH");
    assertAuthority(initial, authority);
    await lockWorkspace(tx, initial.workspaceId);
    const [row] = await tx.select().from(billingOperations2).where(eq22(billingOperations2.id, id2)).for("update");
    if (!row) throw new BillingError("BINDING_MISMATCH");
    return row;
  };
  return {
    async customer(id2) {
      return database.transaction(async (tx) => {
        const operation = await scopedOperation(tx, id2);
        const [account] = await tx.select().from(billingAccounts2).where(and18(
          eq22(billingAccounts2.id, operation.accountId),
          eq22(billingAccounts2.workspaceId, operation.workspaceId),
          eq22(billingAccounts2.provider, authority.provider),
          eq22(billingAccounts2.merchantAccount, authority.merchantAccount),
          eq22(billingAccounts2.mode, authority.mode)
        ));
        if (!account) throw new BillingError("BINDING_MISMATCH");
        return account.customerId;
      });
    },
    async reserve(input) {
      const operation = operationSchema.parse(input);
      assertAuthority(operation.binding, authority);
      if (operation.state !== "reserved" || operation.resolvedAt !== null || operation.remoteCheckoutId !== null)
        throw new BillingError("CONFLICT");
      return database.transaction(async (tx) => {
        await lockWorkspace(tx, operation.binding.workspaceId);
        await hooks.authorizeCheckout(tx, { binding: operation.binding, actorId: operation.actorId, offerRevision: operation.requestedOffer });
        const slot = and18(
          eq22(billingOperations2.workspaceId, operation.binding.workspaceId),
          eq22(billingOperations2.mode, authority.mode),
          eq22(billingOperations2.kind, "checkout")
        );
        const [replay] = await tx.select().from(billingOperations2).where(and18(slot, eq22(billingOperations2.idempotencyKey, operation.idempotencyKey)));
        if (replay) {
          if (replay.fingerprint !== operation.fingerprint) throw new BillingError("CONFLICT");
          return { kind: "replay", operation: asOperation(replay) };
        }
        const [unresolved] = await tx.select().from(billingOperations2).where(and18(slot, isNull13(billingOperations2.resolvedAt)));
        if (unresolved) return { kind: "busy", operation: asOperation(unresolved) };
        const [contract] = await tx.select({ id: billingSubscriptions2.id }).from(billingSubscriptions2).where(and18(
          eq22(billingSubscriptions2.workspaceId, operation.binding.workspaceId),
          eq22(billingSubscriptions2.mode, authority.mode),
          ne7(billingSubscriptions2.state, "ended")
        ));
        if (contract) throw new BillingError("CONFLICT");
        const [existing] = await tx.select().from(billingAccounts2).where(and18(
          eq22(billingAccounts2.workspaceId, operation.binding.workspaceId),
          eq22(billingAccounts2.provider, authority.provider),
          eq22(billingAccounts2.merchantAccount, authority.merchantAccount),
          eq22(billingAccounts2.mode, authority.mode)
        ));
        const accountId = existing?.id ?? randomUUID17();
        const timestamp2 = clock3();
        if (!existing) await tx.insert(billingAccounts2).values({ id: accountId, ...operation.binding, createdAt: timestamp2, updatedAt: timestamp2 });
        await tx.insert(billingOperations2).values({
          id: operation.id,
          ...operation.binding,
          accountId,
          kind: "checkout",
          initiatorId: operation.actorId,
          idempotencyKey: operation.idempotencyKey,
          fingerprint: operation.fingerprint,
          approvedOfferRef: operation.requestedOffer,
          termsVersion: operation.termsVersion,
          offerRevisionId: z41.string().uuid().safeParse(operation.requestedOffer).success ? operation.requestedOffer : null,
          state: "reserved",
          createdAt: timestamp2,
          updatedAt: timestamp2
        });
        await hooks.recordChange(tx, { kind: "checkout.reserved", workspaceId: operation.binding.workspaceId, reference: operation.id });
        return { kind: "reserved", operation };
      });
    },
    async complete(id2, remoteCheckoutId) {
      if (!remoteCheckoutId.trim() || remoteCheckoutId.length > 255) throw new BillingError("INVALID_INPUT");
      await database.transaction(async (tx) => {
        const operation = await scopedOperation(tx, id2);
        if (operation.resolvedAt || operation.state === "failed" || operation.remoteCheckoutId && operation.remoteCheckoutId !== remoteCheckoutId) throw new BillingError("CONFLICT");
        if (operation.state === "completed") return;
        await tx.update(billingOperations2).set({ state: "completed", remoteCheckoutId, updatedAt: clock3() }).where(eq22(billingOperations2.id, id2));
        await hooks.recordChange(tx, { kind: "checkout.created", workspaceId: operation.workspaceId, reference: id2 });
      });
    },
    async markUnknown(id2) {
      await database.transaction(async (tx) => {
        const operation = await scopedOperation(tx, id2);
        if (operation.resolvedAt || operation.state === "completed" || operation.state === "failed") return;
        await tx.update(billingOperations2).set({ state: "unknown", updatedAt: clock3() }).where(eq22(billingOperations2.id, id2));
        await hooks.recordChange(tx, { kind: "checkout.unknown", workspaceId: operation.workspaceId, reference: id2 });
      });
    },
    async ingest(input) {
      const event = verifiedEventSchema.extend({ fingerprint: z41.string().regex(/^[a-f0-9]{64}$/) }).parse(input);
      assertAuthority(event, authority);
      return database.transaction(async (tx) => {
        const [account] = await tx.select().from(billingAccounts2).where(and18(
          eq22(billingAccounts2.provider, authority.provider),
          eq22(billingAccounts2.merchantAccount, authority.merchantAccount),
          eq22(billingAccounts2.mode, authority.mode),
          eq22(billingAccounts2.customerId, event.customerId)
        ));
        if (account) await lockWorkspace(tx, account.workspaceId);
        const [contract] = account ? await tx.select().from(billingSubscriptions2).where(and18(
          eq22(billingSubscriptions2.accountId, account.id),
          eq22(billingSubscriptions2.workspaceId, account.workspaceId),
          eq22(billingSubscriptions2.provider, authority.provider),
          eq22(billingSubscriptions2.merchantAccount, authority.merchantAccount),
          eq22(billingSubscriptions2.mode, authority.mode),
          eq22(billingSubscriptions2.processorSubscriptionId, event.processorSubscriptionId)
        )) : [];
        const timestamp2 = clock3();
        const identity2 = and18(
          eq22(billingEvents2.provider, authority.provider),
          eq22(billingEvents2.merchantAccount, authority.merchantAccount),
          eq22(billingEvents2.mode, authority.mode),
          eq22(billingEvents2.eventId, event.eventId)
        );
        const [inserted] = await tx.insert(billingEvents2).values({
          id: randomUUID17(),
          ...authority,
          accountId: account?.id ?? null,
          workspaceId: account?.workspaceId ?? null,
          eventId: event.eventId,
          eventType: event.eventType,
          objectId: event.processorSubscriptionId,
          fingerprint: event.fingerprint,
          state: contract ? "pending" : "quarantined",
          failureCode: contract ? null : "UNMAPPED_BINDING",
          occurredAt: new Date(event.occurredAt),
          receivedAt: timestamp2,
          nextAttemptAt: timestamp2
        }).onConflictDoNothing({ target: [
          billingEvents2.provider,
          billingEvents2.merchantAccount,
          billingEvents2.mode,
          billingEvents2.eventId
        ] }).returning({ id: billingEvents2.id });
        if (!inserted) {
          const [existing] = await tx.select().from(billingEvents2).where(identity2).for("update");
          if (!existing) throw new BillingError("CONFLICT");
          if (existing.fingerprint === event.fingerprint) return existing.state === "quarantined" ? "quarantined" : "duplicate";
          await tx.update(billingEvents2).set({ state: "quarantined", processedAt: null, failureCode: "IDENTITY_CONFLICT" }).where(identity2);
          await hooks.recordChange(tx, { kind: "event.quarantined", workspaceId: existing.workspaceId, reference: existing.id });
          return "quarantined";
        }
        if (contract) await tx.update(billingSubscriptions2).set({
          generation: sql15`${billingSubscriptions2.generation} + 1`,
          nextReconcileAt: timestamp2,
          updatedAt: timestamp2
        }).where(eq22(billingSubscriptions2.id, contract.id));
        await hooks.recordChange(tx, {
          kind: contract ? "event.accepted" : "event.quarantined",
          workspaceId: account?.workspaceId ?? null,
          reference: inserted.id
        });
        return contract ? "inserted" : "quarantined";
      });
    }
  };
}

// server/billing/checkout.ts
import { createHash as createHash8, randomUUID as randomUUID18 } from "node:crypto";
import { z as z42 } from "zod";
async function startCheckout(input, deps) {
  const request = checkoutRequestSchema.parse(input);
  const offer = offerSchema.parse(deps.offer);
  const authority = authoritySchema.parse(deps.authority);
  if (request.termsVersion !== offer.termsVersion) throw new BillingError("CONFLICT");
  if (request.offerRevision && request.offerRevision !== offer.reference) throw new BillingError("CONFLICT");
  const actor2 = await deps.authorize(request.workspaceId);
  z42.string().uuid().parse(actor2.actorId);
  const binding = bindingSchema.parse(actor2.binding);
  assertAuthority(binding, authority);
  if (binding.workspaceId !== request.workspaceId) throw new BillingError("BINDING_MISMATCH");
  const fingerprint = createHash8("sha256").update(JSON.stringify([
    binding.workspaceId,
    binding.provider,
    binding.merchantAccount,
    binding.mode,
    offer.reference,
    offer.currency,
    offer.interval,
    offer.quantity,
    offer.termsVersion,
    offer.amountMinor ?? null,
    offer.taxIncluded ?? null
  ])).digest("hex");
  const candidate = {
    id: randomUUID18(),
    binding,
    actorId: actor2.actorId,
    idempotencyKey: request.idempotencyKey,
    fingerprint,
    requestedOffer: offer.reference,
    termsVersion: offer.termsVersion,
    state: "reserved",
    remoteCheckoutId: null,
    resolvedAt: null
  };
  const reserved = await deps.repository.reserve(candidate);
  const operation = operationSchema.parse(reserved.operation);
  assertBinding(operation.binding, binding);
  if (reserved.kind !== "reserved") {
    if (reserved.kind === "replay" && operation.fingerprint !== fingerprint) throw new BillingError("CONFLICT");
    return { status: "pending", operationId: operation.id, state: operation.state };
  }
  if (operation.id !== candidate.id || operation.fingerprint !== fingerprint || operation.actorId !== actor2.actorId || operation.state !== "reserved") throw new BillingError("CONFLICT");
  let result;
  try {
    const current2 = await deps.authorize(binding.workspaceId);
    assertBinding(bindingSchema.parse(current2.binding), binding);
    if (current2.actorId !== actor2.actorId) throw new BillingError("BINDING_MISMATCH");
    const customerId = await deps.repository.customer?.(operation.id) ?? void 0;
    result = z42.object({ remoteCheckoutId: z42.string().min(1).max(255), url: z42.string().max(4096) }).strict().parse(await deps.provider.create({ operationId: operation.id, binding, offer, customerId }));
    await deps.repository.complete(operation.id, result.remoteCheckoutId);
  } catch {
    await deps.repository.markUnknown(operation.id).catch(() => {
    });
    throw new BillingError("UNAVAILABLE");
  }
  let url;
  try {
    url = new URL(result.url);
  } catch {
    throw new BillingError("UNTRUSTED_PROVIDER");
  }
  if (url.protocol !== "https:" || url.username || url.password || !deps.hostedOrigins.includes(url.origin))
    throw new BillingError("UNTRUSTED_PROVIDER");
  const current = await deps.authorize(binding.workspaceId);
  assertBinding(bindingSchema.parse(current.binding), binding);
  if (current.actorId !== actor2.actorId) throw new BillingError("BINDING_MISMATCH");
  return { status: "created", operationId: operation.id, url: url.href };
}

// server/billing/service.ts
function createSelectedBillingService(db2, config) {
  const targetFromWorkspace = (workspace) => workspace.companyId !== null ? { kind: "company", id: workspace.companyId } : { kind: "user", id: workspace.userId };
  return {
    async status(actorId, target2) {
      return db2.transaction(async (tx) => {
        const { workspace } = await authorizeBillingTarget(tx, actorId, target2);
        const { offer } = await readCurrentOffer(tx);
        let manualUntil = null, paidThrough = null;
        let contract, operation;
        if (workspace) {
          const [marker4] = await tx.select().from(billingSourceState).where(eq23(billingSourceState.workspaceId, workspace.id));
          const grants = await tx.select().from(manualProGrants).where(and19(eq23(manualProGrants.workspaceId, workspace.id), isNull14(manualProGrants.revokedAt)));
          const expires = grants.filter((grant) => grant.startsAt.getTime() <= config.now() && grant.endsAt.getTime() > config.now()).map((grant) => grant.endsAt.getTime());
          if (!marker4 && workspace.plan === "pro" && workspace.proUntil && workspace.proUntil.getTime() > config.now()) expires.push(workspace.proUntil.getTime());
          if (expires.length) manualUntil = new Date(Math.max(...expires)).toISOString();
          const contracts = await tx.select().from(billingSubscriptions).where(and19(
            eq23(billingSubscriptions.workspaceId, workspace.id),
            eq23(billingSubscriptions.provider, config.authority.provider),
            eq23(billingSubscriptions.merchantAccount, config.authority.merchantAccount),
            eq23(billingSubscriptions.mode, config.authority.mode)
          ));
          contract = contracts.find((row) => row.state !== "ended") ?? contracts.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
          paidThrough = contract?.paidThrough?.toISOString() ?? null;
          [operation] = await tx.select().from(billingOperations).where(and19(
            eq23(billingOperations.workspaceId, workspace.id),
            eq23(billingOperations.mode, config.authority.mode),
            eq23(billingOperations.kind, "checkout"),
            isNull14(billingOperations.resolvedAt)
          ));
        }
        let activeCompany = true;
        if (target2.kind === "company") {
          const [company] = await tx.select().from(companies).where(eq23(companies.id, target2.id));
          activeCompany = company?.isActive ?? false;
        }
        const hasPro2 = workspace?.plan === "pro" && workspace.proUntil !== null && workspace.proUntil.getTime() > config.now();
        const existing = contract && contract.state !== "ended";
        const state = operation ? "pending" : contract?.processorStatus === "past_due" || contract?.processorStatus === "unpaid" ? "payment_failed" : contract?.processorStatus === "incomplete" ? "action_required" : existing ? "active" : contract?.state === "ended" ? "canceled" : "none";
        return {
          target: target2,
          state,
          manualUntil,
          paidThrough,
          effectiveAccess: { hasPro: Boolean(hasPro2), until: hasPro2 ? workspace.proUntil.toISOString() : null },
          cancelAtPeriodEnd: contract?.cancelAtPeriodEnd ?? false,
          operation: operation ? operation.state === "unknown" ? "unknown" : "pending" : "none",
          capabilities: {
            checkout: Boolean(config.newCheckoutsReady() && config.terms && activeCompany && !manualUntil && !existing && !operation),
            manage: Boolean(existing),
            recover: Boolean(existing && ["past_due", "unpaid", "incomplete"].includes(contract.processorStatus))
          },
          unavailableReason: manualUntil ? "manual_grant" : !config.newCheckoutsReady() || !config.terms ? "not_ready" : null,
          offer: config.terms ? {
            amount: displayAmount(offer.amountMinor),
            currency: "EUR",
            interval: "month",
            taxDisclosure: config.terms.taxDisclosure,
            termsText: config.terms.text,
            termsVersion: config.terms.version,
            offerRevision: offer.id
          } : null
        };
      });
    },
    async checkout(actorId, input) {
      if (!config.newCheckoutsReady() || !config.terms) throw new BillingError("UNAVAILABLE");
      const initialized = await db2.transaction(async (tx) => {
        const authorized = await authorizeBillingTarget(tx, actorId, input.target, "checkout", true);
        let workspace = authorized.workspace;
        if (!workspace) {
          if (input.target.kind === "user") await tx.execute(sql16`SELECT id FROM users WHERE id = ${actorId} FOR UPDATE`);
          const [inserted] = await tx.insert(providerSubscriptions).values({
            userId: input.target.kind === "user" ? actorId : null,
            companyId: input.target.kind === "company" ? input.target.id : null,
            plan: "free",
            proUntil: null,
            updatedBy: actorId
          }).onConflictDoNothing().returning();
          workspace = inserted ?? (await tx.select().from(providerSubscriptions).where(input.target.kind === "user" ? eq23(providerSubscriptions.userId, actorId) : eq23(providerSubscriptions.companyId, input.target.id)))[0];
          if (!workspace) throw new BillingError("UNAVAILABLE");
          if (inserted) await config.audit(tx, { kind: "workspace.initialized", workspaceId: workspace.id, reference: String(workspace.id), actorId, target: input.target });
        }
        const { offer } = await readCurrentOffer(tx);
        return { workspace, offer };
      });
      const binding = { ...config.authority, workspaceId: initialized.workspace.id };
      const repository = createBillingRepository(db2, config.authority, {
        async authorizeCheckout(tx, reservation) {
          const [workspace] = await tx.select().from(providerSubscriptions).where(eq23(providerSubscriptions.id, reservation.binding.workspaceId));
          if (!workspace) throw new BillingError("BINDING_MISMATCH");
          const target2 = targetFromWorkspace(workspace);
          await authorizeBillingTarget(tx, reservation.actorId, target2, "checkout", true);
          await assertManualGrantExpired(tx, workspace.id, config.now());
          await assertCurrentOffer(tx, reservation.offerRevision);
        },
        async recordChange(tx, change) {
          await config.audit(tx, { ...change, actorId });
        }
      }, config.now);
      const result = await startCheckout({
        workspaceId: binding.workspaceId,
        termsVersion: input.termsVersion,
        offerRevision: input.offerRevision,
        idempotencyKey: input.idempotencyKey
      }, {
        authority: config.authority,
        offer: {
          reference: initialized.offer.id,
          amountMinor: initialized.offer.amountMinor,
          currency: "EUR",
          interval: "month",
          quantity: 1,
          taxIncluded: true,
          termsVersion: config.terms.version
        },
        hostedOrigins: config.hostedOrigins,
        provider: config.provider,
        repository,
        async authorize(workspaceId) {
          return db2.transaction(async (tx) => {
            const checked = await authorizeBillingTarget(tx, actorId, input.target, "checkout");
            if (checked.workspace?.id !== workspaceId) throw new BillingError("BINDING_MISMATCH");
            return { actorId, binding };
          });
        }
      });
      return result.status === "created" ? { state: "redirect", target: input.target, url: result.url } : { state: "pending", target: input.target };
    },
    async portal(actorId, target2) {
      const reserved = await db2.transaction(async (tx) => {
        const { workspace } = await authorizeBillingTarget(tx, actorId, target2, "portal");
        if (!workspace) throw new BillingError("UNAVAILABLE");
        await tx.select().from(providerSubscriptions).where(eq23(providerSubscriptions.id, workspace.id)).for("update");
        await authorizeBillingTarget(tx, actorId, target2, "portal", true);
        const [contract] = await tx.select().from(billingSubscriptions).where(and19(
          eq23(billingSubscriptions.workspaceId, workspace.id),
          eq23(billingSubscriptions.provider, config.authority.provider),
          eq23(billingSubscriptions.merchantAccount, config.authority.merchantAccount),
          eq23(billingSubscriptions.mode, config.authority.mode),
          ne8(billingSubscriptions.state, "ended")
        ));
        if (!contract) throw new BillingError("UNAVAILABLE");
        const [account] = await tx.select().from(billingAccounts).where(eq23(billingAccounts.id, contract.accountId));
        if (!account?.customerId) throw new BillingError("UNAVAILABLE");
        const operationId = randomUUID19();
        await tx.insert(billingOperations).values({
          id: operationId,
          ...config.authority,
          workspaceId: workspace.id,
          accountId: account.id,
          kind: "portal",
          idempotencyKey: operationId,
          fingerprint: createHash9("sha256").update(JSON.stringify([workspace.id, actorId, account.id, operationId])).digest("hex"),
          approvedOfferRef: contract.approvedOfferRef,
          termsVersion: "portal-v1",
          initiatorId: actorId,
          state: "reserved"
        });
        await config.audit(tx, { kind: "portal.reserved", workspaceId: workspace.id, reference: operationId, actorId });
        return { customerId: account.customerId, operationId, workspaceId: workspace.id };
      });
      let result;
      try {
        result = await config.portal(reserved.customerId, reserved.operationId);
        if (!result.sessionId) throw new BillingError("UNTRUSTED_PROVIDER");
        await db2.transaction(async (tx) => {
          await tx.select().from(providerSubscriptions).where(eq23(providerSubscriptions.id, reserved.workspaceId)).for("update");
          await tx.update(billingOperations).set({ state: "completed", remoteCheckoutId: result.sessionId, resolvedAt: new Date(config.now()), updatedAt: new Date(config.now()) }).where(eq23(billingOperations.id, reserved.operationId));
          await config.audit(tx, { kind: "portal.created", workspaceId: reserved.workspaceId, reference: reserved.operationId, actorId });
        });
      } catch (error) {
        const rejected = error instanceof BillingError && error.code === "POLICY_REVIEW";
        await db2.transaction(async (tx) => {
          await tx.select().from(providerSubscriptions).where(eq23(providerSubscriptions.id, reserved.workspaceId)).for("update");
          await tx.update(billingOperations).set({
            state: rejected ? "failed" : "unknown",
            failureCode: rejected ? "POLICY_REVIEW" : "PROVIDER_TIMEOUT",
            resolvedAt: rejected ? new Date(config.now()) : null,
            updatedAt: new Date(config.now())
          }).where(and19(eq23(billingOperations.id, reserved.operationId), ne8(billingOperations.state, "completed")));
          if (!rejected) await config.audit(tx, { kind: "portal.unknown", workspaceId: reserved.workspaceId, reference: reserved.operationId });
        });
        throw new BillingError(rejected ? "POLICY_REVIEW" : "UNAVAILABLE");
      }
      await db2.transaction((tx) => authorizeBillingTarget(tx, actorId, target2, "portal"));
      const url = new URL(result.url);
      if (url.protocol !== "https:" || url.username || url.password || !config.hostedOrigins.includes(url.origin)) throw new BillingError("UNTRUSTED_PROVIDER");
      return { state: "redirect", target: target2, url: url.href };
    }
  };
}

// server/billing/routes.ts
import { Router, raw } from "express";
import { z as z43 } from "zod";
var billingCheckoutBody = z43.object({
  target: subscriptionTargetSchema,
  termsVersion: z43.string().regex(/^[a-zA-Z0-9._-]{1,64}$/),
  offerRevision: z43.string().uuid(),
  idempotencyKey: z43.string().regex(/^[a-zA-Z0-9_-]{16,128}$/)
}).strict();
function failure5(error, res) {
  const code = error instanceof BillingError ? error.code : error instanceof z43.ZodError ? "INVALID_INPUT" : "UNAVAILABLE";
  const status = code === "FORBIDDEN" || code === "BINDING_MISMATCH" ? 403 : code === "CONFLICT" || code === "MANUAL_GRANT_ACTIVE" ? 409 : code === "INVALID_INPUT" || code === "UNTRUSTED_PROVIDER" ? 400 : 503;
  res.status(status).json({ code, message: status === 403 ? "Billing access is not allowed." : status === 409 ? "Billing information changed. Refresh before continuing." : status === 400 ? "Invalid billing request." : "Billing is unavailable." });
}
var actor = (req) => z43.string().uuid().parse(req.user?.claims.sub);
function selected(req, target2, deps) {
  const current = deps.selectedTarget(req);
  if (current.kind !== target2.kind || current.id !== target2.id) throw new BillingError("FORBIDDEN");
}
function createBillingRouters(deps) {
  const browser = Router(), administration = Router(), webhook = Router();
  const cache = (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  };
  const gate = (ready) => (_req, res, next) => {
    if (!ready()) return failure5(new BillingError("UNAVAILABLE"), res);
    next();
  };
  const sameOrigin = (req, res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && (req.get("Origin") !== deps.origin || req.get("Sec-Fetch-Site") === "cross-site"))
      return failure5(new BillingError("FORBIDDEN"), res);
    next();
  };
  const handle2 = (work) => (req, res) => {
    void work(req, res).catch((error) => failure5(error, res));
  };
  browser.use(cache, gate(deps.ready), deps.authenticate, sameOrigin, deps.rateLimit);
  browser.get("/subscription", handle2(async (req, res) => {
    const target2 = subscriptionTargetSchema.parse(req.query);
    selected(req, target2, deps);
    res.json(await deps.service.status(actor(req), target2));
  }));
  browser.post("/checkout", gate(deps.newCheckoutsReady), handle2(async (req, res) => {
    const input = billingCheckoutBody.parse(req.body);
    selected(req, input.target, deps);
    res.json(await deps.service.checkout(actor(req), input));
  }));
  browser.post("/portal", handle2(async (req, res) => {
    const { target: target2 } = z43.object({ target: subscriptionTargetSchema }).strict().parse(req.body);
    selected(req, target2, deps);
    res.json(await deps.service.portal(actor(req), target2));
  }));
  administration.use(cache, gate(deps.adminReady), deps.authenticate, deps.requireAdmin, sameOrigin, deps.rateLimit);
  administration.get("/offer", handle2(async (req, res) => {
    res.json(await deps.pricing.read(actor(req)));
  }));
  administration.put("/offer", handle2(async (req, res) => {
    res.json(await deps.pricing.save(actor(req), req.body));
  }));
  webhook.use(cache, gate(deps.ready), deps.rateLimit);
  webhook.post("/", raw({ type: "application/json", limit: "256kb" }), handle2(async (req, res) => {
    if (!Buffer.isBuffer(req.body)) throw new BillingError("INVALID_INPUT");
    await deps.webhook(req.body, req.get("stripe-signature") ?? "");
    res.status(200).json({ received: true });
  }));
  return { browser, administration, webhook };
}

// server/billing/audit.ts
init_context();
init_events();
init_capture();
import { randomUUID as randomUUID20 } from "node:crypto";
async function enqueueBillingAudit(tx, input) {
  const context = createAuditContext({
    actor: input.actor,
    scope: input.scope,
    target: input.target,
    source: { application: "fitsmytime", environment: input.environment, component: "billing" },
    requestId: input.requestId ?? randomUUID20(),
    operationId: input.operationId
  });
  const action = ["billing.checkout_unknown.v1", "billing.portal_unknown.v1"].includes(input.eventName) ? { eventName: input.eventName, outcome: "unknown", reasonCode: "PROVIDER_TIMEOUT", changes: [] } : input.eventName === "billing.event_quarantined.v1" ? { eventName: input.eventName, outcome: "rejected", reasonCode: "CONFLICT", changes: [] } : { eventName: input.eventName, outcome: "succeeded", changes: [] };
  await enqueueDrizzleAudit(tx, createAuditEvent(context, action));
}

// server/billing/application.ts
var DISABLED_BILLING_READINESS = Object.freeze({
  ready: () => false,
  newCheckoutsReady: () => false,
  adminReady: () => false,
  sourcesReady: () => false,
  auditReady: () => false
});
function createBillingApplication(db2, stripe, config) {
  async function audit(tx, change) {
    if (!config.auditReady()) throw new BillingError("UNAVAILABLE");
    let scope2 = { kind: "unknown" };
    let actor2 = { kind: "service", serviceId: "billing-worker" };
    let workspace;
    if (change.workspaceId) {
      [workspace] = await tx.select().from(providerSubscriptions).where(eq24(providerSubscriptions.id, change.workspaceId));
      if (!workspace) throw new BillingError("BINDING_MISMATCH");
      scope2 = workspace.companyId !== null ? { kind: "company", workspaceId: String(workspace.companyId) } : { kind: "personal", workspaceId: workspace.userId };
    }
    if (change.actorId) {
      if (change.kind === "offer.changed" || change.kind === "manual_grant.changed") {
        if (!config.isAdmin(change.actorId)) throw new BillingError("FORBIDDEN");
        actor2 = { kind: "user", userId: change.actorId, effectiveRole: "support" };
        if (change.kind === "offer.changed") scope2 = { kind: "global" };
      } else {
        if (!workspace) throw new BillingError("BINDING_MISMATCH");
        const target3 = workspace.companyId !== null ? { kind: "company", id: workspace.companyId } : { kind: "user", id: workspace.userId };
        await authorizeBillingTarget(tx, change.actorId, target3);
        actor2 = { kind: "user", userId: change.actorId, effectiveRole: workspace.companyId === null ? "provider" : "owner" };
      }
    }
    const events = {
      "portal.reserved": "billing.portal_reserved.v1",
      "portal.created": "billing.portal_created.v1",
      "portal.unknown": "billing.portal_unknown.v1",
      "workspace.initialized": "billing.workspace_initialized.v1",
      "checkout.reserved": "billing.checkout_reserved.v1",
      "checkout.created": "billing.checkout_created.v1",
      "checkout.unknown": "billing.checkout_unknown.v1",
      "checkout.resolved": "billing.checkout_resolved.v1",
      "event.accepted": "billing.event_accepted.v1",
      "event.quarantined": "billing.event_quarantined.v1",
      "subscription.reconciled": "billing.subscription_reconciled.v1",
      "offer.changed": "billing.offer_changed.v1",
      "price_mapping.changed": "billing.price_mapping_changed.v1",
      "manual_grant.changed": "billing.manual_grant_changed.v1"
    };
    const eventName = events[change.kind];
    if (!eventName) throw new BillingError("INVALID_INPUT");
    const target2 = change.kind === "workspace.initialized" && workspace ? workspace.companyId !== null ? { type: "company", id: String(workspace.companyId) } : { type: "user", id: workspace.userId } : { type: change.kind === "offer.changed" ? "billing_offer" : change.kind === "manual_grant.changed" ? "manual_grant" : change.kind === "subscription.reconciled" ? "billing_subscription" : change.kind.startsWith("event.") ? "billing_event" : "billing_operation", id: change.reference };
    await enqueueBillingAudit(tx, {
      actor: actor2,
      scope: scope2,
      target: target2,
      eventName,
      environment: config.environment,
      operationId: change.kind === "workspace.initialized" ? randomUUID21() : change.reference
    });
  }
  const pricingAudit = (tx, kind, reference3, context) => audit(tx, { kind, reference: reference3, ...context });
  const mappings = createPriceMappingRepository(db2, pricingAudit, config.now);
  const adapter = createStripeBillingAdapter(stripe, mappings, { ...config, returnOrigin: config.origin });
  const lifecycle = createLifecycleRepository(db2, { ...config, audit });
  const inbox = createStripeInbox(db2, config.authority, audit, config.now);
  const dispatcher = createStripeDispatcher({ adapter, inbox, lifecycle, authority: config.authority, now: config.now, ready: config.ready });
  const service = createSelectedBillingService(db2, {
    ...config,
    audit,
    provider: adapter.checkout,
    hostedOrigins: STRIPE_HOSTED_ORIGINS,
    portal: adapter.portal
  });
  const pricing = createPricingService(db2, config.isAdmin, pricingAudit, config.now);
  const routers = createBillingRouters({ ...config, service, pricing, webhook: dispatcher.webhook });
  return { routers, service, pricing, dispatcher, lifecycle, audit };
}

// server/billing/jobs.ts
import { randomUUID as randomUUID22 } from "node:crypto";
import { and as and20, eq as eq25, inArray as inArray8, isNull as isNull15, lte as lte2, or as or7 } from "drizzle-orm";
var BILLING_MAX_EVENT_ATTEMPTS = 8;
var billingBackoff = (attempt) => Math.min(36e5, 5e3 * 2 ** Math.min(10, Math.max(0, attempt - 1)));
function billingFailure(error) {
  return error instanceof BillingError && ["POLICY_REVIEW", "BINDING_MISMATCH", "UNTRUSTED_PROVIDER", "INVALID_INPUT"].includes(error.code) ? "review" : "retry";
}
function createBillingJobRepository(db2, authority, now, audit) {
  const scope2 = and20(eq25(billingEvents.provider, authority.provider), eq25(billingEvents.merchantAccount, authority.merchantAccount), eq25(billingEvents.mode, authority.mode));
  return {
    async claim() {
      return db2.transaction(async (tx) => {
        const [event] = await tx.select().from(billingEvents).where(and20(
          scope2,
          inArray8(billingEvents.state, ["pending", "processing"]),
          lte2(billingEvents.nextAttemptAt, new Date(now())),
          or7(isNull15(billingEvents.leaseUntil), lte2(billingEvents.leaseUntil, new Date(now())))
        )).orderBy(billingEvents.nextAttemptAt).limit(1).for("update", { skipLocked: true });
        if (!event) return null;
        const token = randomUUID22(), attempts = event.attempts + 1;
        await tx.update(billingEvents).set({ state: "processing", attempts, leaseToken: token, leaseUntil: new Date(now() + 6e4) }).where(eq25(billingEvents.id, event.id));
        return { id: event.id, token, attempts, workspaceId: event.workspaceId };
      });
    },
    async release(job, review) {
      return db2.transaction(async (tx) => {
        const terminal = review || job.attempts >= BILLING_MAX_EVENT_ATTEMPTS;
        const [changed] = await tx.update(billingEvents).set({
          state: terminal ? "quarantined" : "pending",
          failureCode: terminal ? "REVIEW_REQUIRED" : "RETRYABLE",
          leaseToken: null,
          leaseUntil: null,
          nextAttemptAt: new Date(now() + billingBackoff(job.attempts))
        }).where(and20(scope2, eq25(billingEvents.id, job.id), eq25(billingEvents.leaseToken, job.token), eq25(billingEvents.state, "processing"))).returning({ id: billingEvents.id });
        if (changed && terminal) await audit(tx, { kind: "event.quarantined", workspaceId: job.workspaceId, reference: job.id });
      });
    },
    async dueContracts() {
      return db2.select().from(billingSubscriptions).where(and20(
        eq25(billingSubscriptions.provider, authority.provider),
        eq25(billingSubscriptions.merchantAccount, authority.merchantAccount),
        eq25(billingSubscriptions.mode, authority.mode),
        lte2(billingSubscriptions.nextReconcileAt, new Date(now())),
        or7(isNull15(billingSubscriptions.leaseUntil), lte2(billingSubscriptions.leaseUntil, new Date(now())))
      )).orderBy(billingSubscriptions.nextReconcileAt).limit(4);
    },
    async postpone(contract, review) {
      await db2.update(billingSubscriptions).set({ nextReconcileAt: new Date(now() + (review ? 864e5 : 6e4)) }).where(and20(eq25(billingSubscriptions.id, contract.id), eq25(billingSubscriptions.revision, contract.revision)));
    }
  };
}
function createBillingJobs(repository, dispatcher, enabled) {
  let running = false, stopped = false;
  return {
    async tick() {
      if (running || stopped || !enabled()) return;
      running = true;
      try {
        for (let count = 0; count < 8 && !stopped && enabled(); count++) {
          const job = await repository.claim();
          if (!job) break;
          let review = job.attempts > BILLING_MAX_EVENT_ATTEMPTS;
          if (!review) try {
            await dispatcher.process(job.id);
          } catch (error) {
            review = billingFailure(error) === "review";
          }
          await repository.release(job, review);
        }
        for (const contract of await repository.dueContracts()) {
          if (stopped || !enabled()) break;
          try {
            await dispatcher.reconcile(contract.workspaceId, contract.processorSubscriptionId);
          } catch (error) {
            await repository.postpone(contract, billingFailure(error) === "review");
          }
        }
      } finally {
        running = false;
      }
    },
    stop() {
      stopped = true;
    }
  };
}

// server/billing/sandbox-preflight.ts
import Stripe from "stripe";

// server/billing/sandbox-config.ts
var STRIPE_SANDBOX_FIELDS = Object.freeze([
  "STRIPE_BILLING_MODE",
  "STRIPE_BILLING_ENABLED",
  "STRIPE_NEW_CHECKOUTS_ENABLED",
  "STRIPE_BILLING_API_KEY",
  "STRIPE_BILLING_ACCOUNT_ID",
  "STRIPE_BILLING_WEBHOOK_SECRET",
  "STRIPE_BILLING_PORTAL_CONFIGURATION_ID",
  "STRIPE_BILLING_RETURN_ORIGIN"
]);
var StripeSandboxConfigurationError = class extends Error {
  constructor() {
    super("Invalid disabled sandbox preparation");
    this.name = "StripeSandboxConfigurationError";
  }
};
var invalid2 = () => {
  throw new StripeSandboxConfigurationError();
};
function parseStripeSandboxPreparation(env) {
  if (Object.keys(env).some((name) => !STRIPE_SANDBOX_FIELDS.some((allowed) => allowed === name))) return invalid2();
  if ((env.STRIPE_BILLING_MODE || "test") !== "test" || (env.STRIPE_BILLING_ENABLED || "false") !== "false" || (env.STRIPE_NEW_CHECKOUTS_ENABLED || "false") !== "false") return invalid2();
  const apiKey = env.STRIPE_BILLING_API_KEY || void 0, accountId = env.STRIPE_BILLING_ACCOUNT_ID || void 0;
  const webhookSecret = env.STRIPE_BILLING_WEBHOOK_SECRET || void 0;
  const portalConfigurationId = env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID || void 0;
  const returnOrigin = env.STRIPE_BILLING_RETURN_ORIGIN || void 0;
  if (apiKey && !/^(rk|sk)_test_[A-Za-z0-9_]+$/.test(apiKey) || accountId && !/^acct_[A-Za-z0-9]+$/.test(accountId) || webhookSecret && !/^whsec_[A-Za-z0-9]+$/.test(webhookSecret) || portalConfigurationId && !/^bpc_[A-Za-z0-9]+$/.test(portalConfigurationId)) return invalid2();
  if (returnOrigin) {
    let origin;
    try {
      origin = new URL(returnOrigin);
    } catch {
      return invalid2();
    }
    if (origin.protocol !== "https:" || origin.origin !== returnOrigin || origin.username || origin.password) return invalid2();
  }
  return Object.freeze({
    mode: "test",
    billingEnabled: false,
    newCheckoutsEnabled: false,
    apiKey,
    accountId,
    webhookSecret,
    portalConfigurationId,
    returnOrigin
  });
}
var STRIPE_SANDBOX_FAILURE_CATEGORIES = Object.freeze([
  "network_or_timeout",
  "stripe_authentication_or_permission",
  "account_mismatch",
  "other"
]);

// server/billing/sandbox-preflight.ts
var StripeSandboxPreflightError = class extends Error {
  constructor(category = "other") {
    super("Sandbox own-account preflight failed; stop without retry");
    this.category = category;
    this.name = "StripeSandboxPreflightError";
  }
};
function stripeSandboxFailureCategory(error) {
  if (error instanceof StripeSandboxPreflightError) return error.category;
  if (!error || typeof error !== "object") return "other";
  try {
    const value = error;
    if (value.statusCode === 401 || value.statusCode === 403 || value.type === "StripeAuthenticationError" || value.type === "StripePermissionError" || ["api_key_expired", "invalid_api_key", "permission_error"].some((code) => value.code === code))
      return "stripe_authentication_or_permission";
    if (value.type === "StripeConnectionError" || value.name === "AbortError" || value.name === "TimeoutError" || ["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "UND_ERR_CONNECT_TIMEOUT", "ABORT_ERR"].some((code) => value.code === code))
      return "network_or_timeout";
  } catch {
  }
  return "other";
}
function assertOwnAccountReadOnlyRequest(urlInput, method, headers) {
  const url = new URL(urlInput);
  if (method !== "GET" || url.origin !== "https://api.stripe.com" || url.pathname !== "/v1/account" || url.search || url.hash || url.username || url.password || new Headers(headers).has("Stripe-Account")) throw new StripeSandboxPreflightError();
}
function createStripeOwnAccountReader(input, fetcher = fetch) {
  const config = validate(input);
  let requests = 0, used = false;
  const client2 = new Stripe(config.apiKey, {
    apiVersion: "2025-06-30.basil",
    maxNetworkRetries: 0,
    timeout: 1e4,
    httpClient: Stripe.createFetchHttpClient(async (url, options) => {
      if (++requests !== 1) throw new StripeSandboxPreflightError();
      assertOwnAccountReadOnlyRequest(String(url), options?.method ?? "GET", options?.headers);
      return fetcher(url, {
        ...options,
        redirect: "error",
        signal: AbortSignal.any([...options?.signal ? [options.signal] : [], AbortSignal.timeout(1e4)])
      });
    })
  });
  return Object.freeze({ async retrieve() {
    if (used) throw new StripeSandboxPreflightError();
    used = true;
    try {
      return await client2.accounts.retrieve({}, { maxNetworkRetries: 0, timeout: 1e4 });
    } catch (error) {
      throw new StripeSandboxPreflightError(stripeSandboxFailureCategory(error));
    }
  } });
}
function validate(input) {
  const config = parseStripeSandboxPreparation({
    STRIPE_BILLING_MODE: input.mode,
    STRIPE_BILLING_ENABLED: String(input.billingEnabled),
    STRIPE_NEW_CHECKOUTS_ENABLED: String(input.newCheckoutsEnabled),
    STRIPE_BILLING_API_KEY: input.apiKey,
    STRIPE_BILLING_ACCOUNT_ID: input.accountId
  });
  if (!config.apiKey || !config.accountId) throw new StripeSandboxPreflightError();
  return config;
}
async function checkStripeOwnAccount(input, reader) {
  const config = validate(input);
  try {
    const result = await reader.retrieve();
    if (!result || typeof result !== "object" || !("id" in result) || !("object" in result) || result.object !== "account") throw new StripeSandboxPreflightError();
    if (result.id !== config.accountId) throw new StripeSandboxPreflightError("account_mismatch");
    return {
      accountReadSucceeded: true,
      configuredAccountMatched: true,
      mode: "test",
      billingDisabled: true,
      newCheckoutsDisabled: true
    };
  } catch (error) {
    throw new StripeSandboxPreflightError(stripeSandboxFailureCategory(error));
  }
}

// server/billing/runtime.ts
var selected2;
function selectedLocalBillingRuntime() {
  return selected2;
}
function createLocalBillingRuntime(db2, config, deps) {
  let verified = false, stopping = false, workerHealthy = false;
  let ticking = false;
  let timer;
  const ready = () => verified && !stopping;
  const stripe = deps.stripe ?? new Stripe2(config.apiKey, { apiVersion: STRIPE_API_VERSION, timeout: 1e4, maxNetworkRetries: 0 });
  const application = createBillingApplication(db2, stripe, {
    authority: { provider: "stripe", merchantAccount: config.accountId, mode: "test" },
    ready,
    adminReady: ready,
    sourcesReady: ready,
    auditReady: ready,
    newCheckoutsReady: () => ready() && config.newCheckouts && config.worker && workerHealthy,
    now: Date.now,
    isAdmin: deps.isAdmin,
    environment: "development",
    origin: config.origin,
    localSandbox: true,
    webhookSecret: config.webhookSecret,
    portalConfigurationId: config.portalConfigurationId,
    automaticTaxEnabled: false,
    terms: {
      version: "sandbox-v1",
      text: "Sandbox test only. No real purchase. Test subscription renews monthly; test cancellation ends renewal at period end. Existing subscriptions keep their agreed price.",
      taxDisclosure: "Sandbox fixture: displayed EUR amount includes tax; automatic tax is disabled. This is not a production tax policy."
    },
    authenticate: deps.authenticate,
    requireAdmin: deps.requireAdmin,
    rateLimit: rateLimit8({
      windowMs: 6e4,
      limit: 60,
      standardHeaders: true,
      legacyHeaders: false,
      message: { code: "UNAVAILABLE", message: "Billing request limit reached." }
    }),
    selectedTarget(req) {
      if (!req.user?.claims.sub || !req.workspace || req.workspace.invalid) throw new Error("Unavailable workspace");
      return req.workspace.company ? { kind: "company", id: req.workspace.company.id } : { kind: "user", id: req.user.claims.sub };
    }
  });
  const jobs = createBillingJobs(
    createBillingJobRepository(db2, { provider: "stripe", merchantAccount: config.accountId, mode: "test" }, Date.now, application.audit),
    application.dispatcher,
    () => ready() && config.worker
  );
  async function tick() {
    if (ticking) return;
    ticking = true;
    try {
      await jobs.tick();
      workerHealthy = true;
    } catch {
      workerHealthy = false;
      console.error("Billing worker batch unavailable");
    } finally {
      ticking = false;
    }
  }
  return {
    application,
    async verify(onStage) {
      onStage?.("billing_database");
      await deps.verifyDatabase();
      const preparation = {
        mode: "test",
        billingEnabled: false,
        newCheckoutsEnabled: false,
        apiKey: config.apiKey,
        accountId: config.accountId
      };
      onStage?.("billing_account");
      if (deps.verifyAccount) await deps.verifyAccount();
      else await checkStripeOwnAccount(preparation, createStripeOwnAccountReader(preparation));
      onStage?.("billing_portal");
      const portal = await stripe.billingPortal.configurations.retrieve(config.portalConfigurationId, {}, { timeout: 1e4, maxNetworkRetries: 0 });
      assertSandboxPortalConfiguration(portal, config.portalConfigurationId);
      verified = true;
      installBillingManualWriter(application.lifecycle.updateManualEntitlement);
    },
    mountEarly(app2) {
      app2.get("/api/billing/runtime", (_req, res) => {
        res.set("Cache-Control", "no-store");
        res.json({ subscriptionsReady: ready(), administrationReady: ready(), hostedOrigins: ready() ? [...STRIPE_HOSTED_ORIGINS] : [] });
      });
      app2.use("/api/billing/webhook", application.routers.webhook);
    },
    mountAuthenticated(app2) {
      app2.use("/api/billing", application.routers.browser);
      app2.use("/api/admin/billing", application.routers.administration);
    },
    async start() {
      if (!config.worker) return;
      await tick();
      timer = setInterval(() => {
        void tick();
      }, 5e3);
      timer.unref();
    },
    stop() {
      stopping = true;
      workerHealthy = false;
      if (timer) clearInterval(timer);
      jobs.stop();
    }
  };
}

// server/billing/middleware.ts
import express2 from "express";
function mountBillingBodyBoundaries(app2, billing) {
  if (billing) billing.mountEarly(app2);
  else {
    app2.get("/api/billing/runtime", (_req, res) => {
      res.set("Cache-Control", "no-store");
      res.json({ subscriptionsReady: false, administrationReady: false, hostedOrigins: [] });
    });
    app2.all("/api/billing/webhook", (_req, res) => {
      res.set("Cache-Control", "no-store");
      res.status(503).json({ code: "UNAVAILABLE" });
    });
  }
  app2.use(express2.json());
  app2.use(express2.urlencoded({ extended: false }));
}

// migrations/audit/runtime-contract.mjs
var RUN_ID = "a0140000-0000-4000-8000-000000000001";
var EVENT_IDS = Object.freeze([
  "a0140001-0000-4000-8000-000000000001",
  "a0140001-0000-4000-8000-000000000002",
  "a0140001-0000-4000-8000-000000000003",
  "a0140001-0000-4000-8000-000000000004",
  "a0140001-0000-4000-8000-000000000005",
  "a0140001-0000-4000-8000-000000000006",
  "a0140001-0000-4000-8000-000000000007",
  "a0140001-0000-4000-8000-000000000008",
  "a0140001-0000-4000-8000-000000000009",
  "a0140001-0000-4000-8000-00000000000a",
  "a0140001-0000-4000-8000-00000000000b",
  "a0140001-0000-4000-8000-00000000000c"
]);
var TARGETS = Object.freeze({ source: "hbkooiknruimukkhshrk", destination: "ynygqodmtgjrngiudalw" });
var ROLES = Object.freeze({ app: "fmt_app_dev", capture: "fmt_audit_capture_dev", worker: "fmt_audit_worker_dev", writer: "fmt_audit_writer_dev", test: "fmt_audit_test_dev" });
var APP_TABLES = Object.freeze([
  "sessions",
  "users",
  "companies",
  "company_memberships",
  "company_invitations",
  "provider_subscriptions",
  "storefronts",
  "employees",
  "categories",
  "addresses",
  "services",
  "geocoding_cache",
  "bookings",
  "service_reviews",
  "service_embeddings",
  "availability"
]);
var DELETE_TABLES = Object.freeze([
  "sessions",
  "employees",
  "categories",
  "addresses",
  "services",
  "service_reviews",
  "service_embeddings",
  "company_memberships"
]);
var APP_SEQUENCES = Object.freeze([
  "companies_id_seq",
  "provider_subscriptions_id_seq",
  "storefronts_id_seq",
  "employees_id_seq",
  "addresses_id_seq",
  "services_id_seq",
  "bookings_id_seq",
  "service_reviews_id_seq",
  "service_embeddings_id_seq",
  "availability_id_seq"
]);
var SCENARIOS = Object.freeze([
  "rollback-visibility",
  "abort-on-enqueue-error",
  "concurrent-a",
  "concurrent-b",
  "claim-crash",
  "commit-before-ack",
  "conflict",
  "transport-outage",
  "reserved-9",
  "reserved-10",
  "reserved-11",
  "reserved-12"
]);

// migrations/audit/runtime-support.mjs
import fs2 from "node:fs";
import path4 from "node:path";
import tls3 from "node:tls";
import { X509Certificate } from "node:crypto";
import { spawnSync } from "node:child_process";
var ROOT = path4.resolve(import.meta.dirname, "../..");
var CA_PIN = "80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA";
var DIAGNOSTIC_OPTIONS = "-c default_transaction_read_only=on -c search_path=pg_catalog -c statement_timeout=10000 -c lock_timeout=1000 -c idle_in_transaction_session_timeout=15000";
function requireThat(ok, code) {
  if (!ok) {
    const e = new Error(code);
    e.safeCode = code;
    throw e;
  }
}
function safeCode(e) {
  return e?.safeCode || (/^(?:[0-9A-Z]{5}|E[A-Z_]{2,60})$/.test(e?.code || "") ? e.code : "UNCLASSIFIED_FAILURE");
}
function emit(stage, detail = {}) {
  process.stdout.write(JSON.stringify({ stage, ...detail }) + "\n");
}
function readSettings(text3) {
  const values = {};
  for (const line of text3.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    requireThat(!Object.hasOwn(values, m[1]), "DUPLICATE_ENV_KEY");
    let v = m[2];
    if (v.startsWith('"')) {
      try {
        v = JSON.parse(v);
      } catch {
        requireThat(false, "INVALID_QUOTED_ENV_VALUE");
      }
    } else if (v.startsWith("'")) {
      requireThat(v.endsWith("'") && !v.slice(1, -1).includes("'"), "INVALID_QUOTED_ENV_VALUE");
      v = v.slice(1, -1);
    } else requireThat(!/[\s#'"\\]/.test(v), "AMBIGUOUS_ENV_VALUE");
    requireThat(typeof v === "string" && !/[\r\n\0]/.test(v), "INVALID_ENV_VALUE");
    values[m[1]] = v;
  }
  return values;
}
function connection(value, target2, expectedUser) {
  try {
    requireThat(typeof value === "string" && !/[\x00-\x20\x7f]/.test(value), "BAD_CONNECTION");
    const u = new URL(value);
    const host = u.hostname.toLowerCase();
    const user = decodeURIComponent(u.username);
    const password = decodeURIComponent(u.password);
    const database = decodeURIComponent(u.pathname.slice(1));
    requireThat(["postgres:", "postgresql:"].includes(u.protocol) && !u.hash && (!u.port || u.port === "5432"), "BAD_CONNECTION");
    requireThat(user && password && database === "postgres" && !/[<>\x00-\x1f\x7f]/.test(user + password + database), "BAD_CONNECTION");
    const direct = host === `db.${TARGETS[target2]}.supabase.co`;
    const pooler = /^[a-z0-9.-]+\.pooler\.supabase\.com$/.test(host) && user.endsWith(`.${TARGETS[target2]}`);
    requireThat(direct || pooler, "WRONG_TARGET");
    const principal = pooler ? user.slice(0, -(TARGETS[target2].length + 1)) : user;
    requireThat(expectedUser ? principal === expectedUser : principal === "postgres", "WRONG_PRINCIPAL");
    for (const k of u.searchParams.keys()) requireThat(["sslmode", "sslrootcert", "application_name", "connect_timeout"].includes(k) && u.searchParams.getAll(k).length === 1, "URI_OVERRIDE_REJECTED");
    requireThat(!u.searchParams.has("sslmode") || ["require", "verify-ca", "verify-full"].includes(u.searchParams.get("sslmode")), "TLS_MODE_REJECTED");
    return { u, host, user, password, database, principal };
  } catch (e) {
    if (e?.safeCode) throw e;
    requireThat(false, "BAD_CONNECTION");
  }
}
function trustedCA(source) {
  const certPath = source.u.searchParams.get("sslrootcert");
  requireThat(certPath, "EXPLICIT_CA_REQUIRED");
  const pem = fs2.readFileSync(certPath, "utf8");
  const c = new X509Certificate(pem);
  requireThat((pem.match(/BEGIN CERTIFICATE/g) || []).length === 1 && c.ca && c.fingerprint256 === CA_PIN && c.checkIssued(c) && c.verify(c.publicKey) && Date.parse(c.validFrom) <= Date.now() && Date.parse(c.validTo) > Date.now(), "CA_REJECTED");
  return { pem, certPath };
}
async function client(value, target2, ca, user) {
  const c = connection(value, target2, user);
  requireThat(!process.env.PGBINARY, "BINARY_STARTUP_OVERRIDE_REJECTED");
  const configured = c.u.searchParams.get("sslrootcert");
  if (configured) requireThat(new X509Certificate(fs2.readFileSync(configured)).fingerprint256 === CA_PIN, "CA_REJECTED");
  const { default: pg2 } = await import("pg");
  const x = new pg2.Client({
    host: c.host,
    port: 5432,
    user: c.user,
    password: c.password,
    database: c.database,
    ssl: { ca: ca.pem, rejectUnauthorized: true, servername: c.host, checkServerIdentity: tls3.checkServerIdentity, minVersion: "TLSv1.2" },
    options: DIAGNOSTIC_OPTIONS,
    replication: "false",
    sslnegotiation: "postgres",
    application_name: "fitsmytime-audit-runtime-setup",
    client_encoding: "UTF8",
    connectionTimeoutMillis: 1e4,
    query_timeout: 15e3
  });
  x.on("notice", () => {
  });
  x.on("error", () => {
  });
  return x;
}
async function connect(x) {
  await x.connect();
  requireThat(x.connection.stream.encrypted && x.connection.stream.authorized, "TLS_NOT_VERIFIED");
}
var files = /* @__PURE__ */ new Set([".env", ".env.audit-setup.local", ".env.audit-worker.local", ".env.audit-test.local", ".env.audit-before-runtime.local"]);
function privatePath(name) {
  requireThat(files.has(name), "PRIVATE_PATH_REJECTED");
  const p = path4.join(ROOT, name);
  if (fs2.existsSync(p)) requireThat(!fs2.lstatSync(p).isSymbolicLink(), "PRIVATE_SYMLINK_REJECTED");
  return p;
}
function fixed(program, args) {
  const r = spawnSync(program, args, { cwd: ROOT, encoding: "utf8", windowsHide: true, shell: false });
  requireThat(r.status === 0, "PRIVATE_ACL_OR_IGNORE_FAILED");
  return r.stdout;
}
function privatePreflight() {
  requireThat(process.platform === "win32", "WINDOWS_PRIVATE_HANDOFF_ONLY");
  const out = fixed("whoami.exe", ["/user", "/fo", "csv", "/nh"]);
  const sid = out.match(/S-1-5-\d+(?:-\d+)+/)?.[0];
  requireThat(sid, "CURRENT_USER_SID_UNAVAILABLE");
  for (const name of files) requireThat(fixed("git.exe", ["check-ignore", "--", name]).trim() === name, "PRIVATE_FILE_NOT_IGNORED");
  return sid;
}
function privateRead(name, sid) {
  const p = privatePath(name);
  requireThat(fs2.existsSync(p), "PRIVATE_FILE_MISSING");
  fixed("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    path4.join(ROOT, "migrations/audit/protect-private-file.ps1"),
    "-TargetPath",
    p,
    "-UserSid",
    sid,
    "-VerifyOnly"
  ]);
  return fs2.readFileSync(p, "utf8");
}

// migrations/audit/execute-runtime-disabled.mjs
import fs4 from "node:fs";
import path6 from "node:path";
import { pathToFileURL as pathToFileURL2 } from "node:url";
import { createHash as createHash11 } from "node:crypto";

// migrations/audit/execute-runtime-setup.mjs
import fs3 from "node:fs";
import path5 from "node:path";
import { pathToFileURL } from "node:url";
import { createHash as createHash10 } from "node:crypto";
import assert from "node:assert/strict";
var MANIFEST = Object.freeze({
  "0003_destination_runtime.sql": "28a8403d4145751e684c2b5f4965964c47587a3b09751fd20031058413ed7b53",
  "0003_source_runtime.sql": "964cde32cb2dd43e308d7cfdf96b73f715d3112dd95dbc1b5ca4be3682c6d025",
  "0003_destination_rehearsal.sql": "17001360f0b99e0ebef9e6a76dd43a4c6f5aa12f49aab8c3eaf4d45c6de507bd",
  "0003_source_rehearsal.sql": "7b22fe97804a38c84ebbbb9d51c8c54c8d96abb16004abd441251eec8ee5629c"
});
var digest = (bytes) => createHash10("sha256").update(bytes).digest("hex");
function loadManifest() {
  const result = /* @__PURE__ */ new Map();
  for (const [file, hash3] of Object.entries(MANIFEST)) {
    const bytes = fs3.readFileSync(path5.join(ROOT, "migrations/audit", file));
    requireThat(digest(bytes) === hash3, "MANIFEST_DIGEST_MISMATCH");
    const sql18 = bytes.toString("utf8");
    requireThat((sql18.match(/^BEGIN;$/gm) || []).length === 1 && (sql18.match(/^COMMIT;$/gm) || []).length === 1 && !/^\s*\\/m.test(sql18) && sql18.includes("SET LOCAL lock_timeout='5s'") && sql18.includes("SET LOCAL statement_timeout='60s'"), "SQL_WRAPPER_REJECTED");
    result.set(file, sql18);
  }
  return result;
}
function repositoryCompatibility(text3) {
  const declared = [...text3.matchAll(/\bpgTable\(\s*["']([a-z0-9_]+)["']/g)].map((m) => m[1]);
  return {
    expectedCount: APP_TABLES.length,
    declaredCount: declared.length,
    missingCount: APP_TABLES.filter((t) => !declared.includes(t)).length,
    unexpectedCount: declared.filter((t) => !APP_TABLES.includes(t)).length,
    matches: declared.length === APP_TABLES.length && APP_TABLES.every((t) => declared.includes(t))
  };
}
function selectedSettings(text3, names) {
  return readSettings(text3.split(/\r?\n/).filter((line) => names.some((name) => new RegExp("^\\s*(?:export\\s+)?" + name + "\\s*=").test(line))).join("\n"));
}
var METADATA_SQL = Object.freeze({
  identity: `SELECT current_user=session_user AS no_set_role,current_user='postgres' AS setup_principal,
 current_setting('server_version_num')::integer/10000=17 AS version_17,
 current_setting('server_encoding')='UTF8' AS utf8,
 (SELECT rolcreaterole OR rolsuper FROM pg_catalog.pg_roles WHERE rolname=current_user) AS may_create_roles,
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles r WHERE r.rolname=ANY($1::text[])) AS runtime_names_free,
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname='audit_rehearsal') AS rehearsal_name_free,
 coalesce((SELECT pg_has_role(current_user,r.oid,'MEMBER') FROM pg_catalog.pg_roles r WHERE r.rolname=$2),false) AS setup_owner_member,
 coalesce((SELECT pg_has_role(current_user,r.oid,'USAGE') FROM pg_catalog.pg_roles r WHERE r.rolname=$2),false) AS setup_owner_effective_usage,
 coalesce((SELECT pg_has_role(current_user,r.oid,'SET') FROM pg_catalog.pg_roles r WHERE r.rolname=$2),false) AS setup_owner_may_set,
 (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=current_user) OR
 EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles g ON g.oid=m.roleid
 WHERE m.member=current_user::regrole AND g.rolname=$2 AND m.admin_option) AS setup_owner_admin_option`,
  publicRights: `SELECT
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_namespace n,
 LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a
 WHERE a.grantee=0 AND a.privilege_type='CREATE') AS public_permanent_schema_create_absent,
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_database d,
 LATERAL aclexplode(coalesce(d.datacl,acldefault('d',d.datdba))) a
 WHERE d.datname=current_database() AND a.grantee=0 AND a.privilege_type='CREATE') AS public_database_create_absent`,
  source: `SELECT
 (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname=ANY($1::text[]))=16 AS app_tables_present,
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN ('r','p') AND NOT c.relname=ANY($1::text[])) AS no_unreviewed_app_tables,
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname=ANY($1::text[]) AND
 (c.relkind<>'r' OR NOT c.relrowsecurity OR c.relowner<>current_user::regrole)) AS app_owner_rls_match,
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy p JOIN pg_catalog.pg_class c ON c.oid=p.polrelid
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
 AND c.relname=ANY($1::text[]) AND (NOT p.polpermissive OR p.polname='fmt_app_server')) AS app_policy_compatible,
 (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind='S' AND c.relname=ANY($2::text[]))=10 AS app_sequences_present,
 EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='audit_capture' AND c.relname='audit_outbox' AND c.relkind='r') AS outbox_present,
 EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='audit_capture' AND p.proname='enqueue' AND p.pronargs=3
 AND oidvectortypes(p.proargtypes)='text, text, text') AS enqueue_present,
 EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='audit_capture' AND p.proname='claim' AND p.pronargs=1
 AND oidvectortypes(p.proargtypes)='integer') AS claim_present`,
  destination: `SELECT NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname IN ('users','bookings')) AS independent_destination,
 EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='audit' AND c.relname='events' AND c.relkind='r') AS events_present,
 EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='audit' AND p.proname='accept' AND p.pronargs=3
 AND oidvectortypes(p.proargtypes)='text, text, text') AS accept_present`,
  logging: `SELECT
 coalesce((SELECT setting='none' FROM pg_catalog.pg_settings WHERE name='log_statement'),false) AS no_statement_logging,
 coalesce((SELECT setting='-1' FROM pg_catalog.pg_settings WHERE name='log_min_duration_statement'),false) AS no_duration_statement_logging,
 coalesce((SELECT setting='-1' FROM pg_catalog.pg_settings WHERE name='log_min_duration_sample'),false) AS no_sampled_statement_logging,
 coalesce((SELECT setting='0' FROM pg_catalog.pg_settings WHERE name='log_statement_sample_rate'),false) AS no_sample_rate,
 coalesce((SELECT setting='0' FROM pg_catalog.pg_settings WHERE name='log_parameter_max_length_on_error'),false) AS no_error_parameters,
 coalesce((SELECT setting='none' FROM pg_catalog.pg_settings WHERE name='pgaudit.log'),false) AS pgaudit_known_disabled`,
  runtimeRoles: `WITH expected AS (SELECT * FROM jsonb_to_recordset($1::jsonb)
 AS e(name text,groups text[],app boolean)) SELECT
 (SELECT count(*) FROM expected e JOIN pg_catalog.pg_roles r ON r.rolname=e.name)=jsonb_array_length($1::jsonb) AS runtime_roles_present,
 NOT EXISTS(SELECT 1 FROM expected e JOIN pg_catalog.pg_roles r ON r.rolname=e.name
 CROSS JOIN LATERAL unnest(e.groups) required(name) WHERE NOT EXISTS
 (SELECT 1 FROM pg_catalog.pg_roles g WHERE g.rolname=required.name
 AND pg_has_role(r.oid,g.oid,'MEMBER') AND pg_has_role(r.oid,g.oid,'USAGE') AND pg_has_role(r.oid,g.oid,'SET'))) AS runtime_required_groups_effective,
 NOT EXISTS(SELECT 1 FROM expected e JOIN pg_catalog.pg_roles r ON r.rolname=e.name
 JOIN pg_catalog.pg_auth_members m ON m.member=r.oid WHERE m.admin_option) AS runtime_no_membership_admin,
 NOT EXISTS(SELECT 1 FROM expected e JOIN pg_catalog.pg_roles r ON r.rolname=e.name
 WHERE r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls) AS runtime_attributes_restricted,
 NOT EXISTS(SELECT 1 FROM expected e JOIN pg_catalog.pg_roles r ON r.rolname=e.name
 CROSS JOIN pg_catalog.pg_roles g WHERE g.oid<>r.oid AND NOT g.rolname=ANY(e.groups)
 AND pg_has_role(r.oid,g.oid,'MEMBER')) AS runtime_memberships_restricted,
 NOT EXISTS(SELECT 1 FROM expected e JOIN pg_catalog.pg_roles r ON r.rolname=e.name
 CROSS JOIN pg_catalog.pg_namespace n WHERE has_schema_privilege(r.oid,n.oid,'CREATE')) AS runtime_schema_create_absent,
 NOT EXISTS(SELECT 1 FROM expected e JOIN pg_catalog.pg_roles r ON r.rolname=e.name
 WHERE has_database_privilege(r.oid,current_database(),'CREATE')) AS runtime_database_create_absent,
 NOT EXISTS(SELECT 1 FROM expected e JOIN pg_catalog.pg_roles r ON r.rolname=e.name
 WHERE EXISTS(SELECT 1 FROM pg_catalog.pg_class WHERE relowner=r.oid)
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_namespace WHERE nspowner=r.oid)) AS runtime_ownership_absent,
 NOT EXISTS(SELECT 1 FROM expected e JOIN pg_catalog.pg_roles r ON r.rolname=e.name
 CROSS JOIN pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE c.relkind IN ('r','p') AND n.nspname IN ('audit','audit_capture','audit_rehearsal')
 AND has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) AS runtime_audit_base_access_absent,
 NOT EXISTS(SELECT 1 FROM expected e JOIN pg_catalog.pg_roles r ON r.rolname=e.name
 CROSS JOIN pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE NOT e.app AND c.relkind IN ('r','p') AND n.nspname='public'
 AND has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) AS independent_accounts_no_business_access`
});
function booleanSnapshot(result) {
  requireThat(result.rows.length === 1, "METADATA_SHAPE_REJECTED");
  const row = result.rows[0];
  requireThat(Object.values(row).every((v) => typeof v === "boolean"), "METADATA_BOOLEAN_REQUIRED");
  return row;
}
async function inspectMetadata(x, target2) {
  await x.query("BEGIN READ ONLY");
  try {
    await x.query("SET LOCAL statement_timeout='10s'; SET LOCAL lock_timeout='1s'; SET LOCAL idle_in_transaction_session_timeout='15s'");
    const names = target2 === "source" ? [ROLES.app, ROLES.capture, ROLES.worker, ROLES.test, "fm_app_runtime"] : [ROLES.writer, ROLES.test];
    const owner = target2 === "source" ? "fm_audit_source_owner" : "fm_audit_destination_owner";
    const identity2 = booleanSnapshot(await x.query(METADATA_SQL.identity, [names, owner]));
    requireThat(identity2.no_set_role && identity2.setup_principal && identity2.version_17 && identity2.utf8, "SETUP_IDENTITY_REJECTED");
    const rights2 = booleanSnapshot(await x.query(METADATA_SQL.publicRights));
    const schema = booleanSnapshot(await x.query(METADATA_SQL[target2], target2 === "source" ? [APP_TABLES, APP_SEQUENCES] : []));
    const logging = booleanSnapshot(await x.query(METADATA_SQL.logging));
    const expected = target2 === "source" ? [
      { name: ROLES.app, groups: ["fm_app_runtime", "fm_audit_capture"], app: true },
      { name: ROLES.capture, groups: ["fm_audit_capture"], app: false },
      { name: ROLES.worker, groups: ["fm_audit_delivery", "fm_audit_source_monitor"], app: false },
      { name: ROLES.test, groups: [], app: false }
    ] : [
      { name: ROLES.writer, groups: ["fm_audit_writer"], app: false },
      { name: ROLES.test, groups: [], app: false }
    ];
    const runtime2 = booleanSnapshot(await x.query(METADATA_SQL.runtimeRoles, [JSON.stringify(expected)]));
    return { identity: identity2, rights: rights2, schema, logging, runtime: runtime2 };
  } finally {
    await x.query("ROLLBACK");
  }
}
async function inspectPair(configs, cas, onResult, { makeClient = client, open = connect, inspect = inspectMetadata } = {}) {
  const clients = [];
  try {
    for (const target2 of ["destination", "source"]) {
      const x = await makeClient(configs[target2], target2, cas[target2]);
      clients.push(x);
      await open(x);
      const metadata = await inspect(x, target2);
      await onResult(target2, metadata);
    }
  } finally {
    for (const x of clients) try {
      await x.end();
    } catch {
    }
  }
}
function offline() {
  const files2 = loadManifest();
  assert.equal(EVENT_IDS.length, 12);
  assert.equal(new Set(EVENT_IDS).size, 12);
  for (const target2 of ["source", "destination"]) {
    const role = target2 === "source" ? ROLES.worker : ROLES.writer;
    const url = `postgresql://${role}:synthetic@db.${TARGETS[target2]}.supabase.co/postgres?sslmode=verify-full`;
    assert.equal(connection(url, target2, role).principal, role);
    for (const bad of [
      url.replace("/postgres", "/other"),
      url.replace(":synthetic", ":%0A"),
      url.replace("?sslmode=verify-full", "?sslmode=disable"),
      url + "&sslmode=verify-full",
      url + "&host=evil.invalid",
      url.replace(role, "postgres"),
      url.replace(".supabase.co/", ".supabase.co:6543/")
    ])
      assert.throws(() => connection(bad, target2, role));
    assert.throws(() => connection(url, target2 === "source" ? "destination" : "source", role));
  }
  assert.deepEqual(readSettings(`X="a\\\\b"
Y='value'`), { X: "a\\b", Y: "value" });
  for (const text3 of ["X=a\nX=b", 'X="bad', "X=a #comment", 'X="line\\nsecret"']) assert.throws(() => readSettings(text3));
  assert.deepEqual(selectedSettings('IGNORED="bad\nX=value', ["X"]), { X: "value" });
  assert.equal(repositoryCompatibility(APP_TABLES.map((t) => `pgTable("${t}", {})`).join("\n")).matches, true);
  assert.equal(repositoryCompatibility('pgTable("user_search_locations", {})').matches, false);
  assert.throws(() => booleanSnapshot({ rows: [{ ok: null }] }));
  const state = repositoryCompatibility(fs3.readFileSync(path5.join(ROOT, "shared/schema.ts"), "utf8"));
  emit("offline", {
    status: "passed",
    files: [...files2.keys()],
    runId: RUN_ID,
    repository: state,
    databaseAccess: false,
    privateFileAccess: false,
    sqlExecuted: false,
    mutationModes: [],
    requiresBeforeMutation: ["location-table-choice", "private-provisioning-review", "live-metadata-and-provider-logging-review"]
  });
  return state;
}
function loadPrivateConfiguration() {
  const sid = privatePreflight();
  const dedicated = fs3.existsSync(privatePath(".env.audit-setup.local"));
  const names = dedicated ? ["AUDIT_SETUP_SOURCE_DATABASE_URL", "AUDIT_SETUP_DESTINATION_DATABASE_URL"] : ["DATABASE_URL", "AUDIT_DATABASE_URL"];
  const settings = selectedSettings(privateRead(dedicated ? ".env.audit-setup.local" : ".env", sid), names);
  const configs = { source: settings[names[0]], destination: settings[names[1]] };
  const sourceConfig = connection(configs.source, "source");
  const destinationConfig = connection(configs.destination, "destination");
  const cas = { source: trustedCA(sourceConfig) };
  const destinationHasCA = destinationConfig.u.searchParams.has("sslrootcert");
  cas.destination = destinationHasCA ? trustedCA(destinationConfig) : cas.source;
  return { configs, cas, destinationHasCA };
}
async function main() {
  const mode = process.argv[2];
  requireThat(process.argv.length === 3 && ["offline", "preflight"].includes(mode), "MODE_REJECTED");
  if (mode === "offline") {
    offline();
    return;
  }
  loadManifest();
  const repository = repositoryCompatibility(fs3.readFileSync(path5.join(ROOT, "shared/schema.ts"), "utf8"));
  const { configs, cas, destinationHasCA } = loadPrivateConfiguration();
  await inspectPair(configs, cas, (target2, metadata) => {
    emit("metadata-preflight", {
      target: target2,
      projectRef: TARGETS[target2],
      tlsVerified: true,
      trustSource: target2 === "destination" && !destinationHasCA ? "existing-pinned-source-provider-root" : "explicit-pinned-provider-root",
      repository,
      ...metadata,
      activationReady: false,
      mutationsPerformed: false,
      note: "Catalog observations only; password/provider logging, capacity and private handoff still require review."
    });
  });
}
if (process.argv[1] && pathToFileURL(path5.resolve(process.argv[1])).href === import.meta.url) {
  try {
    await main();
  } catch (e) {
    emit("stopped", { code: safeCode(e) });
    process.exitCode = 1;
  }
}

// migrations/audit/execute-runtime-disabled.mjs
var RUNTIME_FILES = Object.freeze({ destination: "0003_destination_runtime.sql", source: "0003_source_runtime.sql" });
var MIGRATION_TIMEOUT_MS = 18e4;
var PRECOMMIT_ERRORS = /* @__PURE__ */ new Set(["42501", "42710", "42704", "42P01", "42883", "42601", "23505", "23503", "23514", "P0001", "55P03"]);
var BASELINE = Object.freeze({
  "_contract_v1.sql": "030f81d453a22216719cefdd550e052df558ec89dc99334b92460e86ee3ae64b",
  "0001_source.sql": "2cdd5712867a328779dd3062d7344ce69459594ca4405bfffbea21394838978a",
  "0001_destination.sql": "13c44e20635125ab0918f1acc5c4424a0bf64b36b2945f2a336497b3eacf3381"
});
var hash2 = (value) => createHash11("sha256").update(value).digest("hex");
var INACCESSIBLE_PROVIDER_VIEW = `r.rolname IN ('fm_app_runtime','fmt_app_dev','fmt_audit_capture_dev','fmt_audit_worker_dev','fmt_audit_writer_dev')
 AND n.nspname='extensions' AND c.relname IN ('pg_stat_statements','pg_stat_statements_info')
 AND c.relkind='v' AND c.relowner=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='postgres')
 AND NOT has_schema_privilege(r.oid,n.oid,'USAGE')
 AND EXISTS(SELECT 1 FROM aclexplode(c.relacl) a JOIN pg_catalog.pg_roles grantor ON grantor.oid=a.grantor
 WHERE a.grantee=0 AND a.privilege_type='SELECT' AND NOT a.is_grantable AND grantor.rolname='postgres')
 AND NOT EXISTS(SELECT 1 FROM aclexplode(c.relacl) a
 WHERE CASE WHEN a.grantee=0 THEN true ELSE pg_has_role(r.oid,a.grantee,'USAGE') END
 AND NOT (a.grantee=0 AND a.privilege_type='SELECT' AND NOT a.is_grantable
 AND a.grantor=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='postgres')))
 AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute attribute CROSS JOIN LATERAL aclexplode(attribute.attacl) a
 WHERE attribute.attrelid=c.oid AND attribute.attnum>0 AND NOT attribute.attisdropped
 AND CASE WHEN a.grantee=0 THEN true ELSE pg_has_role(r.oid,a.grantee,'USAGE') END)`;
var INACCESSIBLE_SOURCE_CRON = `r.rolname IN ('fm_app_runtime','fmt_app_dev','fmt_audit_capture_dev','fmt_audit_worker_dev')
 AND n.nspname='cron' AND c.relowner=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='supabase_admin')
 AND NOT has_schema_privilege(r.oid,n.oid,'USAGE')`;
var INACCESSIBLE_CRON_RELATION = `${INACCESSIBLE_SOURCE_CRON}
 AND c.relkind='r' AND c.relname IN ('job','job_run_details')
 AND (SELECT count(*) FROM aclexplode(c.relacl) a WHERE a.grantee=0
 AND a.privilege_type=ANY(CASE WHEN c.relname='job' THEN ARRAY['SELECT'] ELSE ARRAY['SELECT','DELETE'] END)
 AND NOT a.is_grantable AND a.grantor=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='supabase_admin'))
 =CASE WHEN c.relname='job' THEN 1 ELSE 2 END
 AND NOT EXISTS(SELECT 1 FROM aclexplode(c.relacl) a
 WHERE CASE WHEN a.grantee=0 THEN true ELSE pg_has_role(r.oid,a.grantee,'USAGE') END
 AND NOT(a.grantee=0 AND a.privilege_type=ANY(CASE WHEN c.relname='job' THEN ARRAY['SELECT'] ELSE ARRAY['SELECT','DELETE'] END)
 AND NOT a.is_grantable AND a.grantor=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='supabase_admin')))
 AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute attribute CROSS JOIN LATERAL aclexplode(attribute.attacl) a
 WHERE attribute.attrelid=c.oid AND attribute.attnum>0 AND NOT attribute.attisdropped
 AND CASE WHEN a.grantee=0 THEN true ELSE pg_has_role(r.oid,a.grantee,'USAGE') END)`;
var INACCESSIBLE_CRON_SEQUENCE = `${INACCESSIBLE_SOURCE_CRON}
 AND c.relkind='S' AND c.relname IN ('jobid_seq','runid_seq')
 AND EXISTS(SELECT 1 FROM aclexplode(c.relacl) a WHERE a.grantee=0 AND a.privilege_type='SELECT'
 AND NOT a.is_grantable AND a.grantor=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='supabase_admin'))
 AND NOT EXISTS(SELECT 1 FROM aclexplode(c.relacl) a
 WHERE CASE WHEN a.grantee=0 THEN true ELSE pg_has_role(r.oid,a.grantee,'USAGE') END
 AND NOT(a.grantee=0 AND a.privilege_type='SELECT' AND NOT a.is_grantable
 AND a.grantor=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='supabase_admin')))`;
function installedFunctionContracts(target2) {
  const entries = [];
  for (const file of ["_contract_v1.sql", `0001_${target2}.sql`]) {
    const bytes = fs4.readFileSync(path6.join(ROOT, "migrations/audit", file));
    requireThat(hash2(bytes) === BASELINE[file], "BASELINE_DIGEST_MISMATCH");
    const text3 = bytes.toString("utf8").replaceAll("\r\n", "\n");
    const declarations = [...text3.matchAll(/CREATE FUNCTION ([a-z_]+)\.([a-z_]+)\(([\s\S]*?)\)\s*([\s\S]*?)AS \$\$([\s\S]*?)\$\$;/g)];
    requireThat(declarations.length >= 3, "BASELINE_FUNCTION_EXTRACTION_FAILED");
    for (const [, schema, name, args, header, body] of declarations) {
      entries.push({
        schema,
        name,
        args: args.split(",").map((a) => a.trim().split(/\s+/)[1]).join(", "),
        owner: schema === "audit_contract" ? "fm_audit_contract_owner" : `fm_audit_${target2}_owner`,
        body_hash: hash2(body),
        definer: /\bSECURITY DEFINER\b/.test(header),
        language: header.match(/\bLANGUAGE (sql|plpgsql)\b/)?.[1],
        volatility: /\bIMMUTABLE\b/.test(header) ? "i" : /\bSTABLE\b/.test(header) ? "s" : "v"
      });
    }
  }
  requireThat(entries.length === (target2 === "source" ? 15 : 8), "BASELINE_FUNCTION_COUNT_REJECTED");
  return entries;
}
var INSTALL_SQL = Object.freeze({
  installedSourcePolicies: `SELECT NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy p
 JOIN pg_catalog.pg_class c ON c.oid=p.polrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname=ANY($1::text[]) AND NOT p.polpermissive) AS no_restrictive_application_policies`,
  sourceProviderBaseline: `SELECT
 (SELECT count(*) FROM pg_catalog.pg_roles r CROSS JOIN pg_catalog.pg_class c
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE ${INACCESSIBLE_CRON_RELATION})=8 AS exact_inaccessible_cron_relations,
 (SELECT count(*) FROM pg_catalog.pg_roles r CROSS JOIN pg_catalog.pg_class c
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE ${INACCESSIBLE_CRON_SEQUENCE})=8 AS exact_inaccessible_cron_sequences`,
  sourceInheritedAccess: `WITH inherited AS (SELECT oid FROM pg_catalog.pg_roles
 WHERE rolname IN ('fm_audit_capture','fm_audit_delivery','fm_audit_source_monitor')) SELECT
 NOT EXISTS(SELECT 1 FROM inherited r CROSS JOIN pg_catalog.pg_class c
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='extensions' AND c.relname IN ('pg_stat_statements','pg_stat_statements_info')
 AND has_schema_privilege(r.oid,n.oid,'USAGE') AND has_table_privilege(r.oid,c.oid,'SELECT')) AS provider_views_not_usable_via_current_groups_or_public,
 NOT EXISTS(SELECT 1 FROM inherited r CROSS JOIN pg_catalog.pg_proc p
 JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='purge_expired_geocoding'
 AND has_function_privilege(r.oid,p.oid,'EXECUTE')) AS geocoding_maintenance_not_inherited`,
  destinationProviderBaseline: `SELECT (SELECT count(*) FROM pg_catalog.pg_roles r
 CROSS JOIN pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE r.rolname='fmt_audit_writer_dev' AND ${INACCESSIBLE_PROVIDER_VIEW})=2 AS exact_inaccessible_provider_baseline`,
  ownerMemberships: `SELECT m.roleid::text,m.member::text,m.grantor::text,m.admin_option,m.inherit_option,m.set_option
 FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles r ON r.oid=m.roleid
 WHERE r.rolname=$1 AND m.member=current_user::regrole ORDER BY m.grantor`,
  functions: `WITH expected AS (SELECT * FROM jsonb_to_recordset($1::jsonb)
 AS e(schema text,name text,args text,owner text,body_hash text,definer boolean,language text,volatility text))
 SELECT NOT EXISTS(SELECT 1 FROM expected e WHERE NOT EXISTS(
 SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 JOIN pg_catalog.pg_roles r ON r.oid=p.proowner JOIN pg_catalog.pg_language l ON l.oid=p.prolang
 WHERE n.nspname=e.schema AND p.proname=e.name AND oidvectortypes(p.proargtypes)=e.args
 AND p.prokind='f' AND r.rolname=e.owner AND p.prosecdef=e.definer AND l.lanname=e.language
 AND NOT (r.rolcanlogin OR r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls)
 AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m WHERE m.member=r.oid)
 AND p.provolatile::text=e.volatility AND NOT p.proisstrict AND cardinality(p.proconfig)=1
 AND regexp_replace(p.proconfig[1],'[[:space:]]','','g')='search_path=pg_catalog,pg_temp'
 AND encode(sha256(convert_to(replace(p.prosrc,chr(13)||chr(10),chr(10)),'UTF8')),'hex')=e.body_hash
 )) AS installed_function_contracts_match`,
  groups: `SELECT (SELECT count(*) FROM pg_catalog.pg_roles WHERE rolname=ANY($1::text[]))=cardinality($1::text[]) AS base_groups_present,
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles r WHERE r.rolname=ANY($1::text[])
 AND (r.rolcanlogin OR r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m WHERE m.member=r.oid)
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_class c WHERE c.relowner=r.oid)
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_namespace n WHERE n.nspowner=r.oid))) AS base_groups_restricted`,
  roleState: `WITH expected AS (SELECT * FROM jsonb_to_recordset($1::jsonb) AS e(name text,cap integer,groups text[])) SELECT
 (SELECT count(*) FROM expected e JOIN pg_catalog.pg_roles r ON r.rolname=e.name)=jsonb_array_length($1::jsonb) AS all_runtime_roles_present,
 NOT EXISTS(SELECT 1 FROM expected e JOIN pg_catalog.pg_roles r ON r.rolname=e.name
 WHERE r.rolcanlogin OR r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls
 OR r.rolconnlimit<>e.cap OR NOT r.rolinherit) AS all_disabled_restricted,
 NOT EXISTS(SELECT 1 FROM expected e JOIN pg_catalog.pg_roles r ON r.rolname=e.name
 WHERE EXISTS(SELECT 1 FROM pg_catalog.pg_class c WHERE c.relowner=r.oid)
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_namespace n WHERE n.nspowner=r.oid)
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_namespace n WHERE has_schema_privilege(r.oid,n.oid,'CREATE'))
 OR has_database_privilege(r.oid,current_database(),'CREATE')) AS no_runtime_ownership_or_ddl,
 NOT EXISTS(SELECT 1 FROM expected e JOIN pg_catalog.pg_roles r ON r.rolname=e.name
 JOIN pg_catalog.pg_auth_members m ON m.member=r.oid JOIN pg_catalog.pg_roles g ON g.oid=m.roleid
 WHERE NOT g.rolname=ANY(e.groups) OR m.admin_option OR NOT m.inherit_option OR NOT m.set_option) AS no_unexpected_memberships,
 NOT EXISTS(SELECT 1 FROM expected e JOIN pg_catalog.pg_roles r ON r.rolname=e.name CROSS JOIN LATERAL unnest(e.groups) g(name)
 WHERE NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles p JOIN pg_catalog.pg_auth_members m ON m.roleid=p.oid
 WHERE p.rolname=g.name AND m.member=r.oid AND NOT m.admin_option AND m.inherit_option AND m.set_option)) AS required_memberships_present,
 NOT EXISTS(SELECT 1 FROM expected target JOIN pg_catalog.pg_roles r ON r.rolname=target.name
 JOIN pg_catalog.pg_auth_members m ON m.roleid=r.oid JOIN pg_catalog.pg_roles member_role ON member_role.oid=m.member
 WHERE NOT (m.member=current_user::regrole AND m.admin_option AND NOT m.inherit_option AND NOT m.set_option)
 AND NOT EXISTS(SELECT 1 FROM expected member_expected WHERE member_expected.name=member_role.rolname
 AND target.name=ANY(member_expected.groups) AND NOT m.admin_option AND m.inherit_option AND m.set_option)) AS no_unexpected_runtime_delegation,
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
 JOIN pg_catalog.pg_roles r ON r.oid=a.grantee WHERE r.rolname IN (SELECT name FROM expected)) AS no_future_object_grants,
 NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='fmt_audit_test_dev')
 AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname='audit_rehearsal') AS rehearsal_not_installed`,
  relations: `WITH roles AS (SELECT * FROM unnest($1::text[]) names(name)), expected AS
 (SELECT * FROM jsonb_to_recordset($2::jsonb) AS e(role text,schema text,name text,rights text[])),
 inaccessible_provider_views AS (SELECT r.oid AS role_oid,c.oid AS relation_oid,
 CASE WHEN n.nspname='cron' AND c.relname='job_run_details' THEN ARRAY['SELECT','DELETE'] ELSE ARRAY['SELECT'] END AS allowed_rights
 FROM roles e JOIN pg_catalog.pg_roles r ON r.rolname=e.name CROSS JOIN pg_catalog.pg_class c
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE (${INACCESSIBLE_PROVIDER_VIEW}) OR (${INACCESSIBLE_CRON_RELATION})) SELECT
 NOT EXISTS(SELECT 1 FROM expected e JOIN pg_catalog.pg_roles r ON r.rolname=e.role CROSS JOIN LATERAL unnest(e.rights) needed(privilege)
 WHERE NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname=e.schema AND c.relname=e.name AND c.relkind IN ('r','p','v','m','f')
 AND has_schema_privilege(r.oid,n.oid,'USAGE') AND has_table_privilege(r.oid,c.oid,needed.privilege))) AS required_relation_privileges,
 NOT EXISTS(SELECT 1 FROM roles e JOIN pg_catalog.pg_roles r ON r.rolname=e.name
 CROSS JOIN pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) needed(privilege)
 WHERE c.relkind IN ('r','p','v','m','f') AND n.nspname NOT IN ('pg_catalog','information_schema')
 AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp%'
 AND has_table_privilege(r.oid,c.oid,needed.privilege) AND NOT EXISTS
 (SELECT 1 FROM expected a WHERE a.role=e.name AND a.schema=n.nspname AND a.name=c.relname AND needed.privilege=ANY(a.rights))
 AND NOT EXISTS(SELECT 1 FROM inaccessible_provider_views baseline
 WHERE baseline.role_oid=r.oid AND baseline.relation_oid=c.oid AND needed.privilege=ANY(baseline.allowed_rights))) AS no_unreviewed_relation_privileges,
 NOT EXISTS(SELECT 1 FROM roles e JOIN pg_catalog.pg_roles r ON r.rolname=e.name
 CROSS JOIN pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 JOIN pg_catalog.pg_attribute col ON col.attrelid=c.oid AND col.attnum>0 AND NOT col.attisdropped
 CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','REFERENCES']) needed(privilege)
 WHERE c.relkind IN ('r','p','v','m','f') AND n.nspname NOT IN ('pg_catalog','information_schema')
 AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp%'
 AND has_column_privilege(r.oid,c.oid,col.attnum,needed.privilege)
 AND NOT EXISTS(SELECT 1 FROM expected a WHERE a.role=e.name AND a.schema=n.nspname AND a.name=c.relname
 AND needed.privilege=ANY(a.rights))
 AND NOT (needed.privilege='SELECT' AND has_table_privilege(r.oid,c.oid,'SELECT')
 AND EXISTS(SELECT 1 FROM inaccessible_provider_views baseline
 WHERE baseline.role_oid=r.oid AND baseline.relation_oid=c.oid))) AS no_unreviewed_column_privileges`,
  grantOptions: `WITH roles AS (SELECT r.oid FROM pg_catalog.pg_roles r WHERE r.rolname=ANY($1::text[])) SELECT
 NOT EXISTS(SELECT 1 FROM roles r CROSS JOIN pg_catalog.pg_namespace n
 WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp%'
 AND (has_schema_privilege(r.oid,n.oid,'USAGE WITH GRANT OPTION') OR has_schema_privilege(r.oid,n.oid,'CREATE WITH GRANT OPTION'))) AS no_schema_grant_options,
 NOT EXISTS(SELECT 1 FROM roles r CROSS JOIN pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) needed(privilege)
 WHERE c.relkind IN ('r','p','v','m','f') AND n.nspname NOT IN ('pg_catalog','information_schema')
 AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp%'
 AND has_table_privilege(r.oid,c.oid,needed.privilege||' WITH GRANT OPTION')) AS no_relation_grant_options,
 NOT EXISTS(SELECT 1 FROM roles r CROSS JOIN pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 JOIN pg_catalog.pg_attribute col ON col.attrelid=c.oid AND col.attnum>0 AND NOT col.attisdropped
 CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','REFERENCES']) needed(privilege)
 WHERE c.relkind IN ('r','p','v','m','f') AND n.nspname NOT IN ('pg_catalog','information_schema')
 AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp%'
 AND has_column_privilege(r.oid,c.oid,col.attnum,needed.privilege||' WITH GRANT OPTION')) AS no_column_grant_options,
 NOT EXISTS(SELECT 1 FROM roles r CROSS JOIN pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 CROSS JOIN unnest(ARRAY['USAGE','SELECT','UPDATE']) needed(privilege)
 WHERE c.relkind='S' AND n.nspname NOT IN ('pg_catalog','information_schema')
 AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp%'
 AND has_sequence_privilege(r.oid,c.oid,needed.privilege||' WITH GRANT OPTION')) AS no_sequence_grant_options,
 NOT EXISTS(SELECT 1 FROM roles r CROSS JOIN pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp%'
 AND has_function_privilege(r.oid,p.oid,'EXECUTE WITH GRANT OPTION')) AS no_function_grant_options,
 NOT EXISTS(SELECT 1 FROM roles r CROSS JOIN unnest(ARRAY['CONNECT','CREATE','TEMPORARY']) needed(privilege)
 WHERE has_database_privilege(r.oid,current_database(),needed.privilege||' WITH GRANT OPTION')) AS no_database_grant_options`,
  sequences: `SELECT
 NOT EXISTS(SELECT 1 FROM unnest($1::text[]) names(name) JOIN pg_catalog.pg_roles r ON r.rolname=names.name
 CROSS JOIN pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 CROSS JOIN unnest(ARRAY['USAGE','SELECT','UPDATE']) rights(privilege)
 WHERE c.relkind='S' AND n.nspname NOT IN ('pg_catalog','information_schema')
 AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp%'
 AND has_sequence_privilege(r.oid,c.oid,rights.privilege)
 AND NOT (names.name=ANY($2::text[]) AND n.nspname='public' AND c.relname=ANY($3::text[]) AND rights.privilege='USAGE')
 AND NOT(rights.privilege='SELECT' AND (${INACCESSIBLE_CRON_SEQUENCE}))) AS no_unreviewed_sequence_privileges,
 NOT EXISTS(SELECT 1 FROM unnest($2::text[]) roles(name) JOIN pg_catalog.pg_roles r ON r.rolname=roles.name
 CROSS JOIN unnest($3::text[]) seq(name) WHERE NOT EXISTS
 (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname=seq.name AND c.relkind='S' AND has_sequence_privilege(r.oid,c.oid,'USAGE'))) AS required_sequence_usage`,
  entrypoints: `WITH roles AS (SELECT * FROM unnest($1::text[]) r(name)), expected AS
 (SELECT * FROM jsonb_to_recordset($2::jsonb) AS e(role text,schema text,name text,args text)) SELECT
 NOT EXISTS(SELECT 1 FROM expected e JOIN pg_catalog.pg_roles r ON r.rolname=e.role WHERE NOT EXISTS
 (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname=e.schema AND p.proname=e.name AND oidvectortypes(p.proargtypes)=e.args
 AND has_schema_privilege(r.oid,n.oid,'USAGE') AND has_function_privilege(r.oid,p.oid,'EXECUTE'))) AS required_entrypoints,
 NOT EXISTS(SELECT 1 FROM roles e JOIN pg_catalog.pg_roles r ON r.rolname=e.name
 CROSS JOIN pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN ('audit','audit_capture','audit_contract') AND has_function_privilege(r.oid,p.oid,'EXECUTE')
 AND NOT EXISTS(SELECT 1 FROM expected a WHERE a.role=e.name AND a.schema=n.nspname AND a.name=p.proname
 AND a.args=oidvectortypes(p.proargtypes))) AS no_extra_audit_entrypoints,
 NOT EXISTS(SELECT 1 FROM roles e JOIN pg_catalog.pg_roles r ON r.rolname=e.name
 CROSS JOIN pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='purge_expired_geocoding' AND has_function_privilege(r.oid,p.oid,'EXECUTE')) AS no_geocoding_maintenance`,
  policies: `SELECT (SELECT count(*) FROM pg_catalog.pg_policy p JOIN pg_catalog.pg_class c ON c.oid=p.polrelid
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY($1::text[])
 AND p.polname='fmt_app_server' AND p.polcmd='*' AND p.polpermissive
 AND p.polroles=ARRAY['fm_app_runtime'::regrole::oid] AND pg_get_expr(p.polqual,p.polrelid)='true'
 AND pg_get_expr(p.polwithcheck,p.polrelid)='true' AND c.relrowsecurity)=16 AS exact_runtime_policies`
});
function roleContracts(target2) {
  return target2 === "source" ? [
    { name: "fm_app_runtime", cap: -1, groups: [] },
    { name: ROLES.app, cap: 5, groups: ["fm_app_runtime", "fm_audit_capture"] },
    { name: ROLES.capture, cap: 2, groups: ["fm_audit_capture"] },
    { name: ROLES.worker, cap: 2, groups: ["fm_audit_delivery", "fm_audit_source_monitor"] }
  ] : [{ name: ROLES.writer, cap: 2, groups: ["fm_audit_writer"] }];
}
function relationContracts(target2) {
  if (target2 === "destination") return [];
  return ["fm_app_runtime", ROLES.app].flatMap((role) => APP_TABLES.map((name) => ({
    role,
    schema: "public",
    name,
    rights: ["SELECT", "INSERT", "UPDATE", ...DELETE_TABLES.includes(name) ? ["DELETE"] : []]
  }))).concat(
    ["delivery_health", "maintenance_history"].map((name) => ({ role: ROLES.worker, schema: "audit_capture", name, rights: ["SELECT"] }))
  );
}
function entryContracts(target2) {
  if (target2 === "destination") return [{ role: ROLES.writer, schema: "audit", name: "accept", args: "text, text, text" }];
  return [ROLES.app, ROLES.capture].map((role) => ({ role, schema: "audit_capture", name: "enqueue", args: "text, text, text" })).concat(
    [["claim", "integer"], ["ack", "uuid, uuid"], ["retry", "uuid, uuid, text, integer"], ["quarantine", "uuid, uuid, text"]].map(([name, args]) => ({ role: ROLES.worker, schema: "audit_capture", name, args }))
  );
}
function requireBooleans(result, code) {
  const row = booleanSnapshot(result);
  requireThat(Object.values(row).every((v) => v === true), code);
  return row;
}
function assertInstallPreflight(snapshot) {
  for (const key of ["no_set_role", "setup_principal", "version_17", "utf8", "may_create_roles", "runtime_names_free", "rehearsal_name_free", "setup_owner_admin_option"])
    requireThat(snapshot.identity[key] === true, "INSTALL_IDENTITY_OR_COLLISION_REJECTED");
  requireThat(snapshot.identity.setup_owner_effective_usage === false && snapshot.identity.setup_owner_may_set === false, "SETUP_OWNER_ACCESS_REJECTED");
  requireThat(Object.values(snapshot.rights).every((v) => v === true) && Object.values(snapshot.schema).every((v) => v === true), "INSTALL_SCHEMA_OR_RIGHTS_REJECTED");
}
async function readonly(x, work) {
  await x.query("BEGIN READ ONLY");
  try {
    return await work();
  } finally {
    await x.query("ROLLBACK");
  }
}
async function preflightInstall(x, target2) {
  const snapshot = await inspectMetadata(x, target2);
  assertInstallPreflight(snapshot);
  return readonly(x, async () => {
    const groups = target2 === "source" ? ["fm_audit_capture", "fm_audit_delivery", "fm_audit_source_monitor"] : ["fm_audit_writer"];
    requireBooleans(await x.query(INSTALL_SQL.groups, [groups]), "BASE_GROUPS_REJECTED");
    if (target2 === "source") requireBooleans(await x.query(INSTALL_SQL.sourceInheritedAccess), "SOURCE_INHERITED_ACCESS_REJECTED");
    requireBooleans(await x.query(INSTALL_SQL.functions, [JSON.stringify(installedFunctionContracts(target2))]), "INSTALLED_FUNCTIONS_REJECTED");
    const memberships = (await x.query(INSTALL_SQL.ownerMemberships, [`fm_audit_${target2}_owner`])).rows;
    requireThat(memberships.length > 0 && memberships.some((r) => r.admin_option === true) && memberships.every((r) => r.inherit_option === false && r.set_option === false), "OWNER_BASELINE_REJECTED");
    return { snapshot, memberships };
  });
}
async function verifyInstalled(x, target2, before) {
  return readonly(x, async () => {
    const roles = roleContracts(target2), names = roles.map((r) => r.name);
    const checks = {};
    for (const [key, sql18, args] of [
      ["roles", INSTALL_SQL.roleState, [JSON.stringify(roles)]],
      ...target2 === "destination" ? [["inaccessibleProviderBaseline", INSTALL_SQL.destinationProviderBaseline, []]] : [],
      ...target2 === "source" ? [["inaccessibleCronBaseline", INSTALL_SQL.sourceProviderBaseline, []]] : [],
      ["relations", INSTALL_SQL.relations, [names, JSON.stringify(relationContracts(target2))]],
      ["sequences", INSTALL_SQL.sequences, [names, target2 === "source" ? ["fm_app_runtime", ROLES.app] : [], target2 === "source" ? APP_SEQUENCES : []]],
      ["entrypoints", INSTALL_SQL.entrypoints, [names, JSON.stringify(entryContracts(target2))]],
      ["grantOptions", INSTALL_SQL.grantOptions, [names]],
      ...target2 === "source" ? [["policyCompatibility", INSTALL_SQL.installedSourcePolicies, [APP_TABLES]], ["policies", INSTALL_SQL.policies, [APP_TABLES]]] : []
    ]) checks[key] = requireBooleans(await x.query(sql18, args), "INSTALLED_RUNTIME_VERIFICATION_REJECTED");
    const observed = (await x.query(INSTALL_SQL.ownerMemberships, [`fm_audit_${target2}_owner`])).rows;
    requireThat(JSON.stringify(observed) === JSON.stringify(before.memberships), "OWNER_MEMBERSHIP_CHANGED");
    checks.ownerMembershipsPreserved = true;
    return checks;
  });
}
function checkCommit(result) {
  const results = Array.isArray(result) ? result : [result];
  requireThat(results.at(-1)?.command === "COMMIT", "COMMIT_RESULT_UNCERTAIN");
  const receipts = results.filter((r) => r.command === "SELECT" && r.fields?.length === 1 && r.fields[0].name === "runtime_version_recorded");
  requireThat(receipts.length === 1 && receipts[0].rows.length === 1 && receipts[0].rows[0].runtime_version_recorded === true, "VERSION_RECEIPT_REJECTED");
}
async function installDisabled({ configs, cas, scripts, onEvent = () => {
}, makeClient = client, open = connect, preflight = preflightInstall, verify = verifyInstalled }) {
  const connections = {}, before = {}, commits = { destination: "not-attempted", source: "not-attempted" };
  let target2, stage = "preflight";
  try {
    for (target2 of ["destination", "source"]) {
      connections[target2] = await makeClient(configs[target2], target2, cas[target2]);
      await open(connections[target2]);
      before[target2] = await preflight(connections[target2], target2);
      onEvent({ stage: "install-preflight", target: target2, status: "passed" });
    }
    for (target2 of ["destination", "source"]) {
      stage = "migration";
      commits[target2] = "uncertain";
      try {
        const result = await connections[target2].query({ text: scripts.get(RUNTIME_FILES[target2]), query_timeout: MIGRATION_TIMEOUT_MS });
        const items = Array.isArray(result) ? result : [result];
        if (items.at(-1)?.command === "COMMIT") commits[target2] = "committed";
        checkCommit(result);
      } catch (e) {
        if (commits[target2] !== "committed") {
          try {
            await connections[target2].query("ROLLBACK");
            if (PRECOMMIT_ERRORS.has(e?.code)) commits[target2] = "rolled-back";
          } catch {
          }
        }
        throw e;
      }
      stage = "verification";
      const checks = await verify(connections[target2], target2, before[target2]);
      onEvent({
        stage: "disabled-runtime-installed",
        target: target2,
        projectRef: TARGETS[target2],
        status: "verified",
        file: RUNTIME_FILES[target2],
        sha256: MANIFEST[RUNTIME_FILES[target2]],
        version: `${target2}-runtime-0003`,
        versionReceipt: true,
        checks,
        commits: { ...commits },
        loginsEnabled: false,
        passwordsProvisioned: false,
        applicationCutover: false
      });
    }
    return { status: "passed", commits };
  } catch (e) {
    onEvent({ stage, target: target2, status: "stopped", code: safeCode(e), commits: { ...commits } });
    throw e;
  } finally {
    for (const x of Object.values(connections)) try {
      await x.end();
    } catch {
    }
  }
}
function loadRuntimeScripts() {
  const all = loadManifest();
  return new Map(Object.values(RUNTIME_FILES).map((file) => {
    const sql18 = all.get(file);
    requireThat(sql18 && sql18.includes("SET TRANSACTION READ WRITE;") && sql18.includes("AS runtime_version_recorded;") && sql18.includes("owner_memberships_before") && sql18.includes("GRANTED BY %I RESTRICT") && !/(?:\bPASSWORD\b|\bALTER\s+(?:SYSTEM|DATABASE)|\blog_statement\b|\baudit_rehearsal\b)/i.test(sql18), "DISABLED_SQL_SCOPE_REJECTED");
    return [file, sql18];
  }));
}
async function main2() {
  const mode = process.argv[2];
  requireThat(process.argv.length === 3 && ["offline", "apply-runtime-disabled"].includes(mode), "MODE_REJECTED");
  const scripts = loadRuntimeScripts();
  for (const target2 of ["destination", "source"]) installedFunctionContracts(target2);
  const repository = repositoryCompatibility(fs4.readFileSync(path6.join(ROOT, "shared/schema.ts"), "utf8"));
  if (mode === "offline") {
    emit("disabled-install-offline", { status: "passed", files: [...scripts.keys()], repository, privateFileAccess: false, databaseAccess: false, sqlExecuted: false });
    return;
  }
  const { configs, cas } = loadPrivateConfiguration();
  emit("disabled-install-scope", {
    repository,
    applicationCutover: false,
    loginsEnabled: false,
    passwordsProvisioned: false,
    note: "Only selected sixteen-table runtime installation; location feature, rehearsal and activation excluded."
  });
  await installDisabled({ configs, cas, scripts, onEvent: (value) => emit("runtime-disabled-executor", value) });
}
if (process.argv[1] && pathToFileURL2(path6.resolve(process.argv[1])).href === import.meta.url) {
  try {
    await main2();
  } catch (e) {
    emit("stopped", { code: safeCode(e) });
    process.exitCode = 1;
  }
}

// migrations/audit/search-location-runtime.mjs
var LOCATION_TABLE = "user_search_locations";
var LOCATION_TABLES = Object.freeze([...APP_TABLES, LOCATION_TABLE]);
var LOCATION_RIGHTS = Object.freeze(["SELECT", "INSERT", "UPDATE", "DELETE"]);
var LOCATION_SQL = Object.freeze({
  identity: `SELECT current_user='postgres' AND current_user=session_user AS setup_identity,
    current_setting('server_version_num')::integer/10000=17 AS version_17,
    current_setting('server_encoding')='UTF8' AS utf8,
    current_setting('transaction_read_only')='on' AS read_only`,
  absence: `SELECT to_regclass('public.user_search_locations') IS NULL AS location_absent`,
  foundation: `SELECT
    (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p'))=16 AS exactly_sixteen_tables,
    NOT EXISTS(SELECT 1 FROM unnest($1::text[]) t(name) WHERE NOT EXISTS
      (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=t.name AND c.relkind='r'
      AND c.relowner=current_user::regrole AND c.relrowsecurity)) AS foundation_owner_rls`,
  tables: `SELECT
    (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p'))=17 AS exactly_seventeen_tables,
    NOT EXISTS(SELECT 1 FROM unnest($1::text[]) t(name) WHERE NOT EXISTS
      (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=t.name AND c.relkind='r'
      AND c.relowner=current_user::regrole AND c.relrowsecurity)) AS all_expected_owner_rls`,
  shape: `WITH location AS (SELECT * FROM pg_catalog.pg_class
      WHERE oid=to_regclass('public.user_search_locations')) SELECT
    EXISTS(SELECT 1 FROM location WHERE relkind='r' AND relowner=current_user::regrole
      AND relrowsecurity AND NOT relforcerowsecurity) AS location_owner_rls,
    (SELECT jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull)
      ORDER BY a.attnum) FROM pg_catalog.pg_attribute a JOIN location c ON c.oid=a.attrelid
      WHERE a.attnum>0 AND NOT a.attisdropped)=
      '[["user_id","character varying",true],["source","character varying",true],
      ["input_text","character varying(300)",false],["place_id","character varying(512)",false],
      ["latitude","double precision",false],["longitude","double precision",false],
      ["updated_at","timestamp with time zone",true]]'::jsonb AS exact_columns,
    EXISTS(SELECT 1 FROM pg_catalog.pg_attrdef d JOIN location c ON c.oid=d.adrelid
      JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum=d.adnum
      WHERE a.attname='updated_at' AND pg_get_expr(d.adbin,d.adrelid)='now()') AS timestamp_default,
    (SELECT count(*) FROM pg_catalog.pg_constraint q JOIN location c ON c.oid=q.conrelid)=3 AS exactly_three_constraints,
    EXISTS(SELECT 1 FROM pg_catalog.pg_constraint q JOIN location c ON c.oid=q.conrelid
      WHERE q.contype='p' AND q.convalidated AND q.conkey=ARRAY[1]::smallint[]) AS owner_primary_key,
    EXISTS(SELECT 1 FROM pg_catalog.pg_constraint q JOIN location c ON c.oid=q.conrelid
      WHERE q.contype='f' AND q.convalidated AND q.confdeltype='c' AND q.conkey=ARRAY[1]::smallint[]
      AND q.confrelid=to_regclass('public.users') AND q.confkey=ARRAY[
        (SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=to_regclass('public.users') AND attname='id')]::smallint[])
      AS cascading_owner_foreign_key,
    EXISTS(SELECT 1 FROM pg_catalog.pg_constraint q JOIN location c ON c.oid=q.conrelid
      WHERE q.contype='c' AND q.conname='search_location_shape' AND q.convalidated) AS validated_shape_constraint`,
  policy: `SELECT (SELECT count(*) FROM pg_catalog.pg_policy
    WHERE polrelid=to_regclass('public.user_search_locations'))=1 AS one_location_policy,
    EXISTS(SELECT 1 FROM pg_catalog.pg_policy p WHERE p.polrelid=to_regclass('public.user_search_locations')
      AND p.polname='fmt_app_server' AND p.polcmd='*' AND p.polpermissive
      AND p.polroles=ARRAY['fm_app_runtime'::regrole::oid]
      AND pg_get_expr(p.polqual,p.polrelid)='true'
      AND pg_get_expr(p.polwithcheck,p.polrelid)='true') AS server_only_policy`,
  privateAcl: `SELECT
    (SELECT count(*) FROM pg_catalog.pg_roles WHERE rolname=ANY($1::text[]))=3 AS private_roles_present,
    NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles r CROSS JOIN pg_catalog.pg_class c
      CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) p(privilege)
      WHERE r.rolname=ANY($1::text[]) AND c.oid=to_regclass('public.user_search_locations')
      AND has_table_privilege(r.oid,c.oid,p.privilege)) AS browser_and_service_no_table_access,
    NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles r CROSS JOIN pg_catalog.pg_attribute a
      CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','REFERENCES']) p(privilege)
      WHERE r.rolname=ANY($1::text[]) AND a.attrelid=to_regclass('public.user_search_locations')
      AND a.attnum>0 AND NOT a.attisdropped
      AND has_column_privilege(r.oid,a.attrelid,a.attnum,p.privilege)) AS browser_and_service_no_column_access,
    NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c CROSS JOIN LATERAL
      aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
      WHERE c.oid=to_regclass('public.user_search_locations') AND
      (a.grantee NOT IN (c.relowner,'fm_app_runtime'::regrole::oid) OR a.is_grantable
      OR (a.grantee='fm_app_runtime'::regrole::oid AND a.privilege_type NOT IN ('SELECT','INSERT','UPDATE','DELETE'))))
      AS no_unreviewed_location_acl`,
  definition: `SELECT pg_get_constraintdef(oid) AS definition FROM pg_catalog.pg_constraint
    WHERE conrelid=to_regclass('public.user_search_locations') AND conname='search_location_shape' AND contype='c'`
});

// migrations/billing/contract.mjs
var BILLING_EXPORTS = Object.freeze([
  "billingAccounts",
  "billingSubscriptions",
  "billingInvoices",
  "billingOperations",
  "billingEvents",
  "manualProGrants"
]);
var BILLING_TABLES = Object.freeze([
  "billing_accounts",
  "billing_subscriptions",
  "billing_invoices",
  "billing_operations",
  "billing_events",
  "manual_pro_grants"
]);
var BILLING_PROFILE_TABLES = Object.freeze([...LOCATION_TABLES, ...BILLING_TABLES]);
var BILLING_RUNTIME_RIGHTS = Object.freeze(["SELECT", "INSERT", "UPDATE"]);
var BILLING_SOURCE_ROLES = Object.freeze(["fm_app_runtime", ROLES.app, ROLES.capture, ROLES.worker]);
var BILLING_REVOKE_ROLES = Object.freeze(["PUBLIC", "anon", "authenticated", "service_role", ...BILLING_SOURCE_ROLES]);
var BILLING_FILES = Object.freeze({
  schema: "migrations/0010_monthly_billing.sql",
  runtime: "migrations/0011_monthly_billing_runtime.sql",
  transferSecurity: "migrations/billing/transfer-security.sql"
});
var BILLING_SCHEMA_PREFIX = `-- TASK-024 choice 2, additive DORMANT expansion. Prepared, not applied.
-- No entitlement backfill, projection update, runtime grant or activation.
BEGIN;
SET TRANSACTION READ WRITE;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL idle_in_transaction_session_timeout='60s';
SET LOCAL search_path=pg_catalog,pg_temp;
DO $billing$ BEGIN
  IF current_user<>session_user OR current_user<>'postgres'
     OR current_setting('server_version_num')::integer/10000<>17 THEN
    RAISE EXCEPTION 'Billing principal/version precondition failed';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p'))<>17
     OR EXISTS(SELECT 1 FROM unnest(ARRAY[${LOCATION_TABLES.map((n) => `'${n}'`).join(",")}]::text[]) expected(name)
       WHERE to_regclass('public.' || expected.name) IS NULL) THEN
    RAISE EXCEPTION 'Verified seventeen-table source foundation required';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_roles WHERE rolname IN
      ('fm_app_runtime','fmt_app_dev','fmt_audit_capture_dev','fmt_audit_worker_dev','anon','authenticated','service_role'))<>7 THEN
    RAISE EXCEPTION 'Billing source runtime/browser role baseline missing';
  END IF;
END $billing$;
-- BEGIN GENERATED BILLING DDL
`;
var BILLING_SCHEMA_SUFFIX = `
-- END GENERATED BILLING DDL
${BILLING_TABLES.map((name) => `REVOKE ALL ON TABLE public.${name} FROM ${BILLING_REVOKE_ROLES.join(", ")};`).join("\n")}
SELECT true AS billing_dormant_expansion_created;
COMMIT;
`;

// migrations/billing/v2-contract.mjs
var INITIAL_OFFER_ID = "b0241900-0000-4000-8000-000000000001";
var BILLING_V2_EXPORTS = Object.freeze(["billingOfferRevisions", "billingOfferSettings", "billingPriceMappings", "billingSourceState"]);
var BILLING_V2_TABLES = Object.freeze(["billing_offer_revisions", "billing_offer_settings", "billing_price_mappings", "billing_source_state"]);
var BILLING_V2_PROFILE_TABLES = Object.freeze([...BILLING_PROFILE_TABLES, ...BILLING_V2_TABLES]);
var BILLING_V2_RIGHTS = Object.freeze({ billing_offer_revisions: ["SELECT", "INSERT"], billing_offer_settings: ["SELECT", "UPDATE"], billing_price_mappings: ["SELECT", "INSERT", "UPDATE"], billing_source_state: ["SELECT", "INSERT", "UPDATE"] });
var BILLING_V2_FILES = Object.freeze({ schema: "migrations/0012_monthly_billing_offers.sql", runtime: "migrations/0013_monthly_billing_offers_runtime.sql", columns: "migrations/billing/v2-columns.json", transferSecurity: "migrations/billing/v2-transfer-security.sql" });
var BILLING_V2_SUFFIX = `
-- END GENERATED BILLING V2 DDL
${BILLING_V2_TABLES.map((name) => `REVOKE ALL ON TABLE public.${name} FROM ${BILLING_REVOKE_ROLES.join(", ")};`).join("\n")}
-- Immutable local prices are never updated in-place, including by owner-connected code.
CREATE FUNCTION public.reject_billing_offer_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $offer$
BEGIN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Billing offer revisions are immutable'; END $offer$;
REVOKE ALL ON FUNCTION public.reject_billing_offer_mutation() FROM PUBLIC,anon,authenticated,service_role,fm_app_runtime;
CREATE TRIGGER billing_offer_immutable BEFORE UPDATE OR DELETE ON public.billing_offer_revisions
FOR EACH ROW EXECUTE FUNCTION public.reject_billing_offer_mutation();
CREATE FUNCTION public.guard_billing_price_mapping() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $mapping$
BEGIN
 IF ROW(NEW.id,NEW.offer_id,NEW.provider,NEW.merchant_account,NEW.mode,NEW.fingerprint,NEW.created_at)
  IS DISTINCT FROM ROW(OLD.id,OLD.offer_id,OLD.provider,OLD.merchant_account,OLD.mode,OLD.fingerprint,OLD.created_at)
  OR (OLD.processor_price_id IS NOT NULL AND NEW.processor_price_id IS DISTINCT FROM OLD.processor_price_id)
 THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Billing price identity is immutable'; END IF;
 RETURN NEW;
END $mapping$;
REVOKE ALL ON FUNCTION public.guard_billing_price_mapping() FROM PUBLIC,anon,authenticated,service_role,fm_app_runtime;
CREATE TRIGGER billing_price_identity_immutable BEFORE UPDATE ON public.billing_price_mappings
FOR EACH ROW EXECUTE FUNCTION public.guard_billing_price_mapping();
CREATE FUNCTION public.guard_billing_offer_settings() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $settings$
BEGIN
 IF NEW.singleton IS DISTINCT FROM OLD.singleton OR NEW.revision<>OLD.revision+1
  OR NEW.current_offer_id=OLD.current_offer_id
  OR NOT EXISTS(SELECT 1 FROM public.billing_offer_revisions r WHERE r.id=NEW.current_offer_id
    AND r.version=NEW.revision AND r.issued_by IS NOT DISTINCT FROM NEW.updated_by)
 THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Billing offer pointer revision conflict'; END IF;
 RETURN NEW;
END $settings$;
REVOKE ALL ON FUNCTION public.guard_billing_offer_settings() FROM PUBLIC,anon,authenticated,service_role,fm_app_runtime;
CREATE TRIGGER billing_offer_settings_cas BEFORE UPDATE ON public.billing_offer_settings
FOR EACH ROW EXECUTE FUNCTION public.guard_billing_offer_settings();
CREATE FUNCTION public.guard_billing_subscription_offer() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $subscription$
BEGIN
 IF ROW(NEW.id,NEW.account_id,NEW.workspace_id,NEW.provider,NEW.merchant_account,NEW.mode,
    NEW.processor_subscription_id,NEW.approved_offer_ref,NEW.currency,NEW.interval)
  IS DISTINCT FROM ROW(OLD.id,OLD.account_id,OLD.workspace_id,OLD.provider,OLD.merchant_account,OLD.mode,
    OLD.processor_subscription_id,OLD.approved_offer_ref,OLD.currency,OLD.interval)
  OR (OLD.offer_revision_id IS NOT NULL AND NEW.offer_revision_id IS DISTINCT FROM OLD.offer_revision_id)
  OR (OLD.price_mapping_id IS NOT NULL AND NEW.price_mapping_id IS DISTINCT FROM OLD.price_mapping_id)
 THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Existing subscription agreed offer is immutable'; END IF;
 RETURN NEW;
END $subscription$;
REVOKE ALL ON FUNCTION public.guard_billing_subscription_offer() FROM PUBLIC,anon,authenticated,service_role,fm_app_runtime;
CREATE TRIGGER billing_subscription_offer_immutable BEFORE UPDATE ON public.billing_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.guard_billing_subscription_offer();
INSERT INTO public.billing_offer_revisions(id,version,amount_minor,currency,interval,tax_included,issued_by)
VALUES('${INITIAL_OFFER_ID}',1,1900,'EUR','month',true,NULL);
INSERT INTO public.billing_offer_settings(singleton,current_offer_id,revision,updated_by)
VALUES(true,'${INITIAL_OFFER_ID}',1,NULL);
SELECT true AS billing_local_offers_created;
COMMIT;
`;

// migrations/notifications/runtime-contract.json
var runtime_contract_default = {
  version: "notifications-runtime-v1",
  tables: [
    "user_communication_preferences",
    "phone_verification_challenges",
    "notification_events",
    "notification_jobs",
    "notification_delivery_attempts",
    "notification_callbacks"
  ],
  columns: [
    {
      table: "user_communication_preferences",
      name: "user_id",
      type: "character varying",
      notNull: true,
      default: null
    },
    {
      table: "user_communication_preferences",
      name: "phone",
      type: "character varying(16)",
      notNull: false,
      default: null
    },
    {
      table: "user_communication_preferences",
      name: "phone_verified_at",
      type: "timestamp with time zone",
      notNull: false,
      default: null
    },
    {
      table: "user_communication_preferences",
      name: "preferred_method",
      type: "character varying",
      notNull: false,
      default: null
    },
    {
      table: "user_communication_preferences",
      name: "email_suppressed",
      type: "boolean",
      notNull: true,
      default: "false"
    },
    {
      table: "user_communication_preferences",
      name: "language",
      type: "character varying(8)",
      notNull: true,
      default: "'en'"
    },
    {
      table: "user_communication_preferences",
      name: "sms_opt_in",
      type: "boolean",
      notNull: true,
      default: "false"
    },
    {
      table: "user_communication_preferences",
      name: "whatsapp_opt_in",
      type: "boolean",
      notNull: true,
      default: "false"
    },
    {
      table: "user_communication_preferences",
      name: "updated_at",
      type: "timestamp with time zone",
      notNull: true,
      default: "now()"
    },
    {
      table: "phone_verification_challenges",
      name: "id",
      type: "uuid",
      notNull: true,
      default: null
    },
    {
      table: "phone_verification_challenges",
      name: "user_id",
      type: "character varying",
      notNull: true,
      default: null
    },
    {
      table: "phone_verification_challenges",
      name: "phone",
      type: "character varying(16)",
      notNull: true,
      default: null
    },
    {
      table: "phone_verification_challenges",
      name: "provider_request_id",
      type: "character varying(255)",
      notNull: false,
      default: null
    },
    {
      table: "phone_verification_challenges",
      name: "status",
      type: "character varying",
      notNull: true,
      default: "'pending'"
    },
    {
      table: "phone_verification_challenges",
      name: "attempt_count",
      type: "integer",
      notNull: true,
      default: "0"
    },
    {
      table: "phone_verification_challenges",
      name: "expires_at",
      type: "timestamp with time zone",
      notNull: true,
      default: null
    },
    {
      table: "phone_verification_challenges",
      name: "next_send_at",
      type: "timestamp with time zone",
      notNull: true,
      default: null
    },
    {
      table: "phone_verification_challenges",
      name: "created_at",
      type: "timestamp with time zone",
      notNull: true,
      default: "now()"
    },
    {
      table: "phone_verification_challenges",
      name: "updated_at",
      type: "timestamp with time zone",
      notNull: true,
      default: "now()"
    },
    {
      table: "notification_events",
      name: "id",
      type: "uuid",
      notNull: true,
      default: null
    },
    {
      table: "notification_events",
      name: "booking_id",
      type: "integer",
      notNull: true,
      default: null
    },
    {
      table: "notification_events",
      name: "booking_revision",
      type: "integer",
      notNull: true,
      default: null
    },
    {
      table: "notification_events",
      name: "kind",
      type: "character varying",
      notNull: true,
      default: null
    },
    {
      table: "notification_events",
      name: "scheduled_date",
      type: "timestamp with time zone",
      notNull: true,
      default: null
    },
    {
      table: "notification_events",
      name: "previous_scheduled_date",
      type: "timestamp with time zone",
      notNull: false,
      default: null
    },
    {
      table: "notification_events",
      name: "timezone",
      type: "character varying(100)",
      notNull: true,
      default: "'UTC'"
    },
    {
      table: "notification_events",
      name: "automatic",
      type: "boolean",
      notNull: true,
      default: null
    },
    {
      table: "notification_events",
      name: "created_at",
      type: "timestamp with time zone",
      notNull: true,
      default: "now()"
    },
    {
      table: "notification_jobs",
      name: "id",
      type: "uuid",
      notNull: true,
      default: null
    },
    {
      table: "notification_jobs",
      name: "event_id",
      type: "uuid",
      notNull: true,
      default: null
    },
    {
      table: "notification_jobs",
      name: "channel",
      type: "character varying",
      notNull: false,
      default: null
    },
    {
      table: "notification_jobs",
      name: "state",
      type: "character varying",
      notNull: true,
      default: "'queued'"
    },
    {
      table: "notification_jobs",
      name: "due_at",
      type: "timestamp with time zone",
      notNull: true,
      default: null
    },
    {
      table: "notification_jobs",
      name: "expires_at",
      type: "timestamp with time zone",
      notNull: false,
      default: null
    },
    {
      table: "notification_jobs",
      name: "lease_token",
      type: "uuid",
      notNull: false,
      default: null
    },
    {
      table: "notification_jobs",
      name: "lease_until",
      type: "timestamp with time zone",
      notNull: false,
      default: null
    },
    {
      table: "notification_jobs",
      name: "attempted_at",
      type: "timestamp with time zone",
      notNull: false,
      default: null
    },
    {
      table: "notification_jobs",
      name: "provider_message_id",
      type: "character varying(255)",
      notNull: false,
      default: null
    },
    {
      table: "notification_jobs",
      name: "reason_code",
      type: "character varying(64)",
      notNull: false,
      default: null
    },
    {
      table: "notification_jobs",
      name: "created_at",
      type: "timestamp with time zone",
      notNull: true,
      default: "now()"
    },
    {
      table: "notification_jobs",
      name: "updated_at",
      type: "timestamp with time zone",
      notNull: true,
      default: "now()"
    },
    {
      table: "notification_delivery_attempts",
      name: "id",
      type: "uuid",
      notNull: true,
      default: null
    },
    {
      table: "notification_delivery_attempts",
      name: "job_id",
      type: "uuid",
      notNull: true,
      default: null
    },
    {
      table: "notification_delivery_attempts",
      name: "provider",
      type: "character varying",
      notNull: true,
      default: null
    },
    {
      table: "notification_delivery_attempts",
      name: "provider_message_id",
      type: "character varying(255)",
      notNull: false,
      default: null
    },
    {
      table: "notification_delivery_attempts",
      name: "state",
      type: "character varying",
      notNull: true,
      default: "'reserved'"
    },
    {
      table: "notification_delivery_attempts",
      name: "error_code",
      type: "character varying(64)",
      notNull: false,
      default: null
    },
    {
      table: "notification_delivery_attempts",
      name: "created_at",
      type: "timestamp with time zone",
      notNull: true,
      default: "now()"
    },
    {
      table: "notification_delivery_attempts",
      name: "updated_at",
      type: "timestamp with time zone",
      notNull: true,
      default: "now()"
    },
    {
      table: "notification_callbacks",
      name: "id",
      type: "uuid",
      notNull: true,
      default: null
    },
    {
      table: "notification_callbacks",
      name: "provider",
      type: "character varying",
      notNull: true,
      default: null
    },
    {
      table: "notification_callbacks",
      name: "provider_event_id",
      type: "character varying(255)",
      notNull: true,
      default: null
    },
    {
      table: "notification_callbacks",
      name: "received_at",
      type: "timestamp with time zone",
      notNull: true,
      default: "now()"
    },
    {
      table: "services",
      name: "reminder_enabled",
      type: "boolean",
      notNull: true,
      default: "false"
    },
    {
      table: "services",
      name: "reminder_method",
      type: "character varying",
      notNull: true,
      default: "'email'"
    },
    {
      table: "services",
      name: "reminder_hours",
      type: "integer",
      notNull: true,
      default: "24"
    },
    {
      table: "bookings",
      name: "notification_revision",
      type: "integer",
      notNull: true,
      default: "0"
    }
  ],
  constraints: [
    {
      table: "user_communication_preferences",
      name: "communication_preferences_phone_check",
      type: "c",
      expression: "phoneisnullorphone~'^\\+[1-9][0-9]{7,14}$'"
    },
    {
      table: "user_communication_preferences",
      name: "communication_preferences_verification_check",
      type: "c",
      expression: "phone_verified_atisnullorphoneisnotnullandnotsms_opt_inorphone_verified_atisnotnullandnotwhatsapp_opt_inorphone_verified_atisnotnull"
    },
    {
      table: "user_communication_preferences",
      name: "communication_preferences_method_check",
      type: "c",
      expression: "preferred_methodisnullorpreferred_method='email'orpreferred_method='sms'andsms_opt_inorpreferred_method='whatsapp'andwhatsapp_opt_in"
    },
    {
      table: "user_communication_preferences",
      name: "communication_preferences_language_check",
      type: "c",
      expression: "language=anyarray['en','lv','ru','ar','zh','fr','de','hi','ja','pt','es']"
    },
    {
      table: "user_communication_preferences",
      name: "user_communication_preferences_pkey",
      type: "p",
      columns: [
        "user_id"
      ]
    },
    {
      table: "user_communication_preferences",
      name: "user_communication_preferences_user_id_users_id_fk",
      type: "f",
      columns: [
        "user_id"
      ],
      referenceTable: "users",
      referenceColumns: [
        "id"
      ],
      onDelete: "c"
    },
    {
      table: "phone_verification_challenges",
      name: "phone_verification_shape",
      type: "c",
      expression: "phone~'^\\+[1-9][0-9]{7,14}$'andstatus=anyarray['pending','verified','failed','expired','unknown']andattempt_count>=0andattempt_count<=5andexpires_at>created_atandnext_send_at>=created_at"
    },
    {
      table: "phone_verification_challenges",
      name: "phone_verification_challenges_pkey",
      type: "p",
      columns: [
        "id"
      ]
    },
    {
      table: "phone_verification_challenges",
      name: "phone_verification_challenges_user_id_users_id_fk",
      type: "f",
      columns: [
        "user_id"
      ],
      referenceTable: "users",
      referenceColumns: [
        "id"
      ],
      onDelete: "c"
    },
    {
      table: "notification_events",
      name: "notification_event_shape",
      type: "c",
      expression: "booking_revision>=0andkind=anyarray['accepted','rejected','rescheduled','reminder']andlengthtrimtimezone>=1andlengthtrimtimezone<=100andkind<>'rescheduled'orprevious_scheduled_dateisnotnull"
    },
    {
      table: "notification_events",
      name: "notification_events_pkey",
      type: "p",
      columns: [
        "id"
      ]
    },
    {
      table: "notification_events",
      name: "notification_events_booking_id_bookings_id_fk",
      type: "f",
      columns: [
        "booking_id"
      ],
      referenceTable: "bookings",
      referenceColumns: [
        "id"
      ],
      onDelete: "c"
    },
    {
      table: "notification_jobs",
      name: "notification_job_state_check",
      type: "c",
      expression: "state=anyarray['queued','leased','accepted','delivered','failed','unknown','skipped','cancelled']andchannelisnullorchannel=anyarray['email','sms','whatsapp']"
    },
    {
      table: "notification_jobs",
      name: "notification_job_lease_check",
      type: "c",
      expression: "lease_tokenisnull=lease_untilisnullandstate<>'leased'orlease_tokenisnotnull"
    },
    {
      table: "notification_jobs",
      name: "notification_job_expiry_check",
      type: "c",
      expression: "expires_atisnullorexpires_at>=due_at"
    },
    {
      table: "notification_jobs",
      name: "notification_jobs_pkey",
      type: "p",
      columns: [
        "id"
      ]
    },
    {
      table: "notification_jobs",
      name: "notification_jobs_event_id_notification_events_id_fk",
      type: "f",
      columns: [
        "event_id"
      ],
      referenceTable: "notification_events",
      referenceColumns: [
        "id"
      ],
      onDelete: "c"
    },
    {
      table: "notification_delivery_attempts",
      name: "notification_attempt_shape",
      type: "c",
      expression: "provider=anyarray['vonage','resend']andstate=anyarray['reserved','accepted','delivered','failed','unknown']"
    },
    {
      table: "notification_delivery_attempts",
      name: "notification_delivery_attempts_pkey",
      type: "p",
      columns: [
        "id"
      ]
    },
    {
      table: "notification_delivery_attempts",
      name: "notification_delivery_attempts_job_id_notification_jobs_id_fk",
      type: "f",
      columns: [
        "job_id"
      ],
      referenceTable: "notification_jobs",
      referenceColumns: [
        "id"
      ],
      onDelete: "c"
    },
    {
      table: "notification_callbacks",
      name: "notification_callback_shape",
      type: "c",
      expression: "provider=anyarray['vonage','resend']andlengthtrimprovider_event_id>0"
    },
    {
      table: "notification_callbacks",
      name: "notification_callbacks_pkey",
      type: "p",
      columns: [
        "id"
      ]
    },
    {
      table: "services",
      name: "services_reminder_settings_check",
      type: "c",
      expression: "reminder_method=anyarray['email','sms','whatsapp']andreminder_hours>=1andreminder_hours<=168"
    },
    {
      table: "bookings",
      name: "bookings_notification_revision_check",
      type: "c",
      expression: "notification_revision>=0"
    }
  ],
  indexes: [
    {
      table: "user_communication_preferences",
      name: "user_communication_preferences_pkey",
      unique: true,
      columns: [
        "user_id"
      ],
      predicate: null
    },
    {
      table: "user_communication_preferences",
      name: "communication_preferences_phone_idx",
      unique: false,
      columns: [
        "phone"
      ],
      predicate: "phoneisnotnull"
    },
    {
      table: "phone_verification_challenges",
      name: "phone_verification_challenges_pkey",
      unique: true,
      columns: [
        "id"
      ],
      predicate: null
    },
    {
      table: "phone_verification_challenges",
      name: "phone_verification_user_created_idx",
      unique: false,
      columns: [
        "user_id",
        "created_at"
      ],
      predicate: null
    },
    {
      table: "phone_verification_challenges",
      name: "phone_verification_phone_created_idx",
      unique: false,
      columns: [
        "phone",
        "created_at"
      ],
      predicate: null
    },
    {
      table: "phone_verification_challenges",
      name: "phone_verification_expiry_idx",
      unique: false,
      columns: [
        "expires_at"
      ],
      predicate: null
    },
    {
      table: "phone_verification_challenges",
      name: "phone_verification_provider_identity",
      unique: true,
      columns: [
        "provider_request_id"
      ],
      predicate: null
    },
    {
      table: "notification_events",
      name: "notification_events_pkey",
      unique: true,
      columns: [
        "id"
      ],
      predicate: null
    },
    {
      table: "notification_events",
      name: "notification_event_revision_identity",
      unique: true,
      columns: [
        "booking_id",
        "booking_revision",
        "kind"
      ],
      predicate: null
    },
    {
      table: "notification_events",
      name: "notification_reminder_identity",
      unique: true,
      columns: [
        "booking_id",
        "scheduled_date"
      ],
      predicate: "kind='reminder'"
    },
    {
      table: "notification_events",
      name: "notification_events_retention_idx",
      unique: false,
      columns: [
        "created_at"
      ],
      predicate: null
    },
    {
      table: "notification_jobs",
      name: "notification_jobs_pkey",
      unique: true,
      columns: [
        "id"
      ],
      predicate: null
    },
    {
      table: "notification_jobs",
      name: "notification_job_event_identity",
      unique: true,
      columns: [
        "event_id"
      ],
      predicate: null
    },
    {
      table: "notification_jobs",
      name: "notification_job_due_idx",
      unique: false,
      columns: [
        "due_at"
      ],
      predicate: "state='queued'"
    },
    {
      table: "notification_jobs",
      name: "notification_job_lease_idx",
      unique: false,
      columns: [
        "lease_until"
      ],
      predicate: "state='leased'"
    },
    {
      table: "notification_jobs",
      name: "notification_jobs_retention_idx",
      unique: false,
      columns: [
        "updated_at"
      ],
      predicate: null
    },
    {
      table: "notification_delivery_attempts",
      name: "notification_delivery_attempts_pkey",
      unique: true,
      columns: [
        "id"
      ],
      predicate: null
    },
    {
      table: "notification_delivery_attempts",
      name: "notification_attempt_job_identity",
      unique: true,
      columns: [
        "job_id"
      ],
      predicate: null
    },
    {
      table: "notification_delivery_attempts",
      name: "notification_attempt_recent_idx",
      unique: false,
      columns: [
        "created_at",
        "job_id"
      ],
      predicate: null
    },
    {
      table: "notification_delivery_attempts",
      name: "notification_attempt_provider_identity",
      unique: true,
      columns: [
        "provider",
        "provider_message_id"
      ],
      predicate: null
    },
    {
      table: "notification_callbacks",
      name: "notification_callbacks_pkey",
      unique: true,
      columns: [
        "id"
      ],
      predicate: null
    },
    {
      table: "notification_callbacks",
      name: "notification_callback_identity",
      unique: true,
      columns: [
        "provider",
        "provider_event_id"
      ],
      predicate: null
    },
    {
      table: "notification_callbacks",
      name: "notification_callbacks_retention_idx",
      unique: false,
      columns: [
        "received_at"
      ],
      predicate: null
    }
  ]
};

// migrations/notifications/normalize-expression.mjs
function canonicalCatalogExpression(expression) {
  const defaultTrim = `regexp_replace(${expression}, '\\mTRIM\\([[:space:]]*BOTH[[:space:]]+FROM[[:space:]]+', 'trim(', 'gi')`;
  return `lower(regexp_replace(replace(regexp_replace(regexp_replace(${defaultTrim}, '"[a-z_]+"\\.', '', 'g'), '::(character varying|text)(\\[\\])?', '', 'g'), 'btrim(', 'trim('), '[[:space:]()"]', '', 'g'))`;
}

// migrations/notifications/runtime-contract.mjs
var NOTIFICATION_RUNTIME_TABLES = Object.freeze([...runtime_contract_default.tables]);
var NOTIFICATION_RUNTIME_CONTRACT_JSON = JSON.stringify(runtime_contract_default);
var NOTIFICATION_RUNTIME_RIGHTS = Object.freeze(NOTIFICATION_RUNTIME_TABLES.map((name) => Object.freeze({ name, rights: Object.freeze(["SELECT", "INSERT", "UPDATE", "DELETE"]) })));
var normalizedCheck = canonicalCatalogExpression("pg_catalog.pg_get_expr(q.conbin,q.conrelid)");
var normalizedPredicate = canonicalCatalogExpression("pg_catalog.pg_get_expr(i.indpred,i.indrelid)");
var NOTIFICATION_READINESS_CTES = `notification_profile AS (SELECT $3::jsonb AS profile),
 notification_tables AS (SELECT jsonb_array_elements_text(profile->'tables') AS name FROM notification_profile),
 notification_columns_expected AS (SELECT e.* FROM notification_profile n,
  LATERAL jsonb_to_recordset(n.profile->'columns') AS e("table" text,name text,type text,"notNull" boolean,"default" text)),
 notification_constraints_expected AS (SELECT e.* FROM notification_profile n,
  LATERAL jsonb_to_recordset(n.profile->'constraints') AS e("table" text,name text,type text,expression text,columns text[],"referenceTable" text,"referenceColumns" text[],"onDelete" text)),
 notification_indexes_expected AS (SELECT e.* FROM notification_profile n,
  LATERAL jsonb_to_recordset(n.profile->'indexes') AS e("table" text,name text,"unique" boolean,columns text[],predicate text))`;
var NOTIFICATION_READINESS_SELECT = `NOT EXISTS(SELECT 1 FROM notification_columns_expected e WHERE NOT EXISTS(
 SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attname=e.name AND a.attnum>0 AND NOT a.attisdropped
 LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
 WHERE n.nspname='public' AND c.relname=e."table" AND format_type(a.atttypid,a.atttypmod)=e.type
 AND a.attnotnull=e."notNull" AND regexp_replace(pg_catalog.pg_get_expr(d.adbin,d.adrelid),'::(character varying|text)','', 'g') IS NOT DISTINCT FROM e."default"))
 AND NOT EXISTS(SELECT 1 FROM notification_tables e JOIN pg_catalog.pg_class c ON c.relname=e.name
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
 AND (SELECT count(*) FROM pg_catalog.pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped)
 <> (SELECT count(*) FROM notification_columns_expected col WHERE col."table"=e.name)) AS notification_columns,
 NOT EXISTS(SELECT 1 FROM notification_constraints_expected e WHERE NOT EXISTS(
 SELECT 1 FROM pg_catalog.pg_constraint q JOIN pg_catalog.pg_class c ON c.oid=q.conrelid
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname=e."table" AND q.conname=e.name AND q.contype::text=e.type
 AND q.convalidated AND NOT q.condeferrable AND NOT q.condeferred
 AND CASE WHEN e.type='c' THEN ${normalizedCheck}=e.expression
 ELSE ARRAY(SELECT a.attname::text FROM unnest(q.conkey) WITH ORDINALITY k(attnum,position)
  JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum=k.attnum ORDER BY k.position)=e.columns END
 AND (e.type<>'f' OR (q.confrelid=to_regclass('public.'||e."referenceTable") AND q.confdeltype::text=e."onDelete" AND q.confupdtype='a' AND q.confmatchtype='s'
  AND ARRAY(SELECT a.attname::text FROM unnest(q.confkey) WITH ORDINALITY k(attnum,position)
   JOIN pg_catalog.pg_attribute a ON a.attrelid=q.confrelid AND a.attnum=k.attnum ORDER BY k.position)=e."referenceColumns"))))
 AND NOT EXISTS(SELECT 1 FROM notification_tables e JOIN pg_catalog.pg_class c ON c.relname=e.name
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
 AND (SELECT count(*) FROM pg_catalog.pg_constraint q WHERE q.conrelid=c.oid AND q.contype IN('c','f','p','u','x'))
 <> (SELECT count(*) FROM notification_constraints_expected expected WHERE expected."table"=e.name)) AS notification_constraints,
 NOT EXISTS(SELECT 1 FROM notification_indexes_expected e WHERE NOT EXISTS(
 SELECT 1 FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class t ON t.oid=i.indrelid
 JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace JOIN pg_catalog.pg_class idx ON idx.oid=i.indexrelid
 JOIN pg_catalog.pg_am am ON am.oid=idx.relam
 WHERE n.nspname='public' AND t.relname=e."table" AND idx.relname=e.name AND am.amname='btree'
 AND i.indisvalid AND i.indisready AND i.indislive AND i.indisunique=e."unique" AND i.indnkeyatts=i.indnatts
 AND i.indexprs IS NULL AND NOT i.indnullsnotdistinct
 AND ARRAY(SELECT a.attname::text FROM unnest(i.indkey) WITH ORDINALITY k(attnum,position)
  JOIN pg_catalog.pg_attribute a ON a.attrelid=t.oid AND a.attnum=k.attnum ORDER BY k.position)=e.columns
 AND ${normalizedPredicate} IS NOT DISTINCT FROM e.predicate)) AS notification_indexes,
 NOT EXISTS(SELECT 1 FROM notification_tables e JOIN pg_catalog.pg_class c ON c.relname=e.name
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND (
 EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(c.relacl,pg_catalog.acldefault('r',c.relowner))) a
  WHERE a.grantee<>c.relowner AND (a.grantee<>(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='fm_app_runtime')
   OR a.privilege_type NOT IN('SELECT','INSERT','UPDATE','DELETE') OR a.is_grantable))
 OR EXISTS(SELECT 1 FROM unnest(ARRAY['anon','authenticated','service_role','fmt_audit_capture_dev','fmt_audit_worker_dev']) r(role_name)
  WHERE has_table_privilege(r.role_name,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') IS DISTINCT FROM false)
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_attribute att, LATERAL pg_catalog.aclexplode(att.attacl) a
  WHERE att.attrelid=c.oid AND att.attnum>0 AND NOT att.attisdropped AND a.grantee<>c.relowner))) AS notification_private_acl,
 NOT EXISTS(SELECT 1 FROM notification_tables e WHERE NOT EXISTS(
 SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 JOIN pg_catalog.pg_policy p ON p.polrelid=c.oid WHERE n.nspname='public' AND c.relname=e.name
 AND c.relrowsecurity AND NOT c.relforcerowsecurity AND c.relowner='postgres'::regrole
 AND p.polname='fmt_notification_server' AND p.polcmd='*' AND p.polpermissive
 AND p.polroles=ARRAY[(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='fm_app_runtime')]
 AND pg_catalog.pg_get_expr(p.polqual,p.polrelid)='true' AND pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid)='true'
 AND (SELECT count(*) FROM pg_catalog.pg_policy other WHERE other.polrelid=c.oid)=1)) AS notification_policies,
 has_schema_privilege(current_user,'public','USAGE') AND NOT has_schema_privilege(current_user,'public','CREATE')
 AND pg_has_role(current_user,'fm_app_runtime','USAGE') AND EXISTS(SELECT 1 FROM pg_catalog.pg_roles r
 WHERE r.rolname='fm_app_runtime' AND NOT(r.rolcanlogin OR r.rolsuper OR r.rolbypassrls OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication)) AS notification_schema_access`;

// migrations/appointments/runtime-contract.json
var runtime_contract_default2 = {
  version: "appointments-runtime-v1",
  tables: [
    "booking_messages",
    "booking_reschedule_requests"
  ],
  columns: [
    {
      table: "booking_messages",
      name: "id",
      type: "uuid",
      notNull: true,
      default: null
    },
    {
      table: "booking_messages",
      name: "booking_id",
      type: "integer",
      notNull: true,
      default: null
    },
    {
      table: "booking_messages",
      name: "author_id",
      type: "character varying",
      notNull: true,
      default: null
    },
    {
      table: "booking_messages",
      name: "author_role",
      type: "character varying",
      notNull: true,
      default: null
    },
    {
      table: "booking_messages",
      name: "body",
      type: "text",
      notNull: true,
      default: null
    },
    {
      table: "booking_messages",
      name: "client_request_id",
      type: "uuid",
      notNull: true,
      default: null
    },
    {
      table: "booking_messages",
      name: "broadcast_id",
      type: "uuid",
      notNull: false,
      default: null
    },
    {
      table: "booking_messages",
      name: "created_at",
      type: "timestamp with time zone",
      notNull: true,
      default: "now()"
    },
    {
      table: "booking_reschedule_requests",
      name: "id",
      type: "uuid",
      notNull: true,
      default: null
    },
    {
      table: "booking_reschedule_requests",
      name: "booking_id",
      type: "integer",
      notNull: true,
      default: null
    },
    {
      table: "booking_reschedule_requests",
      name: "requested_by_id",
      type: "character varying",
      notNull: true,
      default: null
    },
    {
      table: "booking_reschedule_requests",
      name: "requested_by_role",
      type: "character varying",
      notNull: true,
      default: null
    },
    {
      table: "booking_reschedule_requests",
      name: "original_scheduled_date",
      type: "timestamp with time zone",
      notNull: true,
      default: null
    },
    {
      table: "booking_reschedule_requests",
      name: "proposed_scheduled_date",
      type: "timestamp with time zone",
      notNull: true,
      default: null
    },
    {
      table: "booking_reschedule_requests",
      name: "fallback",
      type: "character varying",
      notNull: true,
      default: null
    },
    {
      table: "booking_reschedule_requests",
      name: "state",
      type: "character varying",
      notNull: true,
      default: "'pending'"
    },
    {
      table: "booking_reschedule_requests",
      name: "batch_id",
      type: "uuid",
      notNull: false,
      default: null
    },
    {
      table: "booking_reschedule_requests",
      name: "client_request_id",
      type: "uuid",
      notNull: true,
      default: null
    },
    {
      table: "booking_reschedule_requests",
      name: "note",
      type: "text",
      notNull: false,
      default: null
    },
    {
      table: "booking_reschedule_requests",
      name: "timezone",
      type: "character varying(100)",
      notNull: true,
      default: "'UTC'"
    },
    {
      table: "booking_reschedule_requests",
      name: "base_revision",
      type: "integer",
      notNull: true,
      default: null
    },
    {
      table: "booking_reschedule_requests",
      name: "responded_by_id",
      type: "character varying",
      notNull: false,
      default: null
    },
    {
      table: "booking_reschedule_requests",
      name: "responded_at",
      type: "timestamp with time zone",
      notNull: false,
      default: null
    },
    {
      table: "booking_reschedule_requests",
      name: "created_at",
      type: "timestamp with time zone",
      notNull: true,
      default: "now()"
    },
    {
      table: "bookings",
      name: "closed_at",
      type: "timestamp with time zone",
      notNull: false,
      default: null
    }
  ],
  constraints: [
    {
      table: "booking_messages",
      name: "booking_message_shape",
      type: "c",
      expression: "author_role=anyarray['provider','customer']andlengthtrimbody>=1andlengthtrimbody<=4000andlengthbody<=4000andbroadcast_idisnullorauthor_role='provider'"
    },
    {
      table: "booking_messages",
      name: "booking_messages_pkey",
      type: "p",
      columns: [
        "id"
      ]
    },
    {
      table: "booking_messages",
      name: "booking_messages_booking_id_bookings_id_fk",
      type: "f",
      columns: [
        "booking_id"
      ],
      referenceTable: "bookings",
      referenceColumns: [
        "id"
      ],
      onDelete: "c"
    },
    {
      table: "booking_messages",
      name: "booking_messages_author_id_users_id_fk",
      type: "f",
      columns: [
        "author_id"
      ],
      referenceTable: "users",
      referenceColumns: [
        "id"
      ],
      onDelete: "a"
    },
    {
      table: "booking_reschedule_requests",
      name: "booking_reschedule_shape",
      type: "c",
      expression: "requested_by_role=anyarray['provider','customer']andfallback=anyarray['keep_original','cancel_booking']andstate=anyarray['pending','accepted','declined','withdrawn','superseded']andbase_revision>=0andlengthtrimtimezone>=1andlengthtrimtimezone<=100andnoteisnullorlengthnote<=2000andoriginal_scheduled_date<>proposed_scheduled_dateandbatch_idisnullorrequested_by_role='provider'"
    },
    {
      table: "booking_reschedule_requests",
      name: "booking_reschedule_response_shape",
      type: "c",
      expression: "state<>'pending'orresponded_atisnullandresponded_by_idisnullandstate<>'accepted'andstate<>'declined'orresponded_atisnotnullandresponded_by_idisnotnullandresponded_atisnullorresponded_at>=created_at"
    },
    {
      table: "booking_reschedule_requests",
      name: "booking_reschedule_requests_pkey",
      type: "p",
      columns: [
        "id"
      ]
    },
    {
      table: "booking_reschedule_requests",
      name: "booking_reschedule_requests_booking_id_bookings_id_fk",
      type: "f",
      columns: [
        "booking_id"
      ],
      referenceTable: "bookings",
      referenceColumns: [
        "id"
      ],
      onDelete: "c"
    },
    {
      table: "booking_reschedule_requests",
      name: "booking_reschedule_requests_requested_by_id_users_id_fk",
      type: "f",
      columns: [
        "requested_by_id"
      ],
      referenceTable: "users",
      referenceColumns: [
        "id"
      ],
      onDelete: "a"
    },
    {
      table: "booking_reschedule_requests",
      name: "booking_reschedule_requests_responded_by_id_users_id_fk",
      type: "f",
      columns: [
        "responded_by_id"
      ],
      referenceTable: "users",
      referenceColumns: [
        "id"
      ],
      onDelete: "a"
    },
    {
      table: "bookings",
      name: "bookings_closed_at_check",
      type: "c",
      expression: "closed_atisnullorstatus=anyarray['cancelled','completed']"
    }
  ],
  indexes: [
    {
      table: "booking_messages",
      name: "booking_messages_pkey",
      unique: true,
      columns: [
        "id"
      ],
      predicate: null
    },
    {
      table: "booking_messages",
      name: "booking_message_request_identity",
      unique: true,
      columns: [
        "author_id",
        "client_request_id",
        "booking_id"
      ],
      predicate: null
    },
    {
      table: "booking_messages",
      name: "booking_message_history_idx",
      unique: false,
      columns: [
        "booking_id",
        "created_at",
        "id"
      ],
      predicate: null
    },
    {
      table: "booking_messages",
      name: "booking_message_broadcast_idx",
      unique: false,
      columns: [
        "broadcast_id"
      ],
      predicate: "broadcast_idisnotnull"
    },
    {
      table: "booking_reschedule_requests",
      name: "booking_reschedule_requests_pkey",
      unique: true,
      columns: [
        "id"
      ],
      predicate: null
    },
    {
      table: "booking_reschedule_requests",
      name: "booking_reschedule_pending_identity",
      unique: true,
      columns: [
        "booking_id"
      ],
      predicate: "state='pending'"
    },
    {
      table: "booking_reschedule_requests",
      name: "booking_reschedule_request_identity",
      unique: true,
      columns: [
        "requested_by_id",
        "client_request_id",
        "booking_id"
      ],
      predicate: null
    },
    {
      table: "booking_reschedule_requests",
      name: "booking_reschedule_history_idx",
      unique: false,
      columns: [
        "booking_id",
        "created_at",
        "id"
      ],
      predicate: null
    },
    {
      table: "booking_reschedule_requests",
      name: "booking_reschedule_batch_idx",
      unique: false,
      columns: [
        "batch_id"
      ],
      predicate: "batch_idisnotnull"
    },
    {
      table: "bookings",
      name: "bookings_message_retention_idx",
      unique: false,
      columns: [
        "closed_at",
        "id"
      ],
      predicate: "closed_atisnotnullandstatus=anyarray['cancelled','completed']"
    }
  ]
};

// migrations/appointments/runtime-contract.mjs
var APPOINTMENT_RUNTIME_TABLES = Object.freeze([...runtime_contract_default2.tables]);
var APPOINTMENT_RUNTIME_CONTRACT_JSON = JSON.stringify(runtime_contract_default2);
var APPOINTMENT_RUNTIME_RIGHTS = Object.freeze(APPOINTMENT_RUNTIME_TABLES.map((name) => Object.freeze({ name, rights: Object.freeze(["SELECT", "INSERT", "UPDATE", "DELETE"]) })));
var normalizedCheck2 = canonicalCatalogExpression("pg_catalog.pg_get_expr(q.conbin,q.conrelid)");
var normalizedPredicate2 = canonicalCatalogExpression("pg_catalog.pg_get_expr(i.indpred,i.indrelid)");
var APPOINTMENT_READINESS_CTES = `appointment_profile AS (SELECT $4::jsonb AS profile),
 appointment_tables AS (SELECT jsonb_array_elements_text(profile->'tables') AS name FROM appointment_profile),
 appointment_columns_expected AS (SELECT e.* FROM appointment_profile n,
  LATERAL jsonb_to_recordset(n.profile->'columns') AS e("table" text,name text,type text,"notNull" boolean,"default" text)),
 appointment_constraints_expected AS (SELECT e.* FROM appointment_profile n,
  LATERAL jsonb_to_recordset(n.profile->'constraints') AS e("table" text,name text,type text,expression text,columns text[],"referenceTable" text,"referenceColumns" text[],"onDelete" text)),
 appointment_indexes_expected AS (SELECT e.* FROM appointment_profile n,
  LATERAL jsonb_to_recordset(n.profile->'indexes') AS e("table" text,name text,"unique" boolean,columns text[],predicate text))`;
var APPOINTMENT_READINESS_SELECT = `NOT EXISTS(SELECT 1 FROM appointment_columns_expected e WHERE NOT EXISTS(
 SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attname=e.name AND a.attnum>0 AND NOT a.attisdropped
 LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
 WHERE n.nspname='public' AND c.relname=e."table" AND format_type(a.atttypid,a.atttypmod)=e.type
 AND a.attnotnull=e."notNull" AND regexp_replace(pg_catalog.pg_get_expr(d.adbin,d.adrelid),'::(character varying|text)','', 'g') IS NOT DISTINCT FROM e."default"))
 AND NOT EXISTS(SELECT 1 FROM appointment_tables e JOIN pg_catalog.pg_class c ON c.relname=e.name
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
 AND (SELECT count(*) FROM pg_catalog.pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped)
 <> (SELECT count(*) FROM appointment_columns_expected col WHERE col."table"=e.name)) AS appointment_columns,
 NOT EXISTS(SELECT 1 FROM appointment_constraints_expected e WHERE NOT EXISTS(
 SELECT 1 FROM pg_catalog.pg_constraint q JOIN pg_catalog.pg_class c ON c.oid=q.conrelid
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname=e."table" AND q.conname=e.name AND q.contype::text=e.type
 AND q.convalidated AND NOT q.condeferrable AND NOT q.condeferred
 AND CASE WHEN e.type='c' THEN ${normalizedCheck2}=e.expression
 ELSE ARRAY(SELECT a.attname::text FROM unnest(q.conkey) WITH ORDINALITY k(attnum,position)
  JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum=k.attnum ORDER BY k.position)=e.columns END
 AND (e.type<>'f' OR (q.confrelid=to_regclass('public.'||e."referenceTable") AND q.confdeltype::text=e."onDelete" AND q.confupdtype='a' AND q.confmatchtype='s'
  AND ARRAY(SELECT a.attname::text FROM unnest(q.confkey) WITH ORDINALITY k(attnum,position)
   JOIN pg_catalog.pg_attribute a ON a.attrelid=q.confrelid AND a.attnum=k.attnum ORDER BY k.position)=e."referenceColumns"))))
 AND NOT EXISTS(SELECT 1 FROM appointment_tables e JOIN pg_catalog.pg_class c ON c.relname=e.name
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
 AND (SELECT count(*) FROM pg_catalog.pg_constraint q WHERE q.conrelid=c.oid AND q.contype IN('c','f','p','u','x'))
 <> (SELECT count(*) FROM appointment_constraints_expected expected WHERE expected."table"=e.name)) AS appointment_constraints,
 NOT EXISTS(SELECT 1 FROM appointment_indexes_expected e WHERE NOT EXISTS(
 SELECT 1 FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class t ON t.oid=i.indrelid
 JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace JOIN pg_catalog.pg_class idx ON idx.oid=i.indexrelid
 JOIN pg_catalog.pg_am am ON am.oid=idx.relam
 WHERE n.nspname='public' AND t.relname=e."table" AND idx.relname=e.name AND am.amname='btree'
 AND i.indisvalid AND i.indisready AND i.indislive AND i.indisunique=e."unique" AND i.indnkeyatts=i.indnatts
 AND i.indexprs IS NULL AND NOT i.indnullsnotdistinct
 AND ARRAY(SELECT a.attname::text FROM unnest(i.indkey) WITH ORDINALITY k(attnum,position)
  JOIN pg_catalog.pg_attribute a ON a.attrelid=t.oid AND a.attnum=k.attnum ORDER BY k.position)=e.columns
 AND ${normalizedPredicate2} IS NOT DISTINCT FROM e.predicate)) AS appointment_indexes,
 NOT EXISTS(SELECT 1 FROM appointment_tables e JOIN pg_catalog.pg_class c ON c.relname=e.name
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND (
 EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(c.relacl,pg_catalog.acldefault('r',c.relowner))) a
  WHERE a.grantee<>c.relowner AND (a.grantee<>(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='fm_app_runtime')
   OR a.privilege_type NOT IN('SELECT','INSERT','UPDATE','DELETE') OR a.is_grantable))
 OR EXISTS(SELECT 1 FROM unnest(ARRAY['anon','authenticated','service_role','fmt_audit_capture_dev','fmt_audit_worker_dev']) r(role_name)
  WHERE has_table_privilege(r.role_name,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') IS DISTINCT FROM false)
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_attribute att, LATERAL pg_catalog.aclexplode(att.attacl) a
  WHERE att.attrelid=c.oid AND att.attnum>0 AND NOT att.attisdropped AND a.grantee<>c.relowner))) AS appointment_private_acl,
 NOT EXISTS(SELECT 1 FROM appointment_tables e WHERE NOT EXISTS(
 SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 JOIN pg_catalog.pg_policy p ON p.polrelid=c.oid WHERE n.nspname='public' AND c.relname=e.name
 AND c.relrowsecurity AND NOT c.relforcerowsecurity AND c.relowner='postgres'::regrole
 AND p.polname='fmt_appointment_server' AND p.polcmd='*' AND p.polpermissive
 AND p.polroles=ARRAY[(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='fm_app_runtime')]
 AND pg_catalog.pg_get_expr(p.polqual,p.polrelid)='true' AND pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid)='true'
 AND (SELECT count(*) FROM pg_catalog.pg_policy other WHERE other.polrelid=c.oid)=1)) AS appointment_policies,
 has_schema_privilege(current_user,'public','USAGE') AND NOT has_schema_privilege(current_user,'public','CREATE')
 AND pg_has_role(current_user,'fm_app_runtime','USAGE') AND EXISTS(SELECT 1 FROM pg_catalog.pg_roles r
 WHERE r.rolname='fm_app_runtime' AND NOT(r.rolcanlogin OR r.rolsuper OR r.rolbypassrls OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication)) AS appointment_schema_access`;

// migrations/billing/application-readiness.mjs
var EXPECTED_BILLING_PARSERS = Object.freeze([
  Object.freeze({ name: "parse_event", hash: "986d13a576a6bb53a5204670117f448d505defd7703f639ce3665adbc9f9e8d5" }),
  Object.freeze({ name: "parse_event_before_billing", hash: "c7086d4ceee43b586e0efca334ef9a3c7926ac8c856ca3aeb8e79913fe77698b" }),
  Object.freeze({ name: "parse_event_before_portal", hash: "8125d3d26bb142b52ab7abbde95fefaa3123e601744aa67292bee8e6a308f796" })
]);
var BILLING_APPLICATION_READINESS_SQL = `WITH required AS (
 SELECT * FROM jsonb_to_recordset($1::jsonb) AS e(name text,rights text[])
), parsers AS (SELECT * FROM jsonb_to_recordset($2::jsonb) AS e(name text,hash text)), ${NOTIFICATION_READINESS_CTES}, ${APPOINTMENT_READINESS_CTES}
SELECT current_user='fmt_app_dev' AND current_user=session_user AND EXISTS(
 SELECT 1 FROM pg_catalog.pg_roles r WHERE r.rolname=current_user AND r.rolcanlogin
 AND NOT(r.rolsuper OR r.rolbypassrls OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication)) AS restricted_principal,
 current_setting('server_version_num')::integer/10000=17 AS expected_version,
 (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN('r','p'))=(SELECT count(*) FROM required) AS expected_table_count,
 NOT EXISTS(SELECT 1 FROM required e WHERE NOT EXISTS(
  SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname=e.name AND c.relkind='r' AND c.relrowsecurity
  AND NOT EXISTS(SELECT 1 FROM unnest(e.rights) p(privilege) WHERE NOT has_table_privilege(current_user,c.oid,p.privilege)))) AS required_dml,
 NOT EXISTS(SELECT 1 FROM required e JOIN pg_catalog.pg_class c ON c.relname=e.name
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND e.name IN (${[...BILLING_TABLES, ...BILLING_V2_TABLES].map((name) => `'${name}'`).join(",")})
 AND has_table_privilege(current_user,c.oid,'DELETE,TRUNCATE')) AS no_destructive_billing_access,
 NOT EXISTS(SELECT 1 FROM required e JOIN pg_catalog.pg_class c ON c.relname=e.name
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) p(privilege)
 WHERE n.nspname='public' AND has_table_privilege(current_user,c.oid,p.privilege) IS DISTINCT FROM (p.privilege=ANY(e.rights)))
 AND NOT EXISTS(SELECT 1 FROM required e JOIN pg_catalog.pg_class c ON c.relname=e.name
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid
 CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','REFERENCES']) p(privilege)
 WHERE n.nspname='public' AND a.attnum>0 AND NOT a.attisdropped AND NOT p.privilege=ANY(e.rights)
 AND has_column_privilege(current_user,c.oid,a.attnum,p.privilege))
 AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) p(privilege)
 WHERE n.nspname='public' AND c.relkind IN('r','p','v','m','f') AND NOT EXISTS(SELECT 1 FROM required e WHERE e.name=c.relname)
 AND has_table_privilege(current_user,c.oid,p.privilege)) AS exact_public_dml,
 NOT EXISTS(SELECT 1 FROM parsers e WHERE NOT EXISTS(
 SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 JOIN pg_catalog.pg_roles owner ON owner.oid=p.proowner
 WHERE n.nspname='audit_contract' AND p.proname=e.name AND oidvectortypes(p.proargtypes)='text, text, text'
 AND p.prorettype='jsonb'::regtype AND p.prosecdef AND p.provolatile='s'
 AND owner.rolname='fm_audit_contract_owner' AND NOT(owner.rolcanlogin OR owner.rolsuper OR owner.rolbypassrls)
 AND cardinality(p.proconfig)=1 AND regexp_replace(p.proconfig[1],'[[:space:]]','','g')='search_path=pg_catalog,pg_temp'
 AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')=e.hash)) AS expected_audit_parsers,
 (SELECT count(*) FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal
 AND t.tgenabled='O' AND (c.relname,t.tgname) IN (
 ('billing_offer_revisions','billing_offer_immutable'),('billing_price_mappings','billing_price_identity_immutable'),
 ('billing_offer_settings','billing_offer_settings_cas'),('billing_subscriptions','billing_subscription_offer_immutable')))=4 AS immutable_guards,
 ${NOTIFICATION_READINESS_SELECT}, ${APPOINTMENT_READINESS_SELECT}`;
var rights = Object.freeze([
  ...APP_TABLES.map((name) => ({ name, rights: ["SELECT", "INSERT", "UPDATE", ...DELETE_TABLES.includes(name) ? ["DELETE"] : []] })),
  { name: "user_search_locations", rights: ["SELECT", "INSERT", "UPDATE", "DELETE"] },
  ...BILLING_TABLES.map((name) => ({ name, rights: ["SELECT", "INSERT", "UPDATE"] })),
  ...BILLING_V2_TABLES.map((name) => ({ name, rights: BILLING_V2_RIGHTS[name] })),
  ...NOTIFICATION_RUNTIME_RIGHTS,
  ...APPOINTMENT_RUNTIME_RIGHTS
]);
var parameters = Object.freeze([JSON.stringify(rights), JSON.stringify(EXPECTED_BILLING_PARSERS), NOTIFICATION_RUNTIME_CONTRACT_JSON, APPOINTMENT_RUNTIME_CONTRACT_JSON]);
function billingApplicationReadinessArguments() {
  return [...parameters];
}
var BILLING_APPLICATION_READINESS_KEYS = Object.freeze(["restricted_principal", "expected_version", "expected_table_count", "required_dml", "no_destructive_billing_access", "exact_public_dml", "expected_audit_parsers", "immutable_guards", "notification_columns", "notification_constraints", "notification_indexes", "notification_private_acl", "notification_policies", "notification_schema_access", "appointment_columns", "appointment_constraints", "appointment_indexes", "appointment_private_acl", "appointment_policies", "appointment_schema_access"]);

// migrations/wishlist/runtime-contract.json
var runtime_contract_default3 = {
  version: "wishlist-runtime-v1",
  tables: [
    "wishlist_services",
    "product_activity_events",
    "service_activity_groups",
    "service_activity_reads",
    "booking_message_reads"
  ],
  columns: [
    {
      table: "wishlist_services",
      name: "user_id",
      type: "character varying",
      notNull: true,
      default: null
    },
    {
      table: "wishlist_services",
      name: "service_id",
      type: "integer",
      notNull: true,
      default: null
    },
    {
      table: "wishlist_services",
      name: "saved_at",
      type: "timestamp with time zone",
      notNull: true,
      default: "now()"
    },
    {
      table: "product_activity_events",
      name: "id",
      type: "uuid",
      notNull: true,
      default: null
    },
    {
      table: "product_activity_events",
      name: "kind",
      type: "character varying",
      notNull: true,
      default: null
    },
    {
      table: "product_activity_events",
      name: "user_id",
      type: "character varying",
      notNull: false,
      default: null
    },
    {
      table: "product_activity_events",
      name: "service_id",
      type: "integer",
      notNull: true,
      default: null
    },
    {
      table: "product_activity_events",
      name: "provider_id",
      type: "character varying",
      notNull: true,
      default: null
    },
    {
      table: "product_activity_events",
      name: "company_id",
      type: "integer",
      notNull: false,
      default: null
    },
    {
      table: "product_activity_events",
      name: "reporting_day",
      type: "date",
      notNull: true,
      default: null
    },
    {
      table: "product_activity_events",
      name: "occurred_at",
      type: "timestamp with time zone",
      notNull: true,
      default: "now()"
    },
    {
      table: "product_activity_events",
      name: "expires_at",
      type: "timestamp with time zone",
      notNull: true,
      default: null
    },
    {
      table: "product_activity_events",
      name: "processed_at",
      type: "timestamp with time zone",
      notNull: false,
      default: null
    },
    {
      table: "service_activity_groups",
      name: "id",
      type: "uuid",
      notNull: true,
      default: null
    },
    {
      table: "service_activity_groups",
      name: "kind",
      type: "character varying",
      notNull: true,
      default: null
    },
    {
      table: "service_activity_groups",
      name: "service_id",
      type: "integer",
      notNull: true,
      default: null
    },
    {
      table: "service_activity_groups",
      name: "provider_id",
      type: "character varying",
      notNull: true,
      default: null
    },
    {
      table: "service_activity_groups",
      name: "company_id",
      type: "integer",
      notNull: false,
      default: null
    },
    {
      table: "service_activity_groups",
      name: "scope_key",
      type: "character varying",
      notNull: true,
      default: null
    },
    {
      table: "service_activity_groups",
      name: "reporting_day",
      type: "date",
      notNull: true,
      default: null
    },
    {
      table: "service_activity_groups",
      name: "count",
      type: "integer",
      notNull: true,
      default: "1"
    },
    {
      table: "service_activity_groups",
      name: "revision",
      type: "integer",
      notNull: true,
      default: "1"
    },
    {
      table: "service_activity_groups",
      name: "updated_at",
      type: "timestamp with time zone",
      notNull: true,
      default: "now()"
    },
    {
      table: "service_activity_groups",
      name: "expires_at",
      type: "timestamp with time zone",
      notNull: true,
      default: null
    },
    {
      table: "service_activity_reads",
      name: "user_id",
      type: "character varying",
      notNull: true,
      default: null
    },
    {
      table: "service_activity_reads",
      name: "group_id",
      type: "uuid",
      notNull: true,
      default: null
    },
    {
      table: "service_activity_reads",
      name: "read_revision",
      type: "integer",
      notNull: true,
      default: "0"
    },
    {
      table: "booking_message_reads",
      name: "user_id",
      type: "character varying",
      notNull: true,
      default: null
    },
    {
      table: "booking_message_reads",
      name: "message_id",
      type: "uuid",
      notNull: true,
      default: null
    },
    {
      table: "booking_message_reads",
      name: "context_key",
      type: "character varying(100)",
      notNull: true,
      default: null
    },
    {
      table: "booking_message_reads",
      name: "read_at",
      type: "timestamp with time zone",
      notNull: true,
      default: "now()"
    }
  ],
  constraints: [
    {
      table: "wishlist_services",
      name: "wishlist_services_user_id_service_id_pk",
      type: "p",
      columns: [
        "user_id",
        "service_id"
      ]
    },
    {
      table: "wishlist_services",
      name: "wishlist_services_user_id_users_id_fk",
      type: "f",
      columns: [
        "user_id"
      ],
      referenceTable: "users",
      referenceColumns: [
        "id"
      ],
      onDelete: "c"
    },
    {
      table: "wishlist_services",
      name: "wishlist_services_service_id_services_id_fk",
      type: "f",
      columns: [
        "service_id"
      ],
      referenceTable: "services",
      referenceColumns: [
        "id"
      ],
      onDelete: "c"
    },
    {
      table: "product_activity_events",
      name: "product_activity_shape",
      type: "c",
      expression: "kind=anyarray['wishlist_additions','service_views']andkind<>'wishlist_additions'oruser_idisnotnullandreporting_day=occurred_atattimezone'utc'::dateandexpires_at>occurred_atandexpires_at<=occurred_at+'2160:00:00'::intervalandprocessed_atisnullorprocessed_at>=occurred_at"
    },
    {
      table: "product_activity_events",
      name: "product_activity_events_pkey",
      type: "p",
      columns: [
        "id"
      ]
    },
    {
      table: "product_activity_events",
      name: "product_activity_events_user_id_users_id_fk",
      type: "f",
      columns: [
        "user_id"
      ],
      referenceTable: "users",
      referenceColumns: [
        "id"
      ],
      onDelete: "c"
    },
    {
      table: "product_activity_events",
      name: "product_activity_events_service_id_services_id_fk",
      type: "f",
      columns: [
        "service_id"
      ],
      referenceTable: "services",
      referenceColumns: [
        "id"
      ],
      onDelete: "c"
    },
    {
      table: "product_activity_events",
      name: "product_activity_events_provider_id_users_id_fk",
      type: "f",
      columns: [
        "provider_id"
      ],
      referenceTable: "users",
      referenceColumns: [
        "id"
      ],
      onDelete: "c"
    },
    {
      table: "product_activity_events",
      name: "product_activity_events_company_id_companies_id_fk",
      type: "f",
      columns: [
        "company_id"
      ],
      referenceTable: "companies",
      referenceColumns: [
        "id"
      ],
      onDelete: "c"
    },
    {
      table: "service_activity_groups",
      name: "service_activity_group_shape",
      type: "c",
      expression: "kind=anyarray['wishlist_additions','service_views']andcount>0andrevision>0andexpires_at>updated_atandscope_key=casewhencompany_idisnullthen'provider:'||provider_idelse'company:'||company_idend"
    },
    {
      table: "service_activity_groups",
      name: "service_activity_groups_pkey",
      type: "p",
      columns: [
        "id"
      ]
    },
    {
      table: "service_activity_groups",
      name: "service_activity_groups_service_id_services_id_fk",
      type: "f",
      columns: [
        "service_id"
      ],
      referenceTable: "services",
      referenceColumns: [
        "id"
      ],
      onDelete: "c"
    },
    {
      table: "service_activity_groups",
      name: "service_activity_groups_provider_id_users_id_fk",
      type: "f",
      columns: [
        "provider_id"
      ],
      referenceTable: "users",
      referenceColumns: [
        "id"
      ],
      onDelete: "c"
    },
    {
      table: "service_activity_groups",
      name: "service_activity_groups_company_id_companies_id_fk",
      type: "f",
      columns: [
        "company_id"
      ],
      referenceTable: "companies",
      referenceColumns: [
        "id"
      ],
      onDelete: "c"
    },
    {
      table: "service_activity_reads",
      name: "service_activity_read_revision_check",
      type: "c",
      expression: "read_revision>=0"
    },
    {
      table: "service_activity_reads",
      name: "service_activity_reads_user_id_group_id_pk",
      type: "p",
      columns: [
        "user_id",
        "group_id"
      ]
    },
    {
      table: "service_activity_reads",
      name: "service_activity_reads_user_id_users_id_fk",
      type: "f",
      columns: [
        "user_id"
      ],
      referenceTable: "users",
      referenceColumns: [
        "id"
      ],
      onDelete: "c"
    },
    {
      table: "service_activity_reads",
      name: "service_activity_reads_group_id_service_activity_groups_id_fk",
      type: "f",
      columns: [
        "group_id"
      ],
      referenceTable: "service_activity_groups",
      referenceColumns: [
        "id"
      ],
      onDelete: "c"
    },
    {
      table: "booking_message_reads",
      name: "booking_message_read_context_check",
      type: "c",
      expression: "context_key=anyarray['customer','provider:personal']orcontext_key~'^provider:company:[1-9][0-9]*$'"
    },
    {
      table: "booking_message_reads",
      name: "booking_message_reads_user_id_message_id_context_key_pk",
      type: "p",
      columns: [
        "user_id",
        "message_id",
        "context_key"
      ]
    },
    {
      table: "booking_message_reads",
      name: "booking_message_reads_user_id_users_id_fk",
      type: "f",
      columns: [
        "user_id"
      ],
      referenceTable: "users",
      referenceColumns: [
        "id"
      ],
      onDelete: "c"
    },
    {
      table: "booking_message_reads",
      name: "booking_message_reads_message_id_booking_messages_id_fk",
      type: "f",
      columns: [
        "message_id"
      ],
      referenceTable: "booking_messages",
      referenceColumns: [
        "id"
      ],
      onDelete: "c"
    }
  ],
  indexes: [
    {
      table: "wishlist_services",
      name: "wishlist_services_user_id_service_id_pk",
      unique: true,
      columns: [
        "user_id",
        "service_id"
      ],
      descending: [
        false,
        false
      ],
      predicate: null
    },
    {
      table: "wishlist_services",
      name: "wishlist_user_saved_idx",
      unique: false,
      columns: [
        "user_id",
        "saved_at",
        "service_id"
      ],
      descending: [
        false,
        true,
        true
      ],
      predicate: null
    },
    {
      table: "wishlist_services",
      name: "wishlist_service_idx",
      unique: false,
      columns: [
        "service_id"
      ],
      descending: [
        false
      ],
      predicate: null
    },
    {
      table: "product_activity_events",
      name: "product_activity_events_pkey",
      unique: true,
      columns: [
        "id"
      ],
      descending: [
        false
      ],
      predicate: null
    },
    {
      table: "product_activity_events",
      name: "product_wishlist_daily_identity",
      unique: true,
      columns: [
        "user_id",
        "service_id",
        "reporting_day"
      ],
      descending: [
        false,
        false,
        false
      ],
      predicate: "kind='wishlist_additions'"
    },
    {
      table: "product_activity_events",
      name: "product_activity_pending_idx",
      unique: false,
      columns: [
        "reporting_day",
        "occurred_at",
        "id"
      ],
      descending: [
        false,
        false,
        false
      ],
      predicate: "processed_atisnull"
    },
    {
      table: "product_activity_events",
      name: "product_activity_expiry_idx",
      unique: false,
      columns: [
        "expires_at"
      ],
      descending: [
        false
      ],
      predicate: null
    },
    {
      table: "product_activity_events",
      name: "product_activity_user_idx",
      unique: false,
      columns: [
        "user_id"
      ],
      descending: [
        false
      ],
      predicate: null
    },
    {
      table: "product_activity_events",
      name: "product_activity_service_idx",
      unique: false,
      columns: [
        "service_id"
      ],
      descending: [
        false
      ],
      predicate: null
    },
    {
      table: "product_activity_events",
      name: "product_activity_provider_idx",
      unique: false,
      columns: [
        "provider_id"
      ],
      descending: [
        false
      ],
      predicate: null
    },
    {
      table: "product_activity_events",
      name: "product_activity_company_idx",
      unique: false,
      columns: [
        "company_id"
      ],
      descending: [
        false
      ],
      predicate: null
    },
    {
      table: "service_activity_groups",
      name: "service_activity_groups_pkey",
      unique: true,
      columns: [
        "id"
      ],
      descending: [
        false
      ],
      predicate: null
    },
    {
      table: "service_activity_groups",
      name: "service_activity_group_identity",
      unique: true,
      columns: [
        "kind",
        "service_id",
        "reporting_day",
        "scope_key"
      ],
      descending: [
        false,
        false,
        false,
        false
      ],
      predicate: null
    },
    {
      table: "service_activity_groups",
      name: "service_activity_scope_day_idx",
      unique: false,
      columns: [
        "scope_key",
        "reporting_day",
        "id"
      ],
      descending: [
        false,
        true,
        true
      ],
      predicate: null
    },
    {
      table: "service_activity_groups",
      name: "service_activity_group_expiry_idx",
      unique: false,
      columns: [
        "expires_at"
      ],
      descending: [
        false
      ],
      predicate: null
    },
    {
      table: "service_activity_groups",
      name: "service_activity_group_service_idx",
      unique: false,
      columns: [
        "service_id"
      ],
      descending: [
        false
      ],
      predicate: null
    },
    {
      table: "service_activity_groups",
      name: "service_activity_group_provider_idx",
      unique: false,
      columns: [
        "provider_id"
      ],
      descending: [
        false
      ],
      predicate: null
    },
    {
      table: "service_activity_groups",
      name: "service_activity_group_company_idx",
      unique: false,
      columns: [
        "company_id"
      ],
      descending: [
        false
      ],
      predicate: null
    },
    {
      table: "service_activity_reads",
      name: "service_activity_reads_user_id_group_id_pk",
      unique: true,
      columns: [
        "user_id",
        "group_id"
      ],
      descending: [
        false,
        false
      ],
      predicate: null
    },
    {
      table: "service_activity_reads",
      name: "service_activity_read_group_idx",
      unique: false,
      columns: [
        "group_id"
      ],
      descending: [
        false
      ],
      predicate: null
    },
    {
      table: "booking_message_reads",
      name: "booking_message_reads_user_id_message_id_context_key_pk",
      unique: true,
      columns: [
        "user_id",
        "message_id",
        "context_key"
      ],
      descending: [
        false,
        false,
        false
      ],
      predicate: null
    },
    {
      table: "booking_message_reads",
      name: "booking_message_read_message_idx",
      unique: false,
      columns: [
        "message_id"
      ],
      descending: [
        false
      ],
      predicate: null
    }
  ]
};

// migrations/wishlist/runtime-contract.mjs
var WISHLIST_RUNTIME_TABLES = Object.freeze([...runtime_contract_default3.tables]);
var WISHLIST_RUNTIME_CONTRACT_JSON = JSON.stringify(runtime_contract_default3);
var WISHLIST_RUNTIME_RIGHTS = Object.freeze(WISHLIST_RUNTIME_TABLES.map((name) => Object.freeze({ name, rights: Object.freeze(["SELECT", "INSERT", "UPDATE", "DELETE"]) })));
var WISHLIST_READINESS_CTES = APPOINTMENT_READINESS_CTES.replaceAll("appointment", "wishlist").replace("$4::jsonb", "$5::jsonb").replace("columns text[],predicate text)", "columns text[],descending boolean[],predicate text)");
var WISHLIST_READINESS_SELECT = APPOINTMENT_READINESS_SELECT.replaceAll("appointment", "wishlist").replace("AND i.indexprs IS NULL", `AND ARRAY(SELECT (option & 1)=1 FROM unnest(i.indoption::smallint[]) WITH ORDINALITY k(option,position) ORDER BY k.position)=e.descending
 AND i.indexprs IS NULL`);

// migrations/wishlist/application-readiness.mjs
var marker = "\nSELECT current_user=";
if (BILLING_APPLICATION_READINESS_SQL.split(marker).length !== 2) throw new Error("WISHLIST_BASE_PROFILE_CHANGED");
var WISHLIST_APPLICATION_READINESS_SQL = BILLING_APPLICATION_READINESS_SQL.replace(marker, `, ${WISHLIST_READINESS_CTES}${marker}`) + `, ${WISHLIST_READINESS_SELECT}`;
var WISHLIST_APPLICATION_READINESS_KEYS = Object.freeze([...BILLING_APPLICATION_READINESS_KEYS, "wishlist_columns", "wishlist_constraints", "wishlist_indexes", "wishlist_private_acl", "wishlist_policies", "wishlist_schema_access"]);
function wishlistApplicationReadinessArguments() {
  const base = billingApplicationReadinessArguments();
  return [JSON.stringify([...JSON.parse(base[0]), ...WISHLIST_RUNTIME_RIGHTS]), ...base.slice(1), WISHLIST_RUNTIME_CONTRACT_JSON];
}

// migrations/workspace-pricing/runtime-contract.json
var runtime_contract_default4 = {
  version: "workspace-pricing-v1",
  tables: [
    "workspace_pricing_settings"
  ],
  columns: [
    {
      table: "workspace_pricing_settings",
      name: "id",
      type: "uuid",
      notNull: true,
      default: null
    },
    {
      table: "workspace_pricing_settings",
      name: "user_id",
      type: "character varying",
      notNull: false,
      default: null
    },
    {
      table: "workspace_pricing_settings",
      name: "company_id",
      type: "integer",
      notNull: false,
      default: null
    },
    {
      table: "workspace_pricing_settings",
      name: "default_currency",
      type: "character varying(3)",
      notNull: false,
      default: null
    },
    {
      table: "workspace_pricing_settings",
      name: "business_country_code",
      type: "character varying(2)",
      notNull: false,
      default: null
    },
    {
      table: "workspace_pricing_settings",
      name: "revision",
      type: "integer",
      notNull: true,
      default: "1"
    },
    {
      table: "workspace_pricing_settings",
      name: "created_at",
      type: "timestamp with time zone",
      notNull: true,
      default: "now()"
    },
    {
      table: "workspace_pricing_settings",
      name: "updated_at",
      type: "timestamp with time zone",
      notNull: true,
      default: "now()"
    },
    {
      table: "addresses",
      name: "pricing_currency",
      type: "character varying(3)",
      notNull: false,
      default: null
    }
  ],
  constraints: [
    {
      table: "workspace_pricing_settings",
      name: "workspace_pricing_owner_check",
      type: "c",
      expression: "user_idisnotnull<>company_idisnotnull"
    },
    {
      table: "workspace_pricing_settings",
      name: "workspace_pricing_currency_check",
      type: "c",
      expression: "default_currencyisnullordefault_currency=anyarray['aed','afn','all','amd','aoa','ars','aud','awg','azn','bam','bbd','bdt','bhd','bif','bmd','bnd','bob','brl','bsd','btn','bwp','byn','bzd','cad','cdf','chf','clp','cny','cop','crc','cup','cve','czk','djf','dkk','dop','dzd','egp','ern','etb','eur','fjd','fkp','gbp','gel','ghs','gip','gmd','gnf','gtq','gyd','hkd','hnl','htg','huf','idr','ils','inr','iqd','irr','isk','jmd','jod','jpy','kes','kgs','khr','kmf','kpw','krw','kwd','kyd','kzt','lak','lbp','lkr','lrd','lsl','lyd','mad','mdl','mga','mkd','mmk','mnt','mop','mru','mur','mvr','mwk','mxn','myr','mzn','nad','ngn','nio','nok','npr','nzd','omr','pab','pen','pgk','php','pkr','pln','pyg','qar','ron','rsd','rub','rwf','sar','sbd','scr','sdg','sek','sgd','shp','sle','sos','srd','ssp','stn','syp','szl','thb','tjs','tmt','tnd','top','try','ttd','twd','tzs','uah','ugx','usd','uyu','uzs','ves','vnd','vuv','wst','xaf','xcd','xcg','xof','xpf','yer','zar','zmw','zwg']"
    },
    {
      table: "workspace_pricing_settings",
      name: "workspace_pricing_country_check",
      type: "c",
      expression: "business_country_codeisnullorbusiness_country_code=anyarray['ad','ae','af','ag','ai','al','am','ao','aq','ar','as','at','au','aw','ax','az','ba','bb','bd','be','bf','bg','bh','bi','bj','bl','bm','bn','bo','bq','br','bs','bt','bv','bw','by','bz','ca','cc','cd','cf','cg','ch','ci','ck','cl','cm','cn','co','cr','cu','cv','cw','cx','cy','cz','de','dj','dk','dm','do','dz','ec','ee','eg','eh','er','es','et','fi','fj','fk','fm','fo','fr','ga','gb','gd','ge','gf','gg','gh','gi','gl','gm','gn','gp','gq','gr','gs','gt','gu','gw','gy','hk','hm','hn','hr','ht','hu','id','ie','il','im','in','io','iq','ir','is','it','je','jm','jo','jp','ke','kg','kh','ki','km','kn','kp','kr','kw','ky','kz','la','lb','lc','li','lk','lr','ls','lt','lu','lv','ly','ma','mc','md','me','mf','mg','mh','mk','ml','mm','mn','mo','mp','mq','mr','ms','mt','mu','mv','mw','mx','my','mz','na','nc','ne','nf','ng','ni','nl','no','np','nr','nu','nz','om','pa','pe','pf','pg','ph','pk','pl','pm','pn','pr','ps','pt','pw','py','qa','re','ro','rs','ru','rw','sa','sb','sc','sd','se','sg','sh','si','sj','sk','sl','sm','sn','so','sr','ss','st','sv','sx','sy','sz','tc','td','tf','tg','th','tj','tk','tl','tm','tn','to','tr','tt','tv','tw','tz','ua','ug','um','us','uy','uz','va','vc','ve','vg','vi','vn','vu','wf','ws','ye','yt','za','zm','zw']"
    },
    {
      table: "workspace_pricing_settings",
      name: "workspace_pricing_revision_check",
      type: "c",
      expression: "revision>0"
    },
    {
      table: "addresses",
      name: "addresses_pricing_currency_check",
      type: "c",
      expression: "pricing_currencyisnullorpricing_currency=anyarray['aed','afn','all','amd','aoa','ars','aud','awg','azn','bam','bbd','bdt','bhd','bif','bmd','bnd','bob','brl','bsd','btn','bwp','byn','bzd','cad','cdf','chf','clp','cny','cop','crc','cup','cve','czk','djf','dkk','dop','dzd','egp','ern','etb','eur','fjd','fkp','gbp','gel','ghs','gip','gmd','gnf','gtq','gyd','hkd','hnl','htg','huf','idr','ils','inr','iqd','irr','isk','jmd','jod','jpy','kes','kgs','khr','kmf','kpw','krw','kwd','kyd','kzt','lak','lbp','lkr','lrd','lsl','lyd','mad','mdl','mga','mkd','mmk','mnt','mop','mru','mur','mvr','mwk','mxn','myr','mzn','nad','ngn','nio','nok','npr','nzd','omr','pab','pen','pgk','php','pkr','pln','pyg','qar','ron','rsd','rub','rwf','sar','sbd','scr','sdg','sek','sgd','shp','sle','sos','srd','ssp','stn','syp','szl','thb','tjs','tmt','tnd','top','try','ttd','twd','tzs','uah','ugx','usd','uyu','uzs','ves','vnd','vuv','wst','xaf','xcd','xcg','xof','xpf','yer','zar','zmw','zwg']"
    },
    {
      table: "workspace_pricing_settings",
      name: "workspace_pricing_settings_pkey",
      type: "p",
      columns: [
        "id"
      ]
    },
    {
      table: "workspace_pricing_settings",
      name: "workspace_pricing_settings_user_id_users_id_fk",
      type: "f",
      columns: [
        "user_id"
      ],
      referenceTable: "users",
      referenceColumns: [
        "id"
      ],
      onDelete: "c"
    },
    {
      table: "workspace_pricing_settings",
      name: "workspace_pricing_settings_company_id_companies_id_fk",
      type: "f",
      columns: [
        "company_id"
      ],
      referenceTable: "companies",
      referenceColumns: [
        "id"
      ],
      onDelete: "c"
    }
  ],
  indexes: [
    {
      table: "workspace_pricing_settings",
      name: "workspace_pricing_settings_pkey",
      unique: true,
      columns: [
        "id"
      ],
      predicate: null
    },
    {
      table: "workspace_pricing_settings",
      name: "workspace_pricing_personal_identity",
      unique: true,
      columns: [
        "user_id"
      ],
      predicate: null
    },
    {
      table: "workspace_pricing_settings",
      name: "workspace_pricing_company_identity",
      unique: true,
      columns: [
        "company_id"
      ],
      predicate: null
    }
  ]
};

// migrations/workspace-pricing/runtime-contract.mjs
var PRICING_RUNTIME_CONTRACT_JSON = JSON.stringify(runtime_contract_default4);
var PRICING_RUNTIME_RIGHTS = Object.freeze({ name: "workspace_pricing_settings", rights: Object.freeze(["SELECT", "INSERT", "UPDATE"]) });
var PRICING_READINESS_CTES = APPOINTMENT_READINESS_CTES.replaceAll("appointment", "workspace_pricing").replace("$4::jsonb", "$6::jsonb");
var marker2 = "a.privilege_type NOT IN('SELECT','INSERT','UPDATE','DELETE')";
if (!APPOINTMENT_READINESS_SELECT.includes(marker2)) throw new Error("WORKSPACE_PRICING_ACL_BASE_CHANGED");
var PRICING_READINESS_SELECT = APPOINTMENT_READINESS_SELECT.replaceAll("appointment", "workspace_pricing").replace(marker2, "a.privilege_type NOT IN('SELECT','INSERT','UPDATE')");

// migrations/workspace-pricing/application-readiness.mjs
var marker3 = "\nSELECT current_user=";
if (WISHLIST_APPLICATION_READINESS_SQL.split(marker3).length !== 2) throw new Error("WORKSPACE_PRICING_BASE_PROFILE_CHANGED");
var WORKSPACE_PRICING_APPLICATION_READINESS_SQL = WISHLIST_APPLICATION_READINESS_SQL.replace(marker3, `, ${PRICING_READINESS_CTES}${marker3}`) + `, ${PRICING_READINESS_SELECT}`;
var WORKSPACE_PRICING_APPLICATION_READINESS_KEYS = Object.freeze([
  ...WISHLIST_APPLICATION_READINESS_KEYS,
  "workspace_pricing_columns",
  "workspace_pricing_constraints",
  "workspace_pricing_indexes",
  "workspace_pricing_private_acl",
  "workspace_pricing_policies",
  "workspace_pricing_schema_access"
]);
function workspacePricingApplicationReadinessArguments() {
  const base = wishlistApplicationReadinessArguments();
  return [JSON.stringify([...JSON.parse(base[0]), PRICING_RUNTIME_RIGHTS]), ...base.slice(1), PRICING_RUNTIME_CONTRACT_JSON];
}
var WorkspacePricingDatabaseReadinessError = class extends Error {
  code = "WORKSPACE_PRICING_DB_NOT_READY";
  constructor(checks) {
    super("WORKSPACE_PRICING_DB_NOT_READY");
    this.checks = checks;
  }
};
function assertWorkspacePricingApplicationReadiness(rows) {
  const keys = WORKSPACE_PRICING_APPLICATION_READINESS_KEYS;
  const shape = Array.isArray(rows) && rows.length === 1 && rows[0] && typeof rows[0] === "object" && Object.keys(rows[0]).length === keys.length;
  if (!shape || keys.some((key) => rows[0][key] !== true)) throw new WorkspacePricingDatabaseReadinessError(shape ? keys.filter((key) => rows[0][key] !== true) : ["readiness_result_shape"]);
}
async function verifyWorkspacePricingDatabaseReadiness(query) {
  let rows;
  try {
    ({ rows } = await query(WORKSPACE_PRICING_APPLICATION_READINESS_SQL, workspacePricingApplicationReadinessArguments()));
  } catch {
    throw new WorkspacePricingDatabaseReadinessError(["metadata_query"]);
  }
  assertWorkspacePricingApplicationReadiness(rows);
}

// server/billing/database-readiness.ts
var BillingDatabaseReadinessError = class extends Error {
  constructor(checks) {
    super("BILLING_DB_NOT_READY");
    this.checks = checks;
  }
  code = "BILLING_DB_NOT_READY";
};
async function verifyBillingDatabaseReadiness(query) {
  let rows;
  try {
    const result = await query(WORKSPACE_PRICING_APPLICATION_READINESS_SQL, workspacePricingApplicationReadinessArguments());
    rows = result.rows;
  } catch {
    throw new BillingDatabaseReadinessError(["metadata_query"]);
  }
  try {
    assertWorkspacePricingApplicationReadiness(rows);
  } catch {
    let failed = [];
    try {
      if (Array.isArray(rows) && rows.length === 1 && rows[0] && typeof rows[0] === "object") failed = WORKSPACE_PRICING_APPLICATION_READINESS_KEYS.filter((key) => rows[0][key] !== true);
    } catch {
    }
    throw new BillingDatabaseReadinessError(failed.length ? failed : ["readiness_result_shape"]);
  }
}

// server/health.ts
function setupHealthRoutes(app2, checkDatabase, isDraining) {
  app2.get("/health/live", (_req, res) => {
    res.set("Cache-Control", "no-store").json({ status: "ok" });
  });
  app2.get("/health/ready", async (_req, res) => {
    res.set("Cache-Control", "no-store");
    if (isDraining()) return res.status(503).json({ status: "unavailable" });
    try {
      await checkDatabase();
      res.json({ status: "ready" });
    } catch {
      res.status(503).json({ status: "unavailable" });
    }
  });
}

// server/index.ts
init_config();

// server/audit/application.ts
init_config();
init_capture();
function assertAuditApplicationRole(rows) {
  const row = rows[0];
  if (rows.length !== 1 || row.principal !== "fmt_app_dev" || row.rolcanlogin !== true || row.rolinherit !== true || row.rolconnlimit !== 5 || ["app_member", "capture_member", "may_enqueue"].some((key) => row[key] !== true) || [
    "rolsuper",
    "rolbypassrls",
    "rolcreaterole",
    "rolcreatedb",
    "rolreplication",
    "extra_role",
    "membership_admin",
    "owns_objects",
    "permanent_ddl",
    "audit_base_access"
  ].some((key) => row[key] !== false)) throw new AuditCaptureUnavailable();
}
async function verifyAuditApplicationPool(pool2, environment) {
  assertAuditActivation(environment);
  if (environment.AUDIT_ENABLED !== "true") return;
  auditApplicationConnection(environment.DATABASE_URL);
  let client2;
  try {
    client2 = await pool2.connect();
  } catch {
    throw new AuditCaptureUnavailable();
  }
  let failed = true;
  try {
    const stream = client2.connection?.stream;
    if (stream?.encrypted !== true || stream.authorized !== true) throw new AuditCaptureUnavailable();
    const result = await client2.query(`SELECT current_user AS principal,r.rolcanlogin,r.rolinherit,r.rolconnlimit,
      r.rolsuper,r.rolbypassrls,r.rolcreaterole,r.rolcreatedb,r.rolreplication,
      pg_has_role(current_user,'fm_app_runtime','USAGE') AS app_member,
      pg_has_role(current_user,'fm_audit_capture','USAGE') AS capture_member,
      has_function_privilege(current_user,'audit_capture.enqueue(text,text,text)','EXECUTE') AS may_enqueue,
      EXISTS(SELECT 1 FROM pg_roles g WHERE g.rolname NOT IN (current_user,'fm_app_runtime','fm_audit_capture')
        AND pg_has_role(current_user,g.oid,'MEMBER')) AS extra_role,
      EXISTS(SELECT 1 FROM pg_auth_members m WHERE m.member=r.oid AND m.admin_option) AS membership_admin,
      EXISTS(SELECT 1 FROM pg_class c WHERE c.relowner=r.oid) OR
        EXISTS(SELECT 1 FROM pg_namespace n WHERE n.nspowner=r.oid) AS owns_objects,
      EXISTS(SELECT 1 FROM pg_namespace n WHERE has_schema_privilege(current_user,n.oid,'CREATE')) OR
        has_database_privilege(current_user,current_database(),'CREATE') AS permanent_ddl,
      has_table_privilege(current_user,'audit_capture.audit_outbox','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS audit_base_access
      FROM pg_roles r WHERE r.rolname=current_user`);
    assertAuditApplicationRole(result.rows);
    failed = false;
  } catch {
    throw new AuditCaptureUnavailable();
  } finally {
    client2.release(failed);
  }
}

// server/notifications/webhooks.ts
import express3 from "express";
import { randomUUID as randomUUID23 } from "node:crypto";
import { and as and21, eq as eq26, or as or8 } from "drizzle-orm";
import { z as z44 } from "zod";
var providerId = z44.string().min(1).max(255);
var vonagePayload = z44.object({
  message_uuid: providerId,
  channel: z44.enum(["sms", "whatsapp"]),
  status: z44.string().max(50).optional(),
  client_ref: z44.string().uuid().optional(),
  from: z44.string().max(30).optional(),
  to: z44.string().max(30).optional(),
  text: z44.string().max(2e3).optional(),
  message_type: z44.string().max(30).optional()
});
var resendPayload = z44.object({ type: z44.string().max(80), data: z44.object({ email_id: providerId }) });
function mountNotificationWebhooks(app2) {
  app2.post("/api/notifications/webhooks/:provider", express3.raw({ type: "application/json", limit: "32kb" }), async (req, res) => {
    const config = notificationConfig();
    res.set("Cache-Control", "no-store");
    if (!config.enabled || !Buffer.isBuffer(req.body)) return void res.sendStatus(503);
    try {
      const provider = z44.enum(["vonage", "resend"]).parse(req.params.provider);
      let eventId;
      if (provider === "vonage") {
        const verified = verifyVonage(req.body, req.get("authorization") ?? "", config);
        if (!verified) return void res.sendStatus(401);
        eventId = verified;
      } else {
        eventId = req.get("svix-id") ?? "";
        if (!verifyResend(req.body, { id: eventId, timestamp: req.get("svix-timestamp") ?? "", signature: req.get("svix-signature") ?? "" }, config.resendSecret)) return void res.sendStatus(401);
      }
      const input = JSON.parse(req.body.toString("utf8"));
      const vonage = provider === "vonage" ? vonagePayload.parse(input) : null;
      const resend = provider === "resend" ? resendPayload.parse(input) : null;
      await db.transaction(async (tx) => {
        const [record] = await tx.insert(notificationCallbacks).values({ id: randomUUID23(), provider, providerEventId: eventId }).onConflictDoNothing().returning();
        if (!record) return;
        if (vonage && !vonage.status) {
          const sender = vonage.channel === "sms" ? config.smsFrom : config.whatsappFrom;
          if (vonage.to?.replace(/^\+/, "") !== sender.replace(/^\+/, "") || !vonage.from || !/^(STOP|UNSUBSCRIBE|CANCEL|END|QUIT)$/i.test(vonage.text?.trim() ?? "")) return;
          const phone = `+${vonage.from.replace(/^\+/, "")}`;
          await tx.update(userCommunicationPreferences).set(vonage.channel === "sms" ? { smsOptIn: false, preferredMethod: "email", updatedAt: /* @__PURE__ */ new Date() } : { whatsappOptIn: false, preferredMethod: "email", updatedAt: /* @__PURE__ */ new Date() }).where(eq26(userCommunicationPreferences.phone, phone));
          return;
        }
        const messageId = vonage?.message_uuid ?? resend.data.email_id;
        const [attempt] = await tx.select().from(notificationDeliveryAttempts).where(and21(
          eq26(notificationDeliveryAttempts.provider, provider),
          or8(eq26(notificationDeliveryAttempts.providerMessageId, messageId), vonage?.client_ref ? eq26(notificationDeliveryAttempts.jobId, vonage.client_ref) : void 0)
        ));
        if (!attempt) throw new Error("correlation_pending");
        if (attempt.providerMessageId && attempt.providerMessageId !== messageId) throw new Error("correlation_mismatch");
        const [job] = await tx.select().from(notificationJobs).where(eq26(notificationJobs.id, attempt.jobId)).for("update");
        if (!job) return;
        const [lockedAttempt] = await tx.select().from(notificationDeliveryAttempts).where(eq26(notificationDeliveryAttempts.id, attempt.id)).for("update");
        if (!lockedAttempt || lockedAttempt.providerMessageId && lockedAttempt.providerMessageId !== messageId) throw new Error("correlation_mismatch");
        const status = vonage?.status ?? resend.type;
        const next = ["delivered", "read", "email.delivered"].includes(status) ? "delivered" : ["rejected", "undeliverable", "failed", "email.failed", "email.bounced", "email.complained", "email.suppressed"].includes(status) ? "failed" : ["submitted", "accepted", "email.sent"].includes(status) ? "accepted" : null;
        if (!next) return;
        const state = deliveryTransition(job.state, next);
        const reasonCode = state === "delivered" || state === "accepted" ? null : state === "failed" ? "delivery_failed" : job.reasonCode;
        await tx.update(notificationJobs).set({ state, providerMessageId: messageId, leaseToken: null, leaseUntil: null, updatedAt: /* @__PURE__ */ new Date(), reasonCode }).where(eq26(notificationJobs.id, job.id));
        if (state === "accepted" || state === "delivered" || state === "failed") await tx.update(notificationDeliveryAttempts).set({ state, providerMessageId: messageId, errorCode: reasonCode, updatedAt: /* @__PURE__ */ new Date() }).where(eq26(notificationDeliveryAttempts.id, attempt.id));
        if (resend && ["email.bounced", "email.complained", "email.suppressed"].includes(resend.type)) {
          const [recipient] = await tx.select({ seekerId: bookings.seekerId }).from(notificationEvents).innerJoin(bookings, eq26(bookings.id, notificationEvents.bookingId)).where(eq26(notificationEvents.id, job.eventId));
          if (recipient) await tx.insert(userCommunicationPreferences).values({ userId: recipient.seekerId, emailSuppressed: true }).onConflictDoUpdate({ target: userCommunicationPreferences.userId, set: { emailSuppressed: true, updatedAt: /* @__PURE__ */ new Date() } });
        }
      });
      res.sendStatus(204);
    } catch (error) {
      res.sendStatus(error instanceof z44.ZodError || error instanceof SyntaxError ? 400 : 503);
    }
  });
}

// migrations/currencies/schema-contract.json
var schema_contract_default = {
  version: "currencies-v1",
  dataVersion: "CLDR-49/2026-11-05;ISO4217/2026-09-17",
  columns: [
    {
      table: "addresses",
      name: "country_code",
      type: "varchar(2)",
      notNull: false,
      hasDefault: false
    },
    {
      table: "services",
      name: "price",
      type: "numeric",
      notNull: true,
      hasDefault: false
    },
    {
      table: "services",
      name: "currency",
      type: "varchar(3)",
      notNull: true,
      hasDefault: false
    },
    {
      table: "bookings",
      name: "total_amount",
      type: "numeric",
      notNull: true,
      hasDefault: false
    },
    {
      table: "bookings",
      name: "advance_amount",
      type: "numeric",
      notNull: true,
      hasDefault: false
    },
    {
      table: "bookings",
      name: "currency",
      type: "varchar(3)",
      notNull: true,
      hasDefault: false
    }
  ],
  constraints: [
    {
      table: "addresses",
      name: "addresses_country_code_check",
      expression: `"country_code" IS NULL OR "country_code" IN ('AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ', 'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS', 'BT', 'BV', 'BW', 'BY', 'BZ', 'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN', 'CO', 'CR', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ', 'EC', 'EE', 'EG', 'EH', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK', 'FM', 'FO', 'FR', 'GA', 'GB', 'GD', 'GE', 'GF', 'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY', 'HK', 'HM', 'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR', 'IS', 'IT', 'JE', 'JM', 'JO', 'JP', 'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC', 'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK', 'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ', 'NA', 'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ', 'OM', 'PA', 'PE', 'PF', 'PG', 'PH', 'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PW', 'PY', 'QA', 'RE', 'RO', 'RS', 'RU', 'RW', 'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS', 'ST', 'SV', 'SX', 'SY', 'SZ', 'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO', 'TR', 'TT', 'TV', 'TW', 'TZ', 'UA', 'UG', 'UM', 'US', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VG', 'VI', 'VN', 'VU', 'WF', 'WS', 'YE', 'YT', 'ZA', 'ZM', 'ZW')`
    },
    {
      table: "services",
      name: "services_currency_check",
      expression: `"currency" IN ('AED', 'AFN', 'ALL', 'AMD', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN', 'BAM', 'BBD', 'BDT', 'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BRL', 'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHF', 'CLP', 'CNY', 'COP', 'CRC', 'CUP', 'CVE', 'CZK', 'DJF', 'DKK', 'DOP', 'DZD', 'EGP', 'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL', 'GHS', 'GIP', 'GMD', 'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HTG', 'HUF', 'IDR', 'ILS', 'INR', 'IQD', 'IRR', 'ISK', 'JMD', 'JOD', 'JPY', 'KES', 'KGS', 'KHR', 'KMF', 'KPW', 'KRW', 'KWD', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR', 'LRD', 'LSL', 'LYD', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP', 'MRU', 'MUR', 'MVR', 'MWK', 'MXN', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO', 'NOK', 'NPR', 'NZD', 'OMR', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN', 'PYG', 'QAR', 'RON', 'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR', 'SDG', 'SEK', 'SGD', 'SHP', 'SLE', 'SOS', 'SRD', 'SSP', 'STN', 'SYP', 'SZL', 'THB', 'TJS', 'TMT', 'TND', 'TOP', 'TRY', 'TTD', 'TWD', 'TZS', 'UAH', 'UGX', 'USD', 'UYU', 'UZS', 'VES', 'VND', 'VUV', 'WST', 'XAF', 'XCD', 'XCG', 'XOF', 'XPF', 'YER', 'ZAR', 'ZMW', 'ZWG')`
    },
    {
      table: "services",
      name: "services_price_money_check",
      expression: `"price" >= 0 AND "price" <= 99999999.99 AND "price" = trunc("price", CASE WHEN "currency" IN ('BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF') THEN 0 WHEN "currency" IN ('BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND') THEN 3 ELSE 2 END)`
    },
    {
      table: "services",
      name: "services_advance_percent_check",
      expression: '"advance_payment_percent" IS NULL OR ("advance_payment_percent" >= 0 AND "advance_payment_percent" <= 100)'
    },
    {
      table: "bookings",
      name: "bookings_currency_check",
      expression: `"currency" IN ('AED', 'AFN', 'ALL', 'AMD', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN', 'BAM', 'BBD', 'BDT', 'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BRL', 'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHF', 'CLP', 'CNY', 'COP', 'CRC', 'CUP', 'CVE', 'CZK', 'DJF', 'DKK', 'DOP', 'DZD', 'EGP', 'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL', 'GHS', 'GIP', 'GMD', 'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HTG', 'HUF', 'IDR', 'ILS', 'INR', 'IQD', 'IRR', 'ISK', 'JMD', 'JOD', 'JPY', 'KES', 'KGS', 'KHR', 'KMF', 'KPW', 'KRW', 'KWD', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR', 'LRD', 'LSL', 'LYD', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP', 'MRU', 'MUR', 'MVR', 'MWK', 'MXN', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO', 'NOK', 'NPR', 'NZD', 'OMR', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN', 'PYG', 'QAR', 'RON', 'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR', 'SDG', 'SEK', 'SGD', 'SHP', 'SLE', 'SOS', 'SRD', 'SSP', 'STN', 'SYP', 'SZL', 'THB', 'TJS', 'TMT', 'TND', 'TOP', 'TRY', 'TTD', 'TWD', 'TZS', 'UAH', 'UGX', 'USD', 'UYU', 'UZS', 'VES', 'VND', 'VUV', 'WST', 'XAF', 'XCD', 'XCG', 'XOF', 'XPF', 'YER', 'ZAR', 'ZMW', 'ZWG')`
    },
    {
      table: "bookings",
      name: "bookings_total_money_check",
      expression: `"total_amount" >= 0 AND "total_amount" <= 99999999.99 AND "total_amount" = trunc("total_amount", CASE WHEN "currency" IN ('BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF') THEN 0 WHEN "currency" IN ('BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND') THEN 3 ELSE 2 END)`
    },
    {
      table: "bookings",
      name: "bookings_advance_money_check",
      expression: `"advance_amount" >= 0 AND "advance_amount" <= 99999999.99 AND "advance_amount" = trunc("advance_amount", CASE WHEN "currency" IN ('BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF') THEN 0 WHEN "currency" IN ('BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND') THEN 3 ELSE 2 END) AND "advance_amount" <= "total_amount"`
    }
  ]
};

// migrations/currencies/application-readiness.mjs
function canonicalCurrencyExpression(value) {
  return value.replace(/"(?:addresses|services|bookings)"\./g, "").replace(/::(?:character varying|text|numeric)(?:\[\])?/gi, "").replace(/("[a-z_]+"|[a-z_]+) IN \(([^()]+)\)/g, (_all, column2, values) => `${column2} = ANY(ARRAY[${values}])`).replace(/[\s()\"]/g, "").toLowerCase();
}
var catalogExpression = (expression) => `lower(regexp_replace(regexp_replace(regexp_replace(${expression}, '"(addresses|services|bookings)"\\.', '', 'g'), '::(character varying|text|numeric)(\\[\\])?', '', 'gi'), '[[:space:]()"]', '', 'g'))`;
var CURRENCY_READINESS_SQL = `WITH expected_columns AS (
  SELECT * FROM jsonb_to_recordset($1::jsonb) AS e("table" text, name text, type text, "notNull" boolean, "hasDefault" boolean)
), expected_constraints AS (
  SELECT * FROM jsonb_to_recordset($2::jsonb) AS e("table" text, name text, expression text)
)
SELECT NOT EXISTS (SELECT 1 FROM expected_columns e WHERE NOT EXISTS (
  SELECT 1 FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
  WHERE c.relnamespace = 'public'::regnamespace AND c.relname = e."table" AND c.relkind = 'r'
    AND a.attname = e.name AND a.attnum > 0 AND NOT a.attisdropped
    AND pg_catalog.format_type(a.atttypid, a.atttypmod) = e.type
    AND a.attnotnull = e."notNull" AND a.atthasdef = e."hasDefault"
)) AS currency_columns,
NOT EXISTS (SELECT 1 FROM expected_constraints e WHERE NOT EXISTS (
  SELECT 1 FROM pg_catalog.pg_constraint con JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
  WHERE c.relnamespace = 'public'::regnamespace AND c.relname = e."table"
    AND con.conname = e.name AND con.contype = 'c' AND con.convalidated AND NOT con.connoinherit
    AND ${catalogExpression("pg_catalog.pg_get_expr(con.conbin, con.conrelid)")} = e.expression
)) AS currency_constraints`;
var CURRENCY_READINESS_KEYS = Object.freeze(["currency_columns", "currency_constraints"]);
function currencyReadinessArguments() {
  return [
    JSON.stringify(schema_contract_default.columns.map((column2) => ({ ...column2, type: column2.type.replace(/^varchar/, "character varying") }))),
    JSON.stringify(schema_contract_default.constraints.map((check2) => ({ ...check2, expression: canonicalCurrencyExpression(check2.expression) })))
  ];
}
var CurrencyDatabaseReadinessError = class extends Error {
  code = "CURRENCY_DB_NOT_READY";
  constructor(checks) {
    super("CURRENCY_DB_NOT_READY");
    this.checks = checks;
  }
};
function assertCurrencyReadiness(rows) {
  const shaped = Array.isArray(rows) && rows.length === 1 && rows[0] && typeof rows[0] === "object" && Object.keys(rows[0]).length === CURRENCY_READINESS_KEYS.length;
  if (!shaped || CURRENCY_READINESS_KEYS.some((key) => rows[0][key] !== true)) {
    throw new CurrencyDatabaseReadinessError(shaped ? CURRENCY_READINESS_KEYS.filter((key) => rows[0][key] !== true) : ["readiness_result_shape"]);
  }
}
async function verifyCurrencyDatabaseReadiness(query) {
  let rows;
  try {
    ({ rows } = await query(CURRENCY_READINESS_SQL, currencyReadinessArguments()));
  } catch {
    throw new CurrencyDatabaseReadinessError(["metadata_query"]);
  }
  assertCurrencyReadiness(rows);
}

// server/startup-diagnostics.ts
var startupStages = [
  "initialization",
  "audit_principal",
  "currency_database",
  "workspace_pricing_database",
  "billing_configuration",
  "billing_runtime",
  "billing_database",
  "billing_account",
  "billing_portal",
  "routes",
  "billing_worker",
  "assets",
  "listen"
];
var errorCodes = [
  "BILLING_DB_NOT_READY",
  "CURRENCY_DB_NOT_READY",
  "WORKSPACE_PRICING_DB_NOT_READY",
  "EADDRINUSE",
  "EACCES",
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "CERT_HAS_EXPIRED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "INVALID_INPUT",
  "BINDING_MISMATCH",
  "CONFLICT",
  "UNAVAILABLE",
  "POLICY_REVIEW",
  "UNTRUSTED_PROVIDER",
  "FORBIDDEN",
  "MANUAL_GRANT_ACTIVE"
];
var readinessChecks = [...WORKSPACE_PRICING_APPLICATION_READINESS_KEYS, "metadata_query", "readiness_result_shape"];
function startupFailureDiagnostic(stage, error) {
  const output = {
    event: "application_startup_refused",
    stage: startupStages.some((value) => value === stage) ? stage : "initialization",
    code: "STARTUP_FAILED"
  };
  if (!error || typeof error !== "object") return output;
  try {
    const details = error;
    const candidateCode = details.code;
    const knownCode = errorCodes.find((code) => code === candidateCode);
    if (knownCode) output.code = knownCode;
    else if (details.name === "AuditCaptureUnavailable") output.code = "AUDIT_PRINCIPAL_NOT_READY";
    else if (details.name === "AuditConfigurationError") output.code = "AUDIT_CONFIGURATION_INVALID";
    else if (details.name === "StripeSandboxPreflightError") {
      output.code = details.category === "account_mismatch" ? "STRIPE_ACCOUNT_MISMATCH" : details.category === "stripe_authentication_or_permission" ? "STRIPE_AUTHENTICATION_OR_PERMISSION" : details.category === "network_or_timeout" ? "STRIPE_NETWORK_OR_TIMEOUT" : "STRIPE_PREFLIGHT_FAILED";
    } else if (details.type === "StripeAuthenticationError" || details.type === "StripePermissionError") output.code = "STRIPE_AUTHENTICATION_OR_PERMISSION";
    else if (details.type === "StripeConnectionError") output.code = "STRIPE_NETWORK_OR_TIMEOUT";
    const suppliedChecks = details.checks;
    if ((output.code === "BILLING_DB_NOT_READY" || output.code === "WORKSPACE_PRICING_DB_NOT_READY") && Array.isArray(suppliedChecks)) {
      const checks = readinessChecks.filter((key) => suppliedChecks.includes(key));
      if (checks.length) output.checks = checks;
    }
    if (output.code === "CURRENCY_DB_NOT_READY" && Array.isArray(suppliedChecks)) {
      const checks = [...CURRENCY_READINESS_KEYS, "metadata_query", "readiness_result_shape"].filter((key) => suppliedChecks.includes(key));
      if (checks.length) output.checks = checks;
    }
  } catch {
  }
  return output;
}

// server/appointments/retention.ts
import { and as and22, asc as asc7, inArray as inArray9, isNotNull as isNotNull2, lte as lte3, sql as sql17 } from "drizzle-orm";
function messageRetentionCutoff(now) {
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid retention clock");
  const cutoff = new Date(now), day = cutoff.getUTCDate();
  cutoff.setUTCDate(1);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);
  const monthEnd = new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth() + 1, 0)).getUTCDate();
  cutoff.setUTCDate(Math.min(day, monthEnd));
  return cutoff;
}
function messageHistoryExpiresAt(anchor) {
  if (!Number.isFinite(anchor.getTime())) throw new Error("Invalid retention anchor");
  const expires = new Date(anchor), day = expires.getUTCDate();
  expires.setUTCDate(1);
  expires.setUTCFullYear(expires.getUTCFullYear() + 1);
  const monthEnd = new Date(Date.UTC(expires.getUTCFullYear(), expires.getUTCMonth() + 1, 0)).getUTCDate();
  expires.setUTCDate(Math.min(day, monthEnd));
  return expires;
}
async function cleanupBookingMessages(database, now = /* @__PURE__ */ new Date()) {
  const cutoff = messageRetentionCutoff(now);
  cutoff.setUTCDate(cutoff.getUTCDate() + 1);
  return database.transaction(async (tx) => {
    const candidates = await tx.select().from(bookings).where(and22(
      inArray9(bookings.status, ["completed", "cancelled"]),
      isNotNull2(bookings.closedAt),
      lte3(bookings.closedAt, cutoff),
      sql17`((${bookings.closedAt} AT TIME ZONE 'UTC') + interval '12 months') AT TIME ZONE 'UTC' <= ${now}`,
      sql17`EXISTS (SELECT 1 FROM ${bookingMessages} WHERE ${bookingMessages.bookingId} = ${bookings.id})`,
      sql17`NOT EXISTS (SELECT 1 FROM ${bookingMessages} WHERE ${bookingMessages.bookingId} = ${bookings.id} AND ((${bookingMessages.createdAt} AT TIME ZONE 'UTC') + interval '12 months') AT TIME ZONE 'UTC' > ${now})`
    )).orderBy(asc7(bookings.closedAt), asc7(bookings.id)).limit(100).for("update", { skipLocked: true });
    if (!candidates.length) return 0;
    const latest = await tx.select({ bookingId: bookingMessages.bookingId, createdAt: sql17`max(${bookingMessages.createdAt})` }).from(bookingMessages).where(inArray9(bookingMessages.bookingId, candidates.map((row) => row.id))).groupBy(bookingMessages.bookingId);
    const latestByBooking = new Map(latest.map((row) => [row.bookingId, new Date(row.createdAt).getTime()]));
    const eligible2 = candidates.filter((row) => (row.status === "completed" || row.status === "cancelled") && row.closedAt != null && messageHistoryExpiresAt(row.closedAt) <= now && (latestByBooking.has(row.id) ? messageHistoryExpiresAt(new Date(latestByBooking.get(row.id))) <= now : true)).map((row) => row.id);
    if (!eligible2.length) return 0;
    const expired2 = await tx.select({ id: bookingMessages.id }).from(bookingMessages).where(inArray9(bookingMessages.bookingId, eligible2)).orderBy(asc7(bookingMessages.createdAt), asc7(bookingMessages.id)).limit(1e3).for("update", { skipLocked: true });
    if (!expired2.length) return 0;
    const deleted = await tx.delete(bookingMessages).where(inArray9(bookingMessages.id, expired2.map((row) => row.id))).returning({ id: bookingMessages.id });
    return deleted.length;
  });
}
function startBookingMessageRetention(database, options = {}) {
  let running = false, stopped = false;
  const tick = async () => {
    if (running || stopped) return;
    running = true;
    try {
      await cleanupBookingMessages(database, options.now?.() ?? /* @__PURE__ */ new Date());
    } catch {
      options.onError?.();
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => {
    void tick();
  }, options.intervalMs ?? 36e5);
  timer.unref();
  return { stop() {
    stopped = true;
    clearInterval(timer);
  }, tick };
}

// server/index.ts
assertAuditActivation(process.env);
var app = express4();
var draining = false;
var activeBilling;
var startupStage = "initialization";
setupHealthRoutes(app, () => {
  const query = {
    text: "SELECT 1",
    query_timeout: 3e3
  };
  return pool.query(query);
}, () => draining);
app.use((req, res, next) => {
  const start = Date.now();
  const path7 = req.path;
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path7.startsWith("/api")) {
      let logLine = `${req.method} ${path7} ${res.statusCode} in ${duration}ms`;
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  startupStage = "audit_principal";
  await verifyAuditApplicationPool(pool, process.env);
  startupStage = "currency_database";
  await verifyCurrencyDatabaseReadiness((text3, values) => {
    const query = { text: text3, values, query_timeout: 5e3 };
    return pool.query(query);
  });
  startupStage = "workspace_pricing_database";
  await verifyWorkspacePricingDatabaseReadiness((text3, values) => {
    const query = { text: text3, values, query_timeout: 5e3 };
    return pool.query(query);
  });
  startupStage = "billing_configuration";
  const config = selectedLocalBillingRuntime();
  startupStage = "billing_runtime";
  const billing = config ? createLocalBillingRuntime(db, config, {
    authenticate: isAuthenticated,
    requireAdmin: requireAppAdmin,
    isAdmin: (id2) => isAppAdmin(id2),
    verifyDatabase: () => verifyBillingDatabaseReadiness((text3, values) => {
      const query = { text: text3, values, query_timeout: 5e3 };
      return pool.query(query);
    })
  }) : void 0;
  activeBilling = billing;
  if (billing) await billing.verify((stage) => {
    startupStage = stage;
  });
  startupStage = "routes";
  mountNotificationWebhooks(app);
  mountBillingBodyBoundaries(app, billing);
  const server = await registerRoutes(app, billing);
  const bookingMessageRetention = startBookingMessageRetention(db, { onError: () => console.error("Booking message cleanup unavailable") });
  startupStage = "billing_worker";
  await billing?.start();
  const shutdown = () => {
    if (draining) return;
    draining = true;
    bookingMessageRetention.stop();
    billing?.stop();
    log("shutting down");
    setTimeout(() => process.exit(1), 25e3).unref();
    server.close(() => {
      Promise.all([pool.end(), closeAuditCapture()]).then(() => process.exit(0), () => process.exit(1));
    });
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  app.use("/api", apiNotFound);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = status < 500 ? err.message : "Internal Server Error";
    res.status(status).json({ message });
    console.error("Request failed:", err.code ?? err.name ?? "Error");
  });
  startupStage = "assets";
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  startupStage = "listen";
  const port = Number(process.env.PORT || 5e3);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen({ port, host: config?.host ?? "0.0.0.0" }, () => {
      server.off("error", reject);
      log(`serving on port ${port}`);
      resolve();
    });
  });
})().catch((error) => {
  activeBilling?.stop();
  console.error("Application startup refused:", JSON.stringify(startupFailureDiagnostic(startupStage, error)));
  void Promise.allSettled([pool.end(), closeAuditCapture()]).finally(() => {
    process.exitCode = 1;
  });
});
