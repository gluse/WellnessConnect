import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Booking, BookingWithDetails } from "@shared/schema";
import { useProviderBookings, useProviderEmployees, useProviderWorkspace } from "@/hooks/use-provider-workspace";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useToast } from "@/hooks/use-toast";
import AppointmentAgenda from "@/components/appointment-agenda";
import AppointmentStats from "@/components/provider/appointment-stats";
import RescheduleDialog from "@/components/provider/reschedule-dialog";

export default function AppointmentsPage() {
  const { data: context } = useProviderWorkspace();
  const bookings = useProviderBookings();
  const employees = useProviderEmployees();
  const [rescheduling, setRescheduling] = useState<BookingWithDetails | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const update = useMutation({
    mutationFn: async ({ bookingId, status }: { bookingId: number; status: "confirmed" | "cancelled" | "completed" }): Promise<Booking> =>
      (await apiRequest("PATCH", `/api/bookings/${bookingId}/status`, { status })).json(),
    onSuccess: async (updatedBooking, { status }) => {
      queryClient.setQueryData<BookingWithDetails[]>(["/api/bookings/provider"], current => current?.map(booking => booking.id === updatedBooking.id ? { ...booking, ...updatedBooking } : booking));
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["/api/bookings/provider"] }), queryClient.invalidateQueries({ queryKey: ["/api/bookings/seeker"] })]);
      toast({ title: status === "completed" ? "Booking Completed" : "Booking Updated", description: status === "completed" ? "The appointment has been marked complete." : "Booking status has been updated" });
    },
    onError: error => {
      if (isUnauthorizedError(error)) { window.location.assign("/login?returnTo=%2Fmy-services%2Fappointments"); return; }
      toast({ title: "Error", description: "Failed to update booking", variant: "destructive" });
    },
  });
  const canManage = context?.permissions.manageBookings ?? false;
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-semibold">Appointments</h1><p className="text-neutral-600 mt-1">Manage your upcoming and past reservations.</p></div>
    {bookings.isError ? <p role="alert">Unable to load appointments. Please refresh to try again.</p> : <>
      {!bookings.isLoading && <AppointmentStats bookings={bookings.data ?? []} />}
      <AppointmentAgenda bookings={bookings.data ?? []} employees={employees.data ?? []} provider loading={bookings.isLoading} updating={update.isPending}
        onStatusChange={canManage ? (bookingId, status) => { if (!update.isPending) update.mutate({ bookingId, status }); } : undefined}
        onReschedule={canManage ? setRescheduling : undefined} />
    </>}
    {rescheduling && canManage && <RescheduleDialog booking={rescheduling} onClose={() => setRescheduling(null)} />}
  </div>;
}
