import { setTimeout as delay } from "node:timers/promises";
import { createAuditWorker } from "./worker.ts";
import { createWorkerRuntime } from "./runtime.ts";

// Explicit separate process only. No import from application startup; no dotenv.
// Provide restricted connection settings through the process environment.
async function main() {
 const stop = new AbortController();
 process.once("SIGTERM", () => stop.abort()); process.once("SIGINT", () => stop.abort());
 let close: (() => Promise<void>) | undefined;
 try {
  const runtime = await createWorkerRuntime(process.env); close = runtime.close;
  const worker = createAuditWorker(runtime.ports);
  while (!stop.signal.aborted) {
    await worker.step(stop.signal);
    try {
      const health = await worker.health(stop.signal);
      console.log(JSON.stringify({ type: "audit-worker-health", ...worker.snapshot(), ...health,
        attention: health.quarantined > 0 || health.expired > 0 || health.oldestAgeSeconds > 300 }));
    } catch { if (!stop.signal.aborted) console.error("Audit worker health unavailable"); }
    await delay(worker.pollMs, undefined, { signal: stop.signal }).catch(() => {});
  }
 } catch { console.error("Audit worker stopped", "RUNTIME_UNAVAILABLE"); process.exitCode = 1; }
 finally { await close?.(); }
}
void main().catch(() => { console.error("Audit worker stopped", "RUNTIME_UNAVAILABLE"); process.exitCode = 1; });
