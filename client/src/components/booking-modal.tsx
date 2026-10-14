import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, MapPin } from "lucide-react";
import type { ServiceWithProvider } from "@shared/schema";
import type { BookableSlot } from "@shared/scheduling";
import { getProviderName } from "@shared/provider";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useToast } from "@/hooks/use-toast";
import BookingTimePicker from "@/components/booking-time-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function BookingModal({ service, onClose }: { service: ServiceWithProvider; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedSlot, setSelectedSlot] = useState<BookableSlot | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [participantCount, setParticipantCount] = useState(1);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const total = Number(service.price) * participantCount;
  const advance = total * (service.advancePaymentPercent ?? 0) / 100;
  const booking = useMutation({
    mutationFn: async () => {
      if (!selectedSlot) throw new Error("Choose a time first.");
      return (await apiRequest("POST", "/api/bookings", { serviceId: service.id, scheduledDate: selectedSlot.startsAt, participantCount, notes: notes.trim() || null })).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/seeker"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/provider"] });
      queryClient.invalidateQueries({ predicate: query => String(query.queryKey[0]).startsWith("/api/availability/") });
      toast({ title: service.instantBooking ? "Booking confirmed" : "Booking request sent", description: "You can find it in your appointments." });
      onClose();
    },
    onError: error => {
      if (isUnauthorizedError(error)) { window.location.assign("/login"); return; }
      let message = "Unable to book. Please try again.";
      try { message = JSON.parse(error.message.replace(/^\d+:\s*/, "")).message || message; } catch {}
      setError(message);
      if (error.message.startsWith("409:")) {
        setSelectedSlot(null); setReviewing(false);
        queryClient.invalidateQueries({ predicate: query => String(query.queryKey[0]).startsWith("/api/availability/") });
      }
    },
  });
  return <Dialog open onOpenChange={open => { if (!open && !booking.isPending) onClose(); }}>
    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0" onEscapeKeyDown={event => { if (booking.isPending) event.preventDefault(); }} onInteractOutside={event => { if (booking.isPending) event.preventDefault(); }}>
      <div className="grid md:grid-cols-[240px_1fr]">
        <aside className="p-6 md:border-r bg-neutral-50 rounded-t-lg md:rounded-l-lg md:rounded-tr-none space-y-4">
          <DialogHeader><DialogDescription>{getProviderName(service.provider)}</DialogDescription><DialogTitle className="text-xl">{service.name}</DialogTitle></DialogHeader>
          {service.employee?.name && <p className="text-sm text-neutral-600">With {service.employee.name}</p>}
          <p className="flex items-center gap-2 text-sm"><Clock className="w-4 h-4" />{service.duration} minutes</p>
          {service.address && <p className="flex items-start gap-2 text-sm"><MapPin className="w-4 h-4 shrink-0 mt-0.5" />{service.address}</p>}
          <p className="font-semibold">${Number(service.price).toFixed(2)}{service.serviceType === "group" ? " per participant" : ""}</p>
          <p className="text-xs text-neutral-500">{service.instantBooking ? "Your chosen time is confirmed when you book." : "The provider will confirm your request."}</p>
          <p className="text-sm text-neutral-500">{reviewing ? "2. Review & book" : "1. Choose a time"}</p>
        </aside>
        <div className="p-6 space-y-5">
          {!reviewing ? <BookingTimePicker serviceId={service.id} selected={selectedSlot} onSelect={setSelectedSlot} /> : selectedSlot && <>
            <h3 className="text-lg font-semibold">Review your appointment</h3>
            <p className="rounded-lg bg-primary/5 p-4 text-sm">{new Date(selectedSlot.startsAt).toLocaleDateString(undefined, { timeZone: selectedSlot.timezone, weekday: "long", day: "numeric", month: "long", year: "numeric" })}<br />{selectedSlot.startTime}–{selectedSlot.endTime} · {selectedSlot.timezone}</p>
            {service.serviceType === "group" && <div><Label htmlFor="booking-participants">Participants</Label><Input id="booking-participants" type="number" min={1} max={service.maxCapacity ?? 1} value={participantCount} onChange={event => setParticipantCount(Number(event.target.value))} /></div>}
            <div><Label htmlFor="booking-notes">Anything the provider should know? (optional)</Label><Textarea id="booking-notes" maxLength={2000} value={notes} onChange={event => setNotes(event.target.value)} /></div>
            <div className="flex justify-between font-medium"><span>Total</span><span>${total.toFixed(2)}</span></div>
            {advance > 0 && <p className="text-sm text-neutral-600">Provider requires an advance payment of ${advance.toFixed(2)}. Payment collection is not available in this booking form.</p>}
          </>}
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" disabled={booking.isPending} onClick={() => reviewing ? setReviewing(false) : onClose()}>{reviewing ? "Back" : "Cancel"}</Button>
            {!reviewing ? <Button disabled={!selectedSlot} onClick={() => { setError(""); setReviewing(true); }}>Continue</Button> : <Button disabled={booking.isPending || !selectedSlot || !Number.isInteger(participantCount) || participantCount < 1 || participantCount > (service.serviceType === "group" ? service.maxCapacity ?? 1 : 1)} onClick={() => { setError(""); booking.mutate(); }}>{booking.isPending ? "Booking…" : service.instantBooking ? "Confirm booking" : "Request booking"}</Button>}
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}
