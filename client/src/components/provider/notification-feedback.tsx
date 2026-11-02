import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { BookingNotificationState, NotificationSummary } from "@shared/notifications";
import { apiRequest } from "@/lib/queryClient";

export default function NotificationFeedback({ bookingId, summary, scope }: { bookingId: number; summary: NotificationSummary; scope: string }) {
  const { t } = useTranslation();
  const query = useQuery<BookingNotificationState>({
    queryKey: [`/api/bookings/${bookingId}/notifications`, scope, summary.eventId ?? "latest"],
    queryFn: async ({ signal }) => (await apiRequest("GET", `/api/bookings/${bookingId}/notifications`, undefined, signal)).json(),
    gcTime: 0, staleTime: 0, retry: false,
    refetchInterval: query => !query.state.data || ["queued", "leased", "processing"].includes(query.state.data.notification.state ?? "") ? 5_000 : false,
  });
  const current = query.data?.notification ?? summary;
  const superseded = Boolean(summary.eventId && current.eventId && summary.eventId !== current.eventId);
  const key = query.isError ? "statusUnavailable" : superseded ? "automaticUnavailable" : current.state === "delivered" ? "automaticDelivered" : current.state === "accepted" || current.state === "sent" ? "automaticAccepted" : current.state === "unknown" ? "automaticUnknown" : ["queued", "leased", "processing", "scheduled"].includes(current.state ?? "") ? "automaticQueued" : "automaticUnavailable";
  return <p role="status" className="text-sm">{t(`notifications.${key}`)}{current.reasonCode && !query.isError ? ` ${t(`notifications.reasons.${current.reasonCode}`, { defaultValue: t("notifications.unavailable") })}` : ""}</p>;
}
