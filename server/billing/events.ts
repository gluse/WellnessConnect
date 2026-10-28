import { createHash } from "node:crypto";
import { assertAuthority, authoritySchema, BillingError, verifiedEventSchema,
  type Authority, type VerifiedEvent } from "./contracts";

export interface EventRepository {
  /** Atomically dedupe identity+fingerprint, resolve workspace from known customer/contract
   * binding, increment its dirty generation, or quarantine unmapped/conflicting evidence. */
  ingest(event: VerifiedEvent & { fingerprint: string }): Promise<"inserted" | "duplicate" | "quarantined">;
}
export interface EventVerifier {
  /** Must verify signature over raw bytes, timestamp/replay tolerance and expected endpoint key.
   * This interface alone is not signature verification; no real adapter is installed. */
  verify(raw: Uint8Array, signature: string): Promise<unknown>;
}
export async function receiveBillingEvent(raw: Uint8Array, signature: string, deps: {
  authority: Authority; allowedEventTypes: readonly string[]; verifier: EventVerifier; repository: EventRepository;
}): Promise<"inserted" | "duplicate" | "quarantined" | "unsupported"> {
  if (!(raw instanceof Uint8Array) || raw.byteLength === 0 || raw.byteLength > 262_144 ||
    typeof signature !== "string" || !signature.length || signature.length > 2048) throw new BillingError("INVALID_INPUT");
  const authority = authoritySchema.parse(deps.authority);
  let event: VerifiedEvent;
  try { event = verifiedEventSchema.parse(await deps.verifier.verify(raw, signature)); }
  catch { throw new BillingError("UNTRUSTED_PROVIDER"); }
  assertAuthority(event, authority);
  if (!deps.allowedEventTypes.includes(event.eventType)) return "unsupported";
  // Stable verified fields avoid treating harmless JSON reserialization as a new payload.
  // Changes outside this allowlist are reconciled from current provider state, never applied here.
  const fingerprint = createHash("sha256").update(JSON.stringify([
    event.provider, event.merchantAccount, event.mode, event.eventId, event.eventType,
    event.customerId, event.processorSubscriptionId, event.occurredAt,
  ])).digest("hex");
  return deps.repository.ingest({ ...event, fingerprint });
}
