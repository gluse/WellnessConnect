import { randomUUID } from "node:crypto";
import { and, eq, isNull, ne, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { billingAccounts, billingSubscriptions, billingInvoices, billingOperations, billingPriceMappings,
  billingSourceState, manualProGrants, providerSubscriptions, billingEvents, users, companies } from "../../shared/schema";
import { assertAuthority, assertBinding, BillingError, bindingSchema, type Authority, type Binding, type BillingSnapshot } from "./contracts";
import { coverageAt } from "./coverage";
import type { BillingDatabase, BillingTransaction } from "./repository";
import type { ReconciliationRepository } from "./reconcile";

export type LifecycleAudit = (tx: BillingTransaction, change: { kind: "checkout.resolved" | "subscription.reconciled" | "manual_grant.changed";
  workspaceId: number; reference: string; actorId?: string }) => Promise<void>;
export const confirmedCheckoutSchema = z.object({
  operationId: z.string().uuid(), sessionId: z.string().min(1).max(255), workspaceId: z.number().int().positive(),
  offerRevision: z.string().uuid(), mode: z.enum(["test", "live"]), status: z.enum(["open", "complete", "expired"]),
  customerId: z.string().min(1).max(255).nullable(), subscriptionId: z.string().min(1).max(255).nullable(),
  priceId: z.string().min(1).max(255).nullable(), processorStatus: z.string().min(1).max(64).nullable(),
  period: z.object({ start: z.number().int().nonnegative(), end: z.number().int().positive() }).strict().nullable(),
}).strict();

export function createLifecycleRepository(db: BillingDatabase, config: {
  authority: Authority; now(): number; sourcesReady(): boolean; isAdmin(actorId: string): boolean; audit: LifecycleAudit;
}) {
  const timestamp = () => new Date(config.now());
  const workspaceLock = async (tx: BillingTransaction, workspaceId: number) => {
    const [workspace] = await tx.select().from(providerSubscriptions).where(eq(providerSubscriptions.id, workspaceId)).for("update");
    if (!workspace) throw new BillingError("BINDING_MISMATCH"); return workspace;
  };
  async function importSources(tx: BillingTransaction, workspace: typeof providerSubscriptions.$inferSelect) {
    const [marker] = await tx.select().from(billingSourceState).where(eq(billingSourceState.workspaceId, workspace.id));
    if (marker) return;
    const now = config.now();
    // The old row is known manual only until this explicit source-aware cutover.
    if (workspace.plan === "pro" && workspace.proUntil && workspace.proUntil.getTime() > now) {
      await tx.insert(manualProGrants).values({ id: randomUUID(), workspaceId: workspace.id, source: "legacy_manual",
        sourceReference: `legacy:${workspace.id}`, startsAt: new Date(now), endsAt: workspace.proUntil,
        issuedBy: null, legacyUpdatedBy: workspace.updatedBy, legacyUpdatedAt: workspace.updatedAt });
    }
    await tx.insert(billingSourceState).values({ workspaceId: workspace.id, importedAt: new Date(now), revision: 0 });
  }
  async function project(tx: BillingTransaction, workspaceId: number) {
    const manual = await tx.select().from(manualProGrants).where(and(eq(manualProGrants.workspaceId, workspaceId), isNull(manualProGrants.revokedAt)));
    const paid = await tx.select().from(billingInvoices).where(and(eq(billingInvoices.workspaceId, workspaceId),
      eq(billingInvoices.provider, config.authority.provider), eq(billingInvoices.merchantAccount, config.authority.merchantAccount),
      eq(billingInvoices.mode, config.authority.mode), eq(billingInvoices.status, "paid")));
    if (paid.some(invoice => invoice.amountRefunded !== "0" || invoice.disputeReferences.length || invoice.refundReferences.length))
      throw new BillingError("POLICY_REVIEW");
    const coverage = coverageAt([...manual.map(grant => ({ start: grant.startsAt.getTime(), end: grant.endsAt.getTime() })),
      ...paid.map(invoice => ({ start: invoice.periodStart.getTime(), end: invoice.periodEnd.getTime() }))], config.now());
    await tx.update(providerSubscriptions).set({ plan: coverage.proUntil === null ? "free" : "pro",
      proUntil: coverage.proUntil === null ? null : new Date(coverage.proUntil), updatedBy: "billing-worker", updatedAt: timestamp() })
      .where(eq(providerSubscriptions.id, workspaceId));
    await tx.update(billingSourceState).set({ revision: sql`${billingSourceState.revision} + 1` }).where(eq(billingSourceState.workspaceId, workspaceId));
    return coverage;
  }
  return {
    async updateManualEntitlement(actorId: string, input: { target: import("../../shared/storefront").SubscriptionTarget; plan: "free" | "pro"; proUntil?: string | null }) {
      if (!config.sourcesReady() || !config.isAdmin(actorId)) throw new BillingError("UNAVAILABLE");
      const end = input.plan === "pro" ? Date.parse(input.proUntil ?? "") : null;
      if (input.plan === "pro" && (!Number.isFinite(end) || end! <= config.now())) throw new BillingError("INVALID_INPUT");
      return db.transaction(async tx => {
        const target = input.target;
        const owners = target.kind === "company" ? await tx.select({ id: companies.id }).from(companies).where(eq(companies.id, target.id))
          : await tx.select({ id: users.id }).from(users).where(eq(users.id, target.id));
        if (!owners.length) throw new BillingError("BINDING_MISMATCH");
        const where = target.kind === "company" ? eq(providerSubscriptions.companyId, target.id) : eq(providerSubscriptions.userId, target.id);
        await tx.insert(providerSubscriptions).values({ companyId: target.kind === "company" ? target.id : null,
          userId: target.kind === "user" ? target.id : null, plan: "free", updatedBy: actorId }).onConflictDoNothing();
        const [workspace] = await tx.select().from(providerSubscriptions).where(where).for("update");
        if (!workspace) throw new BillingError("BINDING_MISMATCH");
        await importSources(tx, workspace);
        const grants = await tx.select().from(manualProGrants).where(and(eq(manualProGrants.workspaceId, workspace.id), isNull(manualProGrants.revokedAt)));
        for (const grant of grants) {
          await tx.update(manualProGrants).set({ revokedAt: timestamp(), revokedBy: actorId }).where(eq(manualProGrants.id, grant.id));
          await config.audit(tx, { kind: "manual_grant.changed", workspaceId: workspace.id, reference: grant.id, actorId });
        }
        if (end !== null) {
          const id = randomUUID();
          await tx.insert(manualProGrants).values({ id, workspaceId: workspace.id, source: "administrator", sourceReference: id,
            issuedBy: actorId, startsAt: timestamp(), endsAt: new Date(end) });
          await config.audit(tx, { kind: "manual_grant.changed", workspaceId: workspace.id, reference: id, actorId });
        }
        return project(tx, workspace.id);
      });
    },
    async resolveCheckout(input: unknown, eventId?: string) {
      const fact = confirmedCheckoutSchema.parse(input);
      if (fact.mode !== config.authority.mode) throw new BillingError("BINDING_MISMATCH");
      return db.transaction(async tx => {
        const [initial] = await tx.select().from(billingOperations).where(eq(billingOperations.id, fact.operationId));
        if (!initial) throw new BillingError("BINDING_MISMATCH");
        assertAuthority(initial, config.authority);
        await workspaceLock(tx, initial.workspaceId);
        const [operation] = await tx.select().from(billingOperations).where(eq(billingOperations.id, fact.operationId)).for("update");
        if (!operation || operation.kind !== "checkout" || operation.workspaceId !== fact.workspaceId ||
          operation.approvedOfferRef !== fact.offerRevision || (operation.remoteCheckoutId && operation.remoteCheckoutId !== fact.sessionId))
          throw new BillingError("BINDING_MISMATCH");
        const markEvent = async () => {
          if (!eventId) return;
          await tx.update(billingEvents).set({ state: "processed", processedAt: timestamp(), leaseToken: null, leaseUntil: null })
            .where(and(eq(billingEvents.id, eventId), eq(billingEvents.operationId, operation.id),
              eq(billingEvents.workspaceId, operation.workspaceId), eq(billingEvents.provider, operation.provider),
              eq(billingEvents.merchantAccount, operation.merchantAccount), eq(billingEvents.mode, operation.mode),
              inArray(billingEvents.state, ["pending", "processing"])));
        };
        if (fact.status === "open") return "pending" as const;
        if (operation.resolvedAt) { await markEvent(); return "resolved" as const; }
        const [account] = await tx.select().from(billingAccounts).where(eq(billingAccounts.id, operation.accountId)).for("update");
        if (!account || (account.customerId && fact.customerId && account.customerId !== fact.customerId)) throw new BillingError("BINDING_MISMATCH");
        if (fact.status === "complete") {
          if (!fact.customerId || !fact.subscriptionId || !fact.priceId || !fact.processorStatus || !fact.period || fact.period.start >= fact.period.end)
            throw new BillingError("UNTRUSTED_PROVIDER");
          const [mapping] = await tx.select().from(billingPriceMappings).where(and(eq(billingPriceMappings.offerId, fact.offerRevision),
            eq(billingPriceMappings.provider, "stripe"), eq(billingPriceMappings.merchantAccount, operation.merchantAccount),
            eq(billingPriceMappings.mode, operation.mode), eq(billingPriceMappings.processorPriceId, fact.priceId), eq(billingPriceMappings.state, "ready")));
          if (!mapping) throw new BillingError("BINDING_MISMATCH");
          const contracts = await tx.select().from(billingSubscriptions).where(and(eq(billingSubscriptions.workspaceId, operation.workspaceId),
            eq(billingSubscriptions.mode, operation.mode), ne(billingSubscriptions.state, "ended")));
          if (contracts.some(contract => contract.processorSubscriptionId !== fact.subscriptionId)) throw new BillingError("CONFLICT");
          if (!account.customerId) await tx.update(billingAccounts).set({ customerId: fact.customerId, updatedAt: timestamp() }).where(eq(billingAccounts.id, account.id));
          const [existing] = await tx.select().from(billingSubscriptions).where(and(eq(billingSubscriptions.provider, operation.provider),
            eq(billingSubscriptions.merchantAccount, operation.merchantAccount), eq(billingSubscriptions.mode, operation.mode),
            eq(billingSubscriptions.processorSubscriptionId, fact.subscriptionId)));
          if (existing && (existing.workspaceId !== operation.workspaceId || existing.accountId !== account.id || existing.approvedOfferRef !== fact.offerRevision))
            throw new BillingError("BINDING_MISMATCH");
          if (!existing) await tx.insert(billingSubscriptions).values({ id: randomUUID(), workspaceId: operation.workspaceId,
            provider: operation.provider, merchantAccount: operation.merchantAccount, mode: operation.mode, accountId: account.id,
            processorSubscriptionId: fact.subscriptionId, state: "pending", processorStatus: fact.processorStatus,
            approvedOfferRef: fact.offerRevision, offerRevisionId: fact.offerRevision, priceMappingId: mapping.id,
            currency: "EUR", interval: "month", periodStart: new Date(fact.period.start), periodEnd: new Date(fact.period.end),
            nextReconcileAt: timestamp() });
          await tx.update(billingOperations).set({ state: "completed", remoteCheckoutId: fact.sessionId,
            priceMappingId: mapping.id, resolvedAt: timestamp(), updatedAt: timestamp() }).where(eq(billingOperations.id, operation.id));
        } else {
          if (fact.subscriptionId) throw new BillingError("POLICY_REVIEW");
          await tx.update(billingOperations).set({ state: "failed", remoteCheckoutId: fact.sessionId,
            failureCode: "CHECKOUT_EXPIRED", resolvedAt: timestamp(), updatedAt: timestamp() }).where(eq(billingOperations.id, operation.id));
        }
        await config.audit(tx, { kind: "checkout.resolved", workspaceId: operation.workspaceId, reference: operation.id });
        await markEvent();
        return "resolved" as const;
      });
    },
    reconciliationFor(subscriptionId: string): ReconciliationRepository {
      return {
        async claim(binding, now) {
          bindingSchema.parse(binding); assertAuthority(binding, config.authority);
          return db.transaction(async tx => {
            await workspaceLock(tx, binding.workspaceId);
            const [contract] = await tx.select().from(billingSubscriptions).where(eq(billingSubscriptions.id, subscriptionId)).for("update");
            if (!contract) throw new BillingError("BINDING_MISMATCH"); assertBinding(contract, binding);
            if (contract.leaseUntil && contract.leaseUntil.getTime() > now) return null;
            const token = randomUUID(), expiresAt = now + 60000;
            await tx.update(billingSubscriptions).set({ leaseToken: token, leaseUntil: new Date(expiresAt) }).where(eq(billingSubscriptions.id, contract.id));
            return { binding, processorSubscriptionId: contract.processorSubscriptionId, generation: contract.generation,
              revision: contract.revision, token, expiresAt, offerReference: contract.approvedOfferRef };
          });
        },
        async commit(lease, result) {
          if (!config.sourcesReady()) throw new BillingError("UNAVAILABLE");
          assertAuthority(lease.binding, config.authority);
          return db.transaction(async tx => {
            const workspace = await workspaceLock(tx, lease.binding.workspaceId);
            const [contract] = await tx.select().from(billingSubscriptions).where(eq(billingSubscriptions.id, subscriptionId)).for("update");
            if (!contract) throw new BillingError("BINDING_MISMATCH"); assertBinding(contract, lease.binding);
            if (contract.processorSubscriptionId !== lease.processorSubscriptionId || contract.leaseToken !== lease.token ||
              !contract.leaseUntil || contract.leaseUntil.getTime() <= config.now() || contract.generation !== lease.generation || contract.revision !== lease.revision)
              return false;
            const snapshot: BillingSnapshot = result.snapshot;
            assertBinding(snapshot.binding, lease.binding);
            if (snapshot.requestedOffer !== contract.approvedOfferRef || !snapshot.evidenceComplete || !snapshot.state || !snapshot.processorStatus ||
              !snapshot.period || snapshot.cancelAtPeriodEnd === undefined) throw new BillingError("UNTRUSTED_PROVIDER");
            await importSources(tx, workspace);
            for (const invoice of snapshot.invoices) {
              if (invoice.currency !== "EUR" || invoice.amountDue === undefined || invoice.amountPaid === undefined || invoice.amountRefunded === undefined ||
                invoice.exceptionsReviewed !== true || !invoice.refundReferences || !invoice.disputeReferences ||
                BigInt(invoice.amountRefunded) > BigInt(invoice.amountPaid)) throw new BillingError("UNTRUSTED_PROVIDER");
              if (invoice.amountRefunded !== "0" || invoice.refundReferences.length || invoice.disputeReferences.length) throw new BillingError("POLICY_REVIEW");
              const values = { status: invoice.status, periodStart: new Date(invoice.period.start), periodEnd: new Date(invoice.period.end),
                currency: "EUR", amountDue: invoice.amountDue, amountPaid: invoice.amountPaid, amountRefunded: invoice.amountRefunded,
                paymentReference: invoice.paymentReference ?? null, refundReferences: invoice.refundReferences,
                disputeReferences: invoice.disputeReferences, reconciledAt: new Date(result.observedAt), updatedAt: timestamp() };
              const [saved] = await tx.insert(billingInvoices).values({ id: randomUUID(), ...lease.binding, accountId: contract.accountId,
                subscriptionId: contract.id, processorInvoiceId: invoice.processorInvoiceId, ...values })
                .onConflictDoUpdate({ target: [billingInvoices.provider, billingInvoices.merchantAccount, billingInvoices.mode, billingInvoices.processorInvoiceId],
                  set: values, setWhere: and(eq(billingInvoices.subscriptionId, contract.id), eq(billingInvoices.accountId, contract.accountId)) }).returning({ id: billingInvoices.id });
              if (!saved) throw new BillingError("BINDING_MISMATCH");
            }
            const effective = await project(tx, workspace.id);
            await tx.update(billingSubscriptions).set({ state: snapshot.state, processorStatus: snapshot.processorStatus,
              periodStart: new Date(snapshot.period.start), periodEnd: new Date(snapshot.period.end), cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd,
              paidThrough: result.coverage.proUntil === null ? null : new Date(result.coverage.proUntil),
              revision: contract.revision + 1, leaseToken: null, leaseUntil: null, reconciledAt: new Date(result.observedAt),
              nextReconcileAt: new Date(Math.min(config.now() + 86400000, effective.nextChangeAt ?? Infinity)), updatedAt: timestamp() })
              .where(eq(billingSubscriptions.id, contract.id));
            await tx.update(billingEvents).set({ state: "processed", processedAt: timestamp(), leaseToken: null, leaseUntil: null })
              .where(and(eq(billingEvents.accountId, contract.accountId), eq(billingEvents.workspaceId, workspace.id),
                eq(billingEvents.provider, config.authority.provider), eq(billingEvents.merchantAccount, config.authority.merchantAccount),
                eq(billingEvents.mode, config.authority.mode), eq(billingEvents.objectId, contract.processorSubscriptionId),
                inArray(billingEvents.state, ["pending", "processing"])));
            await config.audit(tx, { kind: "subscription.reconciled", workspaceId: workspace.id, reference: contract.id });
            return true;
          });
        },
      };
    },
    async revokeManualGrant(actorId: string, workspaceId: number, grantId: string) {
      if (!config.sourcesReady() || !config.isAdmin(actorId)) throw new BillingError("FORBIDDEN");
      return db.transaction(async tx => {
        const workspace = await workspaceLock(tx, workspaceId); await importSources(tx, workspace);
        const [grant] = await tx.select().from(manualProGrants).where(and(eq(manualProGrants.id, grantId), eq(manualProGrants.workspaceId, workspaceId))).for("update");
        if (!grant) throw new BillingError("BINDING_MISMATCH");
        if (grant.revokedAt) return;
        await tx.update(manualProGrants).set({ revokedAt: timestamp(), revokedBy: actorId }).where(eq(manualProGrants.id, grant.id));
        const effective = await project(tx, workspaceId);
        await config.audit(tx, { kind: "manual_grant.changed", workspaceId, reference: grant.id, actorId });
        return effective;
      });
    },
  };
}
