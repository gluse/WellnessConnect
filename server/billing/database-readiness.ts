// DB owner prepared this injected metadata guard under Backend's explicit local
// delegation. It never imports server/db, reads configuration or opens a socket.
import { BILLING_APPLICATION_READINESS_SQL, billingApplicationReadinessArguments,
  assertBillingApplicationReadiness } from "../../migrations/billing/application-readiness.mjs";

export type BillingReadinessQuery = (text: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
export async function verifyBillingDatabaseReadiness(query: BillingReadinessQuery): Promise<void> {
  try {
    const result = await query(BILLING_APPLICATION_READINESS_SQL, billingApplicationReadinessArguments());
    assertBillingApplicationReadiness(result.rows);
  } catch {
    // Driver messages, query details and connection values must never escape.
    throw new Error("BILLING_DB_NOT_READY");
  }
}
