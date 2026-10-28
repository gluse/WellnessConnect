import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { BookingWithDetails } from "@shared/schema";
import type { BookableSlot } from "@shared/scheduling";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import BookingTimePicker from "@/components/booking-time-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function canCustomerChangeBooking(booking: BookingWithDetails, customerId: string) {
  return booking.seekerId === customerId && (booking.status === "pending" || booking.status === "confirmed") && new Date(booking.scheduledDate).getTime() > Date.now();
}

export default function CustomerBookingChange({ booking, action, onClose, onSuccess, restoreFocus }: {
  booking: BookingWithDetails; action: "cancel" | "reschedule"; onClose: () => void;
  onSuccess: (message: string) => void; restoreFocus: () => void;
}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [slot, setSlot] = useState<BookableSlot | null>(null);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const keep = useRef<HTMLButtonElement>(null);
  const cancel = action === "cancel";
  const stillCurrentCustomer = () => queryClient.getQueryData<{ id: string } | null>(["/api/auth/user"])?.id === booking.seekerId;
  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["/api/bookings/seeker"] }),
    queryClient.invalidateQueries({ queryKey: ["/api/bookings/provider"] }),
    queryClient.invalidateQueries({ predicate: query => String(query.queryKey[0]).startsWith("/api/availability/") }),
  ]);
  const change = useMutation({
    retry: false,
    mutationFn: async (): Promise<Partial<BookingWithDetails>> => (await apiRequest("PATCH", `/api/bookings/${booking.id}/${cancel ? "status" : "reschedule"}`, cancel ? { status: "cancelled" } : { scheduledDate: slot?.startsAt })).json(),
    onSuccess: async saved => {
      if (!stillCurrentCustomer()) return;
      if (saved.id === booking.id) {
        for (const key of ["/api/bookings/seeker", "/api/bookings/provider"]) {
          queryClient.setQueriesData<BookingWithDetails[]>({ queryKey: [key] }, current => current?.map(row => row.id === booking.id ? { ...row, ...saved } : row));
        }
      }
      await refresh();
      if (!stillCurrentCustomer()) return;
      onSuccess(t(cancel ? "bookingChanges.cancelled" : "bookingChanges.rescheduled")); onClose();
    },
    onError: async (cause: Error) => {
      if (!stillCurrentCustomer()) return;
      if (isUnauthorizedError(cause)) {
        queryClient.removeQueries({ queryKey: ["/api/bookings/seeker"] });
        queryClient.setQueryData(["/api/auth/user"], null);
        onClose(); return;
      }
      setError(cause.message.startsWith("403:") ? "bookingChanges.denied" : cause.message.startsWith("409:") ? "bookingChanges.conflict" : "bookingChanges.failed");
      if (cause.message.startsWith("409:")) { setSlot(null); await refresh(); }
    },
    onSettled: () => { submitting.current = false; },
  });
  const submit = () => {
    if (submitting.current || (!cancel && !slot)) return;
    submitting.current = true; setError(""); change.mutate();
  };
  return <Dialog open onOpenChange={open => { if (!open && !change.isPending) onClose(); }}>
    <DialogContent dir={i18n.dir()} closeLabel={t("common.close")} closeDisabled={change.isPending}
      className="max-w-[calc(100%-2rem)] sm:max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 sm:p-6"
      onOpenAutoFocus={event => { if (cancel) { event.preventDefault(); keep.current?.focus(); } }}
      onCloseAutoFocus={event => { event.preventDefault(); restoreFocus(); }}
      onEscapeKeyDown={event => { if (change.isPending) event.preventDefault(); }}
      onInteractOutside={event => { if (change.isPending) event.preventDefault(); }}>
      <DialogHeader className="text-start sm:text-start">
        <DialogTitle>{t(cancel ? "bookingChanges.cancelTitle" : "bookingChanges.rescheduleTitle")}</DialogTitle>
        <DialogDescription>{t(cancel ? "bookingChanges.cancelHelp" : "bookingChanges.rescheduleHelp", { service: booking.service.name })}</DialogDescription>
      </DialogHeader>
      {!cancel && <fieldset disabled={change.isPending} className="min-w-0"><BookingTimePicker serviceId={booking.serviceId} bookingId={booking.id} selected={slot} onSelect={setSlot} /></fieldset>}
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{t(error)}</p>}
      {change.isPending && <p role="status" className="text-sm">{t("bookingChanges.saving")}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button ref={keep} variant="outline" className="min-h-11 h-auto whitespace-normal" disabled={change.isPending} onClick={onClose}>{t(cancel ? "bookingChanges.keep" : "bookingChanges.dismiss")}</Button>
        <Button variant={cancel ? "destructive" : "default"} className="min-h-11 h-auto whitespace-normal" disabled={change.isPending || (!cancel && !slot)} onClick={submit}>{t(cancel ? "bookingChanges.confirmCancel" : "bookingChanges.saveTime")}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}
