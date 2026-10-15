import type { RequestHandler } from "express";

// Mount after API routes and before the frontend's HTML fallback.
export const apiNotFound: RequestHandler = (_req, res) => {
  res.status(404).json({ message: "API endpoint not found." });
};
