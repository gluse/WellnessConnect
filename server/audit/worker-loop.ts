import { setTimeout as pause } from "node:timers/promises";
import { z } from "zod";
import { createAuditWorker, emptyWorkerMetrics, type AuditWorkerMetrics } from "./worker.ts";
import { createWorkerRuntime } from "./runtime.ts";

type Worker = Pick<ReturnType<typeof createAuditWorker>, "step" | "health" | "snapshot" | "pollMs">;
type Health = Awaited<ReturnType<Worker["health"]>>;
export type WorkerReport = { type: "audit-worker-health"; status: "healthy" | "attention" | "unavailable";
  attention: boolean; recovered: boolean; metrics: Readonly<AuditWorkerMetrics>; health?: Health };
const runOptions = z.object({ healthEverySteps: z.number().int().min(1).max(60),
  maxSteps: z.number().int().min(1).max(1000000).optional() }).strict();
export type WorkerRunOptions = z.infer<typeof runOptions>;

/** No event IDs/payloads, driver errors, URLs or other private configuration. */
export function auditWorkerReport(metrics: Readonly<AuditWorkerMetrics>, health: Health | undefined,
  previous = emptyWorkerMetrics(), previouslyAttention = false): WorkerReport {
  const attention = !health || health.quarantined > 0 || health.expired > 0 || health.oldestAgeSeconds >= 300 ||
    metrics.captureGaps > 0 || metrics.sourceFailures > previous.sourceFailures ||
    metrics.destinationFailures > previous.destinationFailures;
  return { type: "audit-worker-health", status: health ? attention ? "attention" : "healthy" : "unavailable",
    attention, recovered: previouslyAttention && !attention, metrics: { ...metrics }, ...(health ? { health: { ...health } } : {}) };
}

/** Bounded test/rehearsal runs and the real daemon share this actual loop. */
export async function runAuditWorker(worker: Worker, signal: AbortSignal,
  report: (value: WorkerReport) => void | Promise<void>, options: WorkerRunOptions = { healthEverySteps: 5 },
  wait = (ms: number, abort: AbortSignal) => pause(ms, undefined, { signal: abort })) {
  runOptions.parse(options);
  let steps = 0, previous = emptyWorkerMetrics(), attention = false;
  while (!signal.aborted && (options.maxSteps === undefined || steps < options.maxSteps)) {
    await worker.step(signal);
    steps++;
    if (signal.aborted) break;
    if (steps === 1 || steps % options.healthEverySteps === 0 || steps === options.maxSteps) {
      let health: Health | undefined;
      try { health = await worker.health(signal); }
      catch { if (signal.aborted) break; }
      const metrics = worker.snapshot(), value = auditWorkerReport(metrics, health, previous, attention);
      await report(value);
      previous = { ...metrics }; attention = value.attention;
    }
    if (options.maxSteps !== undefined && steps >= options.maxSteps) break;
    try { await wait(worker.pollMs, signal); }
    catch (error) { if (!signal.aborted) throw error; }
  }
  return { steps, metrics: worker.snapshot() };
}

export async function runAuditWorkerRuntime(environment: Record<string, string | undefined>, signal: AbortSignal,
  report: (value: WorkerReport) => void | Promise<void>, options?: WorkerRunOptions,
  dependencies = { open: createWorkerRuntime,
    wait: (ms: number, abort: AbortSignal) => pause(ms, undefined, { signal: abort }) }) {
  if (signal.aborted) return;
  const runtime = await dependencies.open(environment);
  try { return await runAuditWorker(createAuditWorker(runtime.ports), signal, report, options, dependencies.wait); }
  finally { await runtime.close(); }
}
