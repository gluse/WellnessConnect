import { auditApplicationConnection } from "../audit/config";
import { billingReturnOrigin } from "./origin";
import { LOCAL_BILLING_ACK, parseLocalBillingConfig, type LocalBillingConfig } from "./local-config";
import { parseStripeSandboxText, parseStripeSandboxPreparation, STRIPE_SANDBOX_FIELDS, type SandboxEnvironment } from "./sandbox-config";

type Stage = "profile" | "credentials";
type Issue = { stage: Stage; category: string; fields?: string[] };
const profileFields = ["STRIPE_LOCAL_APP_ENABLED", "STRIPE_LOCAL_TEST_ACK", "STRIPE_LOCAL_DATABASE_URL",
  "STRIPE_LOCAL_CHECKOUTS_ENABLED", "STRIPE_LOCAL_WORKER_ENABLED", "STRIPE_LOCAL_ORIGIN"];

/** Pure allowlisted metadata. Unknown names and every value are deliberately excluded. */
export function inspectLocalBillingConfiguration(profile: SandboxEnvironment, credentials: SandboxEnvironment): Issue[] {
  const issues: Issue[] = [];
  const invalid = (stage: Stage, category: string, field: string) => issues.push({ stage, category, fields: [field] });
  if (Object.keys(profile).some(key => !profileFields.includes(key))) issues.push({ stage: "profile", category: "unknown_fields" });
  if (profile.STRIPE_LOCAL_APP_ENABLED !== "true") invalid("profile", profile.STRIPE_LOCAL_APP_ENABLED === "false" ? "disabled" : "missing_or_invalid", "STRIPE_LOCAL_APP_ENABLED");
  if (profile.STRIPE_LOCAL_TEST_ACK !== LOCAL_BILLING_ACK) invalid("profile", "missing_or_invalid", "STRIPE_LOCAL_TEST_ACK");
  for (const field of ["STRIPE_LOCAL_CHECKOUTS_ENABLED", "STRIPE_LOCAL_WORKER_ENABLED"])
    if (!["true", "false"].includes(profile[field] ?? "")) invalid("profile", "missing_or_invalid", field);
  if (!profile.STRIPE_LOCAL_DATABASE_URL) invalid("profile", "missing", "STRIPE_LOCAL_DATABASE_URL");
  else try { auditApplicationConnection(profile.STRIPE_LOCAL_DATABASE_URL); }
  catch { invalid("profile", "invalid_restricted_database_format", "STRIPE_LOCAL_DATABASE_URL"); }
  if (profile.STRIPE_LOCAL_ORIGIN) try {
    const origin = billingReturnOrigin(profile.STRIPE_LOCAL_ORIGIN, { environment: "development", mode: "test", localSandbox: true });
    if (origin.protocol !== "http:" || origin.port !== "5000" || !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)) throw new Error();
  } catch { invalid("profile", "invalid_loopback_origin", "STRIPE_LOCAL_ORIGIN"); }
  if (Object.keys(credentials).some(key => !STRIPE_SANDBOX_FIELDS.includes(key as typeof STRIPE_SANDBOX_FIELDS[number])))
    issues.push({ stage: "credentials", category: "unknown_fields" });
  for (const field of STRIPE_SANDBOX_FIELDS) try { parseStripeSandboxPreparation({ [field]: credentials[field] }); }
  catch { invalid("credentials", "invalid", field); }
  for (const field of ["STRIPE_BILLING_API_KEY", "STRIPE_BILLING_ACCOUNT_ID", "STRIPE_BILLING_WEBHOOK_SECRET", "STRIPE_BILLING_PORTAL_CONFIGURATION_ID"])
    if (!credentials[field]) invalid("credentials", "missing", field);
  return issues;
}

/** Reads only two fixed filenames via injected I/O. It never imports runtime/server/db. */
export function loadLocalBillingConfiguration(read: (filename: ".env.stripe-app.local" | ".env.stripe.local") => string) {
  const issues: Issue[] = [];
  const load = (filename: ".env.stripe-app.local" | ".env.stripe.local", stage: Stage) => {
    let text: string;
    try { text = read(filename); }
    catch (error) {
      issues.push({ stage, category: error && typeof error === "object" && "code" in error && error.code === "ENOENT" ? "file_missing" : "file_unavailable" });
      return undefined;
    }
    try { return parseStripeSandboxText(text); }
    catch { issues.push({ stage, category: "malformed_file" }); return undefined; }
  };
  const profile = load(".env.stripe-app.local", "profile"), credentials = load(".env.stripe.local", "credentials");
  if (profile && credentials) issues.push(...inspectLocalBillingConfiguration(profile, credentials));
  else if (credentials) {
    // Credential errors remain useful even when the separate profile is missing.
    issues.push(...inspectLocalBillingConfiguration({}, credentials).filter(issue => issue.stage === "credentials"));
  }
  let config: LocalBillingConfig | undefined;
  if (!issues.length && profile && credentials) {
    try { config = parseLocalBillingConfig(profile, credentials); }
    catch { issues.push({ stage: "profile", category: "invalid_configuration" }); }
  }
  return { diagnostics: { stage: "local_configuration", configurationValid: Boolean(config), issues }, config };
}
