import type { SubscriptionTarget } from "../../shared/storefront";
import { eq, sql } from "drizzle-orm";
import { billingSourceState } from "../../shared/schema";
import { BillingError } from "./contracts";
import type { BillingTransaction } from "./repository";
export type ManualWriter = (actorId: string, input: { target: SubscriptionTarget; plan: "free" | "pro"; proUntil?: string | null }) => Promise<unknown>;
let writer: ManualWriter | undefined;
/** Installed by the explicit sandbox bootstrap. Stopping checkout never removes this writer. */
export function installBillingManualWriter(value: ManualWriter) { writer = value; }
export function billingManualWriter() { return writer; }
/** Caller holds the stable workspace lock, including during rollback to an ordinary launcher. */
export async function assertLegacyManualWritable(tx: BillingTransaction, workspaceId: number) {
  const exists = await tx.execute(sql`SELECT to_regclass('public.billing_source_state') IS NOT NULL AS present`);
  if (exists.rows.length !== 1 || typeof exists.rows[0]?.present !== "boolean") throw new BillingError("UNAVAILABLE");
  if (exists.rows[0].present === true) {
    const [marker] = await tx.select().from(billingSourceState).where(eq(billingSourceState.workspaceId, workspaceId));
    if (marker) throw new BillingError("UNAVAILABLE");
  }
}
