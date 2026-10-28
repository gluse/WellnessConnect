import assert from "node:assert/strict";
import { test } from "node:test";
import { parseStripeSandboxText, parseStripeSandboxPreparation, stripeSandboxMetadata, stripeSandboxFailureMetadata } from "../server/billing/sandbox-config.ts";
import { assertOwnAccountReadOnlyRequest, createStripeOwnAccountReader, checkStripeOwnAccount, stripeSandboxFailureCategory } from "../server/billing/sandbox-preflight.ts";

// Only synthetic map/text/fetch fixtures. No private files, network, DB or application runtime.
const key = "rk_test_SyntheticFixtureOnly", account = "acct_SyntheticFixtureOnly";
const env = { STRIPE_BILLING_API_KEY: key, STRIPE_BILLING_ACCOUNT_ID: account };
const preparation = () => parseStripeSandboxPreparation(env);

test("two supplied fields use test+disabled defaults; incomplete optional setup is allowed", () => {
  const config = preparation();
  assert.equal(config.mode, "test"); assert.equal(config.billingEnabled, false); assert.equal(config.newCheckoutsEnabled, false);
  const metadata = stripeSandboxMetadata(config);
  assert.equal(metadata.apiKeyPresent, true); assert.equal(metadata.accountIdPresent, true); assert.equal(metadata.restrictedKey, true);
  assert.equal(metadata.webhookSecretPresent, false); assert.equal(metadata.portalConfigurationPresent, false); assert.equal(metadata.returnOriginPresent, false);
  const output = JSON.stringify(metadata); assert.equal(output.includes(key), false); assert.equal(output.includes(account), false);
  assert.equal(stripeSandboxMetadata(parseStripeSandboxPreparation({})).apiKeyPresent, false);
});
test("live/public keys, activation flags, unknown fields and malformed identifiers fail without value leaks", () => {
  for (const patch of [{ STRIPE_BILLING_API_KEY: "rk_live_Synthetic" }, { STRIPE_BILLING_API_KEY: "sk_live_Synthetic" },
    { STRIPE_BILLING_API_KEY: "pk_test_Synthetic" }, { STRIPE_BILLING_MODE: "live" }, { STRIPE_BILLING_ENABLED: "true" },
    { STRIPE_NEW_CHECKOUTS_ENABLED: "true" }, { STRIPE_BILLING_ENABLED: "1" }, { OTHER_SECRET: key },
    { STRIPE_BILLING_ACCOUNT_ID: "wrong" }, { STRIPE_BILLING_WEBHOOK_SECRET: "wrong" }, { STRIPE_BILLING_PORTAL_CONFIGURATION_ID: "wrong" }]) {
    assert.throws(() => parseStripeSandboxPreparation({ ...env, ...patch }), error => {
      assert.equal(String(error).includes(key), false); assert.equal(String(error).includes(account), false); return true;
    });
  }
  assert.doesNotThrow(() => parseStripeSandboxPreparation({ ...env, STRIPE_BILLING_API_KEY: "sk_test_Synthetic" }));
});
test("text parser handles BOM/comments/quotes but rejects duplicates, expansion and multiline syntax", () => {
  const parsed = parseStripeSandboxText(`\uFEFF# sample\r\nSTRIPE_BILLING_API_KEY='${key}'\r\nSTRIPE_BILLING_ACCOUNT_ID=${account} # comment\r\n`);
  assert.equal(parseStripeSandboxPreparation(parsed).accountId, account);
  for (const text of ["STRIPE_BILLING_ENABLED=false\nSTRIPE_BILLING_ENABLED=true", "not an assignment", "A='unclosed", "A=one\ncontinued", "x".repeat(16385)])
    assert.throws(() => parseStripeSandboxText(text));
  assert.throws(() => parseStripeSandboxPreparation(parseStripeSandboxText("STRIPE_BILLING_API_KEY=${SECRET}")));
});
test("optional HTTPS origin is exact and cannot smuggle paths/query/credentials", () => {
  for (const origin of ["http://app.test", "https://app.test/", "https://app.test/path", "https://app.test?x=1", "https://u:p@app.test"])
    assert.throws(() => parseStripeSandboxPreparation({ ...env, STRIPE_BILLING_RETURN_ORIGIN: origin }));
  assert.doesNotThrow(() => parseStripeSandboxPreparation({ ...env, STRIPE_BILLING_RETURN_ORIGIN: "https://app.test" }));
});
test("connected helper rejects missing/forged/live config before any transport call", async () => {
  let calls = 0; const reader = { async retrieve() { calls++; return { id: account, object: "account" }; } };
  await assert.rejects(checkStripeOwnAccount(parseStripeSandboxPreparation({}), reader));
  await assert.rejects(checkStripeOwnAccount({ ...preparation(), billingEnabled: true }, reader));
  await assert.rejects(checkStripeOwnAccount({ ...preparation(), apiKey: "sk_live_Synthetic" }, reader));
  assert.equal(calls, 0);
});
test("own-account identity match emits booleans only; mismatch and private SDK error are redacted", async () => {
  const output = await checkStripeOwnAccount(preparation(), { async retrieve() { return { object: "account", id: account, email: "private@fixture.test", business_profile: { name: "PRIVATE" } }; } });
  assert.equal(output.configuredAccountMatched, true); assert.equal(JSON.stringify(output).includes("PRIVATE"), false); assert.equal(JSON.stringify(output).includes(account), false);
  for (const retrieve of [async () => ({ object: "account", id: "acct_Different" }), async () => { throw new Error(`${key} ${account} private@fixture.test`); }]) {
    await assert.rejects(checkStripeOwnAccount(preparation(), { retrieve }), error => {
      assert.equal(String(error).includes(key), false); assert.equal(String(error).includes(account), false); assert.equal(String(error).includes("private@fixture.test"), false); return true;
    });
  }
});
test("transport allowlist permits only one exact merchant GET, never Connect/list/write/redirect targets", () => {
  assert.doesNotThrow(() => assertOwnAccountReadOnlyRequest("https://api.stripe.com/v1/account", "GET", {}));
  for (const [url, method, headers] of [["https://api.stripe.com/v1/account", "POST", {}], ["https://api.stripe.com/v1/accounts", "GET", {}],
    ["https://api.stripe.com/v1/accounts/acct_Other", "GET", {}], ["https://api.stripe.com/v1/customers", "GET", {}],
    ["https://evil.test/v1/account", "GET", {}], ["https://api.stripe.com/v1/account?expand[]=external_accounts", "GET", {}],
    ["https://api.stripe.com/v1/account", "GET", { "Stripe-Account": account }]]) assert.throws(() => assertOwnAccountReadOnlyRequest(url, method, headers));
});
test("real SDK HTTP adapter uses single GET with ten-second bound/no retry and rejects reuse", async () => {
  const requests = [];
  const reader = createStripeOwnAccountReader(preparation(), async (url, options) => {
    requests.push({ url: String(url), options });
    return new Response(JSON.stringify({ object: "account", id: account }), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  const result = await checkStripeOwnAccount(preparation(), reader);
  assert.equal(result.configuredAccountMatched, true); assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://api.stripe.com/v1/account"); assert.equal(requests[0].options.method, "GET");
  assert.equal(requests[0].options.redirect, "error"); assert.ok(requests[0].options.signal);
  await assert.rejects(checkStripeOwnAccount(preparation(), reader)); assert.equal(requests.length, 1);
});
test("SDK permission/network failure stops after one request without exposing response details", async () => {
  let calls = 0;
  const reader = createStripeOwnAccountReader(preparation(), async () => {
    calls++; return new Response(JSON.stringify({ error: { type: "invalid_request_error", message: `${key} private response`, code: "permission_error" } }),
      { status: 403, headers: { "Content-Type": "application/json" } });
  });
  await assert.rejects(checkStripeOwnAccount(preparation(), reader), error => { assert.equal(String(error).includes(key), false); return true; });
  assert.equal(calls, 1);
});
test("connected failure preserves successful local validation without leaking credential/account values", () => {
  const local = stripeSandboxMetadata(preparation());
  const result = stripeSandboxFailureMetadata(local, true);
  assert.equal(result.configurationValid, true); assert.equal(result.connectedCheckAttempted, true); assert.equal(result.accountCheckSucceeded, false);
  assert.equal(result.billingDisabled, true); assert.equal(JSON.stringify(result).includes(key), false); assert.equal(JSON.stringify(result).includes(account), false);
  assert.deepEqual(stripeSandboxFailureMetadata(undefined, false), { configurationValid: false, connectedCheckAttempted: false });
});
test("diagnostic categories allowlist permission/network/mismatch/other without messages or identifiers", async () => {
  const privateMessage = `${key} ${account} private@fixture.test req_PRIVATE`;
  for (const [error, expected] of [[{ statusCode: 403, message: privateMessage }, "stripe_authentication_or_permission"],
    [{ type: "StripeAuthenticationError", message: privateMessage }, "stripe_authentication_or_permission"],
    [{ type: "StripeConnectionError", message: privateMessage }, "network_or_timeout"],
    [{ code: "ETIMEDOUT", message: privateMessage }, "network_or_timeout"],
    [{ name: "AbortError", message: privateMessage }, "network_or_timeout"],
    [{ statusCode: 500, message: privateMessage }, "other"]]) {
    assert.equal(stripeSandboxFailureCategory(error), expected);
    const reader = { async retrieve() { throw error; } };
    await assert.rejects(checkStripeOwnAccount(preparation(), reader), caught => {
      const output = stripeSandboxFailureMetadata(stripeSandboxMetadata(preparation()), true, stripeSandboxFailureCategory(caught));
      assert.equal(output.accountFailureCategory, expected); assert.equal(output.configurationValid, true);
      assert.equal(JSON.stringify(output).includes("PRIVATE"), false); assert.equal(String(caught).includes(key), false);
      assert.equal(JSON.stringify(output).includes(account), false); return true;
    });
  }
  await assert.rejects(checkStripeOwnAccount(preparation(), { async retrieve() { return { object: "account", id: "acct_Different" }; } }),
    caught => stripeSandboxFailureCategory(caught) === "account_mismatch");
  assert.equal(stripeSandboxFailureMetadata(undefined, true, privateMessage).accountFailureCategory, "other");
  assert.equal(stripeSandboxFailureCategory({ get message() { throw new Error("must not inspect message"); } }), "other");
});
