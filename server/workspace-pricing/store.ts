import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { companies, companyMemberships, users, workspacePricingSettings } from "@shared/schema";
import { samePricingWorkspace, WorkspacePricingError, workspacePricingSettingsViewSchema, type PricingWorkspace, type WorkspacePricingSettingsView, type WorkspacePricingUpdate } from "@shared/workspace-pricing";
import type { db } from "../db";

export type WorkspacePricingActor = { userId: string; companyId?: number };
type Database = typeof db;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type QueryDatabase = Pick<Database, "select">;
const forbidden = (): never => { throw new WorkspacePricingError(403, "WORKSPACE_PRICING_FORBIDDEN", "Your access level does not allow this action."); };
const conflict = (): never => { throw new WorkspacePricingError(409, "WORKSPACE_PRICING_CHANGED", "These workspace settings changed. Refresh and review them before saving."); };
export function pricingWorkspace(actor: WorkspacePricingActor): PricingWorkspace { return actor.companyId != null ? { kind: "company", id: actor.companyId } : { kind: "user", id: actor.userId }; }
function owned(actor: WorkspacePricingActor) {
  return actor.companyId != null ? and(eq(workspacePricingSettings.companyId, actor.companyId), isNull(workspacePricingSettings.userId))
    : and(eq(workspacePricingSettings.userId, actor.userId), isNull(workspacePricingSettings.companyId));
}
async function authorize(database: QueryDatabase, actor: WorkspacePricingActor, lock = false) {
  if (actor.companyId == null) {
    let query = database.select().from(users).where(eq(users.id, actor.userId));
    const [user] = await (lock ? query.for("update") : query);
    if (!user) forbidden();
    return;
  }
  const companyQuery = database.select().from(companies).where(eq(companies.id, actor.companyId));
  const [company] = await (lock ? companyQuery.for("update") : companyQuery);
  const memberQuery = database.select().from(companyMemberships).where(and(eq(companyMemberships.companyId, actor.companyId), eq(companyMemberships.userId, actor.userId)));
  const [membership] = await (lock ? memberQuery.for("share") : memberQuery);
  if (!company?.isActive || !membership || !["owner", "admin"].includes(membership.role)) forbidden();
}
function view(actor: WorkspacePricingActor, row?: typeof workspacePricingSettings.$inferSelect): WorkspacePricingSettingsView {
  return workspacePricingSettingsViewSchema.parse({ workspace: pricingWorkspace(actor), defaultCurrency: row?.defaultCurrency ?? null, businessCountryCode: row?.businessCountryCode ?? null, revision: row?.revision ?? 0, canEdit: true });
}

export function createWorkspacePricingStore(database: Database) {
  return {
    async get(actor: WorkspacePricingActor): Promise<WorkspacePricingSettingsView> {
      await authorize(database, actor);
      const [row] = await database.select().from(workspacePricingSettings).where(owned(actor));
      return view(actor, row);
    },
    async patch(actor: WorkspacePricingActor, input: WorkspacePricingUpdate): Promise<WorkspacePricingSettingsView> {
      if (!samePricingWorkspace(pricingWorkspace(actor), input.expectedWorkspace)) throw new WorkspacePricingError(409, "WORKSPACE_CHANGED", "The active workspace changed. Refresh its settings before saving.");
      return database.transaction(async (tx: Transaction) => {
        await authorize(tx, actor, true);
        const [previous] = await tx.select().from(workspacePricingSettings).where(owned(actor)).for("update");
        if ((previous?.revision ?? 0) !== input.expectedRevision) conflict();
        if (previous && previous.revision >= 2147483647) conflict();
        const changes = {
          ...(input.defaultCurrency !== undefined ? { defaultCurrency: input.defaultCurrency } : {}),
          ...(input.businessCountryCode !== undefined ? { businessCountryCode: input.businessCountryCode } : {}),
          updatedAt: new Date(),
        };
        if (previous) {
          const [updated] = await tx.update(workspacePricingSettings).set({ ...changes, revision: previous.revision + 1 })
            .where(and(owned(actor), eq(workspacePricingSettings.id, previous.id), eq(workspacePricingSettings.revision, input.expectedRevision))).returning();
          if (!updated) conflict();
          return view(actor, updated);
        }
        const [created] = await tx.insert(workspacePricingSettings).values({
          id: randomUUID(), userId: actor.companyId == null ? actor.userId : null, companyId: actor.companyId ?? null,
          defaultCurrency: null, businessCountryCode: null, ...changes, revision: 1,
        }).onConflictDoNothing().returning();
        if (!created) conflict();
        return view(actor, created);
      });
    },
  };
}
export type WorkspacePricingStore = ReturnType<typeof createWorkspacePricingStore>;
