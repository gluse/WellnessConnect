import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Redirect, useLocation, useSearch } from "wouter";
import { useTranslation } from "react-i18next";
import type { InboxBooking } from "@shared/wishlist";
import { useAuth } from "@/hooks/useAuth";
import { useInboxScope } from "@/hooks/use-inbox";
import { apiRequest } from "@/lib/queryClient";
import { InboxList, type InboxKind } from "@/components/inbox";
import { BookingConversationDialog } from "@/components/booking-collaboration";
import { Button } from "@/components/ui/button";

export default function Inbox() {
  const auth = useAuth(), state = useInboxScope(), search = useSearch(), [, navigate] = useLocation(), { t } = useTranslation();
  const heading = useRef<HTMLHeadingElement>(null);
  const parameters = new URLSearchParams(search), rawId = parameters.get("booking");
  const bookingId = rawId && /^[1-9]\d{0,9}$/.test(rawId) && Number(rawId) <= 2147483647 ? Number(rawId) : null;
  const kind: InboxKind = parameters.get("tab") === "notifications" ? "notifications" : "messages";
  const explicitBooking = !!bookingId && state.scope.scope !== "all";
  const booking = useQuery<InboxBooking>({ queryKey: ["inbox", state.userId, state.query, "booking", bookingId], enabled: state.ready && explicitBooking,
    queryFn: async ({ signal }) => (await apiRequest("GET", `/api/inbox/messages/${bookingId}?${state.query}`, undefined, signal)).json(), retry: false, staleTime: 0, gcTime: 0 });
  if (!auth.isLoading && !auth.isAuthenticated) return <Redirect to="/login?returnTo=%2Finbox" />;
  const close = () => navigate(`/inbox?${state.query}`);
  return <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
    <h1 className="text-2xl font-semibold" tabIndex={-1} ref={heading}>{t("inbox.title")}</h1>
    <div className="flex flex-wrap gap-2" role="group" aria-label={t("inbox.title")}>{(["messages", "notifications"] as const).map(tab => <Button key={tab} variant={tab === kind ? "default" : "outline"} aria-pressed={tab === kind} onClick={() => navigate(`/inbox?${state.query}&tab=${tab}`)}>{t(`inbox.${tab}`)}</Button>)}</div>
    <InboxList kind={kind} />
    {bookingId && !explicitBooking && <p role="alert">{t("inbox.unavailable")}</p>}
    {explicitBooking && booking.isPending && <p role="status">{t("inbox.loading")}</p>}
    {explicitBooking && booking.isError && <div role="alert"><p>{t("inbox.unavailable")}</p><Button variant="outline" onClick={() => void booking.refetch()}>{t("inbox.retry")}</Button></div>}
    {explicitBooking && booking.isSuccess && state.ready && <BookingConversationDialog key={`${state.userId}:${state.query}:${bookingId}`} booking={booking.data} viewer={state.scope.scope === "provider" ? "provider" : "customer"} canSend={state.canSend}
      scope={`${state.userId}:${state.query}`} onClose={close} restoreFocus={() => heading.current?.focus()} />}
  </main>;
}
