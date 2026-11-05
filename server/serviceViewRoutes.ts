import type { Express, Request } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { serviceViewAuditEnabled, recordServiceView, type ServiceViewActor } from "./audit/http";

const empty = z.object({}).strict();
const serviceId = z.string().regex(/^[1-9][0-9]{0,9}$/).refine(value => Number(value) <= 2147483647);
type Service = { id: number; isActive: boolean | null; companyActive?: boolean };
type Dependencies = {
  getService(id: number): Promise<Service | undefined>;
  // Uses server Auth verification and the confirmed profile only, never req.user/body claims.
  verifyActor(token: string, expectedUserId: string): Promise<ServiceViewActor>;
  recordProductView?(serviceId: number, userId: string | null): Promise<void>;
};

/** Kept separate from GET/cache/prefetch/book paths: this receives explicit details clicks. */
export function setupServiceViewRoutes(app: Express, dependencies: Dependencies) {
  const limit = rateLimit({ windowMs: 60000, limit: 60, standardHeaders: "draft-7", legacyHeaders: false });
  app.post("/api/services/:id/view", limit, async (req: Request, res) => {
    res.set("Cache-Control", "no-store");
    const parsed = serviceId.safeParse(req.params.id);
    if (!parsed.success || !empty.safeParse(req.body === undefined ? {} : req.body).success || !empty.safeParse(req.query).success) {
      return void res.status(400).json({ message: "Invalid service view notification" });
    }
    const id = Number(parsed.data);
    let service: Service | undefined;
    try { service = await dependencies.getService(id); }
    catch { return void res.status(503).json({ message: "Service is temporarily unavailable" }); }
    if (!service || service.id !== id || !service.isActive || !service.companyActive) {
      return void res.status(404).json({ message: "Service not found" });
    }
    if (serviceViewAuditEnabled() || dependencies.recordProductView) {
      let actor: ServiceViewActor = { kind: "anonymous" };
      const auth = req.session?.auth;
      if (typeof auth?.accessToken === "string" && auth.accessToken && typeof auth.userId === "string") {
        try { actor = await dependencies.verifyActor(auth.accessToken, auth.userId); }
        catch { /* Public requests with unverifiable optional identity remain anonymous. */ }
      }
      if (serviceViewAuditEnabled()) await recordServiceView(req, id, actor);
      // Product aggregates are independent of the audit store and public viewing.
      // A failed capture never blocks details or triggers a browser retry.
      if (dependencies.recordProductView) {
        try { await dependencies.recordProductView(id, actor.kind === "user" ? actor.userId : null); }
        catch { console.error("Product service-view capture unavailable."); }
      }
    }
    res.sendStatus(204);
  });
}
