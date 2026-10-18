import type { Express } from "express";

export function setupHealthRoutes(app: Express, checkDatabase: () => Promise<unknown>, isDraining: () => boolean) {
  // Register before sessions: probes never create cookies or session records.
  app.get("/health/live", (_req, res) => {
    res.set("Cache-Control", "no-store").json({ status: "ok" });
  });
  app.get("/health/ready", async (_req, res) => {
    res.set("Cache-Control", "no-store");
    if (isDraining()) return res.status(503).json({ status: "unavailable" });
    try {
      await checkDatabase();
      res.json({ status: "ready" });
    } catch {
      res.status(503).json({ status: "unavailable" });
    }
  });
}
