import { z } from "zod";
import { BillingClientError, type MonthlyBillingTransport } from "./monthly-billing";

const amount = z.string().regex(/^(?:0|[1-9]\d{0,5})\.\d{2}$/)
  .refine(value => value.split(".")[0] !== "0" || value.split(".")[1] >= "50");
export const adminBillingOfferSchema = z.object({
  amount, revision: z.string().regex(/^[1-9]\d{0,9}$/).refine(value => Number(value) <= 2147483647), currency: z.literal("EUR"),
  interval: z.literal("month"), taxIncluded: z.literal(true),
}).strict();
export type AdminBillingOffer = z.infer<typeof adminBillingOfferSchema>;
export type AdminPriceInput = { amount: string; expectedRevision: string };
export interface AdminPricingTransport {
  read(signal: AbortSignal): Promise<unknown>;
  save(input: AdminPriceInput, signal: AbortSignal): Promise<unknown>;
}
// Decimal text stays exact; a locale separator is accepted without Number arithmetic.
export function normalizeMonthlyAmount(value: string): string | null {
  const match = /^(0|[1-9]\d{0,5})(?:[.,](\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const normalized = `${match[1]}.${(match[2] || "").padEnd(2, "0")}`;
  return amount.safeParse(normalized).success ? normalized : null;
}

type Fetcher = typeof fetch;
export const billingCapabilitiesSchema = z.object({
  subscriptionsReady: z.boolean(), administrationReady: z.boolean(),
  hostedOrigins: z.array(z.string().max(255).refine(value => {
    try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password && url.origin === value; }
    catch { return false; }
  })).max(4),
}).strict().refine(value => !value.subscriptionsReady || value.hostedOrigins.length > 0);
export type BillingCapabilities = z.infer<typeof billingCapabilitiesSchema>;
async function requestJSON(fetcher: Fetcher, path: string, method: string, signal: AbortSignal, data?: unknown) {
  const response = await fetcher(path, { method, credentials: "include", cache: "no-store", redirect: "error", signal,
    headers: data ? { "Content-Type": "application/json", Accept: "application/json" } : { Accept: "application/json" },
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!response.ok) throw new BillingClientError(response.status === 401 ? "unauthorized" : response.status === 403 ? "denied" : response.status === 409 ? "conflict" : response.status === 400 ? "invalid" : "unavailable");
  if (!response.headers.get("content-type")?.includes("application/json")) throw new BillingClientError("invalid");
  try { return await response.json(); } catch { throw new BillingClientError("invalid"); }
}
export async function readBillingCapabilities(signal: AbortSignal, fetcher: Fetcher = fetch): Promise<BillingCapabilities> {
  const value = await requestJSON(fetcher, "/api/billing/runtime", "GET", signal);
  const parsed = billingCapabilitiesSchema.safeParse(value);
  if (!parsed.success) throw new BillingClientError("invalid");
  return parsed.data;
}
// Readiness is supplied by the reviewed application integration, never URL/storage/user roles.
// Constructing a disabled runtime makes no requests, including endpoint availability probes.
export function createBillingRuntime(options: { subscriptionsReady: boolean; administrationReady: boolean; hostedOrigins: readonly string[] }, fetcher: Fetcher = fetch) {
  const subscriptionTransport: MonthlyBillingTransport | undefined = options.subscriptionsReady ? {
    hostedOrigins: [...options.hostedOrigins],
    read: (scope, signal) => requestJSON(fetcher, `/api/billing/subscription?${new URLSearchParams({ kind: scope.target.kind, id: String(scope.target.id) })}`, "GET", signal),
    checkout: (scope, input, signal) => requestJSON(fetcher, "/api/billing/checkout", "POST", signal, { target: scope.target, ...input }),
    portal: (scope, signal) => requestJSON(fetcher, "/api/billing/portal", "POST", signal, { target: scope.target }),
  } : undefined;
  const adminPricingTransport: AdminPricingTransport | undefined = options.administrationReady ? {
    read: signal => requestJSON(fetcher, "/api/admin/billing/offer", "GET", signal),
    save: (input, signal) => requestJSON(fetcher, "/api/admin/billing/offer", "PUT", signal, input),
  } : undefined;
  return { subscriptionTransport, adminPricingTransport };
}
