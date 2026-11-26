import { randomUUID } from "node:crypto";
import type { Request, RequestHandler } from "express";
import { createAuditContext } from "./context";
import { createAuditEvent, type AUDIT_READ_ACTIONS } from "./events";
import { completionAuditEnabled, capturePreparedAudit, recordDenial } from "./http";

type Action = typeof AUDIT_READ_ACTIONS[number];
/** Only explicit protected routes; no paths, query text or response data enter the event. */
const routes: readonly [RegExp, Action, boolean?][] = [
  [/^\/api\/auth\/user$/, "account.profile"], [/^\/api\/admin\/users$/, "admin.users"],
  [/^\/api\/addresses$/, "addresses.list", true], [/^\/api\/provider\/employees$/, "employees.list", true],
  [/^\/api\/services\/provider$/, "services.provider", true], [/^\/api\/bookings\/seeker$/, "bookings.seeker"],
  [/^\/api\/reports\/service-views\/?$/i, "services.provider", true],
  [/^\/api\/bookings\/provider$/, "bookings.provider", true], [/^\/api\/availability\/provider$/, "schedules.provider", true],
  [/^\/api\/provider\/manual-appointments(?:\/[0-9a-f-]{36})?$/i, "bookings.provider", true],
  [/^\/api\/company\/context$/, "company.context", true], [/^\/api\/company\/team$/, "company.team", true],
  [/^\/api\/company\/my-invitations$/, "company.invitations"], [/^\/api\/bookings\/[1-9]\d*\/conversation$/, "appointments.conversation"],
  [/^\/api\/bookings\/[1-9]\d*\/(?:event\/)?reschedule-requests$/, "appointments.reschedules"],
  [/^\/api\/bookings\/[1-9]\d*\/available-times$/, "appointments.available_times"],
  [/^\/api\/account\/communication$/, "notifications.settings"], [/^\/api\/bookings\/[1-9]\d*\/notifications$/, "notifications.booking"],
  [/^\/api\/wishlist\/(?:services|membership)$/, "wishlist.list"], [/^\/api\/inbox\/summary$/, "inbox.summary", true],
  [/^\/api\/inbox\/messages(?:\/[1-9]\d*)?$/, "inbox.messages", true], [/^\/api\/inbox\/notifications$/, "inbox.notifications", true],
];
export function protectedReadAction(path: string) { return routes.find(([pattern]) => pattern.test(path)); }
export function protectedReadEvent(req: Request, action: Action, workspace = false) {
  const userId = req.user?.claims.sub;
  if (!userId || !req.auditPersonalRole) throw new Error("AUDIT_IDENTITY_UNAVAILABLE");
  const company = workspace ? req.workspace?.company : undefined;
  const role = company ? req.workspace?.membership?.role : req.auditPersonalRole;
  const context = createAuditContext({
    actor: { kind: "user", userId, effectiveRole: action === "admin.users" ? "support" : role! },
    scope: action === "admin.users" ? { kind: "global" } : company ? { kind: "company", workspaceId: String(company.id) } : { kind: "personal", workspaceId: userId },
    target: { type: "request" }, source: { application: "fitsmytime", environment: process.env.AUDIT_ENVIRONMENT ?? "development", component: "application" },
    requestId: randomUUID(), operationId: randomUUID(),
  });
  return createAuditEvent(context, { eventName: "activity.records_read.v1", outcome: "succeeded", changes: [{ field: "action", before: null, after: action }] });
}
/** Wait for durable capture before returning data from these authenticated read routes. */
export function protectedReadAudit(dependencies = { enabled: completionAuditEnabled, capture: capturePreparedAudit }): RequestHandler {
  return (req, res, next) => {
    const route = req.method === "GET" ? protectedReadAction(req.path) : undefined;
    if (!route || !dependencies.enabled()) return next();
    const originalJson = res.json, originalSend = res.send;
    let scheduled = false;
    const restore = () => { res.json = originalJson; res.send = originalSend; };
    const intercept = (send: typeof res.send, body: unknown) => {
      if (scheduled) return res;
      if (res.statusCode < 200 || res.statusCode >= 300) { restore(); return send.call(res, body); }
      scheduled = true;
      res.set("Cache-Control", "no-store");
      void (async () => {
        try {
          const event = protectedReadEvent(req, route[1], route[2]);
          await dependencies.capture(event);
          restore();
          if (!res.destroyed && !res.headersSent) send.call(res, body);
        } catch {
          restore();
          if (!res.destroyed && !res.headersSent) res.status(503).json({ message: "Activity history is temporarily unavailable. Please try again." });
        }
      })();
      return res;
    };
    res.json = body => intercept(originalJson, body);
    res.send = body => intercept(originalSend, body);
    next();
  };
}

/** Cover authorization failures from domain handlers as well as authentication middleware. */
export function auditResponseDenials(dependencies = { enabled: completionAuditEnabled, record: recordDenial }): RequestHandler {
  return (req, res, next) => {
    if (!req.path.startsWith("/api/") || !dependencies.enabled()) return next();
    const originalJson = res.json, originalSend = res.send;
    let scheduled = false;
    const restore = () => { res.json = originalJson; res.send = originalSend; };
    const intercept = (send: typeof res.send, body: unknown) => {
      if (scheduled) return res;
      if (res.statusCode !== 401 && res.statusCode !== 403) { restore(); return send.call(res, body); }
      scheduled = true;
      const reason = res.statusCode === 401 ? "UNAUTHENTICATED" : "FORBIDDEN";
      void dependencies.record(req, reason).catch(() => {}).then(() => {
        restore();
        // Capture failure never turns an authorization denial into access.
        if (!res.destroyed && !res.headersSent) send.call(res, body);
      });
      return res;
    };
    res.json = body => intercept(originalJson, body);
    res.send = body => intercept(originalSend, body);
    next();
  };
}
