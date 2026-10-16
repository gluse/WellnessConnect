import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { relativeReviewDate } from "@/lib/review-date";
import type { ServiceReviewPage } from "@shared/reviews";

export default function ServiceReviews({ serviceId }: { serviceId: number }) {
  const { t, i18n } = useTranslation();
  const [page, setPage] = useState(1);
  const query = useQuery<ServiceReviewPage>({
    queryKey: ["/api/services", serviceId, "reviews", page],
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/services/${serviceId}/reviews?page=${page}`, { signal });
      if (!response.ok) throw new Error("Unable to load reviews");
      return response.json();
    },
    staleTime: 0,
  });
  const locale = i18n.resolvedLanguage || i18n.language || "en";
  return <div className="space-y-4" aria-live="polite">
    {query.isLoading ? <p role="status">{t("reviews.loading")}</p> : query.isError ?
      <div role="alert" className="space-y-3">
        <p>{t("reviews.loadError")}</p>
        <Button variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}>{t("reviews.retry")}</Button>
      </div> : <>
        {!query.data?.reviews.length ? <p className="text-sm text-neutral-500">{t("reviews.empty")}</p> :
          <ul className="space-y-4">{query.data.reviews.map(review => <li key={review.id} className="border rounded-lg p-4 space-y-3" data-testid={`public-review-${review.id}`}>
            <div className="flex flex-wrap justify-between gap-2">
              <p className="font-medium break-words">{review.reviewerName || t("reviews.customer")}</p>
              <time dateTime={review.createdAt} title={new Date(review.createdAt).toLocaleDateString(locale)} className="text-sm text-neutral-500">
                {relativeReviewDate(review.createdAt, locale)}
              </time>
            </div>
            <div className="flex gap-1" role="img" aria-label={t("reviews.stars", { count: review.rating })}>
              {[1, 2, 3, 4, 5].map(star => <Star key={star} aria-hidden="true" className={`h-4 w-4 ${star <= review.rating ? "fill-amber-400 text-amber-400" : "text-neutral-300"}`} />)}
            </div>
            {review.comment && <p className="text-sm whitespace-pre-wrap break-words">{review.comment}</p>}
          </li>)}</ul>}
        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" disabled={page === 1} onClick={() => setPage(current => current - 1)}>{t("reviews.previous")}</Button>
          <span className="text-sm text-neutral-500">{t("reviews.page", { page })}</span>
          <Button variant="outline" disabled={!query.data?.hasMore} onClick={() => setPage(current => current + 1)}>{t("reviews.next")}</Button>
        </div>
      </>}
  </div>;
}
