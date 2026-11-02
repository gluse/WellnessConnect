import { z } from "zod";
import { validTimezone } from "./scheduling";

export const communicationMethods = ["email", "sms", "whatsapp"] as const;
export type CommunicationMethod = typeof communicationMethods[number];
export const notificationLanguages = ["en", "lv", "ru", "ar", "zh", "fr", "de", "hi", "ja", "pt", "es"] as const;
export const communicationPatchSchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/, "Use an international phone number, including + and country code.").nullable().optional(),
  preferredMethod: z.enum(communicationMethods).nullable().optional(),
  language: z.enum(notificationLanguages).optional(),
  smsOptIn: z.boolean().optional(), whatsappOptIn: z.boolean().optional(),
}).strict();
export const notificationTimezoneSchema = z.string().max(100).refine(validTimezone, "Choose a valid timezone.").default("UTC");
export type CommunicationSettings = {
  phone: string | null; phoneVerified: boolean; preferredMethod: CommunicationMethod | null;
  language: typeof notificationLanguages[number]; smsOptIn: boolean; whatsappOptIn: boolean;
  verificationAvailable: boolean;
};
export type VerificationResult = { status: "pending" | "verified"; expiresAt?: string; nextSendAt?: string };
export type NotificationCapabilities = { hasPro: boolean; automationEnabled: boolean; channels: Record<CommunicationMethod, boolean> };
export type NotificationSummary = { mode: "automatic" | "manual" | "none"; eventId?: string; state?: string; reasonCode?: string | null };
export type ReminderSummary = { state: "scheduled" | "sent" | "unavailable" | "failed" | "paused" | "off"; dueAt?: string; channel?: CommunicationMethod | null; reasonCode?: string | null };
export type ManualNotificationPreview = {
  customerName: string; subject: string; message: string;
  channels: Record<CommunicationMethod, { href: string | null; reasonCode: string | null }>;
};
export type BookingNotificationState = { notification: NotificationSummary; reminder: ReminderSummary };
export class NotificationError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
