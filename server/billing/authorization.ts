import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { subscriptionTargetSchema, type SubscriptionTarget } from "../../shared/storefront";
import { users, companies, companyMemberships, providerSubscriptions, manualProGrants, billingSourceState } from "../../shared/schema";
import { BillingError } from "./contracts";
import type { BillingTransaction } from "./repository";

export type BillingActorRecord = { userId: string; providerType: string | null; company?: {
  id: number; ownerId: string; membershipRole: string | null; active: boolean;
} };
/** Selected policy: personal workspace owner or current company owner, never company admin. */
export function assertBillingOwner(actorId: string, target: SubscriptionTarget, record: BillingActorRecord,
  purpose: "view" | "checkout" | "portal" = "view"): void {
  z.string().uuid().parse(actorId);
  if (record.userId !== actorId) throw new BillingError("FORBIDDEN");
  if (target.kind === "user") {
    if (target.id !== actorId) throw new BillingError("FORBIDDEN");
  } else if (!record.company || record.company.id !== target.id || record.company.ownerId !== actorId ||
    record.company.membershipRole !== "owner" || (purpose === "checkout" && !record.company.active))
    throw new BillingError("FORBIDDEN");
}

export async function authorizeBillingTarget(tx: BillingTransaction, actorId: string, input: unknown,
  purpose: "view" | "checkout" | "portal" = "view", lock = false) {
  const target = subscriptionTargetSchema.parse(input);
  const [user] = await tx.select().from(users).where(eq(users.id, actorId));
  if (!user) throw new BillingError("FORBIDDEN");
  let company: BillingActorRecord["company"];
  if (target.kind === "company") {
    const query = tx.select().from(companies).where(eq(companies.id, target.id));
    const [row] = lock ? await query.for("update") : await query;
    const [membership] = await tx.select().from(companyMemberships).where(and(
      eq(companyMemberships.companyId, target.id), eq(companyMemberships.userId, actorId)));
    if (row) company = { id: row.id, ownerId: row.ownerId, active: row.isActive, membershipRole: membership?.role ?? null };
  }
  assertBillingOwner(actorId, target, { userId: user.id, providerType: user.providerType, company }, purpose);
  const [workspace] = await tx.select().from(providerSubscriptions).where(target.kind === "company"
    ? eq(providerSubscriptions.companyId, target.id) : eq(providerSubscriptions.userId, actorId));
  return { target, workspace };
}

/** Caller holds stable workspace lock. Preserve legacy grant until an explicit source import. */
export async function assertManualGrantExpired(tx: BillingTransaction, workspaceId: number, now: number): Promise<void> {
  const [source] = await tx.select().from(billingSourceState).where(eq(billingSourceState.workspaceId, workspaceId));
  if (!source) {
    const [legacy] = await tx.select().from(providerSubscriptions).where(eq(providerSubscriptions.id, workspaceId));
    if (legacy?.plan === "pro" && legacy.proUntil && legacy.proUntil.getTime() > now)
      throw new BillingError("MANUAL_GRANT_ACTIVE");
  }
  const grants = await tx.select().from(manualProGrants).where(and(eq(manualProGrants.workspaceId, workspaceId),
    isNull(manualProGrants.revokedAt), gt(manualProGrants.endsAt, new Date(now))));
  if (grants.some(grant => grant.startsAt.getTime() <= now)) throw new BillingError("MANUAL_GRANT_ACTIVE");
}
