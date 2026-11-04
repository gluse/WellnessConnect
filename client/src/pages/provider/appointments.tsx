import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Booking, BookingWithDetails } from "@shared/schema";
import type { NotificationSummary } from "@shared/notifications";
import { useProviderBookings, useProviderEmployees, useProviderWorkspace, WORKSPACE_CHANGE_KEY } from "@/hooks/use-provider-workspace";
import { useAuth } from "@/hooks/useAuth";
import { useNotificationCapabilities } from "@/hooks/use-notification-capabilities";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useToast } from "@/hooks/use-toast";
import AppointmentAgenda from "@/components/appointment-agenda";
import RescheduleDialog from "@/components/provider/reschedule-dialog";
import NotificationDialog, { type NotificationDialogRequest } from "@/components/provider/notification-dialog";
import AppointmentReminder from "@/components/provider/appointment-reminder";
import NotificationFeedback from "@/components/provider/notification-feedback";
import type { EventAction } from "@shared/appointment-collaboration";
import { BookingConversationDialog, BookingRescheduleRequests, EventActionDialog, EventRescheduleOutcomes } from "@/components/booking-collaboration";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type UpdatedBooking = Booking & { notification?: NotificationSummary };

type AppointmentView = "calendar" | "upcoming" | "past";
export default function AppointmentsPage({ view = "calendar" }: { view?: AppointmentView }) {
  const { data: context } = useProviderWorkspace();
  const { user } = useAuth();
  const switching = useIsMutating({ mutationKey: WORKSPACE_CHANGE_KEY }) > 0;
  const scope = JSON.stringify([user?.id ?? "", context?.company?.id ?? "personal", context?.permissions, context?.membership]);
  if (!user || switching) return null;
  return <AppointmentsContent key={`${scope}:${view}`} scope={scope} view={view} />;
}
function AppointmentsContent({ scope, view }: { scope: string; view: AppointmentView }) {
  const { data: context } = useProviderWorkspace();
  const { t } = useTranslation();
  const capabilities = useNotificationCapabilities();
  const bookings = useProviderBookings(scope);
  const employees = useProviderEmployees();
  const [rescheduling, setRescheduling] = useState<BookingWithDetails | null>(null);
  const [conversation, setConversation] = useState<BookingWithDetails | null>(null);
  const [eventAction, setEventAction] = useState<{ booking: BookingWithDetails; action: EventAction } | null>(null);
  const [cancelling, setCancelling] = useState<BookingWithDetails | null>(null);
  const [notification, setNotification] = useState<NotificationDialogRequest | null>(null);
  const [automatic, setAutomatic] = useState<{ bookingId: number; summary: NotificationSummary } | null>(null);
  const content = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const triggerLabel = useRef<string | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const changed = (booking: UpdatedBooking) => {
    if (!alive.current) return;
    const summary = booking.notification;
    if (summary?.mode === "manual" && summary.eventId) setNotification({ bookingId: booking.id, kind: "status", eventId: summary.eventId, trigger: trigger.current, triggerLabel: triggerLabel.current });
    if (summary?.mode === "automatic") setAutomatic({ bookingId: booking.id, summary });
    void queryClient.invalidateQueries({ predicate: query => /^\/api\/bookings\/\d+\/notifications$/.test(String(query.queryKey[0])) });
  };
  const update = useMutation({
    mutationFn: async ({ bookingId, status }: { bookingId: number; status: "confirmed" | "cancelled" | "completed" }): Promise<UpdatedBooking> =>
      (await apiRequest("PATCH", `/api/bookings/${bookingId}/status`, { status, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })).json(),
    onSuccess: async (updatedBooking, { status }) => {
      if (!alive.current) return;
      changed(updatedBooking);
      queryClient.setQueriesData<BookingWithDetails[]>({ queryKey: ["/api/bookings/provider"] }, current => current?.map(booking => booking.id === updatedBooking.id ? { ...booking, ...updatedBooking } : booking));
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["/api/bookings/provider"] }), queryClient.invalidateQueries({ queryKey: ["/api/bookings/seeker"] })]);
      toast({ title: status === "completed" ? "Booking Completed" : "Booking Updated", description: status === "completed" ? "The appointment has been marked complete." : "Booking status has been updated" });
    },
    onError: error => {
      if (isUnauthorizedError(error)) {
        const path = view === "calendar" ? "/my-services/appointments" : view === "upcoming" ? "/my-services/upcoming-appointments" : "/my-services/past-appointments";
        window.location.assign(`/login?returnTo=${encodeURIComponent(path)}`); return;
      }
      toast({ title: "Error", description: "Failed to update booking", variant: "destructive" });
    },
  });
  const canManage = context?.permissions.manageBookings ?? false;
  const rememberTrigger = (element?: HTMLElement) => { trigger.current = element ?? document.activeElement as HTMLElement | null; triggerLabel.current = trigger.current?.textContent ?? null; };
  const restoreFocus = () => { if (trigger.current?.isConnected && !trigger.current.matches(":disabled")) trigger.current.focus(); else content.current?.focus(); };
  return <div ref={content} tabIndex={-1} aria-label={t(view === "calendar" ? "notifications.appointments" : view === "upcoming" ? "providerNavigation.upcomingAppointments" : "providerNavigation.pastAppointments")} className="space-y-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
    {view !== "calendar" && <h1 className="text-2xl font-semibold">{t(view === "upcoming" ? "providerNavigation.upcomingAppointments" : "providerNavigation.pastAppointments")}</h1>}
    {capabilities.data?.hasPro === false && <div className="rounded-xl border bg-white p-3 text-sm">{t("notifications.proBanner")} <Link href="/my-services/settings/billing" className="underline inline-block py-2">{t("notifications.subscription")}</Link></div>}
    {capabilities.isError && <p role="status">{t("notifications.capabilityError")}</p>}
    {automatic && <NotificationFeedback key={`${automatic.bookingId}:${automatic.summary.eventId ?? "latest"}`} bookingId={automatic.bookingId} summary={automatic.summary} scope={scope} />}
    {bookings.isError ? <p role="alert">Unable to load appointments. Please refresh to try again.</p> : <>
      <AppointmentAgenda fixedView={view} bookings={bookings.data ?? []} employees={employees.data ?? []} provider loading={bookings.isLoading} updating={update.isPending}
        onStatusChange={canManage ? (bookingId, status, element) => { if (!update.isPending) { rememberTrigger(element); setAutomatic(null); if (status === "cancelled") setCancelling(bookings.data?.find(row => row.id === bookingId) ?? null); else update.mutate({ bookingId, status }); } } : undefined}
        onReschedule={canManage ? (booking, element) => { rememberTrigger(element); setAutomatic(null); setRescheduling(booking); } : undefined}
        onMessage={(booking, element) => { rememberTrigger(element); setConversation(booking); }}
        onEventAction={canManage ? (booking, action, element) => { rememberTrigger(element); setEventAction({ booking, action }); } : undefined}
        renderBookingDetails={canManage ? booking => <BookingRescheduleRequests booking={booking} scope={scope} /> : undefined}
        renderEventDetails={canManage ? booking => <EventRescheduleOutcomes booking={booking} scope={scope} bookings={bookings.data ?? []} /> : undefined}
        renderProviderNotifications={booking => <AppointmentReminder booking={booking} scope={scope} pro={capabilities.isError ? undefined : capabilities.data?.hasPro} canManage={canManage} onManual={element => setNotification({ bookingId: booking.id, kind: "reminder", trigger: element, triggerLabel: element.textContent })} />} />
    </>}
    {rescheduling && canManage && <RescheduleDialog booking={rescheduling} onClose={() => setRescheduling(null)} restoreFocus={restoreFocus} />}
    {conversation && <BookingConversationDialog viewer="provider" canSend={canManage} key={conversation.id} booking={conversation} scope={scope} onClose={() => setConversation(null)} restoreFocus={restoreFocus} />}
    {eventAction && canManage && <EventActionDialog key={`${eventAction.booking.id}:${eventAction.action}`} {...eventAction} scope={scope} onClose={() => setEventAction(null)} restoreFocus={restoreFocus} />}
    {cancelling && canManage && <Dialog open onOpenChange={open => { if (!open && !update.isPending) setCancelling(null); }}><DialogContent closeDisabled={update.isPending} onCloseAutoFocus={event => { event.preventDefault(); requestAnimationFrame(restoreFocus); }}><DialogHeader><DialogTitle>{t("appointmentCollaboration.cancelBooking")}</DialogTitle><DialogDescription>{t("appointmentCollaboration.cancelWarning")}</DialogDescription></DialogHeader><p>{cancelling.service.name} · {[cancelling.seeker.firstName, cancelling.seeker.lastName].filter(Boolean).join(" ")}</p><div className="flex gap-2 flex-wrap justify-end"><Button variant="outline" disabled={update.isPending} onClick={() => setCancelling(null)}>{t("appointmentCollaboration.cancel")}</Button><Button variant="destructive" disabled={update.isPending} onClick={() => { update.mutate({ bookingId: cancelling.id, status: "cancelled" }, { onSuccess: () => setCancelling(null) }); }}>{t("appointmentCollaboration.confirmCancel")}</Button></div></DialogContent></Dialog>}
    {notification && canManage && <NotificationDialog request={notification} scope={scope} onClose={() => setNotification(null)} fallbackFocus={() => content.current?.focus()} />}
  </div>;
}
