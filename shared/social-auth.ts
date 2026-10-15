export const socialProviders = ["google", "facebook", "apple", "microsoft"] as const;
export type SocialProvider = typeof socialProviders[number];
export type AuthProviders = Record<SocialProvider, boolean>;

export const socialProviderLabels: Record<SocialProvider, string> = {
  google: "Google", facebook: "Facebook", apple: "Apple", microsoft: "Microsoft",
};

export function signInErrorMessage(code: string | null): string {
  switch (code) {
    case null: return "";
    case "invitation_session_expired": return "Your invitation sign-in expired. Request a fresh sign-in email below, or sign in if you already have a password.";
    case "google_disabled":
    case "social_disabled": return "This sign-in option is currently unavailable. Choose another option or sign in with email.";
    case "social_cancelled": return "Social sign-in was cancelled. You can try again or choose another sign-in option.";
    case "social_session_expired": return "Your sign-in session expired. Start sign-in again in this browser.";
    default: return "Sign-in could not be completed. Please try again.";
  }
}
