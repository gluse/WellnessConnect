import type { Express } from "express";
import { z } from "zod";
import { isAuthenticated } from "./auth";
import { storage } from "./storage";
import { reviewSchema, ReviewError } from "@shared/reviews";

export function setupReviewRoutes(app: Express) {
  app.patch("/api/bookings/:id/review", isAuthenticated, async (req, res) => {
    res.set("Cache-Control", "no-store");
    try {
      const id = z.coerce.number().int().positive().max(2147483647).parse(req.params.id);
      const input = reviewSchema.parse(req.body);
      res.json(await storage.updateReview(id, req.user!.claims.sub, input));
    } catch (error) {
      res.status(error instanceof ReviewError ? error.status : error instanceof z.ZodError ? 400 : 500)
        .json({ message: error instanceof ReviewError ? error.message : error instanceof z.ZodError
          ? error.issues[0].message : "Unable to save your review. Please try again." });
    }
  });

  app.delete("/api/bookings/:id/review", isAuthenticated, async (req, res) => {
    res.set("Cache-Control", "no-store");
    try {
      const id = z.coerce.number().int().positive().max(2147483647).parse(req.params.id);
      await storage.deleteReview(id, req.user!.claims.sub);
      res.status(204).end();
    } catch (error) {
      res.status(error instanceof ReviewError ? error.status : error instanceof z.ZodError ? 400 : 500)
        .json({ message: error instanceof ReviewError ? error.message : "Unable to delete your review. Please try again." });
    }
  });

  app.get("/api/services/:id/reviews", async (req, res) => {
    res.set("Cache-Control", "no-store");
    try {
      const id = z.coerce.number().int().positive().max(2147483647).parse(req.params.id);
      const { page } = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1) }).strict().parse(req.query);
      const result = await storage.getServiceReviews(id, page);
      if (!result) return res.status(404).json({ message: "Service not found." });
      res.json(result);
    } catch (error) {
      res.status(error instanceof z.ZodError ? 400 : 500).json({ message: "Unable to load reviews. Please try again." });
    }
  });

  app.post("/api/bookings/:id/review", isAuthenticated, async (req, res) => {
    res.set("Cache-Control", "no-store");
    try {
      const id = z.coerce.number().int().positive().max(2147483647).parse(req.params.id);
      const input = reviewSchema.parse(req.body);
      const review = await storage.createReview(id, req.user!.claims.sub, input);
      res.status(201).json(review);
    } catch (error) {
      res.status(error instanceof ReviewError ? error.status : error instanceof z.ZodError ? 400 : 500)
        .json({ message: error instanceof ReviewError ? error.message : error instanceof z.ZodError
          ? error.issues[0].message : "Unable to save your review. Please try again." });
    }
  });
}
