import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Redirect } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { BookingWithDetails } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import AppointmentAgenda from "@/components/appointment-agenda";
import BottomNavigation from "@/components/bottom-navigation";
import { Button } from "@/components/ui/button";
import PendingReviews from "@/components/booking-review";
import CustomerBookingChange, { canCustomerChangeBooking } from "@/components/customer-booking-change";

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
  const trigger = useRef<HTMLButtonElement | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const queryClient = useQueryClient();
  const bookings = useQuery<BookingWithDetails[]>({ queryKey: ["/api/bookings/seeker"], refetchInterval: 30_000, refetchOnWindowFocus: "always" });
  const customerBookings = (bookings.data ?? []).filter(booking => booking.seekerId === user?.id);
  useEffect(() => {
    if (isUnauthorizedError(bookings.error)) queryClient.setQueryData(["/api/auth/user"], null);
  }, [bookings.error, queryClient]);
  if (bookings.error && isUnauthorizedError(bookings.error)) return <Redirect to={signInUrl} />;

  return <div className="min-h-[calc(100dvh-4rem)] bg-neutral-50">
    <main className="max-w-7xl mx-auto p-4 sm:p-6 pb-24 lg:pb-6 space-y-5">
      <div>
        <h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold">My Bookings</h1>
        <p className="mt-2 text-neutral-600">View your upcoming appointments and booking history.</p>
      </div>
      {message && <p role="status" className="rounded-lg border bg-white p-3">{message}</p>}
      {bookings.isError ? <div role="alert" className="border rounded-xl bg-white p-6 space-y-3">
        <p>Unable to load your bookings. Please try again.</p>
        <Button variant="outline" disabled={bookings.isFetching} onClick={() => void bookings.refetch()}>
          {bookings.isFetching ? "Retrying…" : "Try again"}
        </Button>
      </div> : null}
      {(!bookings.isError || bookings.data) && <>
        <PendingReviews bookings={customerBookings} />
        <AppointmentAgenda bookings={customerBookings} loading={bookings.isLoading} renderCustomerActions={booking => user && canCustomerChangeBooking(booking, user.id) && <div className="flex flex-wrap gap-2">
          {(["reschedule", "cancel"] as const).map(action => <Button key={action} variant="outline" className="min-h-11 h-auto whitespace-normal" onClick={event => {
            trigger.current = event.currentTarget; trigger.current.focus(); setMessage(""); setChange({ booking, action });
          }}>{t(action === "cancel" ? "bookingChanges.cancel" : "bookingChanges.reschedule")}</Button>)}
        </div>} />
      </>}
    </main>
    {change && <CustomerBookingChange key={`${user?.id}-${change.booking.id}-${change.action}`} {...change} onClose={() => setChange(null)} onSuccess={setMessage} restoreFocus={() => {
      if (trigger.current?.isConnected) trigger.current.focus(); else heading.current?.focus();
    }} />}
    <div className="lg:hidden"><BottomNavigation /></div>
  </div>;
}
