import { randomUUID } from "node:crypto";
import { createAuditContext, type AuditContextInput } from "../audit/context";
import { createAuditEvent, type AuditEventName } from "../audit/events";
import { enqueueDrizzleAudit } from "../audit/capture";
import type { BillingTransaction } from "./repository";

export async function enqueueBillingAudit(tx: BillingTransaction, input: {
  actor: AuditContextInput["actor"]; scope: AuditContextInput["scope"]; target: AuditContextInput["target"];
  eventName: Extract<AuditEventName, `billing.${string}`>; environment: string; operationId: string; requestId?: string;
}) {
  const context = createAuditContext({ actor: input.actor, scope: input.scope, target: input.target,
    source: { application: "fitsmytime", environment: input.environment, component: "billing" },
    requestId: input.requestId ?? randomUUID(), operationId: input.operationId });
  const action = ["billing.checkout_unknown.v1", "billing.portal_unknown.v1"].includes(input.eventName)
    ? { eventName: input.eventName, outcome: "unknown" as const, reasonCode: "PROVIDER_TIMEOUT" as const, changes: [] }
    : input.eventName === "billing.event_quarantined.v1"
      ? { eventName: input.eventName, outcome: "rejected" as const, reasonCode: "CONFLICT" as const, changes: [] }
      : { eventName: input.eventName, outcome: "succeeded" as const, changes: [] };
  await enqueueDrizzleAudit(tx, createAuditEvent(context, action));
}
