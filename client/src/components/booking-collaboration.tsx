import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { BookingWithDetails } from "@shared/schema";
import type { BookingConversation, EventAction, EventPreview, RescheduleRequest, RescheduleRequests } from "@shared/appointment-collaboration";
import type { BookableSlot } from "@shared/scheduling";
import { getProviderName } from "@shared/provider";
import { apiRequest } from "@/lib/queryClient";
import BookingTimePicker from "@/components/booking-time-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const root = "appointmentCollaboration.";
const timezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
export const collaborationKey = (scope: string, bookingId: number) => ["booking-collaboration", scope, bookingId];
export function useCollaborationRefresh() {
  const queryClient = useQueryClient();
  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["booking-collaboration"] }),
    queryClient.invalidateQueries({ queryKey: ["/api/bookings/provider"] }),
    queryClient.invalidateQueries({ queryKey: ["/api/bookings/seeker"] }),
    queryClient.invalidateQueries({ predicate: query => String(query.queryKey[0]).startsWith("/api/availability/") }),
  ]);
}
function useMounted() {
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  return alive;
}
function errorKey(error: Error) {
  return root + (error.message.startsWith("401:") || error.message.startsWith("403:") ? "denied" : error.message.includes("time_unavailable") ? "slotUnavailable" : error.message.startsWith("409:") ? "conflict" : "failed");
}
export function appointmentTime(value: string | Date, language: string, zone = timezone()) {
  return new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short", timeZone: zone }).format(new Date(value)) + ` (${zone})`;
}
function CollaborationDialog({ title, description, pending, onClose, restoreFocus, children }: {
  title: string; description: string; pending: boolean; onClose: () => void; restoreFocus?: () => void; children: React.ReactNode;
}) {
  const { t, i18n } = useTranslation();
  return <Dialog open onOpenChange={open => { if (!open && !pending) onClose(); }}>
    <DialogContent dir={i18n.dir()} closeLabel={t(root + "close")} closeDisabled={pending}
      className="max-w-[calc(100%-2rem)] sm:max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl p-4 sm:p-6 [overflow-wrap:anywhere]"
      onCloseAutoFocus={event => { if (restoreFocus) { event.preventDefault(); requestAnimationFrame(restoreFocus); } }}
      onEscapeKeyDown={event => { if (pending) event.preventDefault(); }} onInteractOutside={event => { if (pending) event.preventDefault(); }}>
      <DialogHeader className="text-start sm:text-start"><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
      {children}
    </DialogContent>
  </Dialog>;
}

export function BookingConversationDialog({ booking, scope, viewer, onClose, restoreFocus }: {
  booking: BookingWithDetails; scope: string; viewer: "provider" | "customer"; onClose: () => void; restoreFocus?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient(), alive = useMounted();
  const [body, setBody] = useState("");
  const id = useRef(crypto.randomUUID());
  const submitting = useRef(false);
  const messages = useInfiniteQuery<BookingConversation>({
    queryKey: [...collaborationKey(scope, booking.id), "conversation"],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => (await apiRequest("GET", `/api/bookings/${booking.id}/conversation${pageParam ? `?before=${encodeURIComponent(String(pageParam))}` : ""}`, undefined, signal)).json(),
    getNextPageParam: page => page.nextCursor || undefined, staleTime: 0, gcTime: 0, retry: false, refetchInterval: 30_000,
  });
  const send = useMutation({
    retry: false,
    mutationFn: async () => (await apiRequest("POST", `/api/bookings/${booking.id}/conversation`, { body: body.trim(), clientRequestId: id.current })).json(),
    onSuccess: async () => {
      if (!alive.current) return;
      setBody(""); id.current = crypto.randomUUID();
      await queryClient.invalidateQueries({ queryKey: collaborationKey(scope, booking.id) });
    },
    onSettled: () => { submitting.current = false; },
  });
  const denied = [messages.error, send.error].some(error => error && /^(401|403):/.test(error.message));
  const history = denied ? [] : messages.data?.pages.slice().reverse().flatMap(page => page.messages) ?? [];
  const counterpart = viewer === "provider" ? [booking.seeker.firstName, booking.seeker.lastName].filter(Boolean).join(" ") || booking.seeker.email || t(root + "customer") : getProviderName(booking.provider);
  return <CollaborationDialog title={t(root + "conversation")} description={`${booking.service.name} · #${booking.id} · ${appointmentTime(booking.scheduledDate, i18n.language)}`} pending={send.isPending} onClose={onClose} restoreFocus={restoreFocus}>
    <p className="font-semibold" data-testid="conversation-counterpart">{t(root + (viewer === "provider" ? "customer" : "provider"))}: <bdi>{counterpart}</bdi></p>
    <p className="text-sm rounded-lg bg-indigo-50 p-3">{t(root + "privacy")}</p>
    <p className="text-xs text-muted-foreground">{t(root + "retentionNotice")}</p>
    {messages.isPending && <p role="status">{t(root + "loading")}</p>}
    {messages.isError && <div role="alert">{t(root + "loadFailed")} <Button variant="outline" onClick={() => void messages.refetch()}>{t(root + "retry")}</Button></div>}
    {messages.hasNextPage && <Button variant="outline" disabled={messages.isFetchingNextPage} onClick={() => void messages.fetchNextPage()}>{t(root + "olderMessages")}</Button>}
    <div className="space-y-3 max-h-[35dvh] overflow-y-auto" aria-label={t(root + "messages")}>
      {messages.isSuccess && !denied && !history.length && <p className="text-sm text-muted-foreground">{t(root + "emptyMessages")}</p>}
      {history.map(message => <article key={message.id} className={`rounded-lg border p-3 space-y-1 ${message.authorRole === "provider" ? "bg-indigo-50" : "bg-neutral-50"}`}>
        <p className="text-sm font-semibold"><bdi>{message.authorName}</bdi> · {t(root + message.authorRole)}</p>
        <p dir="auto" className="whitespace-pre-wrap [overflow-wrap:anywhere]">{message.body}</p>
        <p className="text-xs text-muted-foreground"><time dateTime={message.createdAt}>{appointmentTime(message.createdAt, i18n.language)}</time> · {t(root + "saved")}</p>
      </article>)}
    </div>
    <form className="space-y-3" onSubmit={event => { event.preventDefault(); if (!submitting.current && body.trim() && messages.isSuccess) { submitting.current = true; send.mutate(); } }}>
      <Label htmlFor="booking-message-body">{t(root + "message")}</Label>
      <Textarea id="booking-message-body" dir="auto" maxLength={4000} value={body} placeholder={t(root + "writeMessage")} disabled={send.isPending || denied} onChange={event => { setBody(event.target.value); if (send.isError) { id.current = crypto.randomUUID(); send.reset(); } }} className="min-h-24" />
      {send.isError && <p role="alert" className="text-red-700">{t(errorKey(send.error))}</p>}
      <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" disabled={send.isPending} onClick={onClose}>{t(root + "close")}</Button><Button type="submit" disabled={!body.trim() || send.isPending || !messages.isSuccess || denied}>{send.isPending ? t(root + "loading") : t(root + "send")}</Button></div>
    </form>
  </CollaborationDialog>;
}

export function RescheduleFields({ booking, slot, onSlot, fallback, onFallback, note, onNote, disabled }: {
  booking: BookingWithDetails; slot: BookableSlot | null; onSlot: (slot: BookableSlot | null) => void;
  fallback: "keep_original" | "cancel_booking"; onFallback: (value: "keep_original" | "cancel_booking") => void; note: string; onNote: (value: string) => void; disabled: boolean;
}) {
  const { t, i18n } = useTranslation();
  return <fieldset disabled={disabled} className="space-y-4 min-w-0">
    <p className="rounded-lg bg-neutral-50 p-3 text-sm"><strong>{t(root + "currentTime")}: </strong>{appointmentTime(booking.scheduledDate, i18n.language)}</p>
    <BookingTimePicker serviceId={booking.serviceId} bookingId={booking.id} selected={slot} onSelect={onSlot} />
    {slot && <p className="text-sm"><strong>{t(root + "proposedTime")}: </strong>{appointmentTime(slot.startsAt, i18n.language, slot.timezone)}</p>}
    <fieldset className="space-y-2"><legend className="font-semibold mb-2">{t(root + "fallbackLabel")}</legend>
      {(["keep_original", "cancel_booking"] as const).map(value => <label key={value} className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer ${fallback === value ? "border-indigo-500 bg-indigo-50" : ""}`}>
        <input type="radio" name="reschedule-fallback" value={value} checked={fallback === value} onChange={() => onFallback(value)} className="mt-1" />
        <span className="space-y-1"><strong className="block">{t(root + (value === "keep_original" ? "keepOriginal" : "cancelOriginal"))}</strong><span className="block text-sm">{t(root + (value === "keep_original" ? "keepHelp" : "cancelHelp"))}</span><span className="block text-sm">{t(root + (value === "keep_original" ? "keepConsequences" : "cancelConsequences"))}</span></span>
      </label>)}
    </fieldset>
    <p className="text-sm rounded-lg bg-indigo-50 p-3">{t(root + "noResponse")}</p><p className="text-sm">{t(root + "availability")}</p>
    <Label htmlFor="reschedule-note">{t(root + "reason")}</Label><Textarea id="reschedule-note" dir="auto" maxLength={2000} value={note} onChange={event => onNote(event.target.value)} />
  </fieldset>;
}

export function RescheduleRequestDialog({ booking, onClose, restoreFocus }: { booking: BookingWithDetails; onClose: () => void; restoreFocus?: () => void }) {
  const { t } = useTranslation(), refresh = useCollaborationRefresh(), alive = useMounted();
  const { toast } = useToast();
  const [slot, setSlot] = useState<BookableSlot | null>(null), [fallback, setFallback] = useState<"keep_original" | "cancel_booking">("keep_original"), [note, setNote] = useState("");
  const id = useRef(crypto.randomUUID()), submitting = useRef(false);
  const send = useMutation({ retry: false, mutationFn: async () => (await apiRequest("POST", `/api/bookings/${booking.id}/reschedule-requests`, { scheduledDate: slot?.startsAt, fallback, note, timeZone: slot?.timezone || timezone(), clientRequestId: id.current })).json(),
    onSuccess: async () => { await refresh(); if (alive.current) { toast({ title: t(root + "requestSent") }); onClose(); } },
    onError: async (error: Error) => { if (alive.current && error.message.includes("time_unavailable")) { setSlot(null); await refresh(); } },
    onSettled: () => { submitting.current = false; } });
  return <CollaborationDialog title={t(root + "requestTitle")} description={t(root + "requestHelp")} pending={send.isPending} onClose={onClose} restoreFocus={restoreFocus}>
    <p className="font-medium">{booking.service.name}</p>
    <RescheduleFields booking={booking} slot={slot} onSlot={value => { setSlot(value); if (send.isError) { id.current = crypto.randomUUID(); send.reset(); } }} fallback={fallback} onFallback={value => { setFallback(value); if (send.isError) { id.current = crypto.randomUUID(); send.reset(); } }} note={note} onNote={value => { setNote(value); if (send.isError) { id.current = crypto.randomUUID(); send.reset(); } }} disabled={send.isPending} />
    {send.isError && <p role="alert" className="text-red-700">{t(errorKey(send.error))}</p>}
    <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={send.isPending} onClick={onClose}>{t(root + "cancel")}</Button><Button disabled={!slot || send.isPending} onClick={() => { if (!submitting.current) { submitting.current = true; send.mutate(); } }}>{send.isPending ? t(root + "loading") : t(root + "sendRequest")}</Button></div>
  </CollaborationDialog>;
}

export function BookingRescheduleRequests({ booking, scope }: { booking: BookingWithDetails; scope: string }) {
  const { t, i18n } = useTranslation(), refresh = useCollaborationRefresh();
  const [confirm, setConfirm] = useState<RescheduleRequest | null>(null);
  const [success, setSuccess] = useState(false);
  const requests = useQuery<RescheduleRequests>({ queryKey: [...collaborationKey(scope, booking.id), "requests"],
    queryFn: async ({ signal }) => (await apiRequest("GET", `/api/bookings/${booking.id}/reschedule-requests`, undefined, signal)).json(), retry: false, staleTime: 0, gcTime: 0, refetchInterval: 30_000 });
  const change = useMutation({ retry: false, mutationFn: async ({ request, decision }: { request: RescheduleRequest; decision: "accept" | "decline" | "withdraw" }) =>
    (await apiRequest("POST", `/api/bookings/${booking.id}/reschedule-requests/${request.id}/${decision === "withdraw" ? "withdraw" : "respond"}`, decision === "withdraw" ? {} : { decision })).json(),
    onSuccess: async () => { setConfirm(null); setSuccess(true); await refresh(); } });
  const pending = requests.data?.requests.find(request => request.state === "pending");
  if (requests.isError) return <p role="status" className="text-sm">{t(root + "loadFailed")} <Button variant="ghost" onClick={() => void requests.refetch()}>{t(root + "retry")}</Button></p>;
  if (!pending) return <>{success && <p role="status" className="text-sm">{t(root + "requestUpdated")}</p>}{!!requests.data?.requests.length && <details className="text-sm rounded-lg border p-3"><summary className="cursor-pointer min-h-6">{t(root + "rescheduleRequest")} · {t(root + requests.data.requests[0].state)}</summary><ul className="mt-2 space-y-2">{requests.data.requests.map(request => <li key={request.id}>{appointmentTime(request.proposedScheduledDate, i18n.language, request.timezone)} · {t(root + request.state)}</li>)}</ul></details>}</>;
  const decide = (decision: "accept" | "decline" | "withdraw") => { if (!change.isPending) change.mutate({ request: pending, decision }); };
  return <section className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-3" aria-label={t(root + "rescheduleRequest")}>
    <p className="font-semibold">{t(root + "rescheduleRequest")} · {t(root + "awaitingResponse")}</p>
    <dl className="text-sm space-y-2"><div><dt className="font-medium">{t(root + "currentTime")}</dt><dd>{appointmentTime(pending.originalScheduledDate, i18n.language, pending.timezone)}</dd></div><div><dt className="font-medium">{t(root + "proposedTime")}</dt><dd>{appointmentTime(pending.proposedScheduledDate, i18n.language, pending.timezone)}</dd></div></dl>
    {pending.note && <p className="text-sm whitespace-pre-wrap [overflow-wrap:anywhere]" dir="auto">{pending.note}</p>}
    <p className="text-sm font-medium">{t(root + (pending.fallback === "cancel_booking" ? "cancelConsequences" : "keepConsequences"))}</p>
    <p className="text-sm">{t(root + "noResponse")}</p><p className="text-sm">{t(root + "availability")}</p>
    {change.isError && <p role="alert" className="text-red-700">{t(errorKey(change.error))}</p>}
    <div className="flex flex-wrap gap-2">{pending.canRespond && <><Button disabled={change.isPending} onClick={() => decide("accept")}>{t(root + "approveTime")}</Button><Button variant={pending.fallback === "cancel_booking" ? "destructive" : "outline"} disabled={change.isPending} onClick={() => pending.fallback === "cancel_booking" ? setConfirm(pending) : decide("decline")}>{t(root + (pending.fallback === "cancel_booking" ? "declineCancel" : "declineKeep"))}</Button></>}
      {pending.canWithdraw && <Button variant="outline" disabled={change.isPending} onClick={() => decide("withdraw")}>{t(root + "withdraw")}</Button>}</div>
    {confirm && <CollaborationDialog title={t(root + "declineCancel")} description={t(root + "declineWarning")} pending={change.isPending} onClose={() => setConfirm(null)}>
      {change.isError && <p role="alert">{t(errorKey(change.error))}</p>}<div className="flex flex-wrap gap-2 justify-end"><Button variant="outline" disabled={change.isPending} onClick={() => setConfirm(null)}>{t(root + "cancel")}</Button><Button variant="destructive" disabled={change.isPending} onClick={() => change.mutate({ request: confirm, decision: "decline" })}>{t(root + "confirmDecline")}</Button></div>
    </CollaborationDialog>}
  </section>;
}

export function EventActionDialog({ booking, action, scope, onClose, restoreFocus }: {
  booking: BookingWithDetails; action: EventAction; scope: string; onClose: () => void; restoreFocus?: () => void;
}) {
  const { t } = useTranslation(), refresh = useCollaborationRefresh(), alive = useMounted();
  const { toast } = useToast();
  const [body, setBody] = useState(""), [review, setReview] = useState(false), [slot, setSlot] = useState<BookableSlot | null>(null);
  const [fallback, setFallback] = useState<"keep_original" | "cancel_booking">("keep_original"), [note, setNote] = useState("");
  const id = useRef(crypto.randomUUID()), submitting = useRef(false);
  const preview = useQuery<EventPreview>({ queryKey: [...collaborationKey(scope, booking.id), "event-preview", action], retry: false, staleTime: 0, gcTime: 0,
    queryFn: async ({ signal }) => (await apiRequest("POST", `/api/bookings/${booking.id}/event/preview`, { action }, signal)).json() });
  const send = useMutation({ retry: false, mutationFn: async () => {
    const bookingIds = preview.data?.bookingIds;
    const path = action === "message" ? "messages" : action === "reschedule" ? "reschedule-requests" : "status";
    const payload = action === "message" ? { bookingIds, body: body.trim(), clientRequestId: id.current } : action === "reschedule" ? { bookingIds, scheduledDate: slot?.startsAt, fallback, note, timeZone: slot?.timezone || timezone(), clientRequestId: id.current } : { bookingIds, status: action === "complete" ? "completed" : "cancelled", timeZone: timezone() };
    return (await apiRequest("POST", `/api/bookings/${booking.id}/event/${path}`, payload)).json();
  }, onSuccess: async result => { await refresh(); if (alive.current) { if (action === "message") toast({ title: t(root + "groupSaved", { count: result.customerCount }) }); if (action === "reschedule") toast({ title: t(root + "requestSent") }); onClose(); } },
    onError: async (error: Error) => { if (alive.current && action === "reschedule" && error.message.includes("time_unavailable")) { setSlot(null); await refresh(); } },
    onSettled: () => { submitting.current = false; } });
  const title = t(root + (action === "message" ? "messageGroup" : action === "reschedule" ? "rescheduleEvent" : action === "complete" ? "confirmComplete" : "confirmCancelEvent"));
  const denied = [preview.error, send.error].some(error => error && /^(401|403):/.test(error.message));
  const allowed = !denied && preview.data && preview.data.bookingCount > 0 && (action !== "message" || preview.data.hasPro);
  return <CollaborationDialog title={title} description={t(root + "scopeHelp")} pending={send.isPending} onClose={onClose} restoreFocus={restoreFocus}>
    <p className="font-medium">{booking.service.name}</p>
    {preview.isPending && <p role="status">{t(root + "loading")}</p>}
    {preview.isError && <div role="alert">{t(root + "loadFailed")} <Button variant="outline" onClick={() => void preview.refetch()}>{t(root + "retry")}</Button></div>}
    {preview.data && !denied && <>
      <p className="font-medium">{t(root + "affected", { count: preview.data.bookingCount, participants: preview.data.participantCount })}</p>
      {(action !== "message" || review) && <ul className="max-h-40 overflow-y-auto divide-y rounded-lg border">{preview.data.recipients.map(recipient => <li key={recipient.bookingId} className="p-3 text-sm"><bdi>{recipient.customerName}</bdi> · {recipient.participantCount} · {recipient.status ? t(root + "status" + recipient.status[0].toUpperCase() + recipient.status.slice(1)) : "—"}</li>)}</ul>}
      {action === "message" && (!preview.data.hasPro ? <p role="status">{t(root + "proRequired")}</p> : <><p className="rounded-lg bg-indigo-50 p-3 text-sm">{t(root + "groupPrivacy")}</p><Label htmlFor="event-message-body">{t(root + "message")}</Label><Textarea id="event-message-body" dir="auto" maxLength={4000} value={body} readOnly={review} disabled={send.isPending} onChange={event => { setBody(event.target.value); if (send.isError) { id.current = crypto.randomUUID(); send.reset(); } }} /></>)}
      {action === "reschedule" && <><p className="text-sm">{t(root + "groupRequestHelp")}</p><RescheduleFields booking={booking} slot={slot} onSlot={value => { setSlot(value); if (send.isError) { id.current = crypto.randomUUID(); send.reset(); } }} fallback={fallback} onFallback={value => { setFallback(value); if (send.isError) { id.current = crypto.randomUUID(); send.reset(); } }} note={note} onNote={value => { setNote(value); if (send.isError) { id.current = crypto.randomUUID(); send.reset(); } }} disabled={send.isPending} /></>}
      {action === "cancel" && <p className="rounded-lg bg-red-50 text-red-800 p-3">{t(root + "cancelWarning")}</p>}
    </>}
    {send.isError && <p role="alert" className="text-red-700">{t(errorKey(send.error))}</p>}
    <div className="flex flex-wrap gap-2 justify-end"><Button variant="outline" disabled={send.isPending} onClick={onClose}>{t(root + "cancel")}</Button>
      {action === "message" && review && <Button variant="outline" disabled={send.isPending} onClick={() => setReview(false)}>{t(root + "editMessage")}</Button>}
      <Button variant={action === "cancel" ? "destructive" : "default"} disabled={!allowed || send.isPending || (action === "message" && !body.trim()) || (action === "reschedule" && !slot)} onClick={() => { if (action === "message" && !review) { setReview(true); return; } if (!submitting.current) { submitting.current = true; send.mutate(); } }}>{send.isPending ? t(root + "loading") : t(root + (action === "message" ? review ? "sendGroup" : "reviewRecipients" : action === "reschedule" ? "sendRequest" : action === "complete" ? "confirmCompleteButton" : "confirmCancel"))}</Button>
    </div>
  </CollaborationDialog>;
}

export function EventRescheduleOutcomes({ booking, scope, bookings }: { booking: BookingWithDetails; scope: string; bookings: BookingWithDetails[] }) {
  const { t } = useTranslation();
  const requests = useQuery<RescheduleRequests>({ queryKey: [...collaborationKey(scope, booking.id), "event-requests"],
    queryFn: async ({ signal }) => (await apiRequest("GET", `/api/bookings/${booking.id}/event/reschedule-requests`, undefined, signal)).json(), retry: false, gcTime: 0, staleTime: 0, refetchInterval: 30_000 });
  if (requests.isError) return <p className="text-sm" role="status">{t(root + "loadFailed")} <Button variant="ghost" onClick={() => void requests.refetch()}>{t(root + "retry")}</Button></p>;
  if (!requests.data?.requests.length) return null;
  return <details className="border-b border-indigo-200 bg-indigo-50 p-3 text-sm"><summary className="min-h-6 cursor-pointer">{t(root + "rescheduleRequest")} · {(["accepted", "pending", "declined"] as const).map(state => `${t(root + (state === "pending" ? "awaitingResponse" : state))}: ${requests.data!.requests.filter(row => row.state === state).length}`).join(" · ")}</summary>
    <ul className="mt-2 space-y-2">{requests.data.requests.map(request => { const row = bookings.find(item => item.id === request.bookingId); return <li key={request.id}><bdi>{row ? [row.seeker.firstName, row.seeker.lastName].filter(Boolean).join(" ") : `#${request.bookingId}`}</bdi> · {t(root + (request.state === "pending" ? "awaitingResponse" : request.state))}</li>; })}</ul>
  </details>;
}
