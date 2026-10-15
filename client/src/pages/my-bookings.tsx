import { useEffect } from "react";
import { Redirect } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { BookingWithDetails } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import AppointmentAgenda from "@/components/appointment-agenda";
import BottomNavigation from "@/components/bottom-navigation";
import { Button } from "@/components/ui/button";

const signInUrl = "/login?returnTo=%2Fmy-bookings";

export default function MyBookings() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <main className="p-8 text-center" role="status">Loading your bookings…</main>;
  if (!isAuthenticated) return <Redirect to={signInUrl} />;
  return <CustomerBookings />;
}

function CustomerBookings() {
  const queryClient = useQueryClient();
  const bookings = useQuery<BookingWithDetails[]>({ queryKey: ["/api/bookings/seeker"] });
  useEffect(() => {
    if (isUnauthorizedError(bookings.error)) queryClient.setQueryData(["/api/auth/user"], null);
  }, [bookings.error, queryClient]);
  if (bookings.error && isUnauthorizedError(bookings.error)) return <Redirect to={signInUrl} />;

  return <div className="min-h-[calc(100dvh-4rem)] bg-neutral-50">
    <main className="max-w-7xl mx-auto p-4 sm:p-6 pb-24 lg:pb-6 space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">My Bookings</h1>
        <p className="mt-2 text-neutral-600">View your upcoming appointments and booking history.</p>
      </div>
      {bookings.isError ? <div role="alert" className="border rounded-xl bg-white p-6 space-y-3">
        <p>Unable to load your bookings. Please try again.</p>
        <Button variant="outline" disabled={bookings.isFetching} onClick={() => void bookings.refetch()}>
          {bookings.isFetching ? "Retrying…" : "Try again"}
        </Button>
      </div> : <AppointmentAgenda bookings={bookings.data ?? []} loading={bookings.isLoading} />}
    </main>
    <div className="lg:hidden"><BottomNavigation /></div>
  </div>;
}
