import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Redirect } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import type { BookingWithDetails } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import AppointmentAgenda from "@/components/appointment-agenda";
import { Button } from "@/components/ui/button";
import PendingReviews from "@/components/booking-review";
import CustomerBookingChange, { canCustomerChangeBooking } from "@/components/customer-booking-change";
import { BookingConversationDialog, BookingRescheduleRequests } from "@/components/booking-collaboration";

const signInUrl = "/login?returnTo=%2Fmy-bookings";

export default function MyBookings() {
  const { user, isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <main className="p-8 text-center" role="status">Loading your bookings…</main>;
  if (!isAuthenticated) return <Redirect to={signInUrl} />;
  return <CustomerBookings key={user?.id} />;
}

function CustomerBookings() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [change, setChange] = useState<{ booking: BookingWithDetails; action: "cancel" | "reschedule" } | null>(null);
  const [message, setMessage] = useState("");
  const [conversation, setConversation] = useState<BookingWithDetails | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const queryClient = useQueryClient();
  const bookings = useQuery<BookingWithDetails[]>({ queryKey: ["/api/bookings/seeker"], refetchInterval: 30_000, refetchOnWindowFocus: "always" });
  const customerBookings = (bookings.data ?? []).filter(booking => booking.seekerId === user?.id);
  useEffect(() => {
    if (isUnauthorizedError(bookings.error)) queryClient.setQueryData(["/api/auth/user"], null);
  }, [bookings.error, queryClient]);
  if (bookings.error && isUnauthorizedError(bookings.error)) return <Redirect to={signInUrl} />;

  return <div className="min-h-[calc(100dvh-4rem)] bg-[#EAF7F3]" data-appointment-area="customer">
    <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-3">
      <h1 ref={heading} tabIndex={-1} className="sr-only">{t("notifications.appointments")}</h1>
      {message && <p role="status" className="rounded-lg border bg-white p-3">{message}</p>}
      {bookings.isError ? <div role="alert" className="border rounded-xl bg-white p-6 space-y-3">
        <p>Unable to load your bookings. Please try again.</p>
        <Button variant="outline" disabled={bookings.isFetching} onClick={() => void bookings.refetch()}>
          {bookings.isFetching ? "Retrying…" : "Try again"}
        </Button>
      </div> : null}
      {(!bookings.isError || bookings.data) && <>
        <PendingReviews bookings={customerBookings} />
        <AppointmentAgenda bookings={customerBookings} loading={bookings.isLoading} renderBookingDetails={booking => <BookingRescheduleRequests booking={booking} scope={`customer:${user?.id}`} />} renderCustomerActions={booking => <div className="flex items-stretch gap-1.5 sm:gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800" aria-label={t("appointmentCollaboration.messageProvider")} title={t("appointmentCollaboration.messageProvider")} onClick={event => { trigger.current = event.currentTarget; setConversation(booking); }}><MessageSquare aria-hidden="true" /></Button>
          {user && canCustomerChangeBooking(booking, user.id) && (["reschedule", "cancel"] as const).map(action => <Button key={action} variant="outline" size="sm" className={`min-h-9 h-auto min-w-0 whitespace-normal px-2 py-1.5 text-xs leading-tight sm:px-3 sm:text-sm ${action === "cancel" ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800" : "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800"}`} onClick={event => {
            trigger.current = event.currentTarget; trigger.current.focus(); setMessage(""); setChange({ booking, action });
          }}>{t(action === "cancel" ? "bookingChanges.cancel" : "bookingChanges.reschedule")}</Button>)}
        </div>} />
      </>}
    </main>
    {change && <CustomerBookingChange key={`${user?.id}-${change.booking.id}-${change.action}`} {...change} onClose={() => setChange(null)} onSuccess={setMessage} restoreFocus={() => {
      if (trigger.current?.isConnected) trigger.current.focus(); else heading.current?.focus();
    }} />}
    {conversation && <BookingConversationDialog viewer="customer" key={conversation.id} booking={conversation} scope={`customer:${user?.id}`} onClose={() => setConversation(null)} restoreFocus={() => { if (trigger.current?.isConnected) trigger.current.focus(); else heading.current?.focus(); }} />}
  </div>;
}
