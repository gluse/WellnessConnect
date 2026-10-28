import express, { type Express } from "express";

/** Shared by the actual server and stream-only tests: raw endpoint always precedes JSON/session. */
export function mountBillingBodyBoundaries(app: Express, billing?: { mountEarly(app: Express): void }) {
  if (billing) billing.mountEarly(app);
  else {
    app.get("/api/billing/runtime", (_req, res) => { res.set("Cache-Control", "no-store"); res.json({ subscriptionsReady: false, administrationReady: false, hostedOrigins: [] }); });
    app.all("/api/billing/webhook", (_req, res) => { res.set("Cache-Control", "no-store"); res.status(503).json({ code: "UNAVAILABLE" }); });
  }
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
}
