import type { Express, RequestHandler } from "express";

export function setupPaymentRoutes(app: Express, authenticate: RequestHandler) {
  // Payments are not integrated. Never let a browser manufacture a paid state,
  // including in development: payment changes need verified provider events.
  app.post("/api/payments/process", authenticate, (_req, res) => {
    res.set("Cache-Control", "no-store").status(501).json({
      code: "PAYMENTS_UNAVAILABLE", message: "Online payment collection is not available.",
    });
  });
}
