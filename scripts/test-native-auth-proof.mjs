import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { IncomingMessage, ServerResponse } from "node:http";
import { Duplex } from "node:stream";
import { once } from "node:events";
import { createNativeAuthProofService, createNativeProofMemoryStore, nativeProofHash } from "../server/native-proof/service.ts";
import { createNativeAuthProofApp } from "../server/native-proof/http.ts";
import { NATIVE_PROOF_API_ORIGIN, NATIVE_PROOF_RETURN_URI, NATIVE_PROOF_PATHS as paths } from "../shared/native-proof.ts";

// Real isolated protocol + Express, injected memory/clock, in-process HTTP streams.
// No sockets, server bootstrap, env/credential files, provider, database or device.
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error("External calls are forbidden in the native auth proof"); };
let groups = 0;
async function scenario(name, action) { await action(); groups++; console.log(`PASS ${name}`); }
const random = () => randomBytes(32).toString("base64url");
function fixture(options = {}) {
  let time = Date.parse("2026-11-08T12:00:00Z");
  const store = createNativeProofMemoryStore();
  const service = createNativeAuthProofService({ ...options, store, clock: () => time });
  return { service, store, advance: ms => { time += ms; } };
}
function begin(service, verifier = random(), account = "proof-alice") {
  const attempt = service.begin({ challenge: nativeProofHash(verifier) });
  const url = service.completeBrowser(attempt.attemptId, account);
  const returned = new URL(url);
  return { attempt, url, verifier, code: returned.searchParams.get("code"), body: { attemptId: attempt.attemptId, code: returned.searchParams.get("code"), verifier } };
}
function failure(action, code, status) { assert.throws(action, error => error.code === code && error.status === status); }
function assertOpaque(value) { assert.match(value, /^[A-Za-z0-9_-]{43}$/); assert.equal(Buffer.from(value, "base64url").length, 32); }
async function request(app, method, path, { body, raw, headers = {} } = {}) {
  const chunks = [], socket = new Duplex({ read() {}, write(chunk, _encoding, done) { chunks.push(Buffer.from(chunk)); done(); } });
  Object.defineProperty(socket, "remoteAddress", { value: "127.0.0.1" });
  const encoded = raw ?? (body === undefined ? undefined : JSON.stringify(body));
  const req = new IncomingMessage(socket);
  req._read = () => {}; req.url = path; req.method = method;
  req.headers = { ...(encoded === undefined ? {} : { "content-type": "application/json", "content-length": String(Buffer.byteLength(encoded)) }), ...headers };
  const res = new ServerResponse(req); res.assignSocket(socket);
  const finished = once(res, "finish");
  app.handle(req, res);
  queueMicrotask(() => { if (encoded !== undefined) req.push(encoded); req.push(null); });
  await finished; socket.destroy();
  const wire = Buffer.concat(chunks).toString(), text = wire.slice(wire.indexOf("\r\n\r\n") + 4);
  return { status: res.statusCode, headers: res.getHeaders(), body: text ? JSON.parse(text) : null, text };
}

try {
  await scenario("S256 agrees with the independent RFC 7636 vector", () => {
    assert.equal(nativeProofHash("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
  await scenario("fixed start/return destinations and server-only synthetic provider tokens", () => {
    const { service, store } = fixture(), started = begin(service);
    const browser = new URL(started.attempt.browserUrl), returned = new URL(started.url);
    assert.equal(browser.origin, NATIVE_PROOF_API_ORIGIN); assert.equal(browser.pathname, paths.browserStart);
    assert.deepEqual([...browser.searchParams.keys()], ["attemptId"]);
    assert.equal(returned.origin + returned.pathname, NATIVE_PROOF_RETURN_URI);
    assert.deepEqual([...returned.searchParams.keys()], ["attemptId", "code"]);
    assert.equal(returned.hash, ""); assertOpaque(started.code);
    const record = store.attempts.get(started.attempt.attemptId);
    assert.equal(record.challenge, nativeProofHash(started.verifier));
    assert.equal(record.handoff.codeHash, nativeProofHash(started.code));
    const serialized = JSON.stringify([...store.attempts]);
    assert.equal(serialized.includes(started.code), false); assert.equal(serialized.includes(started.verifier), false);
    assert.ok(record.handoff.providerSession.accessToken.startsWith("synthetic-provider-access-"));
    for (const response of [started.url, JSON.stringify(started.attempt), JSON.stringify(service.browserAttempt(started.attempt.attemptId))]) {
      assert.equal(response.includes(record.handoff.providerSession.accessToken), false);
      assert.equal(response.includes(record.handoff.providerSession.refreshToken), false);
      assert.equal(response.includes(started.verifier), false);
    }
  });
  await scenario("exchange creates an opaque hash-indexed app session and consumes the code", () => {
    const { service, store } = fixture(), started = begin(service), session = service.exchange(started.body);
    assertOpaque(session.credential); assert.notEqual(session.credential, started.code); assert.notEqual(session.credential, started.verifier);
    assert.equal(store.attempts.has(started.attempt.attemptId), false);
    assert.equal(store.sessions.has(session.credential), false); assert.equal(store.sessions.has(nativeProofHash(session.credential)), true);
    assert.equal(JSON.stringify([...store.sessions]).includes(session.credential), false);
    assert.deepEqual(service.session(session.credential), { user: { id: "proof-alice", displayName: "Alice (synthetic)" }, expiresAt: session.expiresAt });
    assert.deepEqual(service.account(session.credential, "proof-alice"), { account: session.user });
    assert.equal(JSON.stringify(service.session(session.credential)).includes("credential"), false);
    failure(() => service.exchange(started.body), "invalid_handoff", 401);
  });
  await scenario("simultaneous same-code exchanges have exactly one winner", async () => {
    const { service, store } = fixture(), started = begin(service);
    const outcomes = await Promise.allSettled(Array.from({ length: 8 }, () => Promise.resolve().then(() => service.exchange(started.body))));
    assert.equal(outcomes.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(store.sessions.size, 1);
    for (const result of outcomes.filter(result => result.status === "rejected")) assert.equal(result.reason.code, "invalid_handoff");
  });
  await scenario("wrong verifier and cross-attempt code cannot swap accounts", () => {
    const { service } = fixture(), alice = begin(service), bob = begin(service, random(), "proof-bob");
    failure(() => service.exchange({ ...alice.body, verifier: bob.verifier }), "invalid_handoff", 401);
    failure(() => service.exchange({ ...alice.body, code: bob.code }), "invalid_handoff", 401);
    assert.equal(service.exchange(alice.body).user.id, "proof-alice", "Two rejected attempts leave the correct verifier/code usable");
    assert.equal(service.exchange(bob.body).user.id, "proof-bob");
  });
  await scenario("five invalid exchanges invalidate the bounded attempt", () => {
    const { service, store } = fixture(), started = begin(service);
    for (let index = 0; index < 5; index++) failure(() => service.exchange({ ...started.body, verifier: random() }), "invalid_handoff", 401);
    assert.equal(store.attempts.size, 0); failure(() => service.exchange(started.body), "invalid_handoff", 401);
  });
  await scenario("browser completion cannot change an already-bound account", () => {
    const { service } = fixture(), started = begin(service);
    failure(() => service.completeBrowser(started.attempt.attemptId, "proof-bob"), "invalid_handoff", 401);
    assert.equal(service.exchange(started.body).user.id, "proof-alice");
    const pending = service.begin({ challenge: nativeProofHash(random()) });
    failure(() => service.completeBrowser(pending.attemptId, "arbitrary-real-account"), "invalid_request", 400);
    failure(() => service.completeBrowser(pending.attemptId, "__proto__"), "invalid_request", 400);
  });
  await scenario("attempt and handoff expiries reject at exact boundaries", () => {
    const first = fixture(), pending = first.service.begin({ challenge: nativeProofHash(random()) });
    first.advance(120_000); failure(() => first.service.completeBrowser(pending.attemptId, "proof-alice"), "expired_handoff", 410);
    const second = fixture(), started = begin(second.service); second.advance(60_000);
    failure(() => second.service.exchange(started.body), "expired_handoff", 410); assert.equal(second.store.sessions.size, 0);
  });
  await scenario("logout, expiry, and cross-account reads cannot retain access", () => {
    const first = fixture(), session = first.service.exchange(begin(first.service).body);
    failure(() => first.service.account(session.credential, "proof-bob"), "account_forbidden", 403);
    failure(() => first.service.account(session.credential, "unknown"), "account_forbidden", 403);
    first.service.logout(session.credential); first.service.logout(session.credential);
    assert.equal(first.store.sessions.size, 0); failure(() => first.service.session(session.credential), "unauthenticated", 401);
    const second = fixture(), expiring = second.service.exchange(begin(second.service).body); second.advance(900_000);
    failure(() => second.service.session(expiring.credential), "unauthenticated", 401); assert.equal(second.store.sessions.size, 0);
    failure(() => second.service.session(random()), "unauthenticated", 401);
  });
  await scenario("strict inputs reject redirects, identities and credential-shaped extras", () => {
    const { service } = fixture(), challenge = nativeProofHash(random());
    for (const input of [null, [], {}, { challenge: "short" }, { challenge, returnUri: "https://attacker.example" }, { challenge, userId: "proof-bob" }]) {
      failure(() => service.begin(input), "invalid_request", 400);
    }
    const started = begin(service);
    for (const input of [{ ...started.body, userId: "proof-bob" }, { ...started.body, attemptId: "unknown" }, { ...started.body, verifier: "short" }, { ...started.body, code: started.code + "=" }]) {
      failure(() => service.exchange(input), "invalid_request", 400);
    }
    failure(() => service.exchange({ ...started.body, attemptId: "11111111-1111-4111-8111-111111111111" }), "invalid_handoff", 401);
    assert.equal(service.exchange(started.body).user.id, "proof-alice");
  });
  await scenario("memory bounds and expired-record cleanup fail truthfully", () => {
    const attempts = fixture({ maxAttempts: 1 }); attempts.service.begin({ challenge: nativeProofHash(random()) });
    failure(() => attempts.service.begin({ challenge: nativeProofHash(random()) }), "unavailable", 503);
    attempts.advance(120_000); attempts.service.begin({ challenge: nativeProofHash(random()) }); assert.equal(attempts.store.attempts.size, 1);
    const sessions = fixture({ maxSessions: 1 }), first = sessions.service.exchange(begin(sessions.service).body), second = begin(sessions.service);
    failure(() => sessions.service.exchange(second.body), "unavailable", 503);
    assert.equal(sessions.store.attempts.has(second.attempt.attemptId), true, "Capacity failure must not consume an otherwise valid code");
    sessions.service.logout(first.credential); assert.equal(sessions.service.exchange(second.body).user.id, "proof-alice");
    for (const options of [{ maxAttempts: 0 }, { maxSessions: Infinity }, { sessionTtlMs: NaN }, { handoffTtlMs: -1 }]) {
      failure(() => createNativeAuthProofService(options), "invalid_request", 400);
    }
    const invalidClock = createNativeAuthProofService({ clock: () => Infinity }); failure(() => invalidClock.begin({ challenge: nativeProofHash(random()) }), "unavailable", 503);
  });
  await scenario("cryptographic opaque outputs are fresh 32-byte values", () => {
    const { service } = fixture(), observed = new Set();
    for (let index = 0; index < 24; index++) {
      const started = begin(service), session = service.exchange(started.body);
      for (const token of [started.code, session.credential]) { assertOpaque(token); assert.equal(observed.has(token), false); observed.add(token); }
    }
    assert.equal(observed.size, 48);
  });
  await scenario("real HTTP mapping exposes only the bridge exchange credential", async () => {
    const { service, store } = fixture(), app = createNativeAuthProofApp(service), verifier = random();
    let response = await request(app, "POST", paths.attempts, { body: { challenge: nativeProofHash(verifier) } });
    assert.equal(response.status, 201); const attempt = response.body;
    assert.equal(response.headers["cache-control"], "no-store"); assert.equal(response.headers["access-control-allow-origin"], undefined);
    assert.equal(response.headers["referrer-policy"], "no-referrer"); assert.equal(response.headers["x-content-type-options"], "nosniff");
    assert.equal(response.text.includes("credential"), false); assert.equal(response.text.includes(verifier), false);
    response = await request(app, "GET", paths.browserStart + "?attemptId=" + attempt.attemptId);
    assert.equal(response.status, 200); assert.equal(response.body.proofOnly, true);
    const returned = new URL(service.completeBrowser(attempt.attemptId, "proof-bob")), code = returned.searchParams.get("code");
    response = await request(app, "POST", paths.exchange, { body: { attemptId: attempt.attemptId, code, verifier } });
    assert.equal(response.status, 200); const credential = response.body.credential; assertOpaque(credential);
    assert.equal(response.body.user.id, "proof-bob"); assert.equal(response.text.includes("synthetic-provider"), false);
    const headers = { authorization: "Bearer " + credential };
    response = await request(app, "GET", paths.session, { headers }); assert.equal(response.status, 200);
    assert.equal(response.text.includes(credential), false); assert.equal(response.text.includes("credential"), false);
    response = await request(app, "GET", paths.accountPrefix + "proof-alice", { headers }); assert.equal(response.status, 403);
    assert.deepEqual(response.body.error, { code: "account_forbidden", message: "This account is unavailable." });
    assert.equal(response.text.includes("proof-alice"), false); assert.equal(response.text.includes(credential), false);
    response = await request(app, "GET", paths.accountPrefix + "proof-bob", { headers }); assert.equal(response.status, 200); assert.equal(response.body.account.id, "proof-bob");
    response = await request(app, "POST", paths.logout, { headers, body: {} }); assert.equal(response.status, 200); assert.equal(store.sessions.size, 0);
    response = await request(app, "GET", paths.session, { headers }); assert.equal(response.status, 401);
  });
  await scenario("public routes cannot assert browser identity or bypass wire guards", async () => {
    const { service } = fixture(), app = createNativeAuthProofApp(service), challenge = nativeProofHash(random());
    for (const path of ["/api/native-proof/browser/complete", "/api/native-proof/test/browser-complete", "/api/auth/login"]) {
      const response = await request(app, "POST", path, { body: { account: "proof-alice", attemptId: "11111111-1111-4111-8111-111111111111" } });
      assert.equal(response.status, 404); assert.equal(response.body.error.code, "not_found");
    }
    let response = await request(app, "POST", paths.attempts, { body: { challenge }, headers: { origin: "https://attacker.example" } }); assert.equal(response.status, 400);
    response = await request(app, "POST", paths.attempts, { body: { challenge }, headers: { "sec-fetch-site": "cross-site" } }); assert.equal(response.status, 400);
    response = await request(app, "POST", paths.attempts, { raw: "{malformed secret", headers: { "content-type": "application/json" } });
    assert.equal(response.status, 400); assert.equal(response.text.includes("malformed"), false);
    response = await request(app, "POST", paths.attempts, { body: { challenge }, headers: { "content-type": "text/plain" } }); assert.equal(response.status, 400);
    response = await request(app, "POST", paths.attempts, { body: { challenge, padding: "x".repeat(5000) } }); assert.equal(response.status, 400);
    response = await request(app, "POST", paths.attempts + "?userId=proof-alice", { body: { challenge } }); assert.equal(response.status, 400);
    response = await request(app, "POST", paths.attempts + "/", { body: { challenge } }); assert.equal(response.status, 404);
    response = await request(app, "GET", paths.session); assert.equal(response.status, 401);
    response = await request(app, "GET", paths.session, { headers: { authorization: "Bearer short" } }); assert.equal(response.status, 401);
    const session = service.exchange(begin(service).body), headers = { authorization: "Bearer " + session.credential };
    response = await request(app, "GET", paths.session + "?credential=" + session.credential, { headers }); assert.equal(response.status, 400); assert.equal(response.text.includes(session.credential), false);
    response = await request(app, "POST", paths.logout, { headers, body: [] }); assert.equal(response.status, 400); assert.equal(service.session(session.credential).user.id, "proof-alice");
    response = await request(app, "GET", paths.browserStart + "?attemptId=a&attemptId=b"); assert.equal(response.status, 401);
    response = await request(app, "GET", paths.browserStart + "?attemptId=a&code=b"); assert.equal(response.status, 400);
  });
} finally { globalThis.fetch = originalFetch; }
console.log(`Native auth proof: ${groups} scenario groups passed. Synthetic in-memory protocol and in-process HTTP only; no native device, provider, environment, database or network access.`);
