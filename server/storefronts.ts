import { and, asc, eq, gt, inArray, isNull, or, sql, type SQLWrapper } from "drizzle-orm";
import { db } from "./db";
import { companies, providerSubscriptions, storefronts, users, type ServiceWithProvider } from "@shared/schema";
import { hasPro, StorefrontError, type StorefrontInput, type SubscriptionTarget, type SubscriptionOptionsQuery, type SubscriptionOptionsPage, type subscriptionUpdateSchema } from "@shared/storefront";
import type { z } from "zod";
import { billingManualWriter, assertLegacyManualWritable } from "./billing/manual-writer";

const targetWhere = (target: SubscriptionTarget) => target.kind === "company"
  ? eq(providerSubscriptions.companyId, target.id) : eq(providerSubscriptions.userId, target.id);
export const publishedStorefrontConditions = () => and(eq(storefronts.isPublished, true), eq(providerSubscriptions.plan, "pro"),
  gt(providerSubscriptions.proUntil, sql`now()`), or(isNull(providerSubscriptions.companyId), eq(companies.isActive, true)));

export const storefrontStore = {
  async adminOptions({ kind, search, page }: SubscriptionOptionsQuery): Promise<SubscriptionOptionsPage> {
    const pageSize = 20;
    const matches = (field: SQLWrapper) => sql`strpos(lower(${field}), lower(${search})) > 0`;
    const userName = sql<string>`coalesce(nullif(trim(concat_ws(' ', ${users.firstName}, ${users.lastName})), ''), nullif(${users.email}, ''), ${users.id})`;
    if (kind === "company") {
      const rows = await db.select({ id: companies.id, name: companies.name, isActive: companies.isActive, ownerEmail: users.email })
        .from(companies).leftJoin(users, eq(companies.ownerId, users.id))
        .where(search ? or(matches(companies.name), matches(sql`${companies.id}::text`), matches(userName), matches(users.email)) : undefined)
        .orderBy(asc(sql`lower(${companies.name})`), asc(companies.id)).limit(pageSize + 1).offset((page - 1) * pageSize);
      return { items: rows.slice(0, pageSize).map(row => ({ target: { kind: "company", id: row.id }, name: row.name,
        detail: [row.ownerEmail, `#${row.id}`].filter(Boolean).join(" · "), isActive: row.isActive })), hasMore: rows.length > pageSize };
    }
    const rows = await db.select({ id: users.id, name: userName, email: users.email }).from(users)
      .where(search ? or(matches(userName), matches(users.email), matches(users.id)) : undefined)
      .orderBy(asc(sql`lower(${userName})`), asc(users.id)).limit(pageSize + 1).offset((page - 1) * pageSize);
    return { items: rows.slice(0, pageSize).map(row => ({ target: { kind: "user", id: row.id }, name: row.name,
      detail: row.email !== row.name ? row.email : null, isActive: null })), hasMore: rows.length > pageSize };
  },
  async settings(target: SubscriptionTarget) {
    const [row] = await db.select({ subscription: providerSubscriptions, storefront: storefronts }).from(providerSubscriptions)
      .leftJoin(storefronts, eq(storefronts.subscriptionId, providerSubscriptions.id)).where(targetWhere(target));
    return { subscription: row ? { plan: row.subscription.plan, proUntil: row.subscription.proUntil } : null,
      hasPro: hasPro(row?.subscription ?? null), storefront: row?.storefront ?? null };
  },
  async save(target: SubscriptionTarget, input: StorefrontInput) {
    return db.transaction(async tx => {
      // Serialize edits with plan changes, and recheck expiry on every write.
      const [subscription] = await tx.select().from(providerSubscriptions).where(targetWhere(target)).for("update");
      if (!hasPro(subscription ?? null)) throw new StorefrontError(403, "An active Pro subscription is required.");
      const [existing] = await tx.select().from(storefronts).where(eq(storefronts.subscriptionId, subscription.id));
      if (existing && existing.slug !== input.slug) throw new StorefrontError(409, "The storefront address cannot be changed after saving.");
      const values = { ...input, updatedAt: new Date() };
      const [saved] = existing ? await tx.update(storefronts).set(values).where(eq(storefronts.id, existing.id)).returning()
        : await tx.insert(storefronts).values({ ...values, subscriptionId: subscription.id }).returning();
      return saved;
    });
  },
  async publicPage(slug: string) {
    const [row] = await db.select({ storefront: storefronts, userId: providerSubscriptions.userId, companyId: providerSubscriptions.companyId })
      .from(storefronts).innerJoin(providerSubscriptions, eq(storefronts.subscriptionId, providerSubscriptions.id))
      .leftJoin(companies, eq(providerSubscriptions.companyId, companies.id))
      .where(and(eq(storefronts.slug, slug), publishedStorefrontConditions()));
    if (!row) throw new StorefrontError(404, "Storefront not found.");
    const { name, description, logoUrl, coverUrl } = row.storefront;
    return { slug, name, description, logoUrl, coverUrl,
      source: row.companyId != null ? { companyId: row.companyId } : { providerId: row.userId! } };
  },
  async slugs(sources: Pick<ServiceWithProvider, "companyId" | "providerId">[]) {
    const companyIds = Array.from(new Set(sources.flatMap(source => source.companyId == null ? [] : [source.companyId])));
    const userIds = Array.from(new Set(sources.filter(source => source.companyId == null).map(source => source.providerId)));
    if (!companyIds.length && !userIds.length) return new Map<string, string>();
    const rows = await db.select({ slug: storefronts.slug, userId: providerSubscriptions.userId, companyId: providerSubscriptions.companyId })
      .from(storefronts).innerJoin(providerSubscriptions, eq(storefronts.subscriptionId, providerSubscriptions.id))
      .leftJoin(companies, eq(providerSubscriptions.companyId, companies.id)).where(and(publishedStorefrontConditions(),
        or(companyIds.length ? inArray(providerSubscriptions.companyId, companyIds) : undefined,
          userIds.length ? inArray(providerSubscriptions.userId, userIds) : undefined)));
    return new Map(rows.map(row => [row.companyId != null ? `company:${row.companyId}` : `user:${row.userId}`, row.slug]));
  },
  async adminGet(target: SubscriptionTarget) {
    let name: string;
    if (target.kind === "company") {
      const [company] = await db.select().from(companies).where(eq(companies.id, target.id));
      if (!company) throw new StorefrontError(404, "Company not found.");
      name = company.name;
    } else {
      const [user] = await db.select().from(users).where(eq(users.id, target.id));
      if (!user) throw new StorefrontError(404, "User profile not found. The user must sign in first.");
      name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || user.id;
    }
    const [subscription] = await db.select().from(providerSubscriptions).where(targetWhere(target));
    return { name, subscription: subscription ?? null };
  },
  async adminUpdate(input: z.infer<typeof subscriptionUpdateSchema>, adminId: string) {
    await this.adminGet(input.target);
    const writer = billingManualWriter();
    if (writer) { await writer(adminId, input); return this.adminGet(input.target); }
    const values = { plan: input.plan, proUntil: input.plan === "pro" ? new Date(input.proUntil!) : null, updatedBy: adminId, updatedAt: new Date() };
    await db.transaction(async tx => {
      // Create a harmless free anchor before locking; never overwrite a source-aware row.
      await tx.insert(providerSubscriptions).values({ plan: "free", updatedBy: adminId, userId: input.target.kind === "user" ? input.target.id : null,
        companyId: input.target.kind === "company" ? input.target.id : null }).onConflictDoNothing();
      const [workspace] = await tx.select().from(providerSubscriptions).where(targetWhere(input.target)).for("update");
      await assertLegacyManualWritable(tx, workspace.id);
      await tx.insert(providerSubscriptions).values({ ...values, userId: input.target.kind === "user" ? input.target.id : null,
      companyId: input.target.kind === "company" ? input.target.id : null })
      .onConflictDoUpdate({ target: input.target.kind === "company" ? providerSubscriptions.companyId : providerSubscriptions.userId, set: values });
    });
    return this.adminGet(input.target);
  },
};
