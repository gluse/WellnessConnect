import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { PublicStorefront } from "@shared/storefront";
import type { ServiceWithProvider } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useCategories } from "@/hooks/use-categories";
import ServiceCard from "@/components/service-card";
import ServiceDetailModal from "@/components/service-detail-modal";
import BookingModal from "@/components/booking-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { canSortServicePrices } from "@/lib/service-sort";

export function StorefrontView({ page, preview = false }: { page: PublicStorefront; preview?: boolean }) {
  const { t } = useTranslation();
  const categories = useCategories();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("name");
  const priceSortAvailable = canSortServicePrices(page.services);
  useEffect(() => { if (!priceSortAvailable && sort === "price") setSort("name"); }, [priceSortAvailable, sort]);
  const [detail, setDetail] = useState<ServiceWithProvider | null>(null);
  const [booking, setBooking] = useState<ServiceWithProvider | null>(() => {
    const id = preview || typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("book");
    return page.services.find(service => String(service.id) === id) ?? null;
  });
  const services = useMemo(() => page.services.filter(service => (!category || service.category === category)
    && `${service.name} ${service.description ?? ""}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
    .sort((a, b) => sort === "price" && priceSortAvailable ? Number(a.price) - Number(b.price) || a.id - b.id
      : sort === "duration" ? a.duration - b.duration || a.id - b.id : a.name.localeCompare(b.name) || a.id - b.id), [page.services, search, category, sort, priceSortAvailable]);
  const availableCategories = Array.from(new Set(page.services.map(service => service.category)));
  return <div className="space-y-6">
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="h-40 sm:h-56 bg-gradient-to-r from-primary/20 via-primary/5 to-secondary/20">
        {page.coverUrl && <img src={page.coverUrl} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="p-5 sm:p-8 space-y-4">
        <div className="flex items-center gap-4">
          {page.logoUrl && <img src={page.logoUrl} alt={t("storefront.logoAlt", { name: page.name })} className="h-20 w-20 rounded-xl border bg-white object-cover shrink-0" />}
          <div className="min-w-0"><p className="text-sm text-primary font-medium">{t("storefront.providerPage")}</p><h1 className="text-2xl sm:text-3xl font-semibold break-words">{page.name}</h1></div>
        </div>
        {page.description && <p className="whitespace-pre-wrap break-words text-neutral-600 max-w-3xl">{page.description}</p>}
      </div>
    </section>
    <section aria-labelledby="storefront-services" className="space-y-4">
      <h2 id="storefront-services" className="text-xl font-semibold">{t("storefront.services")}</h2>
      <div className="grid gap-3 sm:grid-cols-3 bg-white border rounded-xl p-4">
        <div><Label htmlFor="storefront-search">{t("storefront.search")}</Label><Input id="storefront-search" value={search} onChange={event => setSearch(event.target.value)} /></div>
        <div><Label htmlFor="storefront-category">{t("storefront.category")}</Label><select id="storefront-category" className="h-10 w-full border rounded-md px-3 bg-white" value={category} onChange={event => setCategory(event.target.value)}>
          <option value="">{t("storefront.allCategories")}</option>{availableCategories.map(key => <option key={key} value={key}>{categories.data?.find(item => item.key === key)?.name ?? key}</option>)}
        </select></div>
        <div><Label htmlFor="storefront-sort">{t("storefront.sort")}</Label><select id="storefront-sort" className="h-10 w-full border rounded-md px-3 bg-white" value={sort} onChange={event => setSort(event.target.value)}>
          {["name", "price", "duration"].map(value => <option key={value} value={value} disabled={value === "price" && !priceSortAvailable}>{t(`storefront.sort_${value}`)}</option>)}
        </select></div>
      </div>
      {!priceSortAvailable && <p className="text-sm text-neutral-600" role="status">{t("currency.mixedSort")}</p>}
      <p role="status" className="text-sm text-neutral-500">{t("catalog.count", { count: services.length })}</p>
      {!services.length ? <p className="rounded-xl border bg-white p-6">{t("storefront.empty")}</p> : <div className="grid gap-4 lg:grid-cols-2">
        {services.map(service => <ServiceCard key={service.id} service={service} wishlistEnabled={!preview} onBook={() => setBooking(service)} onViewDetails={() => setDetail(service)} />)}
      </div>}
    </section>
    <ServiceDetailModal service={detail} open={detail !== null} wishlistEnabled={!preview} onClose={() => setDetail(null)} onBook={() => { setBooking(detail); setDetail(null); }} />
    {booking && <BookingModal service={booking} returnTo={`/providers/${page.slug}?book=${booking.id}`} onClose={() => {
      setBooking(null);
      if (!preview && new URLSearchParams(window.location.search).has("book")) window.history.replaceState(null, "", `/providers/${page.slug}`);
    }} />}
  </div>;
}

export default function StorefrontPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const { t } = useTranslation();
  const page = useQuery<PublicStorefront>({ queryKey: ["/api/storefronts", slug],
    queryFn: async ({ signal }) => (await apiRequest("GET", `/api/storefronts/${encodeURIComponent(slug)}`, undefined, signal)).json(),
    staleTime: 0, gcTime: 0, refetchOnWindowFocus: true, refetchInterval: 60_000, retry: false });
  useEffect(() => {
    if (!page.data || page.isError) return;
    const previous = document.title;
    document.title = `${page.data.name} | FitsMyTime`;
    return () => { document.title = previous; };
  }, [page.data?.name, page.isError]);
  const missing = page.error?.message.startsWith("404:");
  return <main className="min-h-screen bg-neutral-50"><div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-5">
    <Button asChild variant="outline"><Link href="/search">{t("storefront.back")}</Link></Button>
    {page.isPending ? <p role="status">{t("storefront.loading")}</p> : page.isError ? <div role="alert" className="space-y-3">
      <h1 className="text-xl font-semibold">{t(missing ? "storefront.unavailable" : "storefront.loadError")}</h1>
      {!missing && <Button onClick={() => void page.refetch()}>{t("catalog.retry")}</Button>}
    </div> : <StorefrontView key={slug} page={page.data} />}
  </div></main>;
}
