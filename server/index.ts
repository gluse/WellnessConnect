import express, { type Request, Response, NextFunction } from "express";
import type { ClientConfig, QueryConfig } from "pg";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { apiNotFound } from "./api-fallback";
import { pool } from "./db";
import { setupHealthRoutes } from "./health";

const app = express();
let draining = false;
setupHealthRoutes(app, () => {
  // pg supports per-query timeouts, but its QueryConfig types omit this option.
  const query: QueryConfig & Pick<ClientConfig, "query_timeout"> = {
    text: "SELECT 1",
    query_timeout: 3000,
  };
  return pool.query(query);
}, () => draining);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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
  const server = await registerRoutes(app);
  const shutdown = () => {
    if (draining) return;
    draining = true;
    log("shutting down");
    // Docker's grace period is 30 seconds; bound long-running requests to 25.
    setTimeout(() => process.exit(1), 25_000).unref();
    server.close(() => {
      pool.end().then(() => process.exit(0), () => process.exit(1));
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
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Serve both the API and client on the host's configured port.
  const port = Number(process.env.PORT || 5000);
  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    log(`serving on port ${port}`);
  });
})();
