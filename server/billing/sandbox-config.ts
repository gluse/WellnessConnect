/** Pure preparation parser. No file/environment reads; never log its sensitive return value. */
export const STRIPE_SANDBOX_FIELDS = Object.freeze([
  "STRIPE_BILLING_MODE", "STRIPE_BILLING_ENABLED", "STRIPE_NEW_CHECKOUTS_ENABLED",
  "STRIPE_BILLING_API_KEY", "STRIPE_BILLING_ACCOUNT_ID", "STRIPE_BILLING_WEBHOOK_SECRET",
  "STRIPE_BILLING_PORTAL_CONFIGURATION_ID", "STRIPE_BILLING_RETURN_ORIGIN",
] as const);
export class StripeSandboxConfigurationError extends Error {
  constructor() { super("Invalid disabled sandbox preparation"); this.name = "StripeSandboxConfigurationError"; }
}
export type SandboxEnvironment = Readonly<Record<string, string | undefined>>;
export type StripeSandboxPreparation = Readonly<{
  mode: "test"; billingEnabled: false; newCheckoutsEnabled: false;
  apiKey?: string; accountId?: string; webhookSecret?: string; portalConfigurationId?: string; returnOrigin?: string;
}>;
const invalid = (): never => { throw new StripeSandboxConfigurationError(); };

/** Deliberately small .env syntax: single-line assignments/comments, no expansion or inheritance. */
export function parseStripeSandboxText(text: string): Record<string, string> {
  if (Buffer.byteLength(text, "utf8") > 16384) return invalid();
  const fields: Record<string, string> = Object.create(null);
  for (const line of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const match = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match || Object.hasOwn(fields, match[1])) return invalid();
    const value = /^(?:"([^"]*)"|'([^']*)'|([^"'#]*?))\s*(?:#.*)?$/.exec(match[2]);
    if (!value) return invalid();
    fields[match[1]] = (value[1] ?? value[2] ?? value[3]).trim();
  }
  return fields;
}
export function parseStripeSandboxPreparation(env: SandboxEnvironment): StripeSandboxPreparation {
  if (Object.keys(env).some(name => !STRIPE_SANDBOX_FIELDS.some(allowed => allowed === name))) return invalid();
  if ((env.STRIPE_BILLING_MODE || "test") !== "test" ||
    (env.STRIPE_BILLING_ENABLED || "false") !== "false" ||
    (env.STRIPE_NEW_CHECKOUTS_ENABLED || "false") !== "false") return invalid();
  const apiKey = env.STRIPE_BILLING_API_KEY || undefined, accountId = env.STRIPE_BILLING_ACCOUNT_ID || undefined;
  const webhookSecret = env.STRIPE_BILLING_WEBHOOK_SECRET || undefined;
  const portalConfigurationId = env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID || undefined;
  const returnOrigin = env.STRIPE_BILLING_RETURN_ORIGIN || undefined;
  if ((apiKey && !/^(rk|sk)_test_[A-Za-z0-9_]+$/.test(apiKey)) || (accountId && !/^acct_[A-Za-z0-9]+$/.test(accountId)) ||
    (webhookSecret && !/^whsec_[A-Za-z0-9]+$/.test(webhookSecret)) ||
    (portalConfigurationId && !/^bpc_[A-Za-z0-9]+$/.test(portalConfigurationId))) return invalid();
  if (returnOrigin) {
    let origin: URL; try { origin = new URL(returnOrigin); } catch { return invalid(); }
    if (origin.protocol !== "https:" || origin.origin !== returnOrigin || origin.username || origin.password) return invalid();
  }
  return Object.freeze({ mode: "test", billingEnabled: false, newCheckoutsEnabled: false,
    apiKey, accountId, webhookSecret, portalConfigurationId, returnOrigin });
}
/** Explicit output allowlist; no credential, account, origin or raw environment values. */
export function stripeSandboxMetadata(config: StripeSandboxPreparation) {
  return { configurationValid: true, knownFieldsOnly: true, mode: config.mode, billingDisabled: true,
    newCheckoutsDisabled: true, apiKeyPresent: Boolean(config.apiKey), sandboxKeyFormatValid: Boolean(config.apiKey),
    restrictedKey: Boolean(config.apiKey?.startsWith("rk_test_")), accountIdPresent: Boolean(config.accountId),
    accountIdFormatValid: Boolean(config.accountId), webhookSecretPresent: Boolean(config.webhookSecret),
    portalConfigurationPresent: Boolean(config.portalConfigurationId), returnOriginPresent: Boolean(config.returnOrigin) };
}
export const STRIPE_SANDBOX_FAILURE_CATEGORIES = Object.freeze([
  "network_or_timeout", "stripe_authentication_or_permission", "account_mismatch", "other",
] as const);
export type StripeSandboxFailureCategory = typeof STRIPE_SANDBOX_FAILURE_CATEGORIES[number];
export function stripeSandboxFailureMetadata(local: ReturnType<typeof stripeSandboxMetadata> | undefined, connected: boolean,
  category?: StripeSandboxFailureCategory) {
  return { ...(local ?? { configurationValid: false }), connectedCheckAttempted: connected,
    ...(connected ? { accountCheckSucceeded: false, accountFailureCategory:
      STRIPE_SANDBOX_FAILURE_CATEGORIES.some(allowed => allowed === category) ? category! : "other" } : {}) };
}
