import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, lte, or } from "drizzle-orm";
import { billingEvents, billingSubscriptions } from "../../shared/schema";
import { BillingError, type Authority } from "./contracts";
import type { BillingDatabase } from "./repository";
import type { ServiceAudit } from "./service";

export const BILLING_MAX_EVENT_ATTEMPTS = 8;
export const billingBackoff = (attempt: number) => Math.min(3600000, 5000 * 2 ** Math.min(10, Math.max(0, attempt - 1)));
export function billingFailure(error: unknown): "review" | "retry" {
  return error instanceof BillingError && ["POLICY_REVIEW", "BINDING_MISMATCH", "UNTRUSTED_PROVIDER", "INVALID_INPUT"].includes(error.code) ? "review" : "retry";
}
export function createBillingJobRepository(db: BillingDatabase, authority: Authority, now: () => number, audit: ServiceAudit) {
  const scope = and(eq(billingEvents.provider, authority.provider), eq(billingEvents.merchantAccount, authority.merchantAccount), eq(billingEvents.mode, authority.mode));
  return {
    async claim() {
      return db.transaction(async tx => {
        const [event] = await tx.select().from(billingEvents).where(and(scope, inArray(billingEvents.state, ["pending", "processing"]),
          lte(billingEvents.nextAttemptAt, new Date(now())), or(isNull(billingEvents.leaseUntil), lte(billingEvents.leaseUntil, new Date(now())))))
          .orderBy(billingEvents.nextAttemptAt).limit(1).for("update", { skipLocked: true });
        if (!event) return null;
        const token = randomUUID(), attempts = event.attempts + 1;
        await tx.update(billingEvents).set({ state: "processing", attempts, leaseToken: token, leaseUntil: new Date(now() + 60000) }).where(eq(billingEvents.id, event.id));
        return { id: event.id, token, attempts, workspaceId: event.workspaceId };
      });
    },
    async release(job: { id: string; token: string; attempts: number; workspaceId: number | null }, review: boolean) {
      return db.transaction(async tx => {
        const terminal = review || job.attempts >= BILLING_MAX_EVENT_ATTEMPTS;
        const [changed] = await tx.update(billingEvents).set({ state: terminal ? "quarantined" : "pending", failureCode: terminal ? "REVIEW_REQUIRED" : "RETRYABLE",
          leaseToken: null, leaseUntil: null, nextAttemptAt: new Date(now() + billingBackoff(job.attempts)) })
          .where(and(scope, eq(billingEvents.id, job.id), eq(billingEvents.leaseToken, job.token), eq(billingEvents.state, "processing")))
          .returning({ id: billingEvents.id });
        if (changed && terminal) await audit(tx, { kind: "event.quarantined", workspaceId: job.workspaceId, reference: job.id });
      });
    },
    async dueContracts() {
      return db.select().from(billingSubscriptions).where(and(eq(billingSubscriptions.provider, authority.provider),
        eq(billingSubscriptions.merchantAccount, authority.merchantAccount), eq(billingSubscriptions.mode, authority.mode),
        lte(billingSubscriptions.nextReconcileAt, new Date(now())), or(isNull(billingSubscriptions.leaseUntil), lte(billingSubscriptions.leaseUntil, new Date(now())))))
        .orderBy(billingSubscriptions.nextReconcileAt).limit(4);
    },
    async postpone(contract: { id: string; revision: number }, review: boolean) {
      await db.update(billingSubscriptions).set({ nextReconcileAt: new Date(now() + (review ? 86400000 : 60000)) })
        .where(and(eq(billingSubscriptions.id, contract.id), eq(billingSubscriptions.revision, contract.revision)));
    },
  };
}
/** Bounded non-overlapping batches. All remote effects are provider reads; creation is never retried here. */
export function createBillingJobs(repository: ReturnType<typeof createBillingJobRepository>, dispatcher: {
  process(id: string): Promise<void>; reconcile(workspaceId: number, subscriptionId: string): Promise<unknown>;
}, enabled: () => boolean) {
  let running = false, stopped = false;
  return {
    async tick() {
      if (running || stopped || !enabled()) return;
      running = true;
      try {
        for (let count = 0; count < 8 && !stopped && enabled(); count++) {
          const job = await repository.claim(); if (!job) break;
          let review = job.attempts > BILLING_MAX_EVENT_ATTEMPTS;
          if (!review) try { await dispatcher.process(job.id); } catch (error) { review = billingFailure(error) === "review"; }
          // A committed dispatcher cleared its lease; release is then a safe no-op.
          await repository.release(job, review);
        }
        for (const contract of await repository.dueContracts()) {
          if (stopped || !enabled()) break;
          try { await dispatcher.reconcile(contract.workspaceId, contract.processorSubscriptionId); }
          catch (error) { await repository.postpone(contract, billingFailure(error) === "review"); }
        }
      } finally { running = false; }
    },
    stop() { stopped = true; },
  };
}
