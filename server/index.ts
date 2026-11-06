import express, { type Request, Response, NextFunction } from "express";
import type { ClientConfig, QueryConfig } from "pg";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { apiNotFound } from "./api-fallback";
import { pool, db } from "./db";
import { isAuthenticated } from "./auth";
import { requireAppAdmin, isAppAdmin } from "./appAdmin";
import { createLocalBillingRuntime, selectedLocalBillingRuntime } from "./billing/runtime";
import { mountBillingBodyBoundaries } from "./billing/middleware";
import { verifyBillingDatabaseReadiness } from "./billing/database-readiness";
import { setupHealthRoutes } from "./health";
import { closeAuditCapture } from "./audit/http";
import { assertAuditActivation } from "./audit/config";
import { verifyAuditApplicationPool } from "./audit/application";
import { mountNotificationWebhooks } from "./notifications/webhooks";
import { startupFailureDiagnostic, type StartupStage } from "./startup-diagnostics";
import { startBookingMessageRetention } from "./appointments/retention";
import { verifyCurrencyDatabaseReadiness } from "../migrations/currencies/application-readiness.mjs";
import { verifyWorkspacePricingDatabaseReadiness } from "../migrations/workspace-pricing/application-readiness.mjs";

assertAuditActivation(process.env);
const app = express();
let draining = false;
let activeBilling: ReturnType<typeof createLocalBillingRuntime> | undefined;
let startupStage: StartupStage = "initialization";
setupHealthRoutes(app, () => {
  // pg supports per-query timeouts, but its QueryConfig types omit this option.
  const query: QueryConfig & Pick<ClientConfig, "query_timeout"> = {
    text: "SELECT 1",
    query_timeout: 3000,
  };
  return pool.query(query);
}, () => draining);


app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Verify the actual app principal before registering sessions or accepting requests.
  startupStage = "audit_principal";
  await verifyAuditApplicationPool(pool, process.env);
  startupStage = "currency_database";
  await verifyCurrencyDatabaseReadiness((text, values) => {
    const query: QueryConfig & Pick<ClientConfig, "query_timeout"> = { text, values, query_timeout: 5000 };
    return pool.query(query);
  });
  startupStage = "workspace_pricing_database";
  await verifyWorkspacePricingDatabaseReadiness((text, values) => {
    const query: QueryConfig & Pick<ClientConfig, "query_timeout"> = { text, values, query_timeout: 5000 };
    return pool.query(query);
  });
  startupStage = "billing_configuration";
  const config = selectedLocalBillingRuntime();
  startupStage = "billing_runtime";
  const billing = config ? createLocalBillingRuntime(db, config, { authenticate: isAuthenticated, requireAdmin: requireAppAdmin,
    isAdmin: id => isAppAdmin(id), verifyDatabase: () => verifyBillingDatabaseReadiness((text, values) => {
      const query: QueryConfig & Pick<ClientConfig, "query_timeout"> = { text, values, query_timeout: 5000 };
      return pool.query(query);
    }) }) : undefined;
  activeBilling = billing;
  if (billing) await billing.verify(stage => { startupStage = stage; });
  startupStage = "routes";
  mountNotificationWebhooks(app);
  mountBillingBodyBoundaries(app, billing);
  const server = await registerRoutes(app, billing);
  const bookingMessageRetention = startBookingMessageRetention(db, { onError: () => console.error("Booking message cleanup unavailable") });
  startupStage = "billing_worker";
  await billing?.start();
  const shutdown = () => {
    if (draining) return;
    draining = true;
    bookingMessageRetention.stop();
    billing?.stop();
    log("shutting down");
    // Docker's grace period is 30 seconds; bound long-running requests to 25.
    setTimeout(() => process.exit(1), 25_000).unref();
    server.close(() => {
      Promise.all([pool.end(), closeAuditCapture()]).then(() => process.exit(0), () => process.exit(1));
    });
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  app.use("/api", apiNotFound);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = status < 500 ? err.message : "Internal Server Error";

    res.status(status).json({ message });
    console.error("Request failed:", err.code ?? err.name ?? "Error");
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  startupStage = "assets";
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Serve both the API and client on the host's configured port.
  startupStage = "listen";
  const port = Number(process.env.PORT || 5000);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen({ port, host: config?.host ?? "0.0.0.0" }, () => {
      server.off("error", reject);
      log(`serving on port ${port}`);
      resolve();
    });
  });
})().catch(error => {
  activeBilling?.stop();
  console.error("Application startup refused:", JSON.stringify(startupFailureDiagnostic(startupStage, error)));
  void Promise.allSettled([pool.end(), closeAuditCapture()]).finally(() => { process.exitCode = 1; });
});
