import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { BookingWithDetails } from "@shared/schema";
import type { BookingNotificationState } from "@shared/notifications";
import { apiRequest } from "@/lib/queryClient";
import { formatDateTime24 } from "@/lib/date-time";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function AppointmentReminder({ booking, scope, pro, canManage, onManual }: { booking: BookingWithDetails; scope: string; pro: boolean | undefined; canManage: boolean; onManual: (trigger: HTMLElement) => void }) {
  const { t, i18n } = useTranslation();
  const eligible = booking.status === "confirmed" && new Date(booking.scheduledDate).getTime() > Date.now();
  const state = useQuery<BookingNotificationState>({
    queryKey: [`/api/bookings/${booking.id}/notifications`, scope],
    queryFn: async ({ signal }) => (await apiRequest("GET", `/api/bookings/${booking.id}/notifications`, undefined, signal)).json(),
    enabled: canManage && eligible, gcTime: 0, staleTime: 0, retry: false, refetchInterval: 60_000,
  });
  if (!eligible || !canManage) return null;
  const reminder = state.data?.reminder;
  const automationConfigured = booking.service.reminderEnabled;
  const automatic = pro === true && automationConfigured;
  const manual = pro === false || (pro === true && automationConfigured === false);
  return <div className="space-y-2" aria-live="polite">
    {automatic && <Badge variant="outline" className="whitespace-normal break-words">{t("notifications.automaticReminders")}</Badge>}
    {automationConfigured && reminder && reminder.state !== "off" && <div className="space-y-1"><p className="text-xs text-muted-foreground">{t(`notifications.reminderState.${reminder.state}`)}</p>
      {reminder.dueAt && <p className="text-xs text-muted-foreground">{formatDateTime24(reminder.dueAt, i18n.language, { dateStyle: "medium", timeStyle: "short" })} ({Intl.DateTimeFormat().resolvedOptions().timeZone}){reminder.channel ? ` · ${t(`notifications.method.${reminder.channel}`)}` : ""}</p>}
      {reminder.reasonCode && <p className="text-xs text-muted-foreground">{t(`notifications.reasons.${reminder.reasonCode}`, { defaultValue: t("notifications.unavailable") })}</p>}
    </div>}
    {automationConfigured && state.isError && <p className="text-sm" role="status">{t("notifications.statusUnavailable")}</p>}
    {manual && <Button type="button" size="sm" variant="outline" className="min-h-11 h-auto whitespace-normal" onClick={event => onManual(event.currentTarget)}>{t("notifications.sendReminder")}</Button>}
  </div>;
}
