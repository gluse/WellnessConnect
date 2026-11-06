import type { Express, Request, RequestHandler } from "express";
import { z } from "zod";
import { workspacePricingUpdateSchema, WorkspacePricingError } from "@shared/workspace-pricing";
import type { WorkspacePricingActor, WorkspacePricingStore } from "./store";

export function setupWorkspacePricingRoutes(app: Express, dependencies: {
  authenticate: RequestHandler;
  currentWorkspace(req: Request, write: boolean): WorkspacePricingActor;
  store: WorkspacePricingStore;
}) {
  app.use("/api/workspace/pricing-settings", (_req, res, next) => { res.set("Cache-Control", "private, no-store"); next(); });
  function handler(write: boolean): RequestHandler {
    return (req, res) => { void (async () => {
      res.set("Cache-Control", "private, no-store");
      try {
        const actor = dependencies.currentWorkspace(req, write);
        if (write) res.json(await dependencies.store.patch(actor, workspacePricingUpdateSchema.parse(req.body)));
        else {
          z.object({}).strict().parse(req.query);
          res.json(await dependencies.store.get(actor));
        }
      } catch (error) {
        const known = error instanceof WorkspacePricingError;
        res.status(known ? error.status : error instanceof z.ZodError ? 400 : 503).json({
          code: known ? error.code : error instanceof z.ZodError ? "INVALID_WORKSPACE_PRICING" : "WORKSPACE_PRICING_UNAVAILABLE",
          message: known ? error.message : error instanceof z.ZodError ? "Choose valid workspace pricing settings." : "Workspace pricing settings are temporarily unavailable.",
        });
      }
    })(); };
  }
  app.get("/api/workspace/pricing-settings", dependencies.authenticate, handler(false));
  app.patch("/api/workspace/pricing-settings", dependencies.authenticate, handler(true));
}
