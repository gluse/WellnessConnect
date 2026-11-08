import type { Express, Request, RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { ServiceViewReportError, type ServiceViewReportActor, type ServiceViewReportService } from "./service";

export function setupServiceViewReportRoutes(app: Express, dependencies: {
  authenticate: RequestHandler; currentActor(req: Request): ServiceViewReportActor; service: ServiceViewReportService;
}) {
  app.use("/api/reports/service-views", (_req, res, next) => { res.set("Cache-Control", "private, no-store"); next(); });
  const limit = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false });
  const handle = (action: (req: Request) => Promise<unknown>): RequestHandler => (req, res) => { void (async () => {
    res.set("Cache-Control", "private, no-store");
    try { res.json(await action(req)); }
    catch (error) {
      const known = error instanceof ServiceViewReportError;
      res.status(known ? error.status : error instanceof z.ZodError ? 400 : 503)
        .json({ code: known ? error.code : error instanceof z.ZodError ? "invalid_input" : "report_unavailable", message: "Unable to prepare service view statistics." });
    }
  })(); };
  app.get("/api/reports/service-views/capabilities", dependencies.authenticate, limit, handle(async req => {
    z.object({}).strict().parse(req.query);
    return dependencies.service.capabilities(dependencies.currentActor(req));
  }));
  app.get("/api/reports/service-views", dependencies.authenticate, limit, handle(req => dependencies.service.report(dependencies.currentActor(req), req.query)));
}
