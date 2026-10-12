import "dotenv/config";
import { createClient, type SupportedStorage } from "@supabase/supabase-js";

export const supabaseUrl = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
export const storageBucket = process.env.SUPABASE_STORAGE_BUCKET || "service-images";
export const appUrl = new URL(process.env.APP_URL || "http://localhost:5000").origin;

if (!supabaseUrl || !publishableKey || !secretKey) {
  throw new Error("Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SECRET_KEY in .env.");
}

// Auth clients are per request: never share one user's tokens with another.
export function createAuthClient(storage?: SupportedStorage) {
  return createClient(supabaseUrl!, publishableKey!, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: Boolean(storage),
      flowType: "pkce",
      storage,
    },
  });
}

// This privileged client is only used on the server, after authorization.
export const supabaseAdmin = createClient(supabaseUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});
