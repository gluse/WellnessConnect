const failureReasons = {
  email_address_not_authorized: "recipient_restricted",
  over_email_send_rate_limit: "rate_limited",
  email_exists: "existing_account",
  user_already_exists: "existing_account",
} as const;

type ProviderCode = keyof typeof failureReasons;
export type InvitationEmailDiagnostic = {
  event: "company_invitation_email_failed";
  reason: (typeof failureReasons)[ProviderCode] | "provider_error";
  providerCode: ProviderCode | "other";
  status: number | null;
};

// Provider messages can contain addresses, links or credentials. Only these
// bounded values are suitable for the server diagnostic, never the HTTP body.
export function invitationEmailDiagnostic(error: unknown): InvitationEmailDiagnostic {
  const details = typeof error === "object" && error !== null ? error as { code?: unknown; status?: unknown } : {};
  const providerCode = typeof details.code === "string" && Object.hasOwn(failureReasons, details.code) ? details.code as ProviderCode : "other";
  return {
    event: "company_invitation_email_failed",
    reason: providerCode === "other" ? "provider_error" : failureReasons[providerCode],
    providerCode,
    status: typeof details.status === "number" && Number.isInteger(details.status) && details.status >= 400 && details.status <= 599 ? details.status : null,
  };
}

export async function sendInvitationEmailOnce(
  send: () => Promise<{ error: unknown }>,
  warn: (diagnostic: InvitationEmailDiagnostic) => void = diagnostic => console.warn("Company invitation email failed:", diagnostic),
): Promise<boolean> {
  let failure: unknown;
  try {
    const { error } = await send();
    if (!error) return true;
    failure = error;
  } catch (error) {
    failure = error;
  }
  // The workspace invitation already committed. Neither mail nor logging failure
  // should turn this into a creation failure that encourages duplicate requests.
  try { warn(invitationEmailDiagnostic(failure)); } catch { /* Keep the share-link fallback available. */ }
  return false;
}
