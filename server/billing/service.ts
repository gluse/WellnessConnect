import { randomUUID, createHash } from "node:crypto";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { providerSubscriptions, billingSubscriptions, billingOperations, billingAccounts, manualProGrants,
  billingSourceState, companies } from "../../shared/schema";
import type { SubscriptionTarget } from "../../shared/storefront";
import { authorizeBillingTarget, assertManualGrantExpired } from "./authorization";
import { readCurrentOffer, assertCurrentOffer, displayAmount } from "./pricing";
import { createBillingRepository, type BillingDatabase, type BillingTransaction } from "./repository";
import { startCheckout, type CheckoutProvider } from "./checkout";
import { BillingError, type Authority } from "./contracts";
import type { BillingRouteService, billingCheckoutBody } from "./routes";
import type { z } from "zod";

export type ServiceAudit = (tx: BillingTransaction, change: {
  kind: "portal.reserved" | "portal.created" | "portal.unknown" | "workspace.initialized" | "checkout.reserved" | "checkout.created" | "checkout.unknown" | "event.accepted" | "event.quarantined";
  workspaceId: number | null; reference: string; actorId?: string; target?: SubscriptionTarget;
}) => Promise<void>;
export interface SelectedBillingConfig {
  authority: Authority; now(): number; newCheckoutsReady(): boolean;
  terms: { version: string; text: string; taxDisclosure: string } | null;
  audit: ServiceAudit; provider: CheckoutProvider; hostedOrigins: readonly string[];
  portal(customerId: string, operationId?: string): Promise<{ url: string; sessionId?: string }>;
}
/** Application service is constructed only by an approved integration; no bootstrap registration. */
export function createSelectedBillingService(db: BillingDatabase, config: SelectedBillingConfig): BillingRouteService {
  const targetFromWorkspace = (workspace: typeof providerSubscriptions.$inferSelect): SubscriptionTarget => workspace.companyId !== null
    ? { kind: "company", id: workspace.companyId } : { kind: "user", id: workspace.userId! };
  return {
    async status(actorId, target) {
      return db.transaction(async tx => {
        const { workspace } = await authorizeBillingTarget(tx, actorId, target);
        const { offer } = await readCurrentOffer(tx);
        let manualUntil: string | null = null, paidThrough: string | null = null;
        let contract: typeof billingSubscriptions.$inferSelect | undefined, operation: typeof billingOperations.$inferSelect | undefined;
        if (workspace) {
          const [marker] = await tx.select().from(billingSourceState).where(eq(billingSourceState.workspaceId, workspace.id));
          const grants = await tx.select().from(manualProGrants).where(and(eq(manualProGrants.workspaceId, workspace.id), isNull(manualProGrants.revokedAt)));
          const expires = grants.filter(grant => grant.startsAt.getTime() <= config.now() && grant.endsAt.getTime() > config.now()).map(grant => grant.endsAt.getTime());
          if (!marker && workspace.plan === "pro" && workspace.proUntil && workspace.proUntil.getTime() > config.now()) expires.push(workspace.proUntil.getTime());
          if (expires.length) manualUntil = new Date(Math.max(...expires)).toISOString();
          const contracts = await tx.select().from(billingSubscriptions).where(and(eq(billingSubscriptions.workspaceId, workspace.id),
            eq(billingSubscriptions.provider, config.authority.provider), eq(billingSubscriptions.merchantAccount, config.authority.merchantAccount),
            eq(billingSubscriptions.mode, config.authority.mode)));
          contract = contracts.find(row => row.state !== "ended") ?? contracts.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
          paidThrough = contract?.paidThrough?.toISOString() ?? null;
          [operation] = await tx.select().from(billingOperations).where(and(eq(billingOperations.workspaceId, workspace.id),
            eq(billingOperations.mode, config.authority.mode), eq(billingOperations.kind, "checkout"), isNull(billingOperations.resolvedAt)));
        }
        let activeCompany = true;
        if (target.kind === "company") { const [company] = await tx.select().from(companies).where(eq(companies.id, target.id)); activeCompany = company?.isActive ?? false; }
        const hasPro = workspace?.plan === "pro" && workspace.proUntil !== null && workspace.proUntil.getTime() > config.now();
        const existing = contract && contract.state !== "ended";
        const state = operation ? "pending" : contract?.processorStatus === "past_due" || contract?.processorStatus === "unpaid" ? "payment_failed"
          : contract?.processorStatus === "incomplete" ? "action_required" : existing ? "active"
            : contract?.state === "ended" ? "canceled" : "none";
        return { target, state, manualUntil, paidThrough, effectiveAccess: { hasPro: Boolean(hasPro), until: hasPro ? workspace!.proUntil!.toISOString() : null },
          cancelAtPeriodEnd: contract?.cancelAtPeriodEnd ?? false, operation: operation ? operation.state === "unknown" ? "unknown" : "pending" : "none",
          capabilities: { checkout: Boolean(config.newCheckoutsReady() && config.terms && activeCompany && !manualUntil && !existing && !operation),
            manage: Boolean(existing), recover: Boolean(existing && ["past_due", "unpaid", "incomplete"].includes(contract!.processorStatus)) },
          unavailableReason: manualUntil ? "manual_grant" : !config.newCheckoutsReady() || !config.terms ? "not_ready" : null,
          offer: config.terms ? { amount: displayAmount(offer.amountMinor), currency: "EUR", interval: "month", taxDisclosure: config.terms.taxDisclosure,
            termsText: config.terms.text, termsVersion: config.terms.version, offerRevision: offer.id } : null };
      });
    },
    async checkout(actorId, input: z.infer<typeof billingCheckoutBody>) {
      if (!config.newCheckoutsReady() || !config.terms) throw new BillingError("UNAVAILABLE");
      const initialized = await db.transaction(async tx => {
        const authorized = await authorizeBillingTarget(tx, actorId, input.target, "checkout", true);
        let workspace = authorized.workspace;
        if (!workspace) {
          // Owner/company lock serializes first anchor creation; unique workspace indexes remain the final guard.
          if (input.target.kind === "user") await tx.execute(sql`SELECT id FROM users WHERE id = ${actorId} FOR UPDATE`);
          const [inserted] = await tx.insert(providerSubscriptions).values({ userId: input.target.kind === "user" ? actorId : null,
            companyId: input.target.kind === "company" ? input.target.id : null, plan: "free", proUntil: null, updatedBy: actorId })
            .onConflictDoNothing().returning();
          workspace = inserted ?? (await tx.select().from(providerSubscriptions).where(input.target.kind === "user"
            ? eq(providerSubscriptions.userId, actorId) : eq(providerSubscriptions.companyId, input.target.id)))[0];
          if (!workspace) throw new BillingError("UNAVAILABLE");
          if (inserted) await config.audit(tx, { kind: "workspace.initialized", workspaceId: workspace.id, reference: String(workspace.id), actorId, target: input.target });
        }
        const { offer } = await readCurrentOffer(tx);
        return { workspace, offer };
      });
      const binding = { ...config.authority, workspaceId: initialized.workspace.id };
      const repository = createBillingRepository(db, config.authority, {
        async authorizeCheckout(tx, reservation) {
          const [workspace] = await tx.select().from(providerSubscriptions).where(eq(providerSubscriptions.id, reservation.binding.workspaceId));
          if (!workspace) throw new BillingError("BINDING_MISMATCH");
          const target = targetFromWorkspace(workspace);
          await authorizeBillingTarget(tx, reservation.actorId, target, "checkout", true);
          await assertManualGrantExpired(tx, workspace.id, config.now());
          await assertCurrentOffer(tx, reservation.offerRevision);
        },
        async recordChange(tx, change) { await config.audit(tx, { ...change, actorId }); },
      }, config.now);
      const result = await startCheckout({ workspaceId: binding.workspaceId, termsVersion: input.termsVersion,
        offerRevision: input.offerRevision, idempotencyKey: input.idempotencyKey }, {
        authority: config.authority, offer: { reference: initialized.offer.id, amountMinor: initialized.offer.amountMinor,
          currency: "EUR", interval: "month", quantity: 1, taxIncluded: true, termsVersion: config.terms.version },
        hostedOrigins: config.hostedOrigins, provider: config.provider, repository,
        async authorize(workspaceId) {
          return db.transaction(async tx => {
            const checked = await authorizeBillingTarget(tx, actorId, input.target, "checkout");
            if (checked.workspace?.id !== workspaceId) throw new BillingError("BINDING_MISMATCH");
            return { actorId, binding };
          });
        },
      });
      return result.status === "created" ? { state: "redirect", target: input.target, url: result.url } : { state: "pending", target: input.target };
    },
    async portal(actorId, target) {
      const reserved = await db.transaction(async tx => {
        const { workspace } = await authorizeBillingTarget(tx, actorId, target, "portal");
        if (!workspace) throw new BillingError("UNAVAILABLE");
        await tx.select().from(providerSubscriptions).where(eq(providerSubscriptions.id, workspace.id)).for("update");
        await authorizeBillingTarget(tx, actorId, target, "portal", true);
        const [contract] = await tx.select().from(billingSubscriptions).where(and(eq(billingSubscriptions.workspaceId, workspace.id),
          eq(billingSubscriptions.provider, config.authority.provider), eq(billingSubscriptions.merchantAccount, config.authority.merchantAccount),
          eq(billingSubscriptions.mode, config.authority.mode), ne(billingSubscriptions.state, "ended")));
        if (!contract) throw new BillingError("UNAVAILABLE");
        const [account] = await tx.select().from(billingAccounts).where(eq(billingAccounts.id, contract.accountId));
        if (!account?.customerId) throw new BillingError("UNAVAILABLE");
        const operationId = randomUUID();
        await tx.insert(billingOperations).values({ id: operationId, ...config.authority, workspaceId: workspace.id,
          accountId: account.id, kind: "portal", idempotencyKey: operationId,
          fingerprint: createHash("sha256").update(JSON.stringify([workspace.id, actorId, account.id, operationId])).digest("hex"),
          approvedOfferRef: contract.approvedOfferRef, termsVersion: "portal-v1", initiatorId: actorId, state: "reserved" });
        await config.audit(tx, { kind: "portal.reserved", workspaceId: workspace.id, reference: operationId, actorId });
        return { customerId: account.customerId, operationId, workspaceId: workspace.id };
      });
      let result: { url: string; sessionId?: string };
      try {
        result = await config.portal(reserved.customerId, reserved.operationId);
        if (!result.sessionId) throw new BillingError("UNTRUSTED_PROVIDER");
        await db.transaction(async tx => {
          await tx.select().from(providerSubscriptions).where(eq(providerSubscriptions.id, reserved.workspaceId)).for("update");
          await tx.update(billingOperations).set({ state: "completed", remoteCheckoutId: result.sessionId, resolvedAt: new Date(config.now()), updatedAt: new Date(config.now()) })
            .where(eq(billingOperations.id, reserved.operationId));
          await config.audit(tx, { kind: "portal.created", workspaceId: reserved.workspaceId, reference: reserved.operationId, actorId });
        });
      } catch (error) {
        // This adapter's POLICY_REVIEW is a configuration rejection before session creation.
        const rejected = error instanceof BillingError && error.code === "POLICY_REVIEW";
        await db.transaction(async tx => {
          await tx.select().from(providerSubscriptions).where(eq(providerSubscriptions.id, reserved.workspaceId)).for("update");
          await tx.update(billingOperations).set({ state: rejected ? "failed" : "unknown", failureCode: rejected ? "POLICY_REVIEW" : "PROVIDER_TIMEOUT",
            resolvedAt: rejected ? new Date(config.now()) : null, updatedAt: new Date(config.now()) })
            .where(and(eq(billingOperations.id, reserved.operationId), ne(billingOperations.state, "completed")));
          if (!rejected) await config.audit(tx, { kind: "portal.unknown", workspaceId: reserved.workspaceId, reference: reserved.operationId });
        });
        throw new BillingError(rejected ? "POLICY_REVIEW" : "UNAVAILABLE");
      }
      // Hosted sessions are capabilities: reauthorize after the external effect before disclosure.
      await db.transaction(tx => authorizeBillingTarget(tx, actorId, target, "portal"));
      const url = new URL(result.url);
      if (url.protocol !== "https:" || url.username || url.password || !config.hostedOrigins.includes(url.origin)) throw new BillingError("UNTRUSTED_PROVIDER");
      return { state: "redirect", target, url: url.href };
    },
  };
}
