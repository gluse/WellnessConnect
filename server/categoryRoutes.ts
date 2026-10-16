import type { Express, Response } from "express";
import { z } from "zod";
import { categoryKeySchema, categoryDetailsSchema, createCategorySchema, CategoryError } from "@shared/categories";
import { isAuthenticated } from "./auth";
import { requireAppAdmin } from "./appAdmin";
import { categoryStore } from "./categories";

function failure(error: unknown, res: Response) {
  // Drizzle may wrap the PostgreSQL error in a cause.
  const code = (error as any)?.cause?.code ?? (error as any)?.code;
  const status = error instanceof CategoryError ? error.status : error instanceof z.ZodError ? 400 : ["23505", "23503"].includes(code) ? 409 : 503;
  res.status(status).json({ message: error instanceof CategoryError ? error.message : error instanceof z.ZodError ? error.issues[0].message
    : code === "23505" ? "A category with this key or name already exists."
    : code === "23503" ? "This category is used by services. Reassign those services before deleting it."
    : "Unable to update or load categories. Please try again." });
}

export function setupCategoryRoutes(app: Express, store = categoryStore) {
  app.use(["/api/categories", "/api/admin/categories"], (_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
  app.get("/api/categories", async (_req, res) => {
    try { res.json(await store.list()); } catch (error) { failure(error, res); }
  });
  app.post("/api/admin/categories", isAuthenticated, requireAppAdmin, async (req, res) => {
    try { res.status(201).json(await store.create(createCategorySchema.parse(req.body))); } catch (error) { failure(error, res); }
  });
  app.patch("/api/admin/categories/:key", isAuthenticated, requireAppAdmin, async (req, res) => {
    try { res.json(await store.update(categoryKeySchema.parse(req.params.key), categoryDetailsSchema.parse(req.body))); } catch (error) { failure(error, res); }
  });
  app.delete("/api/admin/categories/:key", isAuthenticated, requireAppAdmin, async (req, res) => {
    try { await store.remove(categoryKeySchema.parse(req.params.key)); res.json({ message: "Category deleted." }); } catch (error) { failure(error, res); }
  });
}
