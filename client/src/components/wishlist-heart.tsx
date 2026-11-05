import { Heart, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useWishlist } from "@/components/wishlist-provider";

export default function WishlistHeart({ serviceId, className = "" }: { serviceId: number; className?: string }) {
  const state = useWishlist(serviceId);
  const { t } = useTranslation();
  if (!state) return null;
  const saved = state.saved(serviceId), pending = state.pending.has(serviceId), failed = state.errors.has(serviceId);
  return <span className={`wishlist-control ${className}`}>
    <button type="button" data-wishlist-heart={serviceId} aria-pressed={saved} aria-label={t(state.failed ? "wishlist.retryState" : saved ? "wishlist.remove" : "wishlist.add")}
      title={t(saved ? "wishlist.remove" : "wishlist.add")} disabled={pending || (!state.ready && !state.failed)}
      onClick={event => { event.stopPropagation(); event.currentTarget.focus(); if (state.failed) state.retry(); else void state.toggle(serviceId); }}
      className={`wishlist-heart ${saved ? "is-saved" : ""}`}>
      {state.failed ? <RefreshCw className="h-[18px] w-[18px]" aria-hidden="true" /> : <Heart className="h-[18px] w-[18px]" fill={saved ? "currentColor" : "none"} aria-hidden="true" />}
    </button>
    {(failed || state.failed) && <span role="alert" className="wishlist-heart-error">{t(failed ? "wishlist.saveFailed" : "wishlist.stateFailed")}</span>}
  </span>;
}
