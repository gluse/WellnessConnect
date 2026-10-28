import Stripe from "stripe";
import { parseStripeSandboxPreparation, type StripeSandboxPreparation, type StripeSandboxFailureCategory } from "./sandbox-config";

export class StripeSandboxPreflightError extends Error {
  constructor(readonly category: StripeSandboxFailureCategory = "other") {
    super("Sandbox own-account preflight failed; stop without retry"); this.name = "StripeSandboxPreflightError";
  }
}
/** Inspect only bounded SDK transport/status/type identifiers. Never read/return raw messages or bodies. */
export function stripeSandboxFailureCategory(error: unknown): StripeSandboxFailureCategory {
  if (error instanceof StripeSandboxPreflightError) return error.category;
  if (!error || typeof error !== "object") return "other";
  try {
    const value = error as { statusCode?: unknown; type?: unknown; code?: unknown; name?: unknown };
    if (value.statusCode === 401 || value.statusCode === 403 || value.type === "StripeAuthenticationError" ||
      value.type === "StripePermissionError" || ["api_key_expired", "invalid_api_key", "permission_error"].some(code => value.code === code))
      return "stripe_authentication_or_permission";
    if (value.type === "StripeConnectionError" || value.name === "AbortError" || value.name === "TimeoutError" ||
      ["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "UND_ERR_CONNECT_TIMEOUT", "ABORT_ERR"].some(code => value.code === code))
      return "network_or_timeout";
  } catch { /* Even hostile getters cannot expose payloads or change output shape. */ }
  return "other";
}
export type OwnAccountReader = Readonly<{ retrieve(): Promise<unknown> }>;
export function assertOwnAccountReadOnlyRequest(urlInput: string, method: string, headers: HeadersInit | undefined): void {
  const url = new URL(urlInput);
  if (method !== "GET" || url.origin !== "https://api.stripe.com" || url.pathname !== "/v1/account" || url.search || url.hash ||
    url.username || url.password || new Headers(headers).has("Stripe-Account")) throw new StripeSandboxPreflightError();
}
/** Constructs only an exact own-account reader; no other SDK resource is exposed.
 * Calling retrieve is a connected action and requires separate explicit approval. */
export function createStripeOwnAccountReader(input: StripeSandboxPreparation, fetcher: typeof fetch = fetch): OwnAccountReader {
  const config = validate(input);
  let requests = 0, used = false;
  const client = new Stripe(config.apiKey!, { apiVersion: "2025-06-30.basil", maxNetworkRetries: 0, timeout: 10000,
    httpClient: Stripe.createFetchHttpClient(async (url: RequestInfo | URL, options?: RequestInit) => {
      if (++requests !== 1) throw new StripeSandboxPreflightError();
      assertOwnAccountReadOnlyRequest(String(url), options?.method ?? "GET", options?.headers);
      return fetcher(url, { ...options, redirect: "error",
        signal: AbortSignal.any([...(options?.signal ? [options.signal] : []), AbortSignal.timeout(10000)]) });
    }) });
  return Object.freeze({ async retrieve() {
    if (used) throw new StripeSandboxPreflightError(); used = true;
    try { return await client.accounts.retrieve({}, { maxNetworkRetries: 0, timeout: 10000 }); }
    catch (error) { throw new StripeSandboxPreflightError(stripeSandboxFailureCategory(error)); }
  } });
}
function validate(input: StripeSandboxPreparation): StripeSandboxPreparation {
  // Revalidate at the connected boundary; a caller cannot pass a forged enabled/live object.
  const config = parseStripeSandboxPreparation({ STRIPE_BILLING_MODE: input.mode,
    STRIPE_BILLING_ENABLED: String(input.billingEnabled), STRIPE_NEW_CHECKOUTS_ENABLED: String(input.newCheckoutsEnabled),
    STRIPE_BILLING_API_KEY: input.apiKey, STRIPE_BILLING_ACCOUNT_ID: input.accountId });
  if (!config.apiKey || !config.accountId) throw new StripeSandboxPreflightError();
  return config;
}
export async function checkStripeOwnAccount(input: StripeSandboxPreparation, reader: OwnAccountReader) {
  const config = validate(input);
  try {
    const result = await reader.retrieve();
    if (!result || typeof result !== "object" || !("id" in result) || !("object" in result) ||
      result.object !== "account") throw new StripeSandboxPreflightError();
    if (result.id !== config.accountId) throw new StripeSandboxPreflightError("account_mismatch");
    // Account response has no test/live assertion: mode below reflects validated sandbox key/config.
    return { accountReadSucceeded: true, configuredAccountMatched: true, mode: "test" as const,
      billingDisabled: true, newCheckoutsDisabled: true };
  } catch (error) { throw new StripeSandboxPreflightError(stripeSandboxFailureCategory(error)); }
}
