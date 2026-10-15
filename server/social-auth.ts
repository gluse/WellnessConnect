import type { Provider } from "@supabase/supabase-js";
import { socialProviders, type AuthProviders, type SocialProvider } from "@shared/social-auth";
import { isAllowedAuthReturnTo } from "@shared/navigation";
import type { User as AuthUser } from "@supabase/supabase-js";
import type { User } from "@shared/schema";

const providerSettings: Record<SocialProvider, { provider: Provider; flag: string; scopes?: string }> = {
  google: { provider: "google", flag: "SUPABASE_GOOGLE_ENABLED" },
  facebook: { provider: "facebook", flag: "SUPABASE_FACEBOOK_ENABLED", scopes: "email" },
  apple: { provider: "apple", flag: "SUPABASE_APPLE_ENABLED" },
  microsoft: { provider: "azure", flag: "SUPABASE_MICROSOFT_ENABLED", scopes: "email" },
};

export function enabledAuthProviders(): AuthProviders {
  return Object.fromEntries(socialProviders.map(provider => [provider, process.env[providerSettings[provider].flag] === "true"])) as AuthProviders;
}

export function oauthSettings(provider: SocialProvider) {
  const { provider: supabaseProvider, scopes } = providerSettings[provider];
  return { provider: supabaseProvider, scopes };
}

export function loginFailureUrl(error: string, returnTo: unknown): string {
  const params = new URLSearchParams({ error });
  if (isAllowedAuthReturnTo(returnTo)) params.set("returnTo", returnTo);
  return `/login?${params}`;
}

const metadataText = (value: unknown): string | null => typeof value === "string" ? value.trim().slice(0, 100) || null : null;

export function authProfileNames(user: AuthUser, existing: User | undefined) {
  // Account edits are synced to first_name/last_name, including intentional empty
  // strings. Sparse provider metadata must not erase stored names or restore an
  // old provider alias after the user has cleared their name.
  return {
    firstName: typeof user.user_metadata.first_name === "string" ? metadataText(user.user_metadata.first_name)
      : existing ? existing.firstName : metadataText(user.user_metadata.given_name),
    lastName: typeof user.user_metadata.last_name === "string" ? metadataText(user.user_metadata.last_name)
      : existing ? existing.lastName : metadataText(user.user_metadata.family_name),
  };
}
