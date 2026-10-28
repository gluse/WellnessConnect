import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { providerSubscriptions } from "../../shared/schema";
import { createPricingService, createPriceMappingRepository } from "./pricing";
import { createStripeBillingAdapter, STRIPE_HOSTED_ORIGINS } from "./stripe";
import { createLifecycleRepository } from "./lifecycle";
import { createStripeInbox, createStripeDispatcher } from "./dispatcher";
import { createSelectedBillingService, type SelectedBillingConfig } from "./service";
import { createBillingRouters, type BillingRouteDependencies } from "./routes";
import { enqueueBillingAudit } from "./audit";
import { authorizeBillingTarget } from "./authorization";
import { BillingError, type Authority } from "./contracts";
import type { BillingDatabase, BillingTransaction } from "./repository";
import type { AuditContextInput } from "../audit/context";
import type { AuditEventName } from "../audit/events";

export const DISABLED_BILLING_READINESS = Object.freeze({ ready: () => false, newCheckoutsReady: () => false,
  adminReady: () => false, sourcesReady: () => false, auditReady: () => false });
type Change = { kind: string; reference: string; workspaceId?: number | null; actorId?: string };
/** Full injected composition, deliberately never imported by server bootstrap. */
export function createBillingApplication(db: BillingDatabase, stripe: Stripe, config: {
  authority: Authority; ready(): boolean; newCheckoutsReady(): boolean; adminReady(): boolean; sourcesReady(): boolean; auditReady(): boolean;
  isAdmin(actorId: string): boolean; now(): number; environment: string; origin: string; webhookSecret: string;
  portalConfigurationId: string; automaticTaxEnabled: boolean; localSandbox?: boolean; terms: SelectedBillingConfig["terms"];
  authenticate: BillingRouteDependencies["authenticate"]; requireAdmin: BillingRouteDependencies["requireAdmin"];
  rateLimit: BillingRouteDependencies["rateLimit"]; selectedTarget: BillingRouteDependencies["selectedTarget"];
}) {
  async function audit(tx: BillingTransaction, change: Change) {
    if (!config.auditReady()) throw new BillingError("UNAVAILABLE");
    let scope: AuditContextInput["scope"] = { kind: "unknown" };
    let actor: AuditContextInput["actor"] = { kind: "service", serviceId: "billing-worker" };
    let workspace: typeof providerSubscriptions.$inferSelect | undefined;
    if (change.workspaceId) {
      [workspace] = await tx.select().from(providerSubscriptions).where(eq(providerSubscriptions.id, change.workspaceId));
      if (!workspace) throw new BillingError("BINDING_MISMATCH");
      scope = workspace.companyId !== null ? { kind: "company", workspaceId: String(workspace.companyId) }
        : { kind: "personal", workspaceId: workspace.userId! };
    }
    if (change.actorId) {
      if (change.kind === "offer.changed" || change.kind === "manual_grant.changed") {
        if (!config.isAdmin(change.actorId)) throw new BillingError("FORBIDDEN");
        actor = { kind: "user", userId: change.actorId, effectiveRole: "support" };
        if (change.kind === "offer.changed") scope = { kind: "global" };
      } else {
        if (!workspace) throw new BillingError("BINDING_MISMATCH");
        const target = workspace.companyId !== null ? { kind: "company" as const, id: workspace.companyId }
          : { kind: "user" as const, id: workspace.userId! };
        await authorizeBillingTarget(tx, change.actorId, target);
        actor = { kind: "user", userId: change.actorId, effectiveRole: workspace.companyId === null ? "provider" : "owner" };
      }
    }
    const events: Record<string, Extract<AuditEventName, `billing.${string}`>> = {
      "portal.reserved": "billing.portal_reserved.v1", "portal.created": "billing.portal_created.v1", "portal.unknown": "billing.portal_unknown.v1",
      "workspace.initialized": "billing.workspace_initialized.v1", "checkout.reserved": "billing.checkout_reserved.v1",
      "checkout.created": "billing.checkout_created.v1", "checkout.unknown": "billing.checkout_unknown.v1",
      "checkout.resolved": "billing.checkout_resolved.v1", "event.accepted": "billing.event_accepted.v1",
      "event.quarantined": "billing.event_quarantined.v1", "subscription.reconciled": "billing.subscription_reconciled.v1",
      "offer.changed": "billing.offer_changed.v1", "price_mapping.changed": "billing.price_mapping_changed.v1",
      "manual_grant.changed": "billing.manual_grant_changed.v1",
    };
    const eventName = events[change.kind]; if (!eventName) throw new BillingError("INVALID_INPUT");
    const target: AuditContextInput["target"] = change.kind === "workspace.initialized" && workspace
      ? workspace.companyId !== null ? { type: "company", id: String(workspace.companyId) } : { type: "user", id: workspace.userId! }
      : { type: change.kind === "offer.changed" ? "billing_offer" : change.kind === "manual_grant.changed" ? "manual_grant"
        : change.kind === "subscription.reconciled" ? "billing_subscription" : change.kind.startsWith("event.") ? "billing_event" : "billing_operation", id: change.reference };
    await enqueueBillingAudit(tx, { actor, scope, target, eventName, environment: config.environment,
      operationId: change.kind === "workspace.initialized" ? randomUUID() : change.reference });
  }
  const pricingAudit: import("./pricing").PricingAudit = (tx, kind, reference, context) => audit(tx, { kind, reference, ...context });
  const mappings = createPriceMappingRepository(db, pricingAudit, config.now);
  const adapter = createStripeBillingAdapter(stripe, mappings, { ...config, returnOrigin: config.origin });
  const lifecycle = createLifecycleRepository(db, { ...config, audit });
  const inbox = createStripeInbox(db, config.authority, audit, config.now);
  const dispatcher = createStripeDispatcher({ adapter, inbox, lifecycle, authority: config.authority, now: config.now, ready: config.ready });
  const service = createSelectedBillingService(db, { ...config, audit, provider: adapter.checkout,
    hostedOrigins: STRIPE_HOSTED_ORIGINS, portal: adapter.portal });
  const pricing = createPricingService(db, config.isAdmin, pricingAudit, config.now);
  const routers = createBillingRouters({ ...config, service, pricing, webhook: dispatcher.webhook });
  return { routers, service, pricing, dispatcher, lifecycle, audit };
}
