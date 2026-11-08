import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import React from "react";
import renderer from "react-test-renderer";
import { NativeProofClient, validateApiOrigin, validateHandoff, validateResourcePath } from "../client/src/native/client.ts";
import { NativeProof } from "../client/src/native/proof/NativeProof.tsx";
import { proofMessages } from "../client/src/native/proof/messages.ts";
import { createNativeAuthProofService, nativeProofHash } from "../server/native-proof/service.ts";
import { NATIVE_PROOF_API_ORIGIN, NATIVE_PROOF_PATHS } from "../shared/native-proof.ts";

// This test adapter is JavaScript simulation only. Actual native custody is a
// separate Kotlin/Swift build/device gate; no real network/config/database loaded.
function fixture(service = createNativeAuthProofService()) {
  let verifier, attempt, credential, session, generation = 0, lastReturn;
  let override, delay;
  const bridge = {
    async capabilities() { return { native: false, mode: "synthetic-offline", platform: "node-simulation" }; },
    async restoreSession() { return { session: session ? { ...service.session(credential), generation } : null }; },
    async beginLogin() { verifier = randomBytes(32).toString("base64url"); attempt = service.begin({ challenge: nativeProofHash(verifier) }); return attempt; },
    async consumeHandoff({ url }) {
      validateHandoff(url); const returned = new URL(url);
      const exchanged = service.exchange({ attemptId: returned.searchParams.get("attemptId"), code: returned.searchParams.get("code"), verifier });
      credential = exchanged.credential; session = { user: exchanged.user, expiresAt: exchanged.expiresAt, generation: ++generation };
      verifier = undefined; attempt = undefined;
      return { session: structuredClone(session) };
    },
    async simulateBrowserReturn({ account, cold }) {
      assert.equal(typeof cold, "boolean"); lastReturn = service.completeBrowser(attempt.attemptId, account);
      return bridge.consumeHandoff({ url: lastReturn });
    },
    async request({ path, method }) {
      validateResourcePath(path); assert.equal(method, "GET");
      if (delay) await delay;
      if (override) return override;
      try {
        const body = path === NATIVE_PROOF_PATHS.session ? service.session(credential) : service.account(credential, path.slice(NATIVE_PROOF_PATHS.accountPrefix.length));
        return { status: 200, contentType: "application/json", body: JSON.stringify(body) };
      } catch (error) { return { status: error.status, contentType: "application/json", body: JSON.stringify({ error: { code: error.code } }) }; }
    },
    async logout() { if (credential) service.logout(credential); credential = undefined; session = undefined; verifier = undefined; attempt = undefined; generation++; },
  };
  return { bridge, setResponse(value) { override = value; }, setDelay(value) { delay = value; }, returnUrl() { return lastReturn; } };
}
let assertions = 0;
async function check(label, run) { await run(); assertions++; console.log(`PASS ${label}`); }
const reject = (operation, code) => assert.rejects(operation, error => error.code === code);
await check("exact HTTPS API origin and read-only path allowlist", async () => {
  assert.equal(validateApiOrigin(NATIVE_PROOF_API_ORIGIN), NATIVE_PROOF_API_ORIGIN);
  for (const origin of ["http://api.fitsmytime.example", "https://api.fitsmytime.example/", "https://evil.example", "https://api.fitsmytime.example.evil.example"]) assert.throws(() => validateApiOrigin(origin));
  for (const path of ["https://evil.example/api/native-proof/session", "//evil.example/api/native-proof/session", NATIVE_PROOF_PATHS.exchange, NATIVE_PROOF_PATHS.attempts, "/api/native-proof/accounts/proof-alice?x=1", "/api/native-proof/accounts/../auth/exchange", "/api/native-proof/accounts/%2e%2e/auth/exchange", "/api/native-proof/accounts/proof-alice#x"]) assert.throws(() => validateResourcePath(path));
});
await check("callback origin, path, duplicate params and secret-bearing extras rejected", async () => {
  const valid = `https://app.fitsmytime.example/native/auth-return?attemptId=11111111-1111-4111-8111-111111111111&code=${"A".repeat(43)}`;
  assert.equal(validateHandoff(valid), valid);
  for (const url of [valid.replace("https:", "http:"), valid.replace("app.fitsmytime.example", "evil.example"), valid + "&code=x", valid + "&access_token=secret", valid + "#credential", valid.replace("/native/auth-return", "/native/auth-return/")]) assert.throws(() => validateHandoff(url));
});
await check("warm and simulated cold handoff use real backend protocol; replay fails", async () => {
  for (const cold of [false, true]) {
    const f = fixture(), client = new NativeProofClient(f.bridge);
    await client.beginLogin(); const session = await client.simulateReturn("proof-alice", cold);
    assert.equal(session.user.id, "proof-alice"); assert.equal((await client.account("proof-alice")).displayName, "Alice (synthetic)");
    assert.equal(JSON.stringify(session).includes("credential"), false); assert.equal("getCredential" in f.bridge, false);
    await reject(() => client.consumeHandoff(f.returnUrl()), "invalid_handoff"); assert.equal(client.session, null);
  }
});
await check("logout and account switch clear data; foreign account denied", async () => {
  const f = fixture(); let clears = 0; const client = new NativeProofClient(f.bridge, NATIVE_PROOF_API_ORIGIN, () => clears++);
  await client.beginLogin(); await client.simulateReturn("proof-alice", false); await client.account("proof-alice");
  await reject(() => client.account("proof-bob"), "account_forbidden");
  await client.logout(); assert.equal(client.session, null); await reject(() => client.account("proof-alice"), "unauthenticated");
  await client.beginLogin(); await client.simulateReturn("proof-bob", true); assert.equal((await client.account("proof-bob")).id, "proof-bob");
  await reject(() => client.account("proof-alice"), "account_forbidden"); assert.ok(clears >= 4);
});
await check("HTTP errors, non-JSON, malformed and secret-bearing responses fail closed", async () => {
  for (const [response, expected] of [
    [{ status: 503, contentType: "application/json", body: "provider secret" }, "unavailable"],
    [{ status: 401, contentType: "application/json", body: "secret" }, "unauthenticated"],
    [{ status: 200, contentType: "text/html", body: "<html>not data</html>" }, "invalid_response"],
    [{ status: 200, contentType: "application/json", body: "{" }, "invalid_response"],
    [{ status: 200, contentType: "application/json", body: JSON.stringify({ account: { id: "proof-alice", displayName: "Alice (synthetic)" }, credential: "must-not-return" }) }, "invalid_response"],
    [{ status: 200, contentType: "application/json", body: JSON.stringify({ account: { id: "proof-bob", displayName: "Bob (synthetic)" } }) }, "account_forbidden"],
  ]) {
    const f = fixture(), client = new NativeProofClient(f.bridge); await client.beginLogin(); await client.simulateReturn("proof-alice", false); f.setResponse(response);
    await reject(() => client.account("proof-alice"), expected);
  }
});
await check("timeout and in-flight late response cannot restore private data after logout", async () => {
  const f = fixture(), client = new NativeProofClient(f.bridge); await client.beginLogin(); await client.simulateReturn("proof-alice", false);
  let finish; f.setDelay(new Promise(resolve => { finish = resolve; })); await reject(() => client.account("proof-alice", 5), "timeout");
  const request = client.account("proof-alice"); await client.logout(); finish(); await reject(() => request, "stale_session"); assert.equal(client.session, null);
});
await check("React proof uses bundled en/lv/ru messages and observable login/logout", async () => {
  globalThis.React = React;
  for (const language of ["en", "lv", "ru"]) {
    const f = fixture(), client = new NativeProofClient(f.bridge); let view;
    await renderer.act(async () => { view = renderer.create(React.createElement(NativeProof, { client })); });
    await renderer.act(async () => view.root.findByType("select").props.onChange({ target: { value: language } }));
    assert.equal(view.root.findByType("main").props.lang, language); assert.equal(view.root.findByType("h1").children.join(""), proofMessages[language].title);
    const button = text => view.root.findAllByType("button").find(node => node.children.includes(text));
    await renderer.act(async () => { await button(proofMessages[language].start).props.onClick(); });
    await renderer.act(async () => { await button(proofMessages[language].alice).props.onClick(); });
    assert.equal(client.session.user.id, "proof-alice");
    await renderer.act(async () => { await button(proofMessages[language].read).props.onClick(); });
    assert.equal(view.root.findByProps({ "data-testid": "account-result" }).children.join(""), "Alice (synthetic)");
    await renderer.act(async () => { await button(proofMessages[language].logout).props.onClick(); }); assert.equal(client.session, null);
    assert.equal(view.root.findByProps({ "data-testid": "account-result" }).children.join(""), proofMessages[language].empty);
    await renderer.act(async () => view.unmount());
  }
});
console.log(`Passed ${assertions} native-client proof groups. APIs/native bridge simulated; en/lv/ru only. No native-device/security-store claim.`);
