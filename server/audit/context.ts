import { z } from "zod";
import { AuditContractError, canonicalAuditJson, freezeAuditJson, type DeepReadonly } from "./canonical.ts";

export const userIdSchema = z.string().uuid();
const roleSchema = z.enum(["seeker", "provider", "owner", "admin", "viewer", "support"]);
const actorSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("user"), userId: userIdSchema, effectiveRole: roleSchema }).strict(),
  z.object({ kind: z.literal("anonymous") }).strict(),
]);
const scopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("personal"), workspaceId: userIdSchema }).strict(),
  z.object({ kind: z.literal("company"), workspaceId: z.string().regex(/^[1-9][0-9]{0,9}$/) }).strict(),
  z.object({ kind: z.literal("global") }).strict(),
  z.object({ kind: z.literal("unknown") }).strict(),
]);
const targetSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("request") }).strict(),
  z.object({ type: z.literal("user"), id: userIdSchema }).strict(),
  z.object({ type: z.literal("membership"), id: userIdSchema }).strict(),
  z.object({ type: z.literal("company"), id: z.string().regex(/^[1-9][0-9]{0,9}$/) }).strict(),
]);

export const auditContextSchema = z.object({
  actor: actorSchema,
  scope: scopeSchema,
  target: targetSchema,
  source: z.object({
    application: z.literal("fitsmytime"),
    environment: z.string().regex(/^[a-z][a-z0-9-]{0,31}$/),
    component: z.enum(["auth", "account", "company-access", "authorization"]),
    release: z.string().regex(/^[a-f0-9]{7,64}$/).optional(),
  }).strict(),
  requestId: z.string().uuid(),
  operationId: z.string().uuid(),
  parentEventId: z.string().uuid().optional(),
}).strict().superRefine((context, issue) => {
  const invalid = () => issue.addIssue({ code: "custom", message: "Invalid audit context" });
  if (context.actor.kind === "anonymous" && (context.scope.kind !== "unknown" || context.target.type !== "request")) invalid();
  if (context.scope.kind === "unknown" && context.target.type !== "request") invalid();
  if (context.scope.kind === "global" && (context.actor.kind !== "user" || context.actor.effectiveRole !== "support")) invalid();
  if (context.scope.kind === "company" && context.actor.kind === "user" &&
    !["owner", "admin", "provider", "viewer"].includes(context.actor.effectiveRole)) invalid();
  if (context.scope.kind === "personal" && context.actor.kind === "user" &&
    !["seeker", "provider"].includes(context.actor.effectiveRole)) invalid();
  if (context.target.type === "company" && (context.scope.kind !== "company" || context.target.id !== context.scope.workspaceId)) invalid();
  if (context.target.type === "membership" && context.scope.kind !== "company") invalid();
});

export type AuditContextInput = z.infer<typeof auditContextSchema>;
declare const contextBrand: unique symbol;
export type AuditContext = DeepReadonly<AuditContextInput> & { readonly [contextBrand]: true };
const contexts = new WeakSet<object>();

/**
 * SERVER-ONLY ASSERTION BOUNDARY. Call only after verifying identity, current
 * authority and resolved object/workspace with the domain's real authorization.
 * This pure function validates a snapshot; it cannot authenticate or query
 * memberships. Never pass req.body/query/headers/session directly as this input.
 * Anonymous attempts retain no claimed identity, workspace or resolved target.
 */
export function createAuditContext(input: AuditContextInput): AuditContext {
  try {
    canonicalAuditJson(input);
    const context = freezeAuditJson(auditContextSchema.parse(input)) as AuditContext;
    contexts.add(context);
    return context;
  } catch { throw new AuditContractError(); }
}

export function assertAuditContext(value: AuditContext): void {
  if (!value || !contexts.has(value)) throw new AuditContractError();
}
