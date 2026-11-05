import { useEffect, useId, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Bell, MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { InboxMessages, InboxNotifications, InboxNotification, InboxSummary } from "@shared/wishlist";
import { serviceReturnTo } from "@shared/wishlist";
import { apiRequest } from "@/lib/queryClient";
import { inboxQuery, useInboxScope, usePageVisible } from "@/hooks/use-inbox";
import { useIsMobile } from "@/hooks/use-mobile";
import { requestServiceEditorExit } from "@/components/provider/service-navigation-guard";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export type InboxKind = "messages" | "notifications";

export function InboxControls() {
  const state = useInboxScope("all"), visible = usePageVisible(), [location] = useLocation();
  const summary = useQuery<InboxSummary>({ queryKey: ["inbox", state.userId, state.query, "summary"],
    queryFn: async ({ signal }) => (await apiRequest("GET", `/api/inbox/summary?${state.query}`, undefined, signal)).json(),
    enabled: state.ready && visible, retry: false, staleTime: 0, gcTime: 0, refetchInterval: 30_000, refetchOnWindowFocus: "always" });
  const [open, setOpen] = useState<InboxKind | null>(null);
  useEffect(() => { setOpen(null); }, [state.userId, state.query, location]);
  return <div className="app-header-inbox flex shrink-0 items-center" key={`${state.userId}:${state.query}`}>
    {(["messages", "notifications"] as const).map(kind => <InboxControl key={kind} kind={kind} open={open === kind} onOpenChange={value => setOpen(value ? kind : null)}
      count={state.ready && !summary.isError ? summary.data?.[kind === "messages" ? "unreadMessages" : "unreadNotifications"] : undefined} />)}
  </div>;
}

function InboxControl({ kind, open, onOpenChange, count }: { kind: InboxKind; open: boolean; onOpenChange: (open: boolean) => void; count?: number }) {
  const { t, i18n } = useTranslation(), mobile = useIsMobile(640), id = useId();
  const trigger = <Button type="button" variant="ghost" className="header-icon-button relative h-11 w-11 shrink-0 p-0 hover:bg-white/15 hover:text-white" data-inbox-trigger={kind}
    aria-label={t(count === undefined ? `inbox.${kind}` : `inbox.${kind}Count`, { count })}>
    {kind === "messages" ? <MessageSquare className="h-5 w-5" aria-hidden="true" /> : <Bell className="h-5 w-5" aria-hidden="true" />}
    {!!count && <span aria-hidden="true" className="absolute right-0 top-0 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-700 px-1 text-[11px] font-semibold leading-5 text-white ring-2 ring-[var(--header-background)]" data-inbox-badge>{count > 99 ? "99+" : count}</span>}
  </Button>;
  if (mobile) return <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent dir={i18n.dir()} closeLabel={t("inbox.close")} className="max-w-[calc(100%-1rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl p-4">
        <DialogHeader><DialogTitle>{t(`inbox.${kind}`)}</DialogTitle><DialogDescription>{t("inbox.privateScope")}</DialogDescription></DialogHeader>
        <InboxList kind={kind} enabled={open} preview onNavigate={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>;
  return <Popover open={open} onOpenChange={onOpenChange}>
    <PopoverTrigger asChild>{trigger}</PopoverTrigger>
    <PopoverContent dir={i18n.dir()} align="end" collisionPadding={8} className="w-[26rem] max-w-[calc(100vw-1rem)] max-h-[min(36rem,80dvh)] overflow-y-auto" aria-labelledby={id}>
      <h2 id={id} className="font-semibold mb-2">{t(`inbox.${kind}`)}</h2><InboxList kind={kind} enabled={open} preview onNavigate={() => onOpenChange(false)} />
    </PopoverContent>
  </Popover>;
}

export function InboxList({ kind, enabled = true, preview = false, onNavigate }: { kind: InboxKind; enabled?: boolean; preview?: boolean; onNavigate?: () => void }) {
  const state = useInboxScope(preview ? "all" : undefined), { t, i18n } = useTranslation(), client = useQueryClient(), [, navigate] = useLocation();
  const visible = usePageVisible();
  const list = useInfiniteQuery<InboxMessages | InboxNotifications>({
    queryKey: ["inbox", state.userId, state.query, kind], initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => (await apiRequest("GET", `/api/inbox/${kind}?${state.query}${pageParam ? `&cursor=${encodeURIComponent(String(pageParam))}` : ""}`, undefined, signal)).json(),
    enabled: enabled && state.ready && visible, getNextPageParam: page => page.nextCursor || undefined, staleTime: 0, gcTime: 0, retry: false, refetchInterval: 30_000, refetchOnWindowFocus: "always",
  });
  const read = useMutation({ retry: false, mutationFn: async (items: InboxNotification[]) => apiRequest("POST", `/api/inbox/notifications/read?${state.query}`, { items: items.map(({ id, revision }) => ({ id, revision })) }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["inbox"] }) });
  function link(event: React.MouseEvent<HTMLAnchorElement>, path: string, item?: InboxNotification) {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate?.();
    requestServiceEditorExit(() => { if (item && !item.read) read.mutate([item]); navigate(path); });
  }
  if (state.denied) return <p role="alert">{t("inbox.denied")}</p>;
  if (!state.ready || list.isPending) return <p role="status">{t("inbox.loading")}</p>;
  if (list.isError) return <div role="alert" className="space-y-2"><p>{t("inbox.loadFailed")}</p><Button variant="outline" onClick={() => void list.refetch()}>{t("inbox.retry")}</Button></div>;
  const messages = kind === "messages" ? list.data?.pages.flatMap(page => (page as InboxMessages).items) ?? [] : [];
  const notifications = kind === "notifications" ? list.data?.pages.flatMap(page => (page as InboxNotifications).items) ?? [] : [];
  const rows = kind === "messages" ? messages : notifications;
  return <div className="space-y-3 text-sm [overflow-wrap:anywhere]" data-inbox-list={kind}>
    <p className="text-muted-foreground">{state.scope.scope === "all" ? t("inbox.allScope", { workspace: state.label || t("inbox.personalProvider") }) : state.scope.scope === "provider" ? state.label || t("inbox.personalProvider") : t("inbox.customerScope")}</p>
    {!rows.length && <p>{t(kind === "messages" ? "inbox.emptyMessages" : "inbox.emptyNotifications")}</p>}
    {kind === "messages" ? messages.map(item => {
      const query = inboxQuery({ scope: item.viewer, ...(item.viewer === "provider" && (item.companyId ?? (state.scope.scope === "provider" ? state.scope.companyId : undefined)) ? { companyId: item.companyId ?? state.scope.companyId } : {}) });
      const path = `/inbox?${query}&booking=${item.bookingId}`;
      return <Link key={item.bookingId} href={path} onClick={event => link(event, path)} className="block rounded-lg border p-3 space-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
        <span className="block font-semibold"><bdi>{item.counterpartName}</bdi>{item.unreadCount > 0 && <span className="ms-2 rounded-full bg-red-700 px-2 py-0.5 text-xs text-white">{t("inbox.unreadCount", { count: item.unreadCount })}</span>}</span>
        <span className="block"><bdi>{item.serviceName}</bdi> · #{item.bookingId}</span><time className="block text-xs text-muted-foreground" dateTime={item.updatedAt}>{new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short", hourCycle: "h23" }).format(new Date(item.updatedAt))}</time>
      </Link>;
    }) : notifications.map(item => {
      const path = item.available ? serviceReturnTo(item.serviceId) : undefined;
      const label = item.available ? t(`inbox.${item.kind}`, { count: item.count, service: item.serviceName }) : t("inbox.unavailable");
      return <article key={item.id} className="rounded-lg border p-3 space-y-2" data-notification-unread={!item.read}>
        {!item.read && <span className="block text-xs font-semibold text-red-700">{t("inbox.unread")}</span>}
        {path ? <Link href={path} onClick={event => link(event, path, item)} className="font-medium underline underline-offset-2">{label}</Link> : <p>{label}</p>}
        <p className="text-xs text-muted-foreground">{t("inbox.reportingPeriod", { date: new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${item.reportingDay}T00:00:00Z`)) })}</p>
        {!item.read && <Button variant="outline" size="sm" disabled={read.isPending} onClick={() => read.mutate([item])}>{t("inbox.markRead")}</Button>}
      </article>;
    })}
    {read.isError && <p role="alert">{t("inbox.readFailed")}</p>}
    {notifications.some(item => !item.read) && <Button variant="outline" disabled={read.isPending} onClick={() => read.mutate(notifications.filter(item => !item.read).slice(0, 100))}>{t("inbox.markLoadedRead")}</Button>}
    {!preview && list.hasNextPage && <Button variant="outline" disabled={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>{t("inbox.more")}</Button>}
    {preview && <Link href={`/inbox?${state.query}&tab=${kind}`} className="block min-h-11 py-3 underline" onClick={event => link(event, `/inbox?${state.query}&tab=${kind}`)}>{t("inbox.viewAll")}</Link>}
  </div>;
}
