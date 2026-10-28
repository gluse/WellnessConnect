import { auditApplicationConnection } from "../audit/config";
import { parseStripeSandboxPreparation, type SandboxEnvironment } from "./sandbox-config";
import { billingReturnOrigin } from "./origin";

export const LOCAL_BILLING_ACK = "SANDBOX_ONLY_NO_REAL_PURCHASES";
export class LocalBillingConfigurationError extends Error {
  constructor() { super("Invalid local billing profile"); }
}
/** Pure injected configuration; preparation credentials retain their disabled flags. */
export function parseLocalBillingConfig(profile: SandboxEnvironment, credentials: SandboxEnvironment) {
  const fail = (): never => { throw new LocalBillingConfigurationError(); };
  const names = ["STRIPE_LOCAL_APP_ENABLED", "STRIPE_LOCAL_TEST_ACK", "STRIPE_LOCAL_DATABASE_URL",
    "STRIPE_LOCAL_CHECKOUTS_ENABLED", "STRIPE_LOCAL_WORKER_ENABLED", "STRIPE_LOCAL_ORIGIN"];
  if (Object.keys(profile).some(key => !names.includes(key)) || profile.STRIPE_LOCAL_APP_ENABLED !== "true" ||
    profile.STRIPE_LOCAL_TEST_ACK !== LOCAL_BILLING_ACK) return fail();
  for (const key of ["STRIPE_LOCAL_CHECKOUTS_ENABLED", "STRIPE_LOCAL_WORKER_ENABLED"]) {
    if (profile[key] !== "true" && profile[key] !== "false") return fail();
  }
  try {
    const config = parseStripeSandboxPreparation(credentials);
    if (!config.apiKey || !config.accountId || !config.webhookSecret || !config.portalConfigurationId) return fail();
    const origin = profile.STRIPE_LOCAL_ORIGIN || "http://localhost:5000";
    const url = billingReturnOrigin(origin, { environment: "development", mode: "test", localSandbox: true });
    if (url.protocol !== "http:" || url.port !== "5000" || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return fail();
    if (!profile.STRIPE_LOCAL_DATABASE_URL) return fail();
    // Existing application audit policy permits only its restricted development source principal.
    auditApplicationConnection(profile.STRIPE_LOCAL_DATABASE_URL);
    return { apiKey: config.apiKey, accountId: config.accountId, webhookSecret: config.webhookSecret,
      portalConfigurationId: config.portalConfigurationId, origin, host: url.hostname === "[::1]" ? "::1" : url.hostname,
      databaseUrl: profile.STRIPE_LOCAL_DATABASE_URL, newCheckouts: profile.STRIPE_LOCAL_CHECKOUTS_ENABLED === "true",
      worker: profile.STRIPE_LOCAL_WORKER_ENABLED === "true" };
  } catch { return fail(); }
}
export type LocalBillingConfig = ReturnType<typeof parseLocalBillingConfig>;
