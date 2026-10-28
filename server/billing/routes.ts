import { Router, raw, type Request, type RequestHandler, type Response } from "express";
import { z } from "zod";
import { subscriptionTargetSchema, type SubscriptionTarget } from "../../shared/storefront";
import { BillingError } from "./contracts";

export const billingCheckoutBody = z.object({ target: subscriptionTargetSchema,
  termsVersion: z.string().regex(/^[a-zA-Z0-9._-]{1,64}$/), offerRevision: z.string().uuid(),
  idempotencyKey: z.string().regex(/^[a-zA-Z0-9_-]{16,128}$/) }).strict();
export interface BillingRouteService {
  status(actorId: string, target: SubscriptionTarget): Promise<unknown>;
  checkout(actorId: string, input: z.infer<typeof billingCheckoutBody>): Promise<unknown>;
  portal(actorId: string, target: SubscriptionTarget): Promise<unknown>;
}
export interface BillingRouteDependencies {
  ready(): boolean; newCheckoutsReady(): boolean; adminReady(): boolean;
  authenticate: RequestHandler; requireAdmin: RequestHandler; rateLimit: RequestHandler;
  origin: string;
  /** Resolve selected workspace from server context; never derive permissions from it. */
  selectedTarget(req: Request): SubscriptionTarget;
  service: BillingRouteService;
  pricing: { read(actorId: string): Promise<unknown>; save(actorId: string, input: unknown): Promise<unknown> };
  webhook(raw: Uint8Array, signature: string): Promise<void>;
}
function failure(error: unknown, res: Response) {
  const code = error instanceof BillingError ? error.code : error instanceof z.ZodError ? "INVALID_INPUT" : "UNAVAILABLE";
  const status = code === "FORBIDDEN" || code === "BINDING_MISMATCH" ? 403 : code === "CONFLICT" || code === "MANUAL_GRANT_ACTIVE" ? 409
    : code === "INVALID_INPUT" || code === "UNTRUSTED_PROVIDER" ? 400 : 503;
  res.status(status).json({ code, message: status === 403 ? "Billing access is not allowed." : status === 409
    ? "Billing information changed. Refresh before continuing." : status === 400 ? "Invalid billing request." : "Billing is unavailable." });
}
const actor = (req: Request) => z.string().uuid().parse(req.user?.claims.sub);
function selected(req: Request, target: SubscriptionTarget, deps: BillingRouteDependencies) {
  const current = deps.selectedTarget(req);
  if (current.kind !== target.kind || current.id !== target.id) throw new BillingError("FORBIDDEN");
}
/** Factories only. No bootstrap mounts. Webhook must mount BEFORE global JSON/session/origin middleware. */
export function createBillingRouters(deps: BillingRouteDependencies) {
  const browser = Router(), administration = Router(), webhook = Router();
  const cache: RequestHandler = (_req, res, next) => { res.set("Cache-Control", "no-store"); next(); };
  const gate = (ready: () => boolean): RequestHandler => (_req, res, next) => {
    if (!ready()) return failure(new BillingError("UNAVAILABLE"), res); next();
  };
  const sameOrigin: RequestHandler = (req, res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      (req.get("Origin") !== deps.origin || req.get("Sec-Fetch-Site") === "cross-site"))
      return failure(new BillingError("FORBIDDEN"), res);
    next();
  };
  const handle = (work: (req: Request, res: Response) => Promise<void>): RequestHandler => (req, res) => { void work(req, res).catch(error => failure(error, res)); };
  browser.use(cache, gate(deps.ready), deps.authenticate, sameOrigin, deps.rateLimit);
  browser.get("/subscription", handle(async (req, res) => {
    const target = subscriptionTargetSchema.parse(req.query); selected(req, target, deps);
    res.json(await deps.service.status(actor(req), target));
  }));
  browser.post("/checkout", gate(deps.newCheckoutsReady), handle(async (req, res) => {
    const input = billingCheckoutBody.parse(req.body); selected(req, input.target, deps);
    res.json(await deps.service.checkout(actor(req), input));
  }));
  browser.post("/portal", handle(async (req, res) => {
    const { target } = z.object({ target: subscriptionTargetSchema }).strict().parse(req.body); selected(req, target, deps);
    res.json(await deps.service.portal(actor(req), target));
  }));
  administration.use(cache, gate(deps.adminReady), deps.authenticate, deps.requireAdmin, sameOrigin, deps.rateLimit);
  administration.get("/offer", handle(async (req, res) => { res.json(await deps.pricing.read(actor(req))); }));
  administration.put("/offer", handle(async (req, res) => { res.json(await deps.pricing.save(actor(req), req.body)); }));
  webhook.use(cache, gate(deps.ready), deps.rateLimit);
  webhook.post("/", raw({ type: "application/json", limit: "256kb" }), handle(async (req, res) => {
    if (!Buffer.isBuffer(req.body)) throw new BillingError("INVALID_INPUT");
    await deps.webhook(req.body, req.get("stripe-signature") ?? "");
    res.status(200).json({ received: true });
  }));
  return { browser, administration, webhook };
}
