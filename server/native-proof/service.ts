import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  NATIVE_PROOF_API_ORIGIN, NATIVE_PROOF_RETURN_URI, NATIVE_PROOF_PATHS,
  type NativeProofAccountId, type NativeProofAttempt, type NativeProofSession, type NativeProofUser,
} from "../../shared/native-proof";

/** Isolated synthetic protocol only. No database, environment or provider imports. */
export type NativeProofErrorCode = "invalid_request" | "invalid_handoff" | "expired_handoff" |
  "unauthenticated" | "account_forbidden" | "unavailable";
const failures = {
  invalid_request: [400, "The proof request is invalid."],
  invalid_handoff: [401, "The sign-in return could not be verified."],
  expired_handoff: [410, "The sign-in return expired. Start again."],
  unauthenticated: [401, "Sign in to continue."],
  account_forbidden: [403, "This account is unavailable."],
  unavailable: [503, "The proof is temporarily unavailable."],
} as const;
export class NativeProofError extends Error {
  readonly status: number;
  constructor(readonly code: NativeProofErrorCode) {
    super(failures[code][1]); this.name = "NativeProofError"; this.status = failures[code][0];
  }
}

const opaque = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const startInput = z.object({ challenge: opaque }).strict();
const exchangeInput = z.object({
  attemptId: z.string().uuid(), code: opaque,
  verifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/),
}).strict();
const accounts: Readonly<Record<NativeProofAccountId, NativeProofUser>> = Object.freeze({
  "proof-alice": Object.freeze({ id: "proof-alice", displayName: "Alice (synthetic)" }),
  "proof-bob": Object.freeze({ id: "proof-bob", displayName: "Bob (synthetic)" }),
});
type SyntheticProviderSession = { accessToken: string; refreshToken: string };
type AttemptRecord = {
  challenge: string; expiresAt: number; failures: number;
  handoff?: { codeHash: string; expiresAt: number; user: NativeProofUser; providerSession: SyntheticProviderSession };
};
type SessionRecord = { expiresAt: number; user: NativeProofUser; providerSession: SyntheticProviderSession };

/** Trusted server-only memory adapter; raw app credentials and handoff codes never enter it. */
export function createNativeProofMemoryStore() {
  return { attempts: new Map<string, AttemptRecord>(), sessions: new Map<string, SessionRecord>() };
}
export type NativeProofMemoryStore = ReturnType<typeof createNativeProofMemoryStore>;
export interface NativeProofOptions {
  clock?: () => number;
  store?: NativeProofMemoryStore;
  attemptTtlMs?: number;
  handoffTtlMs?: number;
  sessionTtlMs?: number;
  maxAttempts?: number;
  maxSessions?: number;
}

export function nativeProofHash(value: string) { return createHash("sha256").update(value, "ascii").digest("base64url"); }
function equalHash(left: string, right: string) {
  const first = Buffer.from(left, "ascii"), second = Buffer.from(right, "ascii");
  return first.length === second.length && timingSafeEqual(first, second);
}
const randomOpaque = () => randomBytes(32).toString("base64url");
function validate<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new NativeProofError("invalid_request");
  return parsed.data;
}

/**
 * One synchronous in-process transaction per operation. This proves protocol
 * decisions only; production requires a shared transactional/expiring store.
 */
export function createNativeAuthProofService(options: NativeProofOptions = {}) {
  const clock = options.clock ?? Date.now, store = options.store ?? createNativeProofMemoryStore();
  // Configurable fixture durations, not production security/retention policy.
  const attemptTtl = options.attemptTtlMs ?? 120_000, handoffTtl = options.handoffTtlMs ?? 60_000;
  const sessionTtl = options.sessionTtlMs ?? 900_000, maxAttempts = options.maxAttempts ?? 100, maxSessions = options.maxSessions ?? 100;
  for (const limit of [attemptTtl, handoffTtl, sessionTtl, maxAttempts, maxSessions]) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 86_400_000) throw new NativeProofError("invalid_request");
  }
  function now() {
    const time = clock();
    if (!Number.isSafeInteger(time) || time < 0 || time > 8_640_000_000_000_000 - 86_400_000) throw new NativeProofError("unavailable");
    return time;
  }
  function cleanup(time: number) {
    for (const [id, record] of store.attempts) if (record.expiresAt <= time || record.handoff && record.handoff.expiresAt <= time) store.attempts.delete(id);
    for (const [id, record] of store.sessions) if (record.expiresAt <= time) store.sessions.delete(id);
  }
  function attempt(id: unknown, time: number) {
    if (!z.string().uuid().safeParse(id).success) throw new NativeProofError("invalid_handoff");
    const record = store.attempts.get(id as string);
    if (!record) throw new NativeProofError("invalid_handoff");
    if (record.expiresAt <= time || record.handoff && record.handoff.expiresAt <= time) {
      store.attempts.delete(id as string); throw new NativeProofError("expired_handoff");
    }
    return record;
  }
  function authenticated(credential: unknown) {
    if (!opaque.safeParse(credential).success) throw new NativeProofError("unauthenticated");
    const key = nativeProofHash(credential as string), record = store.sessions.get(key);
    if (!record) throw new NativeProofError("unauthenticated");
    if (record.expiresAt <= now()) { store.sessions.delete(key); throw new NativeProofError("unauthenticated"); }
    return record;
  }
  const safeSession = (record: SessionRecord): NativeProofSession => ({ user: { ...record.user }, expiresAt: new Date(record.expiresAt).toISOString() });
  return {
    begin(input: unknown): NativeProofAttempt {
      const { challenge } = validate(startInput, input), time = now(); cleanup(time);
      if (store.attempts.size >= maxAttempts) throw new NativeProofError("unavailable");
      const id = randomUUID(), expiresAt = time + attemptTtl;
      store.attempts.set(id, { challenge, expiresAt, failures: 0 });
      const url = new URL(NATIVE_PROOF_PATHS.browserStart, NATIVE_PROOF_API_ORIGIN);
      url.searchParams.set("attemptId", id);
      return { attemptId: id, browserUrl: url.href, expiresAt: new Date(expiresAt).toISOString() };
    },
    browserAttempt(id: unknown) {
      attempt(id, now());
      return { proofOnly: true as const, status: "awaiting_synthetic_browser" as const };
    },
    /** Trusted synthetic test driver only: no HTTP route accepts an asserted account. */
    completeBrowser(id: string, account: NativeProofAccountId) {
      const time = now(), record = attempt(id, time);
      if (!Object.hasOwn(accounts, account)) throw new NativeProofError("invalid_request");
      if (record.handoff) throw new NativeProofError("invalid_handoff");
      const code = randomOpaque();
      record.handoff = {
        codeHash: nativeProofHash(code), expiresAt: Math.min(record.expiresAt, time + handoffTtl), user: accounts[account],
        providerSession: { accessToken: `synthetic-provider-access-${randomOpaque()}`, refreshToken: `synthetic-provider-refresh-${randomOpaque()}` },
      };
      const url = new URL(NATIVE_PROOF_RETURN_URI); url.searchParams.set("attemptId", id); url.searchParams.set("code", code);
      return url.href;
    },
    /** Private wire DTO consumed by a native adapter, never passed through to JS. */
    exchange(input: unknown): NativeProofSession & { credential: string } {
      const parsed = validate(exchangeInput, input), time = now(), record = attempt(parsed.attemptId, time);
      const handoff = record.handoff;
      if (!handoff || !equalHash(handoff.codeHash, nativeProofHash(parsed.code)) || !equalHash(record.challenge, nativeProofHash(parsed.verifier))) {
        record.failures++;
        if (record.failures >= 5) store.attempts.delete(parsed.attemptId);
        throw new NativeProofError("invalid_handoff");
      }
      cleanup(time);
      if (store.sessions.size >= maxSessions) throw new NativeProofError("unavailable");
      const credential = randomOpaque(), session: SessionRecord = { user: handoff.user, providerSession: handoff.providerSession, expiresAt: time + sessionTtl };
      store.sessions.set(nativeProofHash(credential), session);
      store.attempts.delete(parsed.attemptId); // Consumed atomically with session creation in this memory proof.
      return { ...safeSession(session), credential };
    },
    session(credential: unknown): NativeProofSession { return safeSession(authenticated(credential)); },
    account(credential: unknown, id: unknown) {
      const record = authenticated(credential);
      if (id !== record.user.id) throw new NativeProofError("account_forbidden");
      return { account: { ...record.user } };
    },
    logout(credential: unknown) {
      if (!opaque.safeParse(credential).success) throw new NativeProofError("unauthenticated");
      store.sessions.delete(nativeProofHash(credential as string));
      return { success: true as const };
    },
  };
}
export type NativeAuthProofService = ReturnType<typeof createNativeAuthProofService>;
