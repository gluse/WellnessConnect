import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { PublicSearchError } from "@/lib/public-search";
import { Button } from "@/components/ui/button";

export default function SearchPagination({ hasNextPage, fetching, failed, error, hasResults, onLoad, onRefresh }: {
  hasNextPage: boolean; fetching: boolean; failed: boolean; error: unknown; hasResults: boolean;
  onLoad: () => void; onRefresh: () => void;
}) {
  const { t } = useTranslation(), sentinel = useRef<HTMLDivElement>(null);
  const moreButton = useRef<HTMLButtonElement | null>(null), end = useRef<HTMLParagraphElement>(null), restoreFocus = useRef(false);
  const setMoreButton = useCallback((element: HTMLButtonElement | null) => {
    if (!element && moreButton.current && document.activeElement === moreButton.current) restoreFocus.current = true;
    moreButton.current = element;
  }, []);
  useEffect(() => {
    if (!fetching && restoreFocus.current) {
      restoreFocus.current = false;
      if (document.activeElement === document.body) (hasNextPage ? moreButton.current : end.current)?.focus({ preventScroll: true });
    }
  }, [hasNextPage, fetching]);
  const latest = useRef({ hasNextPage, fetching, failed, onLoad });
  latest.current = { hasNextPage, fetching, failed, onLoad };
  const expired = error instanceof PublicSearchError && (error.status === 400 || error.status === 409 || error.status === 410);
  useEffect(() => {
    if (!hasNextPage || !sentinel.current || typeof IntersectionObserver === "undefined") return;
    let intersecting = false;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) { intersecting = false; continue; }
        if (intersecting) continue;
        intersecting = true;
        const state = latest.current;
        if (state.hasNextPage && !state.fetching && !state.failed && document.visibilityState !== "hidden" && !document.querySelector('[role="dialog"][data-state="open"]')) state.onLoad();
      }
    }, { rootMargin: "300px 0px" });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [hasNextPage]);
  return <div className="search-pagination" data-search-pagination>
    {hasNextPage && <div ref={sentinel} data-search-sentinel aria-hidden="true" className="h-px" />}
    {failed && <p role="alert">{t(expired ? "searchPage.expiredResults" : "searchPage.moreFailed")}</p>}
    {expired ? <Button type="button" variant="outline" data-testid="button-search-refresh" disabled={fetching} onClick={onRefresh}>{t("searchPage.refreshResults")}</Button> :
      hasNextPage ? <Button ref={setMoreButton} type="button" variant="outline" data-testid="button-search-load-more" disabled={fetching} onClick={event => { event.currentTarget.focus({ preventScroll: true }); restoreFocus.current = true; onLoad(); }}>{t(fetching ? "searchPage.loadingMore" : failed ? "publicSearch.retry" : "searchPage.loadMore")}</Button> :
      hasResults && <p ref={end} role="status" tabIndex={-1} data-testid="search-results-end">{t("searchPage.endResults")}</p>}
    {fetching && <p role="status">{t("searchPage.loadingMore")}</p>}
  </div>;
}
