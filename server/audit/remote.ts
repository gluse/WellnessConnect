import type { Request } from "express";
import { randomUUID } from "node:crypto";
import { createAuditContext } from "./context";
import { createAuditEvent, type AuditAction } from "./events";
import { auditAuthEventsEnabled, capturePreparedAudit, requestAuditContext } from "./http";

export type RemoteAuditOperation = "login" | "signup" | "oauth_start" | "oauth_callback" | "recovery" |
  "invite_session" | "invite_password" | "logout" | "password_verify" | "password_change" | "session_refresh" | "profile_update";

function providerOutcome(value: { error?: { status?: number } | null }): Pick<AuditAction, "outcome" | "reasonCode"> {
  if (!value.error) return { outcome: "succeeded" };
  if (value.error.status === 429) return { outcome: "denied", reasonCode: "RATE_LIMITED" };
  if (value.error.status === 401 || value.error.status === 403) return { outcome: "denied", reasonCode: "INVALID_CREDENTIALS" };
  if (value.error.status && value.error.status >= 500) return { outcome: "failed", reasonCode: "PROVIDER_UNAVAILABLE" };
  return { outcome: "rejected", reasonCode: "INVALID_INPUT" };
}

/**
 * Persist intent BEFORE invoking the provider. A missing report means unresolved,
 * never rollback/success. Reports describe observed responses, not atomic remote
 * state. No payload, token, email or provider error enters either audit envelope.
 */
export async function auditRemoteOperation<T extends { error?: { status?: number } | null }>(
  req: Request, operation: RemoteAuditOperation, effect: () => Promise<T>, verifiedUserId?: string,
): Promise<T> {
  if (!auditAuthEventsEnabled()) return effect();
  const request = requestAuditContext(req, "auth", verifiedUserId)!;
  const context = createAuditContext({ ...request, target: { type: "request" }, operationId: randomUUID() });
  const changes = [{ field: "operation", before: null, after: operation }] as const;
  const intent = createAuditEvent(context, { eventName: "auth.operation_requested.v1", outcome: "succeeded", changes });
  await capturePreparedAudit(intent); // No provider side effect if this fails.
  const reportContext = createAuditContext({ ...context, parentEventId: intent.envelope.eventId });
  let result: T;
  try { result = await effect(); }
  catch (error) {
    try { await capturePreparedAudit(createAuditEvent(reportContext, {
      eventName: "auth.operation_reported.v1", outcome: "unknown", reasonCode: "PROVIDER_TIMEOUT", changes,
    })); } catch { /* durable intent survives; capture layer reports a gap */ }
    throw error;
  }
  await capturePreparedAudit(createAuditEvent(reportContext, {
    eventName: "auth.operation_reported.v1", ...providerOutcome(result), changes,
  }));
  return result;
}
