import { randomUUID } from "node:crypto";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../shared/schema";
import { assertAuthority, authoritySchema, BillingError, operationSchema, verifiedEventSchema,
  type Authority, type Binding, type CheckoutOperation, type VerifiedEvent } from "./contracts";
import type { CheckoutRepository } from "./checkout";
import type { EventRepository } from "./events";

export type BillingDatabase = NodePgDatabase<typeof schema>;
type Database = BillingDatabase;
export type BillingTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Change = { kind: "checkout.reserved" | "checkout.created" | "checkout.unknown" |
  "event.accepted" | "event.quarantined"; workspaceId: number | null; reference: string };
export interface BillingRepositoryHooks {
  /** Mandatory fresh server authorization while the workspace lock is held.
   * No company owner/admin permission or manual overlap policy is assumed here. */
  authorizeCheckout(tx: BillingTransaction, input: { binding: Binding; actorId: string; offerRevision: string }): Promise<void>;
  /** Mandatory approved audit contract on this exact transaction. No default/no-op.
   * Until billing event/system identity/retention are selected, production must not instantiate. */
  recordChange(tx: BillingTransaction, change: Change): Promise<void>;
}

const { providerSubscriptions, billingAccounts, billingOperations, billingSubscriptions, billingEvents } = schema;
function asOperation(row: schema.BillingOperation): CheckoutOperation {
  return operationSchema.parse({ id: row.id,
    binding: { workspaceId: row.workspaceId, provider: row.provider, merchantAccount: row.merchantAccount, mode: row.mode },
    actorId: row.initiatorId, idempotencyKey: row.idempotencyKey, fingerprint: row.fingerprint,
    requestedOffer: row.approvedOfferRef, termsVersion: row.termsVersion, state: row.state,
    remoteCheckoutId: row.remoteCheckoutId, resolvedAt: row.resolvedAt?.getTime() ?? null });
}

/** Real dormant persistence. Only the caller's injected database is used; never server/db.
 * No constructor side effects or environment reads. Does not write the Pro projection. */
export function createBillingRepository(database: Database, authorityInput: Authority, hooks: BillingRepositoryHooks,
  now: () => number): CheckoutRepository & EventRepository {
  const authority = authoritySchema.parse(authorityInput);
  const clock = () => {
    const value = now();
    if (!Number.isSafeInteger(value) || value < 0 || value > 8_640_000_000_000_000) throw new BillingError("INVALID_INPUT");
    return new Date(value);
  };
  const lockWorkspace = async (tx: BillingTransaction, workspaceId: number) => {
    const [workspace] = await tx.select({ id: providerSubscriptions.id }).from(providerSubscriptions)
      .where(eq(providerSubscriptions.id, workspaceId)).for("update");
    if (!workspace) throw new BillingError("BINDING_MISMATCH");
  };
  const scopedOperation = async (tx: BillingTransaction, id: string) => {
    // Resolve the anchor first, then use the same workspace->operation lock order as reserve.
    const [initial] = await tx.select().from(billingOperations).where(eq(billingOperations.id, id));
    if (!initial || initial.kind !== "checkout") throw new BillingError("BINDING_MISMATCH");
    assertAuthority(initial, authority);
    await lockWorkspace(tx, initial.workspaceId);
    const [row] = await tx.select().from(billingOperations).where(eq(billingOperations.id, id)).for("update");
    if (!row) throw new BillingError("BINDING_MISMATCH");
    return row;
  };
  return {
    async customer(id) {
      return database.transaction(async tx => {
        const operation = await scopedOperation(tx, id);
        const [account] = await tx.select().from(billingAccounts).where(and(eq(billingAccounts.id, operation.accountId),
          eq(billingAccounts.workspaceId, operation.workspaceId), eq(billingAccounts.provider, authority.provider),
          eq(billingAccounts.merchantAccount, authority.merchantAccount), eq(billingAccounts.mode, authority.mode)));
        if (!account) throw new BillingError("BINDING_MISMATCH");
        return account.customerId;
      });
    },
    async reserve(input) {
      const operation = operationSchema.parse(input);
      assertAuthority(operation.binding, authority);
      if (operation.state !== "reserved" || operation.resolvedAt !== null || operation.remoteCheckoutId !== null)
        throw new BillingError("CONFLICT");
      return database.transaction(async tx => {
        await lockWorkspace(tx, operation.binding.workspaceId);
        await hooks.authorizeCheckout(tx, { binding: operation.binding, actorId: operation.actorId, offerRevision: operation.requestedOffer });
        const slot = and(eq(billingOperations.workspaceId, operation.binding.workspaceId),
          eq(billingOperations.mode, authority.mode), eq(billingOperations.kind, "checkout"));
        const [replay] = await tx.select().from(billingOperations)
          .where(and(slot, eq(billingOperations.idempotencyKey, operation.idempotencyKey)));
        if (replay) {
          if (replay.fingerprint !== operation.fingerprint) throw new BillingError("CONFLICT");
          return { kind: "replay" as const, operation: asOperation(replay) };
        }
        const [unresolved] = await tx.select().from(billingOperations).where(and(slot, isNull(billingOperations.resolvedAt)));
        if (unresolved) return { kind: "busy" as const, operation: asOperation(unresolved) };
        const [contract] = await tx.select({ id: billingSubscriptions.id }).from(billingSubscriptions)
          .where(and(eq(billingSubscriptions.workspaceId, operation.binding.workspaceId),
            eq(billingSubscriptions.mode, authority.mode), ne(billingSubscriptions.state, "ended")));
        if (contract) throw new BillingError("CONFLICT");
        const [existing] = await tx.select().from(billingAccounts).where(and(
          eq(billingAccounts.workspaceId, operation.binding.workspaceId), eq(billingAccounts.provider, authority.provider),
          eq(billingAccounts.merchantAccount, authority.merchantAccount), eq(billingAccounts.mode, authority.mode)));
        const accountId = existing?.id ?? randomUUID();
        const timestamp = clock();
        if (!existing) await tx.insert(billingAccounts).values({ id: accountId, ...operation.binding, createdAt: timestamp, updatedAt: timestamp });
        await tx.insert(billingOperations).values({ id: operation.id, ...operation.binding, accountId, kind: "checkout",
          initiatorId: operation.actorId, idempotencyKey: operation.idempotencyKey, fingerprint: operation.fingerprint,
          approvedOfferRef: operation.requestedOffer, termsVersion: operation.termsVersion,
          offerRevisionId: z.string().uuid().safeParse(operation.requestedOffer).success ? operation.requestedOffer : null,
          state: "reserved", createdAt: timestamp, updatedAt: timestamp });
        await hooks.recordChange(tx, { kind: "checkout.reserved", workspaceId: operation.binding.workspaceId, reference: operation.id });
        return { kind: "reserved" as const, operation };
      });
    },
    async complete(id, remoteCheckoutId) {
      if (!remoteCheckoutId.trim() || remoteCheckoutId.length > 255) throw new BillingError("INVALID_INPUT");
      await database.transaction(async tx => {
        const operation = await scopedOperation(tx, id);
        if (operation.resolvedAt || operation.state === "failed" ||
          (operation.remoteCheckoutId && operation.remoteCheckoutId !== remoteCheckoutId)) throw new BillingError("CONFLICT");
        if (operation.state === "completed") return;
        await tx.update(billingOperations).set({ state: "completed", remoteCheckoutId, updatedAt: clock() })
          .where(eq(billingOperations.id, id));
        // resolvedAt deliberately remains null; URL creation is not remote checkout termination.
        await hooks.recordChange(tx, { kind: "checkout.created", workspaceId: operation.workspaceId, reference: id });
      });
    },
    async markUnknown(id) {
      await database.transaction(async tx => {
        const operation = await scopedOperation(tx, id);
        if (operation.resolvedAt || operation.state === "completed" || operation.state === "failed") return;
        await tx.update(billingOperations).set({ state: "unknown", updatedAt: clock() }).where(eq(billingOperations.id, id));
        await hooks.recordChange(tx, { kind: "checkout.unknown", workspaceId: operation.workspaceId, reference: id });
      });
    },
    async ingest(input: VerifiedEvent & { fingerprint: string }) {
      const event = verifiedEventSchema.extend({ fingerprint: z.string().regex(/^[a-f0-9]{64}$/) }).parse(input);
      assertAuthority(event, authority);
      return database.transaction(async tx => {
        const [account] = await tx.select().from(billingAccounts).where(and(eq(billingAccounts.provider, authority.provider),
          eq(billingAccounts.merchantAccount, authority.merchantAccount), eq(billingAccounts.mode, authority.mode),
          eq(billingAccounts.customerId, event.customerId)));
        if (account) await lockWorkspace(tx, account.workspaceId);
        const [contract] = account ? await tx.select().from(billingSubscriptions).where(and(
          eq(billingSubscriptions.accountId, account.id), eq(billingSubscriptions.workspaceId, account.workspaceId),
          eq(billingSubscriptions.provider, authority.provider), eq(billingSubscriptions.merchantAccount, authority.merchantAccount),
          eq(billingSubscriptions.mode, authority.mode), eq(billingSubscriptions.processorSubscriptionId, event.processorSubscriptionId))) : [];
        const timestamp = clock();
        const identity = and(eq(billingEvents.provider, authority.provider), eq(billingEvents.merchantAccount, authority.merchantAccount),
          eq(billingEvents.mode, authority.mode), eq(billingEvents.eventId, event.eventId));
        const [inserted] = await tx.insert(billingEvents).values({ id: randomUUID(), ...authority,
          accountId: account?.id ?? null, workspaceId: account?.workspaceId ?? null,
          eventId: event.eventId, eventType: event.eventType, objectId: event.processorSubscriptionId,
          fingerprint: event.fingerprint, state: contract ? "pending" : "quarantined",
          failureCode: contract ? null : "UNMAPPED_BINDING", occurredAt: new Date(event.occurredAt),
          receivedAt: timestamp, nextAttemptAt: timestamp }).onConflictDoNothing({ target: [billingEvents.provider,
            billingEvents.merchantAccount, billingEvents.mode, billingEvents.eventId] }).returning({ id: billingEvents.id });
        if (!inserted) {
          const [existing] = await tx.select().from(billingEvents).where(identity).for("update");
          if (!existing) throw new BillingError("CONFLICT");
          if (existing.fingerprint === event.fingerprint) return existing.state === "quarantined" ? "quarantined" : "duplicate";
          await tx.update(billingEvents).set({ state: "quarantined", processedAt: null, failureCode: "IDENTITY_CONFLICT" }).where(identity);
          await hooks.recordChange(tx, { kind: "event.quarantined", workspaceId: existing.workspaceId, reference: existing.id });
          return "quarantined";
        }
        if (contract) await tx.update(billingSubscriptions).set({ generation: sql`${billingSubscriptions.generation} + 1`,
          nextReconcileAt: timestamp, updatedAt: timestamp }).where(eq(billingSubscriptions.id, contract.id));
        await hooks.recordChange(tx, { kind: contract ? "event.accepted" : "event.quarantined",
          workspaceId: account?.workspaceId ?? null, reference: inserted.id });
        return contract ? "inserted" : "quarantined";
      });
    },
  };
}
