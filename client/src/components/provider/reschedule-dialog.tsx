import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { BookingWithDetails } from "@shared/schema";
import type { BookableSlot } from "@shared/scheduling";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import BookingTimePicker from "@/components/booking-time-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function RescheduleDialog({ booking, onClose }: { booking: BookingWithDetails; onClose: () => void }) {
  const [slot, setSlot] = useState<BookableSlot | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const change = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/bookings/${booking.id}/reschedule`, { scheduledDate: slot?.startsAt }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/bookings/provider"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/bookings/seeker"] });
      await queryClient.invalidateQueries({ predicate: query => String(query.queryKey[0]).startsWith("/api/availability/") });
      toast({ title: "Reservation rescheduled" }); onClose();
    },
    onError: () => toast({ title: "Unable to reschedule", description: "Choose an available future time and check your access level.", variant: "destructive" }),
  });
  return <Dialog open onOpenChange={open => { if (!open && !change.isPending) onClose(); }}>
    <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto p-4 sm:p-6" onEscapeKeyDown={event => { if (change.isPending) event.preventDefault(); }} onInteractOutside={event => { if (change.isPending) event.preventDefault(); }}>
      <DialogHeader><DialogTitle>Reschedule appointment</DialogTitle><DialogDescription>Choose a new available time for this reservation.</DialogDescription></DialogHeader>
      <BookingTimePicker serviceId={booking.serviceId} bookingId={booking.id} selected={slot} onSelect={setSlot} />
      <div className="flex justify-end gap-2"><Button variant="outline" disabled={change.isPending} onClick={onClose}>Cancel</Button><Button disabled={!slot || change.isPending} onClick={() => change.mutate()}>{change.isPending ? "Saving…" : "Save new time"}</Button></div>
    </DialogContent>
  </Dialog>;
}
