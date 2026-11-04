import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, MapPin } from "lucide-react";
import type { Booking, ServiceWithProvider } from "@shared/schema";
import type { BookableSlot } from "@shared/scheduling";
import { getProviderName } from "@shared/provider";
import { currentLocation } from "@shared/locations";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useToast } from "@/hooks/use-toast";
import BookingTimePicker from "@/components/booking-time-picker";
import { serviceAmount, useFormLocale } from "./forms-locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const actionClass = "min-h-11 h-auto whitespace-normal py-3";
export function BookingSignInActions({ isLoading, onClose, returnTo = "/search" }: { isLoading: boolean; onClose: () => void; returnTo?: string }) {
  const { t } = useTranslation();
  return <div className="space-y-4">
    {isLoading ? <p role="status">{t("guestSearch.checkingAccount")}</p> : <>
      <p>{t("guestSearch.bookingNote")}</p>
      <Button asChild className={actionClass}><Link href={`/login?returnTo=${encodeURIComponent(returnTo)}`}>{t("guestSearch.signInOrCreate")}</Link></Button>
    </>}
    <Button variant="outline" className={actionClass} onClick={onClose}>{t("guestSearch.continueBrowsing")}</Button>
  </div>;
}
export default function BookingModal({ service, onClose, returnTo = "/search" }: { service: ServiceWithProvider; onClose: () => void; returnTo?: string }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { t, i18n } = useFormLocale();
  const trigger = useRef(typeof document !== "undefined" ? document.activeElement as HTMLElement | null : null);
  const restoreFocus = () => { if (trigger.current?.isConnected) trigger.current.focus(); };
  if (isAuthenticated && user) return <AuthenticatedBooking key={`${user.id}-${service.id}`} userId={user.id} service={service} onClose={onClose} returnTo={returnTo} restoreFocus={restoreFocus} />;
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent dir={i18n.dir()} closeLabel={t("common.close")} className="phase2-form max-w-[calc(100%-2rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg" data-testid="dialog-booking-sign-in" onCloseAutoFocus={event => { event.preventDefault(); restoreFocus(); }}>
      <DialogHeader className="text-start sm:text-start"><DialogTitle>{t("guestSearch.signInToBook")}</DialogTitle><DialogDescription><bdi>{service.name}</bdi></DialogDescription></DialogHeader>
      <BookingSignInActions isLoading={isLoading} onClose={onClose} returnTo={returnTo} />
    </DialogContent>
  </Dialog>;
}
function AuthenticatedBooking({ userId, service, onClose, returnTo, restoreFocus }: { userId: string; service: ServiceWithProvider; onClose: () => void; returnTo: string; restoreFocus: () => void }) {
  service = currentLocation(service);
  const { t, i18n, language } = useFormLocale();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedSlot, setSelectedSlot] = useState<BookableSlot | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [participantCount, setParticipantCount] = useState(1);
  const [participantTouched, setParticipantTouched] = useState(false);
  const [initialMessage, setInitialMessage] = useState("");
  const [error, setError] = useState("");
  const [succeeded, setSucceeded] = useState(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const participants = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  const submitButton = useRef<HTMLButtonElement>(null);
  const duplicateCheck = useRef<AbortController | null>(null);
  useEffect(() => () => duplicateCheck.current?.abort(), []);
  const serviceMaximum = service.serviceType === "group" ? service.maxCapacity ?? 1 : 1;
  const maximum = service.serviceType === "group" ? Math.min(serviceMaximum, selectedSlot?.availableCapacity ?? serviceMaximum) : 1;
  const participantValid = Number.isInteger(participantCount) && participantCount >= 1 && participantCount <= maximum;
  const total = Number(service.price) * participantCount;
  const advance = total * (service.advancePaymentPercent ?? 0) / 100;
  const amount = (value: number) => serviceAmount(value, language);
  const appointmentDate = selectedSlot ? new Intl.DateTimeFormat(language, { timeZone: selectedSlot.timezone, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(selectedSlot.startsAt)) : "";
  useEffect(() => {
    content.current?.scrollTo({ top: 0 });
    heading.current?.focus({ preventScroll: true });
    if (heading.current && content.current && heading.current.getBoundingClientRect().bottom > content.current.getBoundingClientRect().bottom) heading.current.scrollIntoView({ block: "nearest" });
  }, [reviewing, succeeded]);
  const booking = useMutation({
    retry: false,
    mutationFn: async () => {
      if (!selectedSlot) throw new Error("No selected appointment");
      return (await apiRequest("POST", "/api/bookings", { serviceId: service.id, scheduledDate: selectedSlot.startsAt, participantCount, initialMessage: initialMessage.trim() || null })).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/seeker"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/provider"] });
      queryClient.invalidateQueries({ predicate: query => String(query.queryKey[0]).startsWith("/api/availability/") });
      toast({ title: t(service.instantBooking ? "bookingForm.confirmed" : "bookingForm.requestSent"), description: t("bookingForm.successHelp") });
      setInitialMessage(""); setSucceeded(true);
    },
    onError: error => {
      if (isUnauthorizedError(error)) { window.location.assign(`/login?returnTo=${encodeURIComponent(returnTo)}`); return; }
      setError(error.message.startsWith("409:") ? "bookingForm.conflict" : error.message.startsWith("403:") ? "bookingForm.denied" : "bookingForm.saveError");
      if (error.message.startsWith("409:")) {
        setSelectedSlot(null); setReviewing(false);
        queryClient.invalidateQueries({ predicate: query => String(query.queryKey[0]).startsWith("/api/availability/") });
      }
    },
    onSettled: () => { submitting.current = false; },
  });
  const submit = async (duplicateApproved = false) => {
    if (submitting.current || succeeded) return;
    setError(""); setParticipantTouched(true);
    if (!participantValid) { participants.current?.focus(); return; }
    if (!selectedSlot) { setError("bookingForm.chooseTimeFirst"); setReviewing(false); return; }
    submitting.current = true;
    if (service.serviceType === "group" && !duplicateApproved) {
      const controller = new AbortController();
      duplicateCheck.current = controller;
      setCheckingDuplicates(true);
      try {
        const response = await fetch("/api/bookings/seeker", { credentials: "include", signal: controller.signal });
        if (!response.ok) throw new Error(`${response.status}: Booking check failed`);
        const existing: Booking[] = await response.json();
        if (!Array.isArray(existing)) throw new Error("Invalid booking response");
        if (controller.signal.aborted) return;
        if (existing.some(item => item.seekerId === userId && item.serviceId === service.id
          && ["pending", "confirmed", "completed"].includes(item.status ?? "")
          && new Date(item.scheduledDate).getTime() === new Date(selectedSlot.startsAt).getTime())) {
          setDuplicateWarning(true);
          submitting.current = false;
          return;
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        if (isUnauthorizedError(error as Error)) window.location.assign(`/login?returnTo=${encodeURIComponent(returnTo)}`);
        else setError("bookingForm.duplicateCheckError");
        submitting.current = false;
        return;
      } finally {
        if (!controller.signal.aborted) setCheckingDuplicates(false);
      }
    }
    booking.mutate();
  };
  const busy = booking.isPending || checkingDuplicates;
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent ref={content} dir={i18n.dir()} closeLabel={t("common.close")} closeDisabled={busy}
      className="phase2-form max-w-[calc(100%-2rem)] md:max-w-4xl max-h-[calc(100dvh-2rem)] overflow-y-auto p-0 rounded-xl"
      onOpenAutoFocus={event => { event.preventDefault(); heading.current?.focus(); }}
      onCloseAutoFocus={event => { event.preventDefault(); restoreFocus(); }}
      onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onInteractOutside={event => { if (busy) event.preventDefault(); }}>
      <div className="grid md:grid-cols-[220px_minmax(0,1fr)] min-w-0">
        <aside className="p-4 pe-12 md:p-6 md:border-e bg-muted rounded-t-xl md:rounded-ss-xl md:rounded-es-xl md:rounded-se-none space-y-3 min-w-0">
          <DialogHeader className="text-start sm:text-start"><DialogDescription><bdi>{getProviderName(service.provider)}</bdi></DialogDescription><DialogTitle className="text-xl break-words"><bdi>{service.name}</bdi></DialogTitle></DialogHeader>
          {service.employee?.name && <p className="text-sm text-muted-foreground"><bdi>{service.employee.name}</bdi></p>}
          <p className="hidden md:flex items-center gap-2 text-sm"><Clock className="w-4 h-4 shrink-0" aria-hidden="true" />{new Intl.NumberFormat(language, { style: "unit", unit: "minute", unitDisplay: "short" }).format(service.duration)}</p>
          {service.address && <p className="hidden md:flex items-start gap-2 text-sm"><MapPin className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" /><bdi>{service.address}</bdi></p>}
          <p className="font-semibold"><bdi>{service.serviceType === "group" ? t("bookingForm.perParticipant", { amount: amount(Number(service.price)) }) : amount(Number(service.price))}</bdi></p>
          <p className="text-sm text-muted-foreground">{t(service.instantBooking ? "bookingForm.instantHelp" : "bookingForm.requestHelp")}</p>
        </aside>
        <div className="p-4 sm:p-6 space-y-5 min-w-0">
          <h2 ref={heading} tabIndex={-1} className="text-lg font-semibold focus:outline-none">{t(succeeded ? service.instantBooking ? "bookingForm.confirmed" : "bookingForm.requestSent" : reviewing ? "bookingForm.reviewStep" : "bookingForm.chooseStep")}</h2>
          {succeeded ? <div className="space-y-4">
            <p role="status">{t("bookingForm.successHelp")}</p>
            <div className="rounded-lg border bg-muted p-4 space-y-2"><p className="font-medium"><bdi>{service.name}</bdi></p><p><bdi>{getProviderName(service.provider)}</bdi></p><p>{appointmentDate}</p><p><bdi>{selectedSlot?.startTime}–{selectedSlot?.endTime}</bdi> · <bdi>{selectedSlot?.timezone}</bdi></p></div>
            <div className="grid sm:grid-cols-2 gap-3"><Button asChild className={actionClass}><Link href="/my-bookings" onClick={onClose}>{t("bookingForm.viewBookings")}</Link></Button><Button variant="outline" className={actionClass} onClick={onClose}>{t("common.close")}</Button></div>
          </div> : <>
            {!reviewing ? <BookingTimePicker serviceId={service.id} selected={selectedSlot} onSelect={setSelectedSlot} /> : selectedSlot && <>
              <div className="rounded-lg bg-muted border p-4 text-sm space-y-2">
                <p className="font-medium"><bdi>{service.name}</bdi></p><p><bdi>{getProviderName(service.provider)}</bdi></p>
                <p>{appointmentDate}</p><p><bdi>{selectedSlot.startTime}–{selectedSlot.endTime}</bdi> · <bdi>{selectedSlot.timezone}</bdi></p>
                {service.address && <p><bdi>{service.address}</bdi></p>}
                <Button variant="outline" type="button" className={actionClass} disabled={busy} onClick={() => setReviewing(false)}>{t("bookingForm.changeTime")}</Button>
              </div>
              {service.serviceType === "group" && <div className="space-y-2"><Label htmlFor="booking-participants">{t("booking.participants")}</Label>
                <Input ref={participants} id="booking-participants" className="min-h-11" type="number" min={1} max={maximum} step={1} disabled={busy}
                  value={Number.isNaN(participantCount) ? "" : participantCount} onBlur={() => setParticipantTouched(true)}
                  aria-invalid={participantTouched && !participantValid || undefined} aria-describedby={participantTouched && !participantValid ? "booking-participants-help booking-participants-error" : "booking-participants-help"}
                  onChange={event => setParticipantCount(event.target.value === "" ? NaN : Number(event.target.value))} />
                <p id="booking-participants-help" className="text-sm text-muted-foreground">{t("bookingForm.participantHelp", { maximum: new Intl.NumberFormat(language).format(maximum) })}</p>
                {participantTouched && !participantValid && <p id="booking-participants-error" role="alert" className="text-sm text-red-700 dark:text-red-300">{t("bookingForm.participantError", { maximum: new Intl.NumberFormat(language).format(maximum) })}</p>}
              </div>}
              <div className="space-y-2"><Label htmlFor="booking-initial-message">{t("bookingForm.initialMessage")}</Label><Textarea id="booking-initial-message" aria-describedby="booking-initial-message-help" dir="auto" maxLength={4000} disabled={busy} value={initialMessage} onChange={event => setInitialMessage(event.target.value)} /><p id="booking-initial-message-help" className="text-sm text-muted-foreground">{t("bookingForm.initialMessageHelp")}</p></div>
              <dl className="flex flex-wrap justify-between gap-3 font-medium"><dt>{t("bookingForm.total")}</dt><dd><bdi>{participantValid ? amount(total) : "—"}</bdi></dd></dl>
              {participantValid && advance > 0 && <p className="text-sm text-muted-foreground">{t("bookingForm.advanceNotice", { amount: amount(advance) })}</p>}
            </>}
            {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{t(error)}</p>}
            <p role="status" aria-live="polite" className="text-sm">{checkingDuplicates ? t("bookingForm.checkingDuplicates") : booking.isPending ? t(service.instantBooking ? "bookingForm.confirming" : "bookingForm.requesting") : ""}</p>
            <div className="grid sm:grid-cols-2 gap-3 border-t pt-4">
              <Button variant="outline" className={actionClass} disabled={busy} onClick={() => reviewing ? setReviewing(false) : onClose()}>{t(reviewing ? "common.back" : "common.cancel")}</Button>
              {!reviewing ? <Button className={actionClass} disabled={!selectedSlot} onClick={() => { setError(""); setReviewing(true); }}>{t("bookingForm.continue")}</Button>
                : <Button ref={submitButton} className={actionClass} disabled={busy || !selectedSlot} onClick={() => void submit()}>{t(service.instantBooking ? "booking.confirmBooking" : "bookingForm.requestBooking")}</Button>}
            </div>
          </>}
        </div>
      </div>
      <AlertDialog open={duplicateWarning} onOpenChange={setDuplicateWarning}>
        <AlertDialogContent dir={i18n.dir()} className="phase2-form max-w-[calc(100%-2rem)] sm:max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto"
          onCloseAutoFocus={event => { event.preventDefault(); submitButton.current?.focus(); }}>
          <AlertDialogHeader className="text-start sm:text-start">
            <AlertDialogTitle>{t("bookingForm.duplicateTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("bookingForm.duplicateDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="text-sm space-y-2"><p><bdi>{service.name}</bdi></p><p>{appointmentDate}</p><p><bdi>{selectedSlot?.startTime}–{selectedSlot?.endTime}</bdi> · <bdi>{selectedSlot?.timezone}</bdi></p></div>
          <AlertDialogFooter className="gap-2 sm:space-x-0">
            <AlertDialogCancel className={actionClass} data-testid="button-cancel-duplicate-booking">{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction className={actionClass} data-testid="button-confirm-duplicate-booking" onClick={() => void submit(true)}>{t("bookingForm.duplicateContinue")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DialogContent>
  </Dialog>;
}
