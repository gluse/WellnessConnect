import { z } from "zod";
import { canonicalAuditJson, auditPayloadHash, AUDIT_HASH_VERSION } from "./canonical.ts";
import { parseAuditEnvelope } from "./events.ts";
import { workerOptionsSchema } from "./config.ts";

const claimSchema = z.object({
  event_id: z.string().uuid(), canonical_json: z.string().max(32768), payload_hash: z.string().regex(/^[a-f0-9]{64}$/),
  hash_version: z.string().max(64), lease_token: z.string().uuid(), lease_until: z.union([z.date(), z.string().datetime()]),
  attempts: z.union([z.string().regex(/^[0-9]{1,19}$/), z.number().int().nonnegative()]),
}).strict();
export type AuditClaim = z.infer<typeof claimSchema>;
export type DeliveryDisposition = "inserted" | "matching" | "conflict" | "expired";
export type RetryCode = "DESTINATION_UNAVAILABLE" | "DESTINATION_TIMEOUT" | "DESTINATION_BUSY";
export type QuarantineCode = "INVALID_CONTRACT" | "HASH_CONFLICT" | "EXPIRED_AT_DESTINATION" | "UNSUPPORTED_VERSION" | "AUTHORIZATION_CONFIGURATION";
export class AuditPortFailure extends Error {
  readonly code: RetryCode | "AUTHORIZATION_CONFIGURATION" | "INVALID_CONTRACT";
  constructor(code: AuditPortFailure["code"]) { super("Audit delivery operation unavailable"); this.name = "AuditPortFailure"; this.code = code; }
}
export interface AuditWorkerPorts {
  claim(limit: number, signal: AbortSignal): Promise<unknown[]>;
  accept(row: AuditClaim, signal: AbortSignal): Promise<DeliveryDisposition>;
  ack(row: AuditClaim, signal: AbortSignal): Promise<boolean>;
  retry(row: AuditClaim, code: RetryCode, delaySeconds: number, signal: AbortSignal): Promise<boolean>;
  quarantine(row: AuditClaim, code: QuarantineCode, signal: AbortSignal): Promise<boolean>;
  health(signal: AbortSignal): Promise<{ pending: number; leased: number; quarantined: number; expired: number; oldestAgeSeconds: number }>;
}
export interface AuditWorkerMetrics {
  claimed: number; delivered: number; matching: number; retried: number; quarantined: number; stale: number;
  sourceFailures: number; destinationFailures: number; captureGaps: number;
}
export const emptyWorkerMetrics = (): AuditWorkerMetrics => ({ claimed: 0, delivered: 0, matching: 0, retried: 0,
  quarantined: 0, stale: 0, sourceFailures: 0, destinationFailures: 0, captureGaps: 0 });

/** Source/destination ports must commit each operation before resolving. */
export function createAuditWorker(ports: AuditWorkerPorts, options = { batchSize: 10, timeoutMs: 5000, pollMs: 1000 },
  dependencies = { now: () => Date.now(), random: () => Math.random() }) {
  workerOptionsSchema.parse(options);
  const metrics = emptyWorkerMetrics();
  const timed = async <T>(work: (signal: AbortSignal) => Promise<T>, parent: AbortSignal): Promise<T> => {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    parent.addEventListener("abort", cancel, { once: true });
    const timer = setTimeout(cancel, options.timeoutMs);
    try {
      if (parent.aborted) controller.abort();
      return await Promise.race([work(controller.signal), new Promise<never>((_, reject) => {
        const abort = () => reject(new AuditPortFailure("DESTINATION_TIMEOUT"));
        if (controller.signal.aborted) abort(); else controller.signal.addEventListener("abort", abort, { once: true });
      })]);
    } finally { clearTimeout(timer); parent.removeEventListener("abort", cancel); }
  };
  const delay = (attempts: string | number) => {
    const base = Math.min(150, 2 ** Math.min(8, Number(attempts)));
    return Math.min(300, Math.max(1, Math.ceil(base * (1 + Math.max(0, Math.min(1, dependencies.random()))))));
  };
  const step = async (signal: AbortSignal): Promise<void> => {
    if (signal.aborted) return;
    let rows: unknown[];
    try { rows = await timed(s => ports.claim(options.batchSize, s), signal); }
    catch { metrics.sourceFailures++; return; }
    if (!Array.isArray(rows) || rows.length > options.batchSize) { metrics.sourceFailures++; return; }
    for (const raw of rows) {
      if (signal.aborted) break; // Lease expiry safely reclaims unprocessed rows.
      const parsed = claimSchema.safeParse(raw);
      if (!parsed.success) { metrics.captureGaps++; continue; } // Cannot safely identify/ack an invalid claim.
      const row = parsed.data;
      metrics.claimed++;
      let quarantine: QuarantineCode | undefined;
      if (row.hash_version !== AUDIT_HASH_VERSION) quarantine = "UNSUPPORTED_VERSION";
      else {
        try {
          const event = parseAuditEnvelope(JSON.parse(row.canonical_json));
          if (event.eventId !== row.event_id || canonicalAuditJson(event) !== row.canonical_json ||
            auditPayloadHash(row.canonical_json) !== row.payload_hash || event.source.environment !== "development") quarantine = "INVALID_CONTRACT";
        } catch { quarantine = "INVALID_CONTRACT"; }
      }
      try {
        if (quarantine) {
          if (await timed(s => ports.quarantine(row, quarantine!, s), signal)) metrics.quarantined++; else metrics.stale++;
          continue;
        }
        const remaining = new Date(row.lease_until).getTime() - dependencies.now();
        if (remaining < options.timeoutMs + 2000) {
          if (await timed(s => ports.retry(row, "DESTINATION_BUSY", delay(row.attempts), s), signal)) metrics.retried++; else metrics.stale++;
          continue;
        }
        let disposition: DeliveryDisposition;
        try { disposition = await timed(s => ports.accept(row, s), signal); }
        catch (error) {
          metrics.destinationFailures++;
          if (signal.aborted) break;
          const code = error instanceof AuditPortFailure ? error.code : "DESTINATION_UNAVAILABLE";
          if (code === "AUTHORIZATION_CONFIGURATION" || code === "INVALID_CONTRACT") {
            if (await timed(s => ports.quarantine(row, code, s), signal)) metrics.quarantined++; else metrics.stale++;
          } else if (await timed(s => ports.retry(row, code, delay(row.attempts), s), signal)) metrics.retried++; else metrics.stale++;
          continue;
        }
        if (disposition === "inserted" || disposition === "matching") {
          // Only committed acceptance permits ack. Failed ack is NOT re-delivery success.
          if (await timed(s => ports.ack(row, s), signal)) {
            metrics.delivered++; if (disposition === "matching") metrics.matching++;
          } else metrics.stale++;
        } else if (disposition === "conflict" || disposition === "expired") {
          if (await timed(s => ports.quarantine(row, disposition === "conflict" ? "HASH_CONFLICT" : "EXPIRED_AT_DESTINATION", s), signal)) metrics.quarantined++; else metrics.stale++;
        } else { metrics.destinationFailures++; } // Unknown remote disposition: never ack.
      } catch { metrics.sourceFailures++; }
    }
  };
  const health = (signal: AbortSignal) => timed(s => ports.health(s), signal);
  return { step, health, snapshot: () => Object.freeze({ ...metrics }), pollMs: options.pollMs };
}
