import type { Express, RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { searchLocationSchema, type SearchLocationPreference } from "@shared/search-location";

export interface SearchLocationStore {
  get(userId: string): Promise<SearchLocationPreference | null>;
  put(userId: string, preference: SearchLocationPreference): Promise<void>;
  adopt(userId: string, preference: SearchLocationPreference): Promise<SearchLocationPreference | null>;
  remove(userId: string): Promise<void>;
}

// Auth and database are injected so handler tests cannot load live clients.
export function setupSearchLocationRoutes(app: Express, authenticate: RequestHandler, store: SearchLocationStore) {
  const path = "/api/account/search-location";
  const limit = rateLimit({ windowMs: 60000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false });
  app.use(path, (_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
  app.get(path, limit, authenticate, async (req, res) => {
    try { res.json(await store.get(req.user!.claims.sub)); }
    catch { res.status(503).json({ code: "LOCATION_PREFERENCE_UNAVAILABLE" }); }
  });
  app.put(path, authenticate, limit, async (req, res) => {
    const parsed = searchLocationSchema.safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ code: "INVALID_LOCATION_PREFERENCE" });
    try { await store.put(req.user!.claims.sub, parsed.data); res.sendStatus(204); }
    catch { res.status(503).json({ code: "LOCATION_PREFERENCE_UNAVAILABLE" }); }
  });
  app.post(path + "/adopt", authenticate, limit, async (req, res) => {
    const parsed = searchLocationSchema.safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ code: "INVALID_LOCATION_PREFERENCE" });
    try { res.json(await store.adopt(req.user!.claims.sub, parsed.data)); }
    catch { res.status(503).json({ code: "LOCATION_PREFERENCE_UNAVAILABLE" }); }
  });
  app.delete(path, authenticate, limit, async (req, res) => {
    try { await store.remove(req.user!.claims.sub); res.sendStatus(204); }
    catch { res.status(503).json({ code: "LOCATION_PREFERENCE_UNAVAILABLE" }); }
  });
}
