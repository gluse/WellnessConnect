import { z } from "zod";

export const messageInputSchema = z.object({ body: z.string().trim().min(1).max(4000), clientRequestId: z.string().uuid() }).strict();
export const eventBookingIdsSchema = z.array(z.number().int().positive()).min(1).max(500).refine(ids => new Set(ids).size === ids.length, "Duplicate booking IDs are not allowed.");
export const rescheduleInputSchema = z.object({ scheduledDate: z.string().datetime(), fallback: z.enum(["keep_original", "cancel_booking"]),
  note: z.string().trim().max(2000).optional(), timeZone: z.string().min(1).max(100).refine(value => { try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; } }), clientRequestId: z.string().uuid() }).strict();
export type RescheduleInput = z.infer<typeof rescheduleInputSchema>;
export type BookingMessage = { id: string; bookingId: number; authorId: string; authorRole: "provider" | "customer"; authorName: string;
  body: string; createdAt: string; broadcastId: string | null };
export type BookingConversation = { messages: BookingMessage[]; nextCursor: string | null };
export type RescheduleRequest = { id: string; bookingId: number; requestedById: string; requestedByRole: "provider" | "customer";
  originalScheduledDate: string; proposedScheduledDate: string; fallback: "keep_original" | "cancel_booking";
  state: "pending" | "accepted" | "declined" | "withdrawn" | "superseded"; note: string | null; timezone: string;
  createdAt: string; respondedAt: string | null; canRespond: boolean; canWithdraw: boolean; batchId: string | null };
export type RescheduleRequests = { requests: RescheduleRequest[] };
export type EventAction = "complete" | "cancel" | "reschedule" | "message";
export type EventPreview = { bookingIds: number[]; bookingCount: number; participantCount: number; hasPro: boolean;
  recipients: { bookingId: number; customerName: string; status: string | null; participantCount: number }[] };

// Session identity follows saved reservation fields, never customer/service labels.
export function appointmentEventKey(booking: { id: number; serviceId: number; providerId: string; companyId?: number | null; employeeId?: number | null;
  scheduledDate: string | Date; bookingDuration?: number | null; bookingCleanupTime?: number | null; service?: { duration: number; serviceType: string } }) {
  if (booking.service?.serviceType !== "group") return `booking:${booking.id}`;
  return JSON.stringify([booking.companyId ?? null, booking.providerId, booking.serviceId, booking.employeeId ?? null,
    new Date(booking.scheduledDate).toISOString(), booking.bookingDuration ?? booking.service.duration, booking.bookingCleanupTime ?? 0]);
}
