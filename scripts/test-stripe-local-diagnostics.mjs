import assert from "node:assert/strict";
import { test } from "node:test";
import { loadLocalBillingConfiguration } from "../server/billing/local-diagnostics.ts";

const profile = `STRIPE_LOCAL_APP_ENABLED=true
STRIPE_LOCAL_TEST_ACK=SANDBOX_ONLY_NO_REAL_PURCHASES
STRIPE_LOCAL_DATABASE_URL=postgres://fmt_app_dev:SENSITIVE@db.hbkooiknruimukkhshrk.supabase.co:5432/postgres?sslmode=require
STRIPE_LOCAL_CHECKOUTS_ENABLED=false
STRIPE_LOCAL_WORKER_ENABLED=false
STRIPE_LOCAL_ORIGIN=http://localhost:5000`;
const credentials = `STRIPE_BILLING_API_KEY=rk_test_SECRET_SENTINEL
STRIPE_BILLING_ACCOUNT_ID=acct_PRIVATESENTINEL
STRIPE_BILLING_WEBHOOK_SECRET=whsec_SENTINEL
STRIPE_BILLING_PORTAL_CONFIGURATION_ID=bpc_SENTINEL`;
const fixture = (profileText = profile, credentialText = credentials) => filename => filename === ".env.stripe-app.local" ? profileText : credentialText;

test("missing profile and credential failures name only allowed fields; base file is never requested", () => {
  const read = [];
  const result = loadLocalBillingConfiguration(filename => {
    read.push(filename);
    if (filename === ".env.stripe-app.local") throw Object.assign(new Error("PRIVATE_PATH"), { code: "ENOENT" });
    return credentials.replace("STRIPE_BILLING_PORTAL_CONFIGURATION_ID=bpc_SENTINEL", "STRIPE_BILLING_ENABLED=true");
  });
  assert.deepEqual(read, [".env.stripe-app.local", ".env.stripe.local"]);
  assert.deepEqual(result.diagnostics.issues, [{ stage: "profile", category: "file_missing" },
    { stage: "credentials", category: "invalid", fields: ["STRIPE_BILLING_ENABLED"] },
    { stage: "credentials", category: "missing", fields: ["STRIPE_BILLING_PORTAL_CONFIGURATION_ID"] }]);
  assert.equal(result.config, undefined);
});

test("valid local metadata excludes all configuration values and keeps preparation flags disabled", () => {
  const result = loadLocalBillingConfiguration(fixture());
  assert.equal(result.diagnostics.configurationValid, true);
  assert.equal(result.config.newCheckouts, false);
  assert.equal(result.config.worker, false);
  const metadata = JSON.stringify(result.diagnostics);
  for (const value of ["SENSITIVE", "SENTINEL", "postgres://", "localhost", "acct_", "whsec_"]) assert.equal(metadata.includes(value), false);
});

test("unknown names, unreadable files and malformed input cannot expose arbitrary names/messages", () => {
  const unknown = loadLocalBillingConfiguration(fixture(`${profile}\nPRIVATE_UNKNOWN_NAME=SECRET`, credentials));
  assert.ok(unknown.diagnostics.issues.some(issue => issue.category === "unknown_fields"));
  assert.equal(JSON.stringify(unknown.diagnostics).includes("PRIVATE_UNKNOWN_NAME"), false);
  const unreadable = loadLocalBillingConfiguration(() => { throw Object.assign(new Error("SECRET_PATH_OR_VALUE"), { code: "EACCES" }); });
  assert.ok(unreadable.diagnostics.issues.every(issue => issue.category === "file_unavailable"));
  assert.equal(JSON.stringify(unreadable.diagnostics).includes("SECRET"), false);
  const malformed = loadLocalBillingConfiguration(fixture(`${profile}\nnot-an-assignment SECRET`, credentials));
  assert.deepEqual(malformed.diagnostics.issues, [{ stage: "profile", category: "malformed_file" }]);
});

test("diagnostics preserve actual activation, restricted database and origin guards", () => {
  for (const [before, after, field] of [["STRIPE_LOCAL_APP_ENABLED=true", "STRIPE_LOCAL_APP_ENABLED=false", "STRIPE_LOCAL_APP_ENABLED"],
    ["fmt_app_dev:SENSITIVE", "postgres:SENSITIVE", "STRIPE_LOCAL_DATABASE_URL"],
    ["http://localhost:5000", "http://example.test:5000", "STRIPE_LOCAL_ORIGIN"]]) {
    const result = loadLocalBillingConfiguration(fixture(profile.replace(before, after)));
    assert.equal(result.diagnostics.configurationValid, false);
    assert.ok(result.diagnostics.issues.some(issue => issue.fields?.includes(field)));
  }
  const live = loadLocalBillingConfiguration(fixture(profile, credentials.replace("rk_test_", "sk_live_")));
  assert.ok(live.diagnostics.issues.some(issue => issue.fields?.includes("STRIPE_BILLING_API_KEY")));
});
