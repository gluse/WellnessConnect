import type { Express, Response } from "express";
import { z } from "zod";
import { storefrontSchema, storefrontSlugSchema, subscriptionTargetSchema, subscriptionOptionsSchema, subscriptionUpdateSchema, StorefrontError, type SubscriptionTarget } from "@shared/storefront";
import { isAuthenticated } from "./auth";
import { scope, AccessError } from "./companyAccess";
import { requireAppAdmin } from "./appAdmin";
import { ImageStorageError, validateOwnedImage } from "./imageStorage";
import { storefrontStore } from "./storefronts";
import { storage } from "./storage";

function failure(error: unknown, res: Response) {
  const known = error instanceof StorefrontError || error instanceof AccessError || error instanceof ImageStorageError;
  const conflict = ((error as any)?.cause?.code ?? (error as any)?.code) === "23505";
  res.status(known ? error.status : error instanceof z.ZodError ? 400 : conflict ? 409 : 503)
    .json({ message: known ? error.message : error instanceof z.ZodError ? error.issues[0].message
      : conflict ? "That storefront address is already taken." : "Unable to load or save storefront information. Please try again." });
}

export function setupStorefrontRoutes(app: Express, store = storefrontStore, catalog = storage, validateImage = validateOwnedImage) {
  app.use(["/api/storefronts", "/api/provider/storefront", "/api/admin/subscriptions"], (_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
  app.get("/api/storefronts/:slug", async (req, res) => {
    try {
      const { source, ...page } = await store.publicPage(storefrontSlugSchema.parse(req.params.slug));
      res.json({ ...page, services: await catalog.searchServices(source) });
    } catch (error) { failure(error, res); }
  });
  const workspaceTarget = (req: import("express").Request): SubscriptionTarget => {
    const current = scope(req, "manageServices");
    return current.companyId != null ? { kind: "company", id: current.companyId } : { kind: "user", id: current.userId };
  };
  app.get("/api/provider/storefront", isAuthenticated, async (req, res) => {
    try { res.json(await store.settings(workspaceTarget(req))); } catch (error) { failure(error, res); }
  });
  app.put("/api/provider/storefront", isAuthenticated, async (req, res) => {
    try {
      const target = workspaceTarget(req);
      const input = storefrontSchema.parse(req.body);
      const settings = await store.settings(target);
      if (!settings.hasPro) throw new StorefrontError(403, "An active Pro subscription is required.");
      for (const field of ["logoUrl", "coverUrl"] as const) {
        // Previously saved company images remain editable after ownership changes.
        if (input[field] && input[field] !== settings.storefront?.[field]) await validateImage(input[field], req.user!.claims.sub);
      }
      res.json(await store.save(target, input));
    } catch (error) { failure(error, res); }
  });
  app.get("/api/admin/subscriptions/options", isAuthenticated, requireAppAdmin, async (req, res) => {
    try { res.json(await store.adminOptions(subscriptionOptionsSchema.parse(req.query))); } catch (error) { failure(error, res); }
  });
  app.get("/api/admin/subscriptions", isAuthenticated, requireAppAdmin, async (req, res) => {
    try { res.json(await store.adminGet(subscriptionTargetSchema.parse(req.query))); } catch (error) { failure(error, res); }
  });
  app.put("/api/admin/subscriptions", isAuthenticated, requireAppAdmin, async (req, res) => {
    try { res.json(await store.adminUpdate(subscriptionUpdateSchema.parse(req.body), req.user!.claims.sub)); } catch (error) { failure(error, res); }
  });
}
