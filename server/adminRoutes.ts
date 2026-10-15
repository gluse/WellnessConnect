import type { Express } from "express";
import { z } from "zod";
import { isAuthenticated } from "./auth";
import { isAppAdmin, requireAppAdmin } from "./appAdmin";
import { adminUserFiltersSchema } from "@shared/admin";
import { registeredUserDirectory, loadCompanyAffiliations } from "./admin-directory";

const querySchema = adminUserFiltersSchema.extend({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().refine(value => [25, 50, 100].includes(value)).default(50),
}).strict().refine(value => !value.registeredFrom || !value.registeredTo || value.registeredFrom <= value.registeredTo,
  "The registration end date must be on or after the start date.");

export function setupAdminRoutes(app: Express, loadCompanies = loadCompanyAffiliations) {
  app.get("/api/admin/access", isAuthenticated, (req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({ isAdmin: isAppAdmin(req.user!.claims.sub) });
  });

  app.get("/api/admin/users", isAuthenticated, requireAppAdmin, async (req, res) => {
    res.set("Cache-Control", "no-store");
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ message: "Choose valid directory filters, dates, and paging options." });
    try {
      const { page, pageSize, ...filters } = parsed.data;
      res.json(await registeredUserDirectory(filters, page, pageSize, loadCompanies));
    } catch {
      res.status(503).json({ message: "Unable to load registered users. Please try again." });
    }
  });
}
