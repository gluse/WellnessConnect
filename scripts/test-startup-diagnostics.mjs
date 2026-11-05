import assert from "node:assert/strict";
import { startupFailureDiagnostic, startupStages } from "../server/startup-diagnostics.ts";
import { BillingDatabaseReadinessError, verifyBillingDatabaseReadiness } from "../server/billing/database-readiness.ts";
import { WISHLIST_APPLICATION_READINESS_KEYS as BILLING_APPLICATION_READINESS_KEYS, WISHLIST_APPLICATION_READINESS_SQL as BILLING_APPLICATION_READINESS_SQL,
  wishlistApplicationReadinessArguments as billingApplicationReadinessArguments } from "../migrations/wishlist/application-readiness.mjs";

// Pure diagnostics and injected metadata queries; no server/db/env/provider import.
const canary = "PRIVATE_CONFIG_DRIVER_BODY_STACK_CANARY";
let checks = 0;
const check = action => { action(); checks++; };
const good = Object.fromEntries(BILLING_APPLICATION_READINESS_KEYS.map(key => [key, true]));
for (const stage of startupStages) {
  const diagnostic = startupFailureDiagnostic(stage, new Error(canary));
  check(() => assert.deepEqual(diagnostic, { event: "application_startup_refused", stage, code: "STARTUP_FAILED" }));
  check(() => assert.ok(!JSON.stringify(diagnostic).includes(canary)));
}
for (const error of [null, undefined, canary, { code: canary, message: canary, stack: canary, name: canary, category: canary, body: canary },
  Object.defineProperty({}, "code", { get() { throw Error(canary); } })]) {
  check(() => assert.deepEqual(startupFailureDiagnostic(canary, error), { event: "application_startup_refused", stage: "initialization", code: "STARTUP_FAILED" }));
}
let codeReads = 0;
check(() => assert.equal(startupFailureDiagnostic("listen", Object.defineProperty({}, "code", { get() { return codeReads++ ? canary : "EADDRINUSE"; } })).code, "EADDRINUSE"));
check(() => assert.equal(codeReads, 1, "Error code is snapshotted once and never echoed from a later getter"));
let privateReads = 0;
const protectedError = { code: "BILLING_DB_NOT_READY", checks: ["required_dml", canary, "required_dml", "notification_columns"] };
for (const field of ["message", "stack", "cause", "body", "config", "query"]) Object.defineProperty(protectedError, field, { get() { privateReads++; throw Error(canary); } });
const safe = startupFailureDiagnostic("billing_database", protectedError);
check(() => assert.deepEqual(safe.checks, BILLING_APPLICATION_READINESS_KEYS.filter(key => ["required_dml", "notification_columns"].includes(key))));
check(() => assert.equal(privateReads, 0));
check(() => assert.equal(startupFailureDiagnostic("audit_principal", { name: "AuditCaptureUnavailable" }).code, "AUDIT_PRINCIPAL_NOT_READY"));
check(() => assert.equal(startupFailureDiagnostic("audit_principal", { name: "AuditConfigurationError" }).code, "AUDIT_CONFIGURATION_INVALID"));
for (const [category, code] of [["account_mismatch", "STRIPE_ACCOUNT_MISMATCH"], ["stripe_authentication_or_permission", "STRIPE_AUTHENTICATION_OR_PERMISSION"], ["network_or_timeout", "STRIPE_NETWORK_OR_TIMEOUT"], [canary, "STRIPE_PREFLIGHT_FAILED"]])
  check(() => assert.equal(startupFailureDiagnostic("billing_account", { name: "StripeSandboxPreflightError", category }).code, code));
for (const type of ["StripeAuthenticationError", "StripePermissionError"])
  check(() => assert.equal(startupFailureDiagnostic("billing_portal", { type }).code, "STRIPE_AUTHENTICATION_OR_PERMISSION"));
check(() => assert.equal(startupFailureDiagnostic("billing_portal", { type: "StripeConnectionError" }).code, "STRIPE_NETWORK_OR_TIMEOUT"));
let calls = 0;
await verifyBillingDatabaseReadiness(async (sql, parameters) => {
  calls++; assert.equal(sql, BILLING_APPLICATION_READINESS_SQL); assert.deepEqual(parameters, billingApplicationReadinessArguments()); return { rows: [good] };
});
check(() => assert.equal(calls, 1));
for (const key of BILLING_APPLICATION_READINESS_KEYS) {
  await assert.rejects(verifyBillingDatabaseReadiness(async () => ({ rows: [{ ...good, [key]: false }] })), error => {
    assert.ok(error instanceof BillingDatabaseReadinessError); assert.equal(error.code, "BILLING_DB_NOT_READY"); assert.equal(error.message, "BILLING_DB_NOT_READY");
    assert.deepEqual(error.checks, [key]); assert.deepEqual(startupFailureDiagnostic("billing_database", error).checks, [key]); return true;
  }); checks++;
}
for (const rows of [[], [good, good], [{ ...good, [canary]: canary }], [Object.defineProperty({}, "required_dml", { get() { throw Error(canary); } })]]) {
  await assert.rejects(verifyBillingDatabaseReadiness(async () => ({ rows })), error => {
    assert.equal(error.message, "BILLING_DB_NOT_READY"); assert.ok(!JSON.stringify(startupFailureDiagnostic("billing_database", error)).includes(canary)); return true;
  }); checks++;
}
await assert.rejects(verifyBillingDatabaseReadiness(async () => { throw Object.assign(Error(canary), { code: canary, query: canary }); }), error => {
  assert.equal(error.message, "BILLING_DB_NOT_READY"); assert.deepEqual(error.checks, ["metadata_query"]); assert.ok(!String(error.stack).includes(canary));
  assert.deepEqual(startupFailureDiagnostic("billing_database", error).checks, ["metadata_query"]); return true;
}); checks++;
console.log(`Startup diagnostics: ${checks} checks passed (injected metadata only; no configuration, database or provider access).`);
