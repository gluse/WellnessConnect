import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronsUpDown } from "lucide-react";
import type { SubscriptionOption, SubscriptionOptionsPage, SubscriptionTarget } from "@shared/storefront";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SubscriptionTargetPicker({ kind, value, disabled, onChange, onAccessError }: {
  kind: SubscriptionTarget["kind"]; value: SubscriptionOption | null; disabled: boolean;
  onChange: (option: SubscriptionOption | null) => void; onAccessError: (error: Error) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(value?.name ?? "");
  const [debounced, setDebounced] = useState(search.trim());
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const highlighted = useRef<HTMLLIElement>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), 200);
    return () => window.clearTimeout(timer);
  }, [search]);
  const settled = search.trim() === debounced;
  const options = useInfiniteQuery<SubscriptionOptionsPage>({
    queryKey: ["/api/admin/subscriptions/options", kind, debounced], initialPageParam: 1,
    queryFn: async ({ pageParam, signal }) => (await apiRequest("GET", `/api/admin/subscriptions/options?${new URLSearchParams({ kind, search: debounced, page: String(pageParam) })}`, undefined, signal)).json(),
    getNextPageParam: (last, pages) => last.hasMore ? pages.length + 1 : undefined,
    enabled: open && settled && !disabled, staleTime: 0, gcTime: 0, retry: false,
  });
  useEffect(() => {
    if (options.error && /^(401|403):/.test(options.error.message)) onAccessError(options.error);
  }, [options.error, onAccessError]);
  useEffect(() => { highlighted.current?.scrollIntoView({ block: "nearest" }); }, [active]);
  // Do not offer results from a previous search while the next search settles.
  const items = settled ? options.data?.pages.flatMap(page => page.items) ?? [] : [];
  const loading = !settled || options.isPending;
  const choose = (option: SubscriptionOption) => { onChange(option); setSearch(option.name); setOpen(false); setActive(0); };
  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") { setOpen(false); event.preventDefault(); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault(); setOpen(true);
      setActive(current => open ? Math.max(0, Math.min(items.length - 1, current + (event.key === "ArrowDown" ? 1 : -1))) : 0);
    } else if (event.key === "Enter" && open) {
      event.preventDefault(); if (items[active] && !options.isError) choose(items[active]);
    }
  }
  const placeholder = t(kind === "company" ? "storefront.chooseCompany" : "storefront.chooseProvider");
  return <div className="relative" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
    <div className="relative">
      <Input ref={input} id="subscription-target" role="combobox" aria-autocomplete="list" aria-expanded={open}
        aria-controls={open ? "subscription-target-options" : undefined} aria-activedescendant={open && !options.isError && items[active] ? `subscription-option-${active}` : undefined}
        aria-describedby="subscription-target-help" autoComplete="off" placeholder={placeholder} value={search} maxLength={200} disabled={disabled}
        className="pr-10" onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onKeyDown={keyDown}
        onChange={event => { setSearch(event.target.value); setActive(0); setOpen(true); if (value) onChange(null); }} />
      <button type="button" disabled={disabled} aria-label={placeholder} className="absolute right-0 top-0 h-10 w-10 flex items-center justify-center rounded-md focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        onMouseDown={event => event.preventDefault()} onClick={() => { if (open) setOpen(false); else { input.current?.focus(); setOpen(true); } }}><ChevronsUpDown className="h-4 w-4" aria-hidden="true" /></button>
    </div>
    {value?.detail && <p className="mt-1 text-sm text-muted-foreground break-all">{value.detail}</p>}
    {open && <div className="absolute z-50 mt-1 w-full min-w-0 rounded-md border bg-popover text-popover-foreground shadow-lg p-1">
      {loading ? <p role="status" className="p-3 text-sm">{t("storefront.loadingChoices")}</p> : options.isError ? <div role="alert" className="p-3 space-y-2 text-sm">
        <p>{t("storefront.choicesError")}</p><Button type="button" size="sm" variant="outline" disabled={options.isFetching} onClick={() => void (options.isFetchNextPageError ? options.fetchNextPage() : options.refetch())}>{t("catalog.retry")}</Button>
      </div> : !items.length ? <p role="status" className="p-3 text-sm">{t("storefront.noChoices")}</p> : null}
      <ul id="subscription-target-options" role="listbox" aria-label={placeholder} aria-busy={loading || options.isFetching} className="max-h-64 overflow-y-auto">
        {!loading && !options.isError && items.map((option, index) => <li key={`${option.target.kind}:${option.target.id}`} ref={index === active ? highlighted : undefined}
          id={`subscription-option-${index}`} role="option" aria-selected={value?.target.kind === option.target.kind && value.target.id === option.target.id}
          className={`rounded-sm px-3 py-2 cursor-pointer text-sm break-words ${active === index ? "bg-accent text-accent-foreground" : "hover:bg-accent"}`}
          onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => choose(option)}>
          <span className="block font-medium">{option.name}{option.isActive === false && <span className="ml-2 font-normal text-muted-foreground">{t("storefront.closedCompany")}</span>}</span>
          {option.detail && <span className="block text-muted-foreground break-all">{option.detail}</span>}
        </li>)}
      </ul>
      {!loading && !options.isError && options.hasNextPage && <Button type="button" className="w-full" variant="ghost" size="sm" disabled={options.isFetchingNextPage} onClick={() => void options.fetchNextPage()}>{t(options.isFetchingNextPage ? "storefront.loadingChoices" : "storefront.moreChoices")}</Button>}
    </div>}
  </div>;
}
