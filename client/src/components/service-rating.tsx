import { Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { serviceRating } from "@/lib/service-sort";
import type { ServiceWithProvider } from "@shared/schema";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import ServiceReviews from "@/components/service-reviews";

export default function ServiceRating({ service }: { service: ServiceWithProvider }) {
  const { t } = useTranslation();
  const rating = serviceRating(service);
  if (rating !== undefined) return <Dialog>
    <DialogTrigger asChild>
      <button type="button" className="flex flex-wrap items-center gap-1 text-sm text-neutral-600 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        aria-label={t("reviews.view", { name: service.name })} data-testid={`button-reviews-${service.id}`}>
        <Star className="w-4 h-4 text-amber-400 fill-current" aria-hidden="true" />
        <span className="font-medium">{rating.toFixed(1)}</span>
        <span>{t("service.ratingOutOfFive")}</span>
        {typeof service.reviewCount === "number" && service.reviewCount > 0 && <span>· {t("reviews.count", { count: service.reviewCount })}</span>}
      </button>
    </DialogTrigger>
    <DialogContent className="max-w-2xl max-h-[85dvh] overflow-y-auto" data-testid="dialog-service-reviews">
      <DialogHeader>
        <DialogTitle>{t("reviews.heading")}</DialogTitle>
        <DialogDescription>{service.name}</DialogDescription>
      </DialogHeader>
      <ServiceReviews serviceId={service.id} />
    </DialogContent>
  </Dialog>;
  return (
    <div className="flex items-center gap-1 text-sm text-neutral-500" data-testid={`text-rating-${service.id}`}>
      {t("service.notRated")}
    </div>
  );
}
