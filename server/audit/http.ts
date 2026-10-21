import { randomUUID } from "node:crypto";
import type { Request } from "express";
import { createAuditContext, type AuditContext } from "./context.ts";
import { createAuditEvent, type AuditAction } from "./events.ts";
import { AuditCaptureUnavailable, type PreparedAuditEvent } from "./capture.ts";

type Sink = (event: PreparedAuditEvent) => Promise<void>;
type Runtime = { capture: Sink; ready(): Promise<void>; close(): Promise<void> };
declare global { namespace Express { interface Request { auditPersonalRole?: "seeker" | "provider"; } } }
const correlations = new WeakMap<object, { requestId: string; operationId: string }>();
let runtime: Promise<Runtime> | undefined;
let injected: Sink | undefined;
let injectedReady: (() => Promise<void>) | undefined;

export const auditEnabled = () => injected !== undefined || process.env.AUDIT_ENABLED === "true";
/** Synthetic tests/in-process host composition only; never exposed to HTTP. */
export function setAuditSink(sink?: Sink, ready?: () => Promise<void>) { injected = sink; injectedReady = ready; }
export function auditGap() { console.error("Audit capture gap", "CAPTURE_UNAVAILABLE"); }
export async function closeAuditCapture() { if (runtime) { const active = runtime; runtime = undefined; await (await active).close(); } }
function captureRuntime() {
  runtime ??= import("./runtime.ts").then(module => module.createCaptureRuntime(process.env)).catch(error => { runtime = undefined; throw error; });
  return runtime;
}
/** Availability probe only, NOT durable remote intent or a cross-service transaction. */
export async function requireAuditAvailability(): Promise<void> {
  if (!auditEnabled()) return;
  try { if (injected) await injectedReady?.(); else await (await captureRuntime()).ready(); }
  catch { auditGap(); throw new AuditCaptureUnavailable(); }
}

function identity(req: Request) {
  let value = correlations.get(req);
  if (!value) { value = { requestId: randomUUID(), operationId: randomUUID() }; correlations.set(req, value); }
  return value;
}

/** userId may come only from verified Auth response or isAuthenticated, NEVER a session/body claim. */
export function requestAuditContext(req: Request, component: "auth" | "account" | "authorization", userId?: string): AuditContext | undefined {
  if (!auditEnabled()) return;
  const verified = userId ?? req.user?.claims.sub;
  if (verified && !req.auditPersonalRole) throw new AuditCaptureUnavailable();
  return createAuditContext({ ...identity(req), actor: verified ? { kind: "user", userId: verified, effectiveRole: req.auditPersonalRole! } : { kind: "anonymous" },
    scope: verified ? { kind: "personal", workspaceId: verified } : { kind: "unknown" },
    target: component === "authorization" || !verified ? { type: "request" } : { type: "user", id: verified },
    source: { application: "fitsmytime", environment: injected ? "development" : process.env.AUDIT_ENVIRONMENT!, component } });
}

export async function recordAudit(req: Request, action: AuditAction, userId?: string): Promise<void> {
  if (!auditEnabled()) return;
  try {
    const context = requestAuditContext(req, action.eventName === "security.action_denied.v1" ? "authorization" : "auth", userId)!;
    const event = createAuditEvent(context, action);
    if (injected) await injected(event);
    else {
      await (await captureRuntime()).capture(event);
    }
  } catch { auditGap(); throw new AuditCaptureUnavailable(); }
}

/** Await durable denial capture where possible; capture failure NEVER grants access. */
export async function recordDenial(req: Request, reasonCode: "UNAUTHENTICATED" | "FORBIDDEN" | "WRONG_ORIGIN" | "RATE_LIMITED" | "SESSION_EXPIRED"): Promise<void> {
  try { await recordAudit(req, { eventName: "security.action_denied.v1", outcome: "denied", reasonCode, changes: [] }); }
  catch { /* Safe independent gap signal already emitted; denial remains denied. */ }
}

/** Keep existing synchronous disabled middleware behavior. */
export function denyWithAudit(req: Request, reason: Parameters<typeof recordDenial>[1], respond: () => unknown) {
  if (!auditEnabled()) return respond();
  return recordDenial(req, reason).then(respond);
}
