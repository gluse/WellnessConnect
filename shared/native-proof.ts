/** Public synthetic proof contract. Never place session credentials or verifiers here. */
export const NATIVE_PROOF_API_ORIGIN = "https://api.fitsmytime.example";
export const NATIVE_PROOF_RETURN_ORIGIN = "https://app.fitsmytime.example";
export const NATIVE_PROOF_RETURN_PATH = "/native/auth-return";
export const NATIVE_PROOF_RETURN_URL = NATIVE_PROOF_RETURN_ORIGIN + NATIVE_PROOF_RETURN_PATH;
export const NATIVE_PROOF_RETURN_URI = NATIVE_PROOF_RETURN_URL;
export const NATIVE_PROOF_PATHS = {
  attempts: "/api/native-proof/auth/attempts",
  browserStart: "/api/native-proof/browser/start",
  exchange: "/api/native-proof/auth/exchange",
  session: "/api/native-proof/session",
  logout: "/api/native-proof/logout",
  accountPrefix: "/api/native-proof/accounts/",
} as const;
export type NativeProofAccountId = "proof-alice" | "proof-bob";
export interface NativeProofUser { id: NativeProofAccountId; displayName: string }
export interface NativeProofSession { user: NativeProofUser; expiresAt: string }
export interface NativeProofSafeSession extends NativeProofSession { generation: number }
export interface NativeProofAttempt { attemptId: string; browserUrl: string; expiresAt: string }
export interface NativeProofResponse { status: number; contentType: string; body: string }
/** The native implementation owns all credentials, including attempt verifiers. */
export interface NativeProofBridge {
  capabilities(): Promise<{ native: boolean; mode: "synthetic-offline"; platform: string }>;
  restoreSession(): Promise<{ session: NativeProofSafeSession | null }>;
  beginLogin(): Promise<NativeProofAttempt>;
  consumeHandoff(input: { url: string }): Promise<{ session: NativeProofSafeSession }>;
  request(input: { path: string; method: "GET"; timeoutMs: number }): Promise<NativeProofResponse>;
  logout(): Promise<void>;
  /** Debug proof only: simulates external authorization, never a production provider. */
  simulateBrowserReturn(input: { account: NativeProofAccountId; cold: boolean }): Promise<{ session: NativeProofSafeSession }>;
}
