import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Link, Redirect } from "wouter";
import { useTranslation } from "react-i18next";
import type { ServiceWithProvider } from "@shared/schema";
import type { WishlistPage } from "@shared/wishlist";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { wishlistListKey } from "@/components/wishlist-provider";
import WishlistHeart from "@/components/wishlist-heart";
import ServiceCard from "@/components/service-card";
import ServiceDetailModal from "@/components/service-detail-modal";
import BookingModal from "@/components/booking-modal";
import { Button } from "@/components/ui/button";

export default function Wishlist() {
  const { user, isLoading, isAuthenticated, isError, refetch } = useAuth();
  const { t } = useTranslation();
  if (isLoading) return <main className="p-6" role="status">{t("wishlist.loading")}</main>;
  if (isError) return <main className="p-6 space-y-3" role="alert"><p>{t("wishlist.loadFailed")}</p><Button variant="outline" onClick={() => void refetch()}>{t("wishlist.retry")}</Button></main>;
  if (!isAuthenticated || !user) return <Redirect to="/login?returnTo=%2Fwishlist" />;
  return <SavedServices key={user.id} userId={user.id} />;
}

function SavedServices({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const heading = useRef<HTMLHeadingElement>(null), focused = useRef<number | null>(null);
  const [detail, setDetail] = useState<ServiceWithProvider | null>(null), [booking, setBooking] = useState<ServiceWithProvider | null>(null);
  const list = useInfiniteQuery<WishlistPage>({
    queryKey: wishlistListKey(userId), initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => (await apiRequest("GET", `/api/wishlist/services${pageParam ? `?cursor=${encodeURIComponent(String(pageParam))}` : ""}`, undefined, signal)).json(),
    getNextPageParam: page => page.nextCursor || undefined, staleTime: 0, gcTime: 0, retry: false, refetchOnWindowFocus: "always",
  });
  const items = list.isError ? [] : list.data?.pages.flatMap(page => page.items) ?? [];
  useEffect(() => {
    if (focused.current !== null && !items.some(item => item.serviceId === focused.current)) {
      focused.current = null;
      // The next heart may become disabled when removing this card changes the
      // membership batch. The stable heading keeps focus through that refresh.
      if (document.activeElement === document.body) heading.current?.focus();
    }
  }, [list.data]);
  return <div className="search-design min-h-[70dvh] bg-background text-foreground">
    <main className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4" data-wishlist-page>
      <h1 className="text-2xl font-semibold" ref={heading} tabIndex={-1}>{t("wishlist.title")}</h1>
      <p>{t("wishlist.help")}</p>
      <a className="inline-block min-h-11 py-3 text-sm underline underline-offset-2" href="/privacy-policy.html#wishlist-activity" target="_blank" rel="noopener noreferrer">{t("legal.privacyPolicyNewTab")}</a>
      {list.isPending && <p role="status">{t("wishlist.loading")}</p>}
      {list.isError && <div role="alert" className="space-y-3"><p>{t("wishlist.loadFailed")}</p><Button variant="outline" onClick={() => void list.refetch()}>{t("wishlist.retry")}</Button></div>}
      {list.isSuccess && !items.length && <div className="space-y-3"><p>{t("wishlist.empty")}</p><Button asChild><Link href="/search">{t("wishlist.browse")}</Link></Button></div>}
      <div className="search-cards search-cards-list" onFocusCapture={event => {
        const heart = (event.target as HTMLElement).closest<HTMLElement>("[data-wishlist-heart]");
        if (heart) focused.current = Number(heart.dataset.wishlistHeart);
      }}>
        {items.map(item => item.available ? <ServiceCard key={item.serviceId} service={item.service} searchLayout
          onViewDetails={() => setDetail(item.service)} onBook={() => setBooking(item.service)} /> :
          <article key={item.serviceId} className="relative min-h-24 border-b p-4 pe-16" data-wishlist-unavailable={item.serviceId}>
            <h2 className="font-semibold">{t("wishlist.unavailable")}</h2><p>{t("wishlist.unavailableHelp")}</p><WishlistHeart serviceId={item.serviceId} />
          </article>)}
      </div>
      {list.hasNextPage && <Button variant="outline" disabled={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>{t(list.isFetchingNextPage ? "wishlist.loading" : "wishlist.more")}</Button>}
    </main>
    <ServiceDetailModal service={detail} searchLayout open={!!detail} onClose={() => setDetail(null)} onBook={() => { setBooking(detail); setDetail(null); }} />
    {booking && <BookingModal service={booking} returnTo="/wishlist" onClose={() => setBooking(null)} />}
  </div>;
}
