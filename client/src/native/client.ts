import {
  NATIVE_PROOF_API_ORIGIN, NATIVE_PROOF_PATHS, NATIVE_PROOF_RETURN_URI,
  type NativeProofBridge, type NativeProofSafeSession, type NativeProofUser,
} from "../../../shared/native-proof";

export type ProofErrorCode = "invalid_destination" | "invalid_handoff" | "invalid_response" | "timeout" | "unavailable" | "unauthenticated" | "account_forbidden" | "stale_session";
export class ProofError extends Error {
  constructor(readonly code: ProofErrorCode) { super(code); this.name = "ProofError"; }
}
export function validateApiOrigin(origin: string) {
  if (origin !== NATIVE_PROOF_API_ORIGIN) throw new ProofError("invalid_destination");
  return origin;
}
export function validateResourcePath(path: string) {
  if (path !== NATIVE_PROOF_PATHS.session && !/^\/api\/native-proof\/accounts\/proof-(alice|bob)$/.test(path)) throw new ProofError("invalid_destination");
  return path;
}
export function validateHandoff(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new ProofError("invalid_handoff"); }
  const expected = new URL(NATIVE_PROOF_RETURN_URI);
  if (url.origin !== expected.origin || url.pathname !== expected.pathname || url.username || url.password || url.hash ||
    url.searchParams.getAll("attemptId").length !== 1 || url.searchParams.getAll("code").length !== 1 ||
    Array.from(url.searchParams.keys()).some(key => key !== "attemptId" && key !== "code") ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(url.searchParams.get("attemptId") ?? "") ||
    !/^[A-Za-z0-9_-]{43}$/.test(url.searchParams.get("code") ?? "")) throw new ProofError("invalid_handoff");
  return url.href;
}
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
export function safeUser(value: unknown): NativeProofUser {
  if (!record(value) || Object.keys(value).sort().join() !== "displayName,id" ||
    (value.id !== "proof-alice" && value.id !== "proof-bob") || typeof value.displayName !== "string" ||
    value.displayName !== (value.id === "proof-alice" ? "Alice (synthetic)" : "Bob (synthetic)")) throw new ProofError("invalid_response");
  return { id: value.id, displayName: value.displayName };
}
function safeSession(value: unknown): NativeProofSafeSession {
  if (!record(value) || Object.keys(value).sort().join() !== "expiresAt,generation,user" ||
    typeof value.expiresAt !== "string" || !Number.isFinite(Date.parse(value.expiresAt)) ||
    !Number.isSafeInteger(value.generation) || Number(value.generation) < 0) throw new ProofError("invalid_response");
  return { user: safeUser(value.user), expiresAt: value.expiresAt, generation: Number(value.generation) };
}
function normalizeError(error: unknown): ProofError {
  if (error instanceof ProofError) return error;
  if (record(error) && ["unauthenticated", "account_forbidden", "invalid_handoff", "timeout"].includes(String(error.code))) return new ProofError(error.code as ProofErrorCode);
  return new ProofError("unavailable");
}
async function deadline<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([operation, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new ProofError("timeout")), timeoutMs); })]); }
  finally { if (timer) clearTimeout(timer); }
}

/** Isolated proof client. Credentials are never accepted or returned by this API. */
export class NativeProofClient {
  private revision = 0;
  private current: NativeProofSafeSession | null = null;
  private accountCache = new Map<string, NativeProofUser>();
  constructor(private bridge: NativeProofBridge, origin = NATIVE_PROOF_API_ORIGIN, private clearPrivateCaches: () => void = () => {}) { validateApiOrigin(origin); }
  get session() { return this.current ? structuredClone(this.current) : null; }
  private reset() { this.revision++; this.current = null; this.accountCache.clear(); this.clearPrivateCaches(); }
  private commit(value: unknown) {
    const session = safeSession(value);
    if (Date.parse(session.expiresAt) <= Date.now()) throw new ProofError("unauthenticated");
    this.reset(); this.current = session; return this.session!;
  }
  async restore() {
    const revision = this.revision;
    try {
      const { session } = await deadline(this.bridge.restoreSession(), 10_000);
      if (revision !== this.revision) throw new ProofError("stale_session");
      if (!session) { this.reset(); return null; }
      return this.commit(session);
    } catch (error) { if (revision === this.revision) this.reset(); throw normalizeError(error); }
  }
  async beginLogin() {
    this.reset();
    const revision = this.revision;
    try {
      const attempt = await deadline(this.bridge.beginLogin(), 10_000);
      if (revision !== this.revision) throw new ProofError("stale_session");
      const browser = new URL(attempt.browserUrl);
      if (browser.origin !== NATIVE_PROOF_API_ORIGIN || browser.pathname !== NATIVE_PROOF_PATHS.browserStart || browser.username || browser.password || browser.hash ||
        Array.from(browser.searchParams.keys()).join() !== "attemptId" || browser.searchParams.get("attemptId") !== attempt.attemptId) throw new ProofError("invalid_destination");
      return { attemptId: attempt.attemptId, browserUrl: browser.href, expiresAt: attempt.expiresAt };
    } catch (error) { throw normalizeError(error); }
  }
  async consumeHandoff(url: string) {
    validateHandoff(url);
    const revision = this.revision;
    try {
      const result = await deadline(this.bridge.consumeHandoff({ url }), 10_000);
      if (revision !== this.revision) throw new ProofError("stale_session");
      return this.commit(result.session);
    } catch (error) { if (revision === this.revision) this.reset(); throw normalizeError(error); }
  }
  async simulateReturn(account: "proof-alice" | "proof-bob", cold: boolean) {
    const revision = this.revision;
    try {
      const result = await deadline(this.bridge.simulateBrowserReturn({ account, cold }), 10_000);
      if (revision !== this.revision) throw new ProofError("stale_session");
      return this.commit(result.session);
    } catch (error) { if (revision === this.revision) this.reset(); throw normalizeError(error); }
  }
  async account(accountId: string, timeoutMs = 5_000) {
    const path = validateResourcePath(NATIVE_PROOF_PATHS.accountPrefix + accountId);
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10_000) throw new ProofError("invalid_destination");
    const revision = this.revision, session = this.current;
    if (!session || Date.parse(session.expiresAt) <= Date.now()) { this.reset(); throw new ProofError("unauthenticated"); }
    // Never serve a cached row for another account or across a login generation.
    if (session.user.id !== accountId) throw new ProofError("account_forbidden");
    const key = `${session.generation}:${accountId}`;
    const cached = this.accountCache.get(key); if (cached) return structuredClone(cached);
    try {
      const response = await deadline(this.bridge.request({ path, method: "GET", timeoutMs }), timeoutMs);
      if (revision !== this.revision) throw new ProofError("stale_session");
      if (response.status === 401) { this.reset(); throw new ProofError("unauthenticated"); }
      if (response.status === 403) throw new ProofError("account_forbidden");
      if (response.status !== 200) throw new ProofError("unavailable");
      if (!/^application\/json(?:\s*;|$)/i.test(response.contentType) || response.body.length > 65536) throw new ProofError("invalid_response");
      let value: unknown; try { value = JSON.parse(response.body); } catch { throw new ProofError("invalid_response"); }
      if (!record(value) || Object.keys(value).join() !== "account") throw new ProofError("invalid_response");
      const user = safeUser(value.account);
      if (user.id !== accountId) throw new ProofError("account_forbidden");
      this.accountCache.set(key, user); return structuredClone(user);
    } catch (error) { throw normalizeError(error); }
  }
  async logout() {
    this.reset();
    try { await deadline(this.bridge.logout(), 10_000); } catch (error) { throw normalizeError(error); }
  }
}
