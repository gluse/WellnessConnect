// DB owner prepared this injected metadata guard under Backend's explicit local
// delegation. It never imports server/db, reads configuration or opens a socket.
import { WISHLIST_APPLICATION_READINESS_SQL as BILLING_APPLICATION_READINESS_SQL, wishlistApplicationReadinessArguments as billingApplicationReadinessArguments,
  assertWishlistApplicationReadiness as assertBillingApplicationReadiness, WISHLIST_APPLICATION_READINESS_KEYS as BILLING_APPLICATION_READINESS_KEYS } from "../../migrations/wishlist/application-readiness.mjs";

export type BillingReadinessQuery = (text: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
export class BillingDatabaseReadinessError extends Error {
  readonly code = "BILLING_DB_NOT_READY";
  constructor(readonly checks: readonly string[]) { super("BILLING_DB_NOT_READY"); }
}
export async function verifyBillingDatabaseReadiness(query: BillingReadinessQuery): Promise<void> {
  let rows: Record<string, unknown>[];
  try {
    const result = await query(BILLING_APPLICATION_READINESS_SQL, billingApplicationReadinessArguments());
    rows = result.rows;
  } catch {
    // Driver messages, query details and connection values must never escape.
    throw new BillingDatabaseReadinessError(["metadata_query"]);
  }
  try { assertBillingApplicationReadiness(rows); }
  catch {
    let failed: string[] = [];
    try {
      if (Array.isArray(rows) && rows.length === 1 && rows[0] && typeof rows[0] === "object") failed = BILLING_APPLICATION_READINESS_KEYS.filter(key => rows[0][key] !== true);
    } catch { /* Malformed driver results still expose no original error. */ }
    throw new BillingDatabaseReadinessError(failed.length ? failed : ["readiness_result_shape"]);
  }
}
