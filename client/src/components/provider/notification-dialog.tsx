import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { ManualNotificationPreview } from "@shared/notifications";
import { apiRequest } from "@/lib/queryClient";
import { safeNotificationHref } from "@/lib/notification-links";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export type NotificationDialogRequest = { bookingId: number; kind: "status" | "reminder"; eventId?: string; trigger: HTMLElement | null; triggerLabel?: string | null };
export default function NotificationDialog({ request, scope, onClose, fallbackFocus }: { request: NotificationDialogRequest; scope: string; onClose: () => void; fallbackFocus: () => void }) {
  const { t, i18n } = useTranslation();
  const preview = useQuery<ManualNotificationPreview>({
    queryKey: ["notification-preview", scope, request.bookingId, request.kind, request.eventId],
    queryFn: async ({ signal }) => (await apiRequest("POST", `/api/bookings/${request.bookingId}/notification-preview`, { kind: request.kind, eventId: request.eventId, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }, signal)).json(),
    staleTime: 0, gcTime: 0, retry: false,
  });
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent dir={i18n.dir()} closeLabel={t("notifications.done")} className="max-w-[calc(100%-2rem)] sm:max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl break-words motion-reduce:animate-none [&>button:last-child]:h-8 [&>button:last-child]:w-8 [&>button:last-child]:inline-flex [&>button:last-child]:items-center [&>button:last-child]:justify-center"
      onCloseAutoFocus={event => {
        event.preventDefault();
        // Restore after the modal focus scope releases the background. WebKit
        // otherwise leaves focus on body when an action removed its trigger.
        requestAnimationFrame(() => {
          if (request.trigger?.isConnected && !request.trigger.matches(":disabled") && (!request.triggerLabel || request.trigger.textContent === request.triggerLabel)) request.trigger.focus();
          else fallbackFocus();
        });
      }}>
      <DialogHeader className="text-start sm:text-start"><DialogTitle>{t(request.kind === "reminder" ? "notifications.sendReminder" : "notifications.notify")}</DialogTitle><DialogDescription>{t("notifications.composerHelp")}</DialogDescription></DialogHeader>
      {preview.isPending && <p role="status">{t("notifications.loading")}</p>}
      {preview.isError && <div role="alert"><p>{t("notifications.loadError")}</p><Button variant="outline" onClick={() => void preview.refetch()}>{t("notifications.retry")}</Button></div>}
      {preview.data && !preview.isError && <><p className="font-medium"><bdi>{preview.data.customerName}</bdi></p><p className="whitespace-pre-wrap rounded-lg bg-muted p-3" dir="auto">{preview.data.message}</p>
        <div className="grid gap-3">{(["sms", "email", "whatsapp"] as const).map(method => {
          const channel = preview.data.channels[method], href = safeNotificationHref(method, channel.href);
          return <div key={method} className="space-y-1">{href ? <Button asChild variant="outline" className="w-full h-auto min-h-11 whitespace-normal py-3"><a href={href} {...(method === "whatsapp" ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{t(`notifications.send.${method}`)}</a></Button>
            : <><Button variant="outline" disabled className="w-full h-auto min-h-11 whitespace-normal py-3" aria-describedby={`notification-${method}-reason`}>{t(`notifications.send.${method}`)}</Button><p id={`notification-${method}-reason`} className="text-sm text-muted-foreground">{t(`notifications.reasons.${channel.reasonCode}`, { defaultValue: t("notifications.unavailable") })}</p></>}</div>;
        })}</div></>}
      <Button className="min-h-11 h-auto whitespace-normal" onClick={onClose}>{t("notifications.done")}</Button>
    </DialogContent>
  </Dialog>;
}
