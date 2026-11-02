import "dotenv/config";
import { notificationConfig } from "./transports";

// Disabled by default; do not even initialize a database pool until explicitly enabled.
async function main() {
if (!notificationConfig().enabled) {
  console.error("Notifications are disabled. Configure and authorize them before running the worker.");
  process.exitCode = 1;
} else {
  const { db, pool } = await import("../db");
  const { notificationWorkerTick } = await import("./worker");
  let stopping = false;
  const stop = () => { stopping = true; };
  process.on("SIGTERM", stop); process.on("SIGINT", stop);
  try {
    while (!stopping) {
      const started = Date.now();
      try { const result = await notificationWorkerTick(db, { shouldStop: () => stopping }); console.info("Notification worker completed:", result.processed); }
      catch { console.error("Notification worker tick failed; no automatic retry of attempted messages."); }
      // Short waits allow prompt signal handling without overlapping ticks.
      while (!stopping && Date.now() - started < 60_000) await new Promise(resolve => setTimeout(resolve, Math.min(1000, 60_000 - (Date.now() - started))));
    }
  } finally { await pool.end(); }
}
}
void main().catch(() => { console.error("Notification worker initialization failed."); process.exitCode = 1; });
