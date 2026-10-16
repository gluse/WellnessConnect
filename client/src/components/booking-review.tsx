import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { reviewSchema, type ReviewInput } from "@shared/reviews";
import type { BookingWithDetails, ServiceReview } from "@shared/schema";

export function BookingReviewSummary({ booking }: { booking: BookingWithDetails }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { updateCache, onError } = useReviewCache(booking);
  const remove = useMutation({
    mutationFn: async () => { await apiRequest("DELETE", `/api/bookings/${booking.id}/review`); },
    onSuccess: () => updateCache(null),
    onError,
  });
  const review = booking.review!;
  if (editing) return <ReviewEditor booking={booking} review={review} onSaved={() => setEditing(false)} onCancel={() => setEditing(false)} />;
  return <div className="rounded-lg bg-neutral-50 p-3 text-sm space-y-1" data-testid={`review-saved-${review.bookingId}`}>
    <p className="font-medium">{t("reviews.yourRating", { rating: review.rating })}</p>
    {review.comment && <p className="whitespace-pre-wrap break-words">{review.comment}</p>}
    {confirmDelete ? <div className="space-y-2" role="group" aria-label={t("reviews.deleteConfirm")}>
      <p>{t("reviews.deleteConfirm")}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="destructive" size="sm" disabled={remove.isPending}
          onClick={() => { if (!remove.isPending) remove.mutate(); }}>{t(remove.isPending ? "reviews.deleting" : "reviews.confirmDelete")}</Button>
        <Button type="button" variant="outline" size="sm" disabled={remove.isPending} onClick={() => { setConfirmDelete(false); remove.reset(); }}>{t("common.cancel")}</Button>
      </div>
    </div> : <div className="flex flex-wrap gap-2 pt-2">
      <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>{t("reviews.edit")}</Button>
      <Button type="button" variant="outline" size="sm" onClick={() => setConfirmDelete(true)}>{t("reviews.delete")}</Button>
    </div>}
    {remove.isError && <p role="alert" className="text-destructive">{t("reviews.deleteError")}</p>}
  </div>;
}

function useReviewCache(booking: BookingWithDetails) {
  const queryClient = useQueryClient();
  return {
    updateCache: (review: ServiceReview | null) => {
      queryClient.setQueryData<BookingWithDetails[]>(["/api/bookings/seeker"], current =>
        current?.map(row => row.id === booking.id ? { ...row, review } : row));
      void queryClient.invalidateQueries({ queryKey: ["/api/services/search"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/services/semantic-search"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/services", booking.serviceId, "reviews"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/bookings/seeker"] });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) queryClient.setQueryData(["/api/auth/user"], null);
      if (/^(404|409):/.test(error.message)) {
        void queryClient.invalidateQueries({ queryKey: ["/api/bookings/seeker"] });
      }
    },
  };
}

function ReviewEditor({ booking, review, onSaved, onCancel }: {
  booking: BookingWithDetails; review?: ServiceReview; onSaved: () => void; onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { updateCache, onError } = useReviewCache(booking);
  const [rating, setRating] = useState(review?.rating ?? 0);
  const [comment, setComment] = useState(review?.comment ?? "");
  const [validation, setValidation] = useState("");
  const save = useMutation({
    mutationFn: async (input: ReviewInput): Promise<ServiceReview> =>
      (await apiRequest(review ? "PATCH" : "POST", `/api/bookings/${booking.id}/review`, input)).json(),
    onSuccess: saved => { onSaved(); updateCache(saved); },
    onError,
  });
  const required = rating > 0 && rating < 3;
  return <form className="space-y-3" data-testid={`review-form-${booking.id}`} onSubmit={event => {
        event.preventDefault();
        if (save.isPending) return;
        const parsed = reviewSchema.safeParse({ rating, comment });
        if (!parsed.success) {
          setValidation(t(!rating ? "reviews.chooseRating" : comment.trim().length > 2000 ? "reviews.commentTooLong" : "reviews.commentRequired"));
          return;
        }
        setValidation("");
        save.mutate(parsed.data);
      }}>
        <fieldset disabled={save.isPending} className="space-y-2">
          <legend className="text-sm font-medium">{t("reviews.rating")}</legend>
          <div className="flex gap-1">{[1, 2, 3, 4, 5].map(value =>
            <label key={value} className="relative cursor-pointer rounded-md p-2 hover:bg-amber-50">
              <input type="radio" name={`rating-${booking.id}`} value={value} checked={rating === value}
                aria-label={t("reviews.stars", { count: value })}
                onChange={() => { setRating(value); setValidation(""); }} className="peer sr-only" />
              <Star aria-hidden="true" className={`h-6 w-6 peer-focus-visible:ring-2 peer-focus-visible:ring-ring rounded-sm ${value <= rating ? "fill-amber-400 text-amber-400" : "text-neutral-400"}`} />
            </label>)}</div>
          <label htmlFor={`review-comment-${booking.id}`} className="block text-sm font-medium">
            {t(required ? "reviews.commentRequiredLabel" : "reviews.commentOptionalLabel")}
          </label>
          <textarea id={`review-comment-${booking.id}`} value={comment} required={required} maxLength={2000}
            onChange={event => { setComment(event.target.value); setValidation(""); }} rows={3}
            aria-describedby={`review-help-${booking.id}`} className="w-full rounded-md border border-input bg-background p-3 text-sm" />
          <p id={`review-help-${booking.id}`} className="text-xs text-neutral-500">{t("reviews.commentHelp")} {t("reviews.publicNotice")}</p>
        </fieldset>
        {(validation || save.isError) && <p role="alert" className="text-sm text-destructive">{validation || t("reviews.saveError")}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={save.isPending}>{t(save.isPending ? "reviews.saving" : review ? "reviews.saveChanges" : "reviews.submit")}</Button>
          <Button type="button" variant="outline" disabled={save.isPending} onClick={onCancel}>{t(review ? "common.cancel" : "reviews.later")}</Button>
        </div>
      </form>;
}

function BookingReviewForm({ booking, onReviewed }: { booking: BookingWithDetails; onReviewed: () => void }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  // Keep a deferred draft mounted, so Later does not discard its values.
  return <div className="border rounded-lg p-4 space-y-3" data-testid={`review-prompt-${booking.id}`}>
    <p className="font-medium break-words">{booking.service.name}</p>
    <p className="text-sm text-neutral-500">{new Date(booking.scheduledDate).toLocaleString(i18n.resolvedLanguage)}</p>
    <p className="text-sm text-neutral-600">{t("reviews.prompt")}</p>
    {!open && <Button variant="outline" onClick={() => setOpen(true)}>{t("reviews.write")}</Button>}
    <div hidden={!open}>
      <ReviewEditor booking={booking} onSaved={onReviewed} onCancel={() => setOpen(false)} />
    </div>
  </div>;
}

export default function PendingReviews({ bookings }: { bookings: BookingWithDetails[] }) {
  const { t } = useTranslation();
  const [reviewedId, setReviewedId] = useState<number | null>(null);
  const reviewed = bookings.some(booking => booking.id === reviewedId && booking.review);
  const pending = bookings.filter(booking => booking.status === "completed" && !booking.review);
  if (!pending.length) return reviewed ? <p role="status" className="text-sm text-green-700">{t("reviews.thanks")}</p> : null;
  return <section aria-labelledby="pending-reviews-title" className="border rounded-xl bg-white p-4 sm:p-6 space-y-4">
    <h2 id="pending-reviews-title" className="text-lg font-semibold">{t("reviews.title")}</h2>
    {reviewed && <p role="status" className="text-sm text-green-700">{t("reviews.thanks")}</p>}
    {pending.map(booking => <BookingReviewForm key={booking.id} booking={booking} onReviewed={() => setReviewedId(booking.id)} />)}
  </section>;
}
