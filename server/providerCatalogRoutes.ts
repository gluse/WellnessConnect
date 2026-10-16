import type { Express } from "express";
import { providerCatalogSchema } from "@shared/provider-catalog";
import { storage } from "./storage";

export function setupProviderCatalogRoutes(app: Express) {
  app.get("/api/services/catalog", async (req, res) => {
    res.set("Cache-Control", "no-store");
    const parsed = providerCatalogSchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ message: "Choose one company or service provider." });
    try {
      res.json(await storage.searchServices(parsed.data));
    } catch {
      res.status(500).json({ message: "Unable to load this provider's services. Please try again." });
    }
  });
}
