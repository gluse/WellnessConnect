import type { CommunicationMethod, ManualNotificationPreview } from "../../shared/notifications";

export type Preferences = { phone: string | null; phoneVerifiedAt: Date | null; preferredMethod: CommunicationMethod | null; language: string; smsOptIn: boolean; whatsappOptIn: boolean; emailSuppressed?: boolean };
export const defaultPreferences: Preferences = { phone: null, phoneVerifiedAt: null, preferredMethod: null, language: "en", smsOptIn: false, whatsappOptIn: false };
export function channelReason(channel: CommunicationMethod, prefs: Preferences, email: string | null): string | null {
  if (channel === "email") return prefs.emailSuppressed ? "email_suppressed" : email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? null : "missing_email";
  if (!prefs.phone) return "missing_phone";
  if (!prefs.phoneVerifiedAt) return "unverified_phone";
  return (channel === "sms" ? prefs.smsOptIn : prefs.whatsappOptIn) ? null : "missing_permission";
}
export function statusAction(previous: string | null, next: string | null): "accepted" | "rejected" | null {
  return previous === "pending" && next === "confirmed" ? "accepted" : previous === "pending" && next === "cancelled" ? "rejected" : null;
}
export function reminderDue(appointment: Date, hours: number, now: Date) {
  const due = new Date(appointment.getTime() - hours * 3_600_000);
  return due.getTime() > now.getTime() ? due : null;
}
export { renderMessage } from "../../shared/notification-message";
export function manualPreview(input: { customerName: string; subject: string; message: string; preferences: Preferences; email: string | null }): ManualNotificationPreview {
  const channels = {} as ManualNotificationPreview["channels"];
  for (const channel of ["email", "sms", "whatsapp"] as const) {
    const reasonCode = channelReason(channel, input.preferences, input.email);
    const href = reasonCode ? null : channel === "email" ? `mailto:${encodeURIComponent(input.email!)}?subject=${encodeURIComponent(input.subject)}&body=${encodeURIComponent(input.message)}`
      : channel === "sms" ? `sms:${input.preferences.phone}?body=${encodeURIComponent(input.message)}` : `https://wa.me/${input.preferences.phone!.slice(1)}?text=${encodeURIComponent(input.message)}`;
    channels[channel] = { href, reasonCode };
  }
  return { customerName: input.customerName, subject: input.subject, message: input.message, channels };
}
export function deliveryTransition(current: string, next: "accepted" | "delivered" | "failed") {
  if (current === "delivered" || current === "cancelled" || current === "skipped") return current;
  if (next === "delivered") return "delivered";
  if (current === "failed" && next === "accepted") return current;
  return next;
}
