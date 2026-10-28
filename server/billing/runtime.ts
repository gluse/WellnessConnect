import type { Express, RequestHandler } from "express";
import Stripe from "stripe";
import { rateLimit } from "express-rate-limit";
import { createBillingApplication } from "./application";
import { createBillingJobRepository, createBillingJobs } from "./jobs";
import { installBillingManualWriter } from "./manual-writer";
import type { LocalBillingConfig } from "./local-config";
import type { BillingDatabase } from "./repository";
import { STRIPE_API_VERSION, STRIPE_HOSTED_ORIGINS, assertSandboxPortalConfiguration } from "./stripe";
import { checkStripeOwnAccount, createStripeOwnAccountReader } from "./sandbox-preflight";

let selected: LocalBillingConfig | undefined;
/** Only the explicit launcher selects a profile. Ordinary imports/startup remain dormant. */
export function selectLocalBillingRuntime(config: LocalBillingConfig) {
  if (selected || process.env.NODE_ENV !== "development") throw new Error("Local billing runtime unavailable");
  selected = config;
}
export function selectedLocalBillingRuntime() { return selected; }

export function createLocalBillingRuntime(db: BillingDatabase, config: LocalBillingConfig, deps: {
  authenticate: RequestHandler; requireAdmin: RequestHandler; isAdmin(actorId: string): boolean;
  verifyDatabase(): Promise<void>;
  stripe?: Stripe; verifyAccount?(): Promise<unknown>;
}) {
  let verified = false, stopping = false, workerHealthy = false;
  let ticking = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  const ready = () => verified && !stopping;
  const stripe = deps.stripe ?? new Stripe(config.apiKey, { apiVersion: STRIPE_API_VERSION, timeout: 10000, maxNetworkRetries: 0 });
  const application = createBillingApplication(db, stripe, {
    authority: { provider: "stripe", merchantAccount: config.accountId, mode: "test" },
    ready, adminReady: ready, sourcesReady: ready, auditReady: ready,
    newCheckoutsReady: () => ready() && config.newCheckouts && config.worker && workerHealthy,
    now: Date.now, isAdmin: deps.isAdmin, environment: "development", origin: config.origin, localSandbox: true,
    webhookSecret: config.webhookSecret, portalConfigurationId: config.portalConfigurationId, automaticTaxEnabled: false,
    terms: { version: "sandbox-v1", text: "Sandbox test only. No real purchase. Test subscription renews monthly; test cancellation ends renewal at period end. Existing subscriptions keep their agreed price.",
      taxDisclosure: "Sandbox fixture: displayed EUR amount includes tax; automatic tax is disabled. This is not a production tax policy." },
    authenticate: deps.authenticate, requireAdmin: deps.requireAdmin,
    rateLimit: rateLimit({ windowMs: 60000, limit: 60, standardHeaders: true, legacyHeaders: false,
      message: { code: "UNAVAILABLE", message: "Billing request limit reached." } }),
    selectedTarget(req) {
      if (!req.user?.claims.sub || !req.workspace || req.workspace.invalid) throw new Error("Unavailable workspace");
      return req.workspace.company ? { kind: "company", id: req.workspace.company.id } : { kind: "user", id: req.user.claims.sub };
    },
  });
  const jobs = createBillingJobs(createBillingJobRepository(db, { provider: "stripe", merchantAccount: config.accountId, mode: "test" }, Date.now, application.audit),
    application.dispatcher, () => ready() && config.worker);
  async function tick() {
    if (ticking) return; ticking = true;
    try { await jobs.tick(); workerHealthy = true; }
    catch { workerHealthy = false; console.error("Billing worker batch unavailable"); }
    finally { ticking = false; }
  }
  return {
    application,
    async verify() {
      await deps.verifyDatabase();
      const preparation = { mode: "test" as const, billingEnabled: false as const, newCheckoutsEnabled: false as const,
        apiKey: config.apiKey, accountId: config.accountId };
      if (deps.verifyAccount) await deps.verifyAccount();
      else await checkStripeOwnAccount(preparation, createStripeOwnAccountReader(preparation));
      const portal = await stripe.billingPortal.configurations.retrieve(config.portalConfigurationId, {}, { timeout: 10000, maxNetworkRetries: 0 });
      assertSandboxPortalConfiguration(portal, config.portalConfigurationId);
      verified = true;
      // Source-aware manual writes remain installed when new checkouts stop or the worker fails.
      installBillingManualWriter(application.lifecycle.updateManualEntitlement);
    },
    mountEarly(app: Express) {
      app.get("/api/billing/runtime", (_req, res) => { res.set("Cache-Control", "no-store"); res.json({ subscriptionsReady: ready(), administrationReady: ready(), hostedOrigins: ready() ? [...STRIPE_HOSTED_ORIGINS] : [] }); });
      app.use("/api/billing/webhook", application.routers.webhook);
    },
    mountAuthenticated(app: Express) {
      app.use("/api/billing", application.routers.browser);
      app.use("/api/admin/billing", application.routers.administration);
    },
    async start() {
      if (!config.worker) return;
      await tick();
      timer = setInterval(() => { void tick(); }, 5000); timer.unref();
    },
    stop() { stopping = true; workerHealthy = false; if (timer) clearInterval(timer); jobs.stop(); },
  };
}
