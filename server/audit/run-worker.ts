import { runAuditWorkerRuntime } from "./worker-loop.ts";

// Explicit separate process only. No import from application startup; no dotenv.
// Provide restricted connection settings through the process environment.
async function main() {
 const stop = new AbortController();
 const abort = () => stop.abort();
 process.once("SIGTERM", abort); process.once("SIGINT", abort);
 try {
  await runAuditWorkerRuntime(process.env, stop.signal, value => { console.log(JSON.stringify(value)); });
 } catch { console.error("Audit worker stopped", "RUNTIME_UNAVAILABLE"); process.exitCode = 1; }
 finally { process.removeListener("SIGTERM", abort); process.removeListener("SIGINT", abort); }
}
void main().catch(() => { console.error("Audit worker stopped", "RUNTIME_UNAVAILABLE"); process.exitCode = 1; });
