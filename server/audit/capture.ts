import { sql, type SQL } from "drizzle-orm";
import { canonicalAuditJson, auditPayloadHash, AUDIT_HASH_VERSION, AuditContractError } from "./canonical.ts";
import { parseAuditEnvelope, type createAuditEvent } from "./events.ts";

export type PreparedAuditEvent = ReturnType<typeof createAuditEvent>;
export interface AuditQueryResult { rows: Record<string, unknown>[] }
export interface AuditExecutor { query(text: string, values?: unknown[]): Promise<AuditQueryResult> }
export interface AuditClient extends AuditExecutor { release(destroy?: boolean): void }
export interface AuditPool { connect(): Promise<AuditClient> }
export class AuditCaptureUnavailable extends Error {
  readonly status = 503;
  constructor() { super("Activity capture is temporarily unavailable"); this.name = "AuditCaptureUnavailable"; }
}

export function auditArguments(event: PreparedAuditEvent): [string, string, string] {
  const envelope = parseAuditEnvelope(event.envelope);
  const canonical = canonicalAuditJson(envelope);
  if (canonical !== event.canonicalJson || auditPayloadHash(canonical) !== event.payloadHash ||
    event.hashVersion !== AUDIT_HASH_VERSION) throw new AuditContractError();
  return [canonical, event.payloadHash, event.hashVersion];
}

/** Caller owns this transaction/client. Never obtains a second connection. */
export async function enqueueAudit(transaction: AuditExecutor, event: PreparedAuditEvent): Promise<void> {
  try {
    const result = await transaction.query("SELECT audit_capture.enqueue($1,$2,$3) AS event_id", auditArguments(event));
    if (result.rows.length !== 1 || result.rows[0].event_id !== event.envelope.eventId) throw new AuditCaptureUnavailable();
  } catch { console.error("Audit capture gap", "CAPTURE_UNAVAILABLE"); throw new AuditCaptureUnavailable(); }
}

/** Uses precisely the existing Drizzle transaction handle. */
export async function enqueueDrizzleAudit(transaction: { execute(query: SQL): Promise<AuditQueryResult> }, event: PreparedAuditEvent): Promise<void> {
  try {
    const [canonical, hash, version] = auditArguments(event);
    const result = await transaction.execute(sql`SELECT audit_capture.enqueue(${canonical},${hash},${version}) AS event_id`);
    if (result.rows.length !== 1 || result.rows[0].event_id !== event.envelope.eventId) throw new AuditCaptureUnavailable();
  } catch { console.error("Audit capture gap", "CAPTURE_UNAVAILABLE"); throw new AuditCaptureUnavailable(); }
}

export async function auditTransaction<T>(pool: AuditPool, work: (transaction: AuditExecutor) => Promise<T>): Promise<T> {
  let client: AuditClient;
  try { client = await pool.connect(); }
  catch { console.error("Audit capture gap", "CAPTURE_UNAVAILABLE"); throw new AuditCaptureUnavailable(); }
  let failed = false;
  try {
    await client.query("BEGIN");
    const value = await work(client);
    await client.query("COMMIT");
    return value;
  } catch {
    failed = true;
    await client.query("ROLLBACK").catch(() => {});
    // A commit transport failure is ambiguous; do not fabricate a rollback fact.
    throw new AuditCaptureUnavailable();
  } finally { client.release(failed); }
}

/** Failures/denials use a fresh transaction after any business rollback. */
export async function captureIndependent(pool: AuditPool, event: PreparedAuditEvent): Promise<void> {
  await auditTransaction(pool, transaction => enqueueAudit(transaction, event));
}
