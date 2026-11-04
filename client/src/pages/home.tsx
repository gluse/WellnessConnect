import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, List, LayoutGrid, CalendarDays, Map as MapIcon, Search, Target, X, SlidersHorizontal } from "lucide-react";
import ServiceFilters, { type SearchFilters } from "@/components/service-filters";
import SearchDateFields, { searchDates } from "@/components/search-date-fields";
import ServiceCard from "@/components/service-card";
import ProviderServicesDialog from "@/components/provider-services-dialog";
import SearchResultsSort from "@/components/search-results-sort";
import { serviceRating, sortServices, type ServiceSort } from "@/lib/service-sort";
import GoogleMap from "@/components/google-map";
import { resolveSearchLocation, type ResolvedSearchLocation } from "@/lib/saved-search-location";
import { useSearchLocation } from "@/hooks/use-search-location";
import { useAuth } from "@/hooks/useAuth";
import BookingModal from "@/components/booking-modal";
import ServiceDetailModal from "@/components/service-detail-modal";
import BottomNavigation from "@/components/bottom-navigation";
import { useFormLocale } from "@/components/forms-locale";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import type { ServiceWithProvider } from "@shared/schema";
import { useCategories } from "@/hooks/use-categories";
import { fetchPublicSearch, SEARCH_QUERY_LIMIT, searchErrorKey, searchValidationKey } from "@/lib/public-search";
import { apiRequest } from "@/lib/queryClient";

const defaults: SearchFilters = { category: "", searchQuery: "", searchMode: "exact", serviceType: "", ageGroups: [], distance: 25, date: "", dateEnd: "", time: "", timeEnd: "", availableOnly: false };
type SearchLocation = ResolvedSearchLocation;
const validRadius = (distance: number) => Number.isInteger(distance) && distance >= 1 && distance <= 500;
const validate = (filters: SearchFilters, hasLocation: boolean) => hasLocation && !validRadius(filters.distance) ? "searchPage.invalidRadius" : searchValidationKey(filters);

export default function Home() {
  const auth = useAuth();
  const { t } = useFormLocale();
  if (auth.isLoading) return <main className="search-state" role="status">{t("searchLocation.restoring")}</main>;
  if (auth.isError) return <main className="search-state" role="alert"><p>{t("searchLocation.restoreFailed")}</p><Button onClick={() => void auth.refetch()}>{t("publicSearch.retry")}</Button></main>;
  return <SearchPage key={auth.user?.id ?? "guest"} userId={auth.user?.id ?? null} />;
}

function SearchPage({ userId }: { userId: string | null }) {
  const queryClient = useQueryClient();
  useEffect(() => () => {
    queryClient.removeQueries({ predicate: query => query.queryKey[0] === "/api/services/search" && query.queryKey[1] === userId });
  }, [queryClient, userId]);
  const { t, language } = useFormLocale();
  const categories = useCategories();
  const [viewMode, setViewMode] = useState<"grid" | "list" | "map">("list");
  const [sort, setSort] = useState<ServiceSort>("default");
  const [filters, setFilters] = useState<SearchFilters>(defaults);
  const [draft, setDraft] = useState<SearchFilters>(defaults);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchFilters["searchMode"]>("exact");
  const [locationDraft, setLocationDraft] = useState("");
  const [resolvedDraft, setResolvedDraft] = useState<SearchLocation | null>(null);
  const savedLocation = useSearchLocation(userId);
  // Browsing is session-only; an outage must never delete a remembered preference.
  const [browsingWithoutLocation, setBrowsingWithoutLocation] = useState(false);
  const location = browsingWithoutLocation ? null : savedLocation.location;
  const restoringLocation = savedLocation.loading && !browsingWithoutLocation;
  const [locationBusy, setLocationBusy] = useState(false);
  const [queryError, setQueryError] = useState<string>();
  const [filterError, setFilterError] = useState<string>();
  const [locationReceipt, setLocationReceipt] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [whenOpen, setWhenOpen] = useState(false);
  const [whenDraft, setWhenDraft] = useState<SearchFilters>(defaults);
  const [whenError, setWhenError] = useState<string>();
  const whenFeedback = useRef<HTMLParagraphElement>(null);
  const whenTrigger = useRef<HTMLButtonElement>(null);
  const locationTrigger = useRef<HTMLButtonElement>(null);
  const locked = useRef(false), alive = useRef(true);
  const locationCleanup = useRef<(() => void) | null>(null);
  const queryFeedback = useRef<HTMLParagraphElement>(null);
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  const [selectedService, setSelectedService] = useState<ServiceWithProvider | null>(null);
  const [providerSource, setProviderSource] = useState<ServiceWithProvider | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    // Location is optional. Only close an explicitly opened picker after a
    // successful choice; absence of a remembered location never opens a modal.
    if (!savedLocation.loading && !savedLocation.saving && !locationBusy && location && !savedLocation.error && !queryError) setLocationOpen(false);
  }, [savedLocation.loading, savedLocation.saving, savedLocation.error, locationBusy, location, browsingWithoutLocation]);

  useEffect(() => {
    if (!location) { setResolvedDraft(null); setLocationDraft(""); return; }
    const target = { ...location, name: location.current ? t("searchPage.currentLocation") : location.name };
    setResolvedDraft(target); setLocationDraft(target.name);
  }, [location]);

  useEffect(() => { alive.current = true; return () => { alive.current = false; locationCleanup.current?.(); }; }, []);
  const searchEnabled = !savedLocation.loading || browsingWithoutLocation;
  const search = useQuery({
    queryKey: ["/api/services/search", userId, filters, location?.coords ?? null],
    queryFn: ({ signal }) => fetchPublicSearch(filters, location?.coords ?? null, signal),
    retry: false,
    enabled: searchEnabled,
  });
  const effectiveSort = sort.startsWith("distance-") && !location ? "default" : sort;
  const services = useMemo(() => sortServices(!searchEnabled || search.isError ? [] : search.data?.services ?? [], effectiveSort, location?.coords ?? null), [search.data, search.isError, effectiveSort, location, searchEnabled]);
  const errorKey = search.isError ? searchErrorKey(search.error) : undefined;
  const loading = restoringLocation || (searchEnabled && (search.isPending || search.isFetching));
  const showResults = searchEnabled && !loading && !errorKey;

  function rejectQuery(key: string) {
    setQueryError(key);
    requestAnimationFrame(() => queryFeedback.current?.focus());
  }
  async function submitQuery(event: FormEvent, locationOnly = false) {
    event.preventDefault();
    if (locked.current || restoringLocation || savedLocation.saving) return;
    const next = locationOnly ? filters : { ...filters, searchQuery: query.trim(), searchMode: mode };
    const invalid = validate(next, !!location);
    if (invalid) { rejectQuery(invalid); return; }
    locked.current = true; setLocationBusy(true); setQueryError(undefined); setLocationReceipt(false);
    try {
      const address = locationDraft.trim();
      if (!address && locationOnly) { rejectQuery("searchLocation.required"); return; }
      let target = address ? resolvedDraft?.name === address ? resolvedDraft : location?.name === address ? location : null : null;
      if (address && !target) {
        target = await resolveSearchLocation({ source: "address", inputText: address });
      }
      if (!alive.current) return;
      setFilters(next);
      if (target) { await savedLocation.choose(target); setBrowsingWithoutLocation(false); }
      else setBrowsingWithoutLocation(true);
      if (!alive.current) return;
      setResolvedDraft(target); setLocationDraft(target?.name ?? "");
      // Query submission deliberately leaves the other filter drafts untouched.
      setDraft(current => ({ ...current, searchQuery: next.searchQuery, searchMode: next.searchMode }));
      if (!target) setSort(current => current.startsWith("distance-") ? "default" : current);
    } catch { if (alive.current) rejectQuery("searchPage.locationFailed"); }
    finally { if (alive.current) { locked.current = false; setLocationBusy(false); } }
  }
  function useCurrentLocation() {
    if (locked.current || restoringLocation || savedLocation.saving) return;
    setLocationReceipt(false);
    if (window.isSecureContext === false) { rejectQuery("searchPage.locationInsecure"); return; }
    if (!navigator.geolocation) { rejectQuery("searchPage.locationUnsupported"); return; }
    locked.current = true; setLocationBusy(true); setQueryError(undefined);
    let active = true;
    // The native timeout excludes time spent waiting for permission/visibility.
    const deadline = setTimeout(() => { if (alive.current && active) fail("searchPage.locationTimeout"); }, 35000);
    const cleanup = () => { active = false; clearTimeout(deadline); };
    locationCleanup.current = cleanup;
    const finish = () => { cleanup(); locationCleanup.current = null; locked.current = false; setLocationBusy(false); };
    const fail = (key: string) => { rejectQuery(key); finish(); };
    const locate = (highAccuracy: boolean) => {
      try {
        navigator.geolocation.getCurrentPosition(async position => {
          if (!alive.current || !active) return;
          const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
          if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lng) || Math.abs(coords.lat) > 90 || Math.abs(coords.lng) > 180) {
            fail("searchPage.locationUnavailable"); return;
          }
          const target: SearchLocation = { name: t("searchPage.currentLocation"), coords, current: true, preference: { source: "device", latitude: coords.lat, longitude: coords.lng } };
          // The location button is an explicit action: apply it to results/sorting
          // without committing unfinished query or filter drafts.
          await savedLocation.choose(target);
          setBrowsingWithoutLocation(false);
          if (!alive.current || !active) return;
          setResolvedDraft(target); setLocationDraft(target.name); setLocationReceipt(true); finish();
        }, error => {
          if (!alive.current || !active) return;
          // A quick network fix can fail while GPS is still acquiring a position.
          // Retry once with a fresh, more accurate fix; never retry denied permission.
          if (!highAccuracy && (error.code === 2 || error.code === 3)) { locate(true); return; }
          fail(error.code === 1 ? "searchPage.locationDenied" : error.code === 3 ? "searchPage.locationTimeout" : "searchPage.locationUnavailable");
        }, { enableHighAccuracy: highAccuracy, timeout: highAccuracy ? 20000 : 10000, maximumAge: highAccuracy ? 0 : 60000 });
      } catch {
        if (alive.current && active) fail("searchPage.locationUnavailable");
      }
    };
    locate(false);
  }
  function applyFilters() {
    if (locked.current || restoringLocation || savedLocation.saving) return false;
    const next = { ...draft, distance: !location && !validRadius(draft.distance) ? defaults.distance : draft.distance, searchQuery: filters.searchQuery, searchMode: filters.searchMode };
    const invalid = validate(next, !!location);
    setFilterError(invalid);
    if (invalid) return false;
    if (!location) setBrowsingWithoutLocation(true);
    setFilters(next); setFiltersOpen(false);
    return true;
  }
  function resetDraft() { setDraft({ ...defaults, searchQuery: filters.searchQuery, searchMode: filters.searchMode }); setFilterError(undefined); }
  function openWhen() {
    setWhenDraft({ ...filters, availableOnly: true }); setWhenError(undefined); setWhenOpen(true);
  }
  function applyWhen(event: FormEvent) {
    event.preventDefault();
    if (locked.current || restoringLocation || savedLocation.saving) return;
    const next = { ...filters, ...searchDates(whenDraft) };
    const invalid = validate(next, !!location);
    setWhenError(invalid);
    if (invalid) { requestAnimationFrame(() => whenFeedback.current?.focus()); return; }
    setFilters(next); setDraft(current => ({ ...current, ...searchDates(next) })); setWhenOpen(false);
  }
  function clearAll() {
    if (locked.current) return;
    setFilters(defaults); setDraft(defaults); setQuery(""); setMode("exact"); setSort("default"); setFilterError(undefined); setQueryError(undefined); setLocationReceipt(false);
  }
  function browseWithoutLocation() {
    setBrowsingWithoutLocation(true); setLocationOpen(false); setQueryError(undefined);
    setResolvedDraft(null); setLocationDraft(""); setLocationReceipt(false);
    setFilterError(undefined);
    setDraft(current => validRadius(current.distance) ? current : { ...current, distance: defaults.distance });
    setSort(current => current.startsWith("distance-") ? "default" : current);
    requestAnimationFrame(() => resultsHeading.current?.focus());
  }
  function forgetLocation() {
    setBrowsingWithoutLocation(true);
    queryClient.removeQueries({ predicate: query => query.queryKey[0] === "/api/services/search" && query.queryKey[1] === userId });
    void savedLocation.forget();
  }
  function remove(changes: Partial<SearchFilters>) {
    setFilters(current => ({ ...current, ...changes }));
    setDraft(current => ({ ...current, ...changes })); setFilterError(undefined);
    if (changes.searchQuery !== undefined) { setQuery(changes.searchQuery); setMode(changes.searchMode ?? filters.searchMode); }
  }
  const chips: { key: string; label: string; action: () => void }[] = [];
  const locationLabel = location?.current ? t("searchPage.currentLocation") : location?.name;
  if (filters.category) chips.push({ key: "category", label: categories.data?.find(category => category.key === filters.category)?.name ?? filters.category, action: () => remove({ category: "" }) });
  if (filters.searchQuery) chips.push({ key: "query", label: t("searchPage.queryChip", { query: filters.searchQuery, mode: t(filters.searchMode === "semantic" ? "searchPage.ai" : "searchPage.keyword") }), action: () => remove({ searchQuery: "", searchMode: "exact" }) });
  if (location) chips.push({ key: "location", label: t("searchPage.locationChip", { location: locationLabel, distance: new Intl.NumberFormat(language).format(filters.distance) }), action: () => { forgetLocation(); setSort(current => current.startsWith("distance-") ? "default" : current); } });
  if (filters.serviceType) chips.push({ key: "type", label: t(filters.serviceType === "group" ? "searchPage.group" : "searchPage.individual"), action: () => remove({ serviceType: "" }) });
  filters.ageGroups.forEach(age => chips.push({ key: age, label: t(`searchPage.${age}`), action: () => remove({ ageGroups: filters.ageGroups.filter(value => value !== age) }) }));
  if (filters.date) {
    const date = (value: string) => new Intl.DateTimeFormat(language, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
    chips.push({ key: "date", label: filters.dateEnd ? t("searchPage.dateRange", { start: date(filters.date), end: date(filters.dateEnd) }) : date(filters.date), action: () => remove({ date: "", dateEnd: "", time: "", timeEnd: "", availableOnly: false }) });
  }
  if (filters.time || filters.timeEnd) chips.push({ key: "time", label: t("searchPage.timeRange", { start: filters.time || "00:00", end: filters.timeEnd || "23:59" }), action: () => remove({ time: "", timeEnd: "" }) });
  if (filters.availableOnly) chips.push({ key: "available", label: t("searchPage.availableOnly"), action: () => remove({ availableOnly: false }) });
  const filterProps = { filters: draft, onFiltersChange: (next: SearchFilters) => { setDraft(next); setFilterError(undefined); }, onApply: applyFilters, onReset: resetDraft, error: filterError, pending: locationBusy, hasLocation: !!location };
  const busy = locationBusy || restoringLocation || savedLocation.saving;
  const formatDate = (value: string) => new Intl.DateTimeFormat(language, { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
  const whenSummary = [filters.date ? filters.dateEnd ? t("searchPage.dateRange", { start: formatDate(filters.date), end: formatDate(filters.dateEnd) }) : formatDate(filters.date) : "", filters.time || filters.timeEnd ? t("searchPage.timeRange", { start: filters.time || "00:00", end: filters.timeEnd || "23:59" }) : ""].filter(Boolean).join(" · ") || t("searchPage.anyTime");
  const book = (service: ServiceWithProvider) => { setSelectedService(service); setShowBookingModal(true); };
  const details = (service: ServiceWithProvider) => {
    setSelectedService(service); setShowDetailModal(true);
    if (Number.isInteger(service.id) && service.id > 0 && service.id <= 2147483647) {
      void apiRequest("POST", `/api/services/${service.id}/view`).catch(() => {});
    }
  };

  return <div className="search-design search-page">
    <main className="search-shell">
      <h1 className="sr-only">{t("searchPage.title")}</h1>
      <form className="search-query-form" aria-label={t("searchPage.search")} onSubmit={submitQuery}>
        <div className="search-query-bar">
          <div className="search-query-field">
            <Button ref={locationTrigger} type="button" variant="ghost" className="search-field-icon" data-testid="open-search-location" onClick={() => setLocationOpen(true)} disabled={busy} aria-label={t(location ? "searchLocation.change" : "searchLocation.title")}><MapPin aria-hidden="true" /></Button>
            <div><label htmlFor="search-location">{t("searchPage.whereLabel")}</label><input id="search-location" aria-invalid={(queryError?.startsWith("searchPage.location") || queryError === "searchLocation.required") || false} data-testid="input-location" maxLength={300} aria-describedby={queryError ? "search-query-feedback" : undefined} value={resolvedDraft?.current && locationDraft === resolvedDraft.name ? t("searchPage.currentLocation") : locationDraft} onChange={event => { setLocationDraft(event.target.value); setResolvedDraft(null); setLocationReceipt(false); setQueryError(undefined); }} placeholder={t("searchPage.anyLocation")} disabled={busy} /></div>
          </div>
          <Button ref={whenTrigger} variant="ghost" type="button" className="search-when-field" data-testid="open-search-when" aria-haspopup="dialog" aria-expanded={whenOpen} onClick={openWhen} disabled={busy}>
            <CalendarDays aria-hidden="true" /><span><span className="search-field-label">{t("searchPage.when")}</span><span className="search-field-value">{whenSummary}</span></span>
          </Button>
          <div className="search-query-field"><Search className="search-field-icon" aria-hidden="true" /><div><label htmlFor="service-query">{t("searchPage.whatLabel")}</label><input id="service-query" aria-invalid={queryError === "publicSearch.queryTooLong"} aria-describedby={queryError ? "search-query-feedback" : undefined} data-testid="input-search-query" type="search" maxLength={SEARCH_QUERY_LIMIT} value={query} onChange={event => { setQuery(event.target.value); setQueryError(undefined); }} placeholder={t("searchPage.allServices")} disabled={busy} /></div></div>
          <Button type="submit" className="search-submit" data-testid="button-search-services" disabled={busy} aria-label={t(locationBusy ? "searchPage.resolvingLocation" : "searchPage.search")}><Search aria-hidden="true" /></Button>
        </div>
        <details className="search-query-options"><summary>{t("searchPage.searchMode")}: {t(mode === "exact" ? "searchPage.keyword" : "searchPage.ai")}</summary><div className="search-query-mode"><fieldset><legend className="sr-only">{t("searchPage.searchMode")}</legend>{["exact", "semantic"].map(value => <label key={value}><input type="radio" name="search-mode" value={value} checked={mode === value} disabled={busy} onChange={() => setMode(value as SearchFilters["searchMode"])} aria-describedby="search-mode-help" />{t(value === "exact" ? "searchPage.keyword" : "searchPage.ai")}</label>)}</fieldset><p id="search-mode-help">{t(mode === "exact" ? "searchPage.keywordHelp" : "searchPage.aiHelp")}</p></div></details>
        {queryError && !locationOpen && <p ref={queryFeedback} id="search-query-feedback" tabIndex={-1} role="alert" className="search-query-error">{t(queryError)}</p>}
        {savedLocation.error && !locationOpen && <p role="alert" className="search-query-error">{t(savedLocation.error)} <button type="button" className="search-text-button" onClick={() => setLocationOpen(true)}>{t("searchLocation.change")}</button></p>}
        {locationBusy && <p role="status" className="search-location-receipt">{t("searchPage.resolvingLocation")}</p>}
        {locationReceipt && <p role="status" className="search-location-receipt">{t("searchPage.locationReady")}</p>}
      </form>
      <Dialog open={whenOpen} onOpenChange={setWhenOpen}>
        <DialogContent className="search-design search-when-dialog" closeLabel={t("searchPage.close")} onCloseAutoFocus={event => { event.preventDefault(); whenTrigger.current?.focus(); }}>
          <DialogHeader><DialogTitle>{t("searchPage.when")}</DialogTitle><DialogDescription>{t("searchPage.dateHelp")}</DialogDescription></DialogHeader>
          <form onSubmit={applyWhen} noValidate className="search-when-form">
            <SearchDateFields id="search-when" filters={whenDraft} onChange={changes => { setWhenDraft(current => ({ ...current, ...changes })); setWhenError(undefined); }} error={whenError} disabled={busy} />
            {whenError && <p id="search-when-error" ref={whenFeedback} tabIndex={-1} role="alert" className="search-query-error">{t(whenError)}</p>}
            <div className="search-when-actions"><Button type="button" variant="outline" disabled={busy} onClick={() => { setWhenDraft(current => ({ ...current, ...searchDates(defaults) })); setWhenError(undefined); }}>{t("searchPage.reset")}</Button><Button type="submit" disabled={busy}>{t("searchPage.apply")}</Button></div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={locationOpen} onOpenChange={open => { if (!locationBusy && !savedLocation.saving) setLocationOpen(open); }}>
        <DialogContent className="search-design search-location-dialog" closeLabel={t("searchPage.close")} closeDisabled={locationBusy || savedLocation.saving}
          onOpenAutoFocus={event => { event.preventDefault(); document.getElementById("modal-search-location")?.focus(); }}
          onCloseAutoFocus={event => { event.preventDefault(); locationTrigger.current?.focus(); }}>
          <DialogHeader className="search-location-heading">
            <div className="search-location-icon"><MapPin aria-hidden="true" /></div>
            <DialogTitle>{t("searchLocation.title")}</DialogTitle>
            <DialogDescription>{t("searchLocation.intro")}</DialogDescription>
          </DialogHeader>
          <form className="search-location-form" onSubmit={event => void submitQuery(event, true)} aria-busy={locationBusy || restoringLocation || savedLocation.saving}>
            <Button type="button" variant="outline" className="search-location-gps" onClick={useCurrentLocation} disabled={locationBusy || restoringLocation || savedLocation.saving}><Target aria-hidden="true" />{t("searchPage.useLocation")}</Button>
            <div className="search-location-address">
              <label htmlFor="modal-search-location">{t("searchPage.where")}</label>
              <input id="modal-search-location" maxLength={300} value={resolvedDraft?.current && locationDraft === resolvedDraft.name ? t("searchPage.currentLocation") : locationDraft}
                onChange={event => { setLocationDraft(event.target.value); setResolvedDraft(null); setLocationReceipt(false); setQueryError(undefined); }}
                placeholder={t("searchPage.locationPlaceholder")} disabled={locationBusy || restoringLocation || savedLocation.saving}
                aria-invalid={!!queryError} aria-describedby={queryError ? "search-query-feedback modal-location-privacy-help" : "modal-location-privacy-help"} />
            </div>
            <div className="search-location-privacy">
              <label className="search-choice"><input data-testid="remember-search-location" type="checkbox" checked={savedLocation.remember} onChange={event => savedLocation.setRemember(event.target.checked)} disabled={locationBusy || restoringLocation || savedLocation.saving} aria-describedby="modal-location-privacy-help" />{t(userId ? "searchLocation.rememberAccount" : "searchLocation.rememberGuest")}</label>
              <p id="modal-location-privacy-help">{t("searchLocation.notice")} <a href="/privacy-policy.html" target="_blank" rel="noopener noreferrer">{t("legal.privacyPolicy")}</a></p>
            </div>
            {queryError && <p ref={queryFeedback} id="search-query-feedback" tabIndex={-1} role="alert" className="search-query-error">{t(queryError)}</p>}
            {savedLocation.error && <div role="alert" className="search-location-error"><p>{t(savedLocation.error)}</p><Button type="button" variant="outline" onClick={() => { if (savedLocation.error === "searchLocation.restoreFailed") setBrowsingWithoutLocation(false); void savedLocation.retry(); }} disabled={locationBusy || restoringLocation || savedLocation.saving}>{t("publicSearch.retry")}</Button></div>}
            {(locationBusy || savedLocation.saving || restoringLocation) && <p role="status" className="search-location-receipt">{t(restoringLocation ? "searchLocation.restoring" : "searchPage.resolvingLocation")}</p>}
            <div className="search-location-actions">
              <Button type="button" variant="outline" data-testid="browse-without-location" onClick={browseWithoutLocation} disabled={locationBusy || savedLocation.saving}>{t("searchLocation.browseWithout")}</Button>
              {location && <Button type="button" variant="ghost" data-testid="forget-search-location" onClick={forgetLocation} disabled={locationBusy || restoringLocation || savedLocation.saving}>{t("searchLocation.forget")}</Button>}
              <Button type="submit" data-testid="confirm-search-location" disabled={locationBusy || restoringLocation || savedLocation.saving}><Search aria-hidden="true" />{t(locationBusy ? "searchPage.resolvingLocation" : "searchPage.search")}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <div className="search-workspace"><section className="search-results" aria-labelledby="search-results-title" aria-busy={loading}>
        <div className="search-results-head">
          <h2 id="search-results-title" ref={resultsHeading} tabIndex={-1} aria-live="polite">{loading ? t("publicSearch.loading") : errorKey ? t("searchPage.navSearch") : t("searchPage.resultsCount", { count: services.length })}</h2>
          <div className="search-view-actions">
            <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}><DialogTrigger asChild><Button type="button" variant="ghost" className="search-mobile-filter-trigger"><SlidersHorizontal aria-hidden="true" />{t("searchPage.filters")}</Button></DialogTrigger><DialogContent className="search-design search-filter-dialog" closeLabel={t("searchPage.close")}><DialogHeader className="sr-only"><DialogTitle>{t("searchPage.filters")}</DialogTitle><DialogDescription>{t("searchPage.filterHelp")}</DialogDescription></DialogHeader><ServiceFilters {...filterProps} /></DialogContent></Dialog>
            <SearchResultsSort value={effectiveSort} onChange={setSort} hasLocation={!!location} hasRatings={services.some(service => serviceRating(service) !== undefined)} compact />
          </div>
        </div>
        <div className="search-view-toggle" role="group" aria-label={t("searchPage.resultView")}>{(["grid", "list", "map"] as const).map(value => <Button key={value} variant="ghost" type="button" data-testid={`button-view-${value}`} aria-pressed={viewMode === value} onClick={() => setViewMode(value)}>{value === "grid" ? <LayoutGrid aria-hidden="true" /> : value === "list" ? <List aria-hidden="true" /> : <MapIcon aria-hidden="true" />}<span>{t(`views.${value}`)}</span></Button>)}</div>
        {!!chips.length && <div className="search-chips">{chips.map(chip => <button type="button" className="search-chip" key={chip.key} disabled={locationBusy || restoringLocation || savedLocation.saving} onClick={chip.action} aria-label={t("searchPage.remove", { filter: chip.label })}><bdi>{chip.label}</bdi><X aria-hidden="true" /></button>)}<button type="button" className="search-text-button" onClick={clearAll} disabled={locationBusy || restoringLocation || savedLocation.saving}>{t("searchPage.clear")}</button></div>}
        {!searchEnabled && !loading ? <div className="search-state" role="status"><p>{t("searchLocation.intro")}</p><Button type="button" variant="outline" onClick={browseWithoutLocation}>{t("searchLocation.browseWithout")}</Button></div> : loading ? <div className="search-loading" role="status"><p>{t("publicSearch.loading")}</p><div /><div /></div> : errorKey ? <div className="search-state" role="alert"><h3>{t("searchPage.errorTitle")}</h3><p>{t(errorKey)}</p><Button variant="outline" onClick={() => void search.refetch()} disabled={search.isFetching}>{t("publicSearch.retry")}</Button></div> : <>
          {search.data?.truncated && <p className="search-truncated" role="status">{t("publicSearch.truncated")}</p>}
          {viewMode !== "map" && (services.length ? <div className={`search-cards search-cards-${viewMode}`}>{services.map(service => <ServiceCard key={service.id} service={service} searchLayout hasLocation={!!location} onBook={() => book(service)} onViewDetails={() => details(service)} onViewProvider={() => setProviderSource(service)} />)}</div> : <div className="search-state" role="status"><MapPin aria-hidden="true" /><h3>{t("searchPage.emptyTitle")}</h3><p>{t("publicSearch.empty")}</p><Button onClick={clearAll} disabled={busy}>{t("searchPage.clear")}</Button></div>)}
          {viewMode === "map" && <div><p className="search-map-help">{t("searchPage.mapHelp")} <button type="button" className="search-text-button" onClick={() => setViewMode("list")}>{t("searchPage.backList")}</button></p>{services.length || location ? <div className="search-map"><GoogleMap services={services} userLocation={location?.coords ?? null} onServiceSelect={details} onShowList={() => setViewMode("list")} /></div> : <div className="search-state"><h3>{t("searchPage.emptyTitle")}</h3><p>{t("searchPage.anyLocation")}</p><Button variant="outline" onClick={() => setViewMode("list")}>{t("searchPage.backList")}</Button></div>}</div>}
        </>}
        {showResults && services.length > 0 && <p className="search-footer">{t("searchPage.footer")}</p>}
      </section></div>
    </main>
    {showBookingModal && selectedService && <BookingModal service={selectedService} onClose={() => setShowBookingModal(false)} />}
    <ProviderServicesDialog source={providerSource} open={providerSource !== null && !showDetailModal && !showBookingModal} onClose={() => setProviderSource(null)} onBook={book} onViewDetails={details} />
    <ServiceDetailModal service={selectedService} searchLayout open={showDetailModal} onViewProvider={() => { if (selectedService) setProviderSource(selectedService); setShowDetailModal(false); }} onClose={() => { setShowDetailModal(false); setSelectedService(null); }} onBook={() => { setShowDetailModal(false); setShowBookingModal(true); }} />
    {!userId && <div className="search-bottom-navigation"><BottomNavigation /></div>}
  </div>;
}
