import type { Express, Request } from "express";
import { randomUUID } from "node:crypto";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { createAuditContext } from "./context";
import { createAuditEvent } from "./events";
import { capturePreparedAudit, type ServiceViewActor } from "./http";

export const locationObservationSchema = z.object({
  stage: z.enum(["requested", "permission_observed", "remember_chosen", "withdrawn"]),
  outcome: z.enum(["requested", "granted", "already_granted", "denied", "timeout", "unavailable", "policy_blocked", "unknown", "remember", "forget"]),
  storageScope: z.enum(["none", "profile", "cookie"]),
  noticeVersion: z.literal("location-2026-11-07"),
  language: z.enum(["en", "lv", "ru", "ar", "zh", "fr", "de", "hi", "ja", "pt", "es"]),
}).strict().superRefine((value, context) => {
  const invalid = value.stage === "requested" ? value.outcome !== "requested" || value.storageScope !== "none"
    : value.stage === "permission_observed" ? !["granted", "already_granted", "denied", "timeout", "unavailable", "policy_blocked", "unknown"].includes(value.outcome) || value.storageScope !== "none"
      : value.stage === "remember_chosen" ? value.outcome !== "remember" || value.storageScope === "none"
        : value.outcome !== "forget";
  if (invalid) context.addIssue({ code: "custom", message: "Invalid location observation" });
});

/** This records receipt of a browser report, never verified OS permission or legal consent. */
export function locationObservationEvent(body: z.infer<typeof locationObservationSchema>, actor: ServiceViewActor, environment: string) {
  const input = locationObservationSchema.parse(body);
  return createAuditEvent(createAuditContext({ actor,
    scope: actor.kind === "user" ? { kind: "personal", workspaceId: actor.userId } : { kind: "unknown" },
    target: { type: "request" }, requestId: randomUUID(), operationId: randomUUID(),
    source: { application: "fitsmytime", environment, component: "location" },
  }), { eventName: "location.observation_recorded.v1", outcome: "succeeded", changes: [
    { field: "stage", before: null, after: input.stage },
    { field: "reportedOutcome", before: null, after: input.outcome },
    { field: "storageScope", before: null, after: input.storageScope },
    { field: "noticeVersion", before: null, after: input.noticeVersion },
    { field: "language", before: null, after: input.language },
  ] });
}

export function setupLocationAuditRoutes(app: Express, dependencies: {
  verifyActor(req: Request): Promise<ServiceViewActor>;
  capture?: typeof capturePreparedAudit;
  environment?: () => string;
}) {
  const limit = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false });
  app.post("/api/audit/location-observations", limit, async (req, res) => {
    res.set("Cache-Control", "no-store");
    const input = locationObservationSchema.safeParse(req.body);
    if (!input.success || Object.keys(req.query).length) return void res.status(400).json({ code: "INVALID_LOCATION_OBSERVATION" });
    try {
      const actor = await dependencies.verifyActor(req);
      const event = locationObservationEvent(input.data, actor, dependencies.environment?.() ?? process.env.AUDIT_ENVIRONMENT ?? "development");
      await (dependencies.capture ?? capturePreparedAudit)(event);
      res.sendStatus(204);
    } catch { res.status(503).json({ code: "LOCATION_AUDIT_UNAVAILABLE" }); }
  });
}
