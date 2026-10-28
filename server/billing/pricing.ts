import { randomUUID, createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { billingOfferRevisions, billingOfferSettings, billingPriceMappings } from "../../shared/schema";
import { BillingError, type Authority, type MonthlyOffer } from "./contracts";
import type { BillingDatabase, BillingTransaction } from "./repository";

export const adminAmountSchema = z.string().regex(/^(?:0|[1-9]\d{0,5})\.\d{2}$/);
export function amountToMinor(input: unknown): number {
  const amount = adminAmountSchema.parse(input);
  const [whole, cents] = amount.split(".");
  const value = Number(whole) * 100 + Number(cents);
  // EUR-settled nonzero subscription charges: Stripe's published EUR minimum is 50 cents.
  if (!Number.isSafeInteger(value) || value < 50 || value > 99999999) throw new BillingError("INVALID_INPUT");
  return value;
}
export function displayAmount(minor: number): string { return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, "0")}`; }
export type PricingView = { amount: string; revision: string; currency: "EUR"; interval: "month"; taxIncluded: true };
export type PricingAudit = (tx: BillingTransaction, kind: "offer.changed" | "price_mapping.changed", reference: string,
  context?: { actorId?: string; workspaceId?: number }) => Promise<void>;
export async function readCurrentOffer(tx: BillingTransaction, lock = false) {
  const query = tx.select().from(billingOfferSettings).where(eq(billingOfferSettings.singleton, true));
  const [setting] = lock ? await query.for("update") : await query;
  if (!setting) throw new BillingError("UNAVAILABLE");
  const [offer] = await tx.select().from(billingOfferRevisions).where(eq(billingOfferRevisions.id, setting.currentOfferId));
  if (!offer) throw new BillingError("UNAVAILABLE");
  return { setting, offer };
}
export async function assertCurrentOffer(tx: BillingTransaction, revision: string): Promise<void> {
  const { offer } = await readCurrentOffer(tx, true);
  if (offer.id !== revision) throw new BillingError("CONFLICT");
}
export function createPricingService(db: BillingDatabase, isAdmin: (actorId: string) => boolean, audit: PricingAudit, now: () => number) {
  const view = (offer: { amountMinor: number }, revision: number): PricingView => ({ amount: displayAmount(offer.amountMinor),
    revision: String(revision), currency: "EUR", interval: "month", taxIncluded: true });
  return {
    async read(actorId: string) {
      if (!isAdmin(actorId)) throw new BillingError("FORBIDDEN");
      return db.transaction(async tx => { const { setting, offer } = await readCurrentOffer(tx); return view(offer, setting.revision); });
    },
    async save(actorId: string, input: unknown) {
      const request = z.object({ amount: adminAmountSchema, expectedRevision: z.string().regex(/^[1-9]\d{0,9}$/)
        .refine(value => Number(value) <= 2147483647) }).strict().parse(input);
      const amountMinor = amountToMinor(request.amount);
      return db.transaction(async tx => {
        if (!isAdmin(actorId)) throw new BillingError("FORBIDDEN");
        const { setting, offer } = await readCurrentOffer(tx, true);
        if (String(setting.revision) !== request.expectedRevision) throw new BillingError("CONFLICT");
        if (offer.amountMinor === amountMinor) return view(offer, setting.revision);
        if (setting.revision === 2147483647) throw new BillingError("UNAVAILABLE");
        const id = randomUUID(), timestamp = new Date(now());
        await tx.insert(billingOfferRevisions).values({ id, version: setting.revision + 1, amountMinor,
          currency: "EUR", interval: "month", taxIncluded: true, issuedBy: actorId, createdAt: timestamp });
        const [updated] = await tx.update(billingOfferSettings).set({ currentOfferId: id, revision: setting.revision + 1,
          updatedBy: actorId, updatedAt: timestamp }).where(and(eq(billingOfferSettings.singleton, true),
            eq(billingOfferSettings.revision, setting.revision))).returning();
        if (!updated) throw new BillingError("CONFLICT");
        await audit(tx, "offer.changed", id, { actorId });
        // No provider calls or existing subscription updates occur in this path.
        return view({ amountMinor }, updated.revision);
      });
    },
  };
}

export interface PriceMappingRepository {
  reserve(offer: MonthlyOffer, authority: Authority, workspaceId?: number): Promise<{ id: string; priceId: string | null; fresh: boolean }>;
  complete(id: string, priceId: string, workspaceId?: number): Promise<void>;
  unknown(id: string, workspaceId?: number): Promise<void>;
}
export function createPriceMappingRepository(db: BillingDatabase, audit: PricingAudit, now: () => number): PriceMappingRepository {
  return {
    async reserve(offer, authority, workspaceId) {
      if (authority.provider !== "stripe" || !offer.amountMinor || offer.taxIncluded !== true) throw new BillingError("INVALID_INPUT");
      return db.transaction(async tx => {
        // Mutable singleton is the lock anchor; immutable revisions have no UPDATE privilege.
        await tx.select().from(billingOfferSettings).where(eq(billingOfferSettings.singleton, true)).for("update");
        const [revision] = await tx.select().from(billingOfferRevisions).where(eq(billingOfferRevisions.id, offer.reference));
        if (!revision || revision.amountMinor !== offer.amountMinor) throw new BillingError("CONFLICT");
        const [mapping] = await tx.select().from(billingPriceMappings).where(and(eq(billingPriceMappings.offerId, offer.reference),
          eq(billingPriceMappings.provider, "stripe"), eq(billingPriceMappings.merchantAccount, authority.merchantAccount), eq(billingPriceMappings.mode, authority.mode)));
        if (mapping) return { id: mapping.id, priceId: mapping.state === "ready" ? mapping.processorPriceId : null, fresh: false };
        const id = randomUUID(), timestamp = new Date(now());
        await tx.insert(billingPriceMappings).values({ id, offerId: offer.reference, provider: "stripe", merchantAccount: authority.merchantAccount,
          mode: authority.mode, state: "reserved", fingerprint: createHash("sha256").update(JSON.stringify([offer.reference, offer.amountMinor, "eur", "month", "inclusive"])).digest("hex"), createdAt: timestamp, updatedAt: timestamp });
        await audit(tx, "price_mapping.changed", id, { workspaceId });
        return { id, priceId: null, fresh: true };
      });
    },
    async complete(id, processorPriceId, workspaceId) {
      await db.transaction(async tx => {
        const [mapping] = await tx.select().from(billingPriceMappings).where(eq(billingPriceMappings.id, id)).for("update");
        if (!mapping || (mapping.processorPriceId && mapping.processorPriceId !== processorPriceId)) throw new BillingError("CONFLICT");
        if (mapping.state === "ready") return;
        await tx.update(billingPriceMappings).set({ state: "ready", processorPriceId, updatedAt: new Date(now()) }).where(eq(billingPriceMappings.id, id));
        await audit(tx, "price_mapping.changed", id, { workspaceId });
      });
    },
    async unknown(id, workspaceId) { await db.transaction(async tx => {
      const [mapping] = await tx.select().from(billingPriceMappings).where(eq(billingPriceMappings.id, id)).for("update");
      if (!mapping || mapping.state === "ready") return;
      await tx.update(billingPriceMappings).set({ state: "unknown", updatedAt: new Date(now()) }).where(eq(billingPriceMappings.id, id));
      await audit(tx, "price_mapping.changed", id, { workspaceId });
    }); },
  };
}
