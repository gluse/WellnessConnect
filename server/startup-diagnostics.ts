import { WISHLIST_APPLICATION_READINESS_KEYS as BILLING_APPLICATION_READINESS_KEYS } from "../migrations/wishlist/application-readiness.mjs";
import { CURRENCY_READINESS_KEYS } from "../migrations/currencies/application-readiness.mjs";

export const startupStages = ["initialization", "audit_principal", "currency_database", "billing_configuration", "billing_runtime", "billing_database",
  "billing_account", "billing_portal", "routes", "billing_worker", "assets", "listen"] as const;
export type StartupStage = typeof startupStages[number];
const errorCodes = ["BILLING_DB_NOT_READY", "CURRENCY_DB_NOT_READY", "EADDRINUSE", "EACCES", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN",
  "ERR_TLS_CERT_ALTNAME_INVALID", "CERT_HAS_EXPIRED", "DEPTH_ZERO_SELF_SIGNED_CERT", "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "INVALID_INPUT", "BINDING_MISMATCH", "CONFLICT", "UNAVAILABLE", "POLICY_REVIEW", "UNTRUSTED_PROVIDER", "FORBIDDEN", "MANUAL_GRANT_ACTIVE"] as const;
const readinessChecks: readonly string[] = [...BILLING_APPLICATION_READINESS_KEYS, "metadata_query", "readiness_result_shape"];

/** Return only fixed diagnostics. Never read message/stack/cause/config/body. */
export function startupFailureDiagnostic(stage: unknown, error: unknown): { event: "application_startup_refused"; stage: StartupStage; code: string; checks?: string[] } {
  const output: ReturnType<typeof startupFailureDiagnostic> = { event: "application_startup_refused",
    stage: startupStages.some(value => value === stage) ? stage as StartupStage : "initialization", code: "STARTUP_FAILED" };
  if (!error || typeof error !== "object") return output;
  try {
    const details = error as { code?: unknown; name?: unknown; type?: unknown; category?: unknown; checks?: unknown };
    const candidateCode = details.code;
    const knownCode = errorCodes.find(code => code === candidateCode);
    if (knownCode) output.code = knownCode;
    else if (details.name === "AuditCaptureUnavailable") output.code = "AUDIT_PRINCIPAL_NOT_READY";
    else if (details.name === "AuditConfigurationError") output.code = "AUDIT_CONFIGURATION_INVALID";
    else if (details.name === "StripeSandboxPreflightError") {
      output.code = details.category === "account_mismatch" ? "STRIPE_ACCOUNT_MISMATCH" : details.category === "stripe_authentication_or_permission" ? "STRIPE_AUTHENTICATION_OR_PERMISSION"
        : details.category === "network_or_timeout" ? "STRIPE_NETWORK_OR_TIMEOUT" : "STRIPE_PREFLIGHT_FAILED";
    } else if (details.type === "StripeAuthenticationError" || details.type === "StripePermissionError") output.code = "STRIPE_AUTHENTICATION_OR_PERMISSION";
    else if (details.type === "StripeConnectionError") output.code = "STRIPE_NETWORK_OR_TIMEOUT";
    const suppliedChecks = details.checks;
    if (output.code === "BILLING_DB_NOT_READY" && Array.isArray(suppliedChecks)) {
      const checks = readinessChecks.filter(key => suppliedChecks.includes(key));
      if (checks.length) output.checks = checks;
    }
    if (output.code === "CURRENCY_DB_NOT_READY" && Array.isArray(suppliedChecks)) {
      const checks = [...CURRENCY_READINESS_KEYS, "metadata_query", "readiness_result_shape"].filter(key => suppliedChecks.includes(key));
      if (checks.length) output.checks = checks;
    }
  } catch { /* A hostile getter must not make reporting expose arbitrary values. */ }
  return output;
}
