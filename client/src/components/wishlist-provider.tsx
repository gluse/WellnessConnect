import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import type { WishlistMembership } from "@shared/wishlist";
import { serviceReturnTo } from "@shared/wishlist";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type WishlistState = {
  userId: string | null; register: (id: number) => () => void; saved: (id: number) => boolean;
  ready: boolean; failed: boolean; pending: Set<number>; errors: Set<number>;
  toggle: (id: number) => Promise<void>; retry: () => void;
};
const WishlistContext = createContext<WishlistState | null>(null);
export const wishlistListKey = (userId: string) => ["wishlist-services", userId];

/** One account-owned cache batches every mounted heart; public service DTOs stay public. */
export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user, isLoading, isError } = useAuth();
  const userId = !isLoading && !isError ? user?.id ?? null : null;
  return <AccountWishlist key={userId ?? "guest"} userId={userId} authReady={!isLoading && !isError}>{children}</AccountWishlist>;
}

function AccountWishlist({ userId, authReady, children }: { userId: string | null; authReady: boolean; children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const [ids, setIds] = useState<number[]>([]);
  const [overrides, setOverrides] = useState<Map<number, boolean>>(new Map());
  const [pending, setPending] = useState<Set<number>>(new Set());
  const [errors, setErrors] = useState<Set<number>>(new Set());
  const [guestService, setGuestService] = useState<number | null>(null);
  const guestTrigger = useRef<HTMLElement | null>(null);
  const locked = useRef(new Set<number>()), alive = useRef(true);
  const registrations = useRef(new Map<number, number>());
  useEffect(() => { alive.current = true; return () => { alive.current = false; void client.cancelQueries({ queryKey: ["wishlist-membership", userId] }); client.removeQueries({ queryKey: ["wishlist-membership", userId] }); if (userId) client.removeQueries({ queryKey: wishlistListKey(userId) }); }; }, [client, userId]);
  const membership = useQuery<WishlistMembership>({
    queryKey: ["wishlist-membership", userId, ids], enabled: !!userId && !!ids.length,
    queryFn: async ({ signal }) => {
      const pages = await Promise.all(Array.from({ length: Math.ceil(ids.length / 100) }, (_, index) =>
        apiRequest("GET", `/api/wishlist/membership?serviceIds=${ids.slice(index * 100, index * 100 + 100).join(",")}`, undefined, signal).then(response => response.json() as Promise<WishlistMembership>)));
      return { serviceIds: pages.flatMap(page => page.serviceIds) };
    }, retry: false, staleTime: 30_000, gcTime: 0, refetchOnWindowFocus: "always",
  });
  const savedIds = useMemo(() => new Set(membership.data?.serviceIds ?? []), [membership.data]);
  const register = useRef((id: number) => {
    registrations.current.set(id, (registrations.current.get(id) ?? 0) + 1);
    if (alive.current) setIds(current => current.includes(id) ? current : [...current, id].sort((a, b) => a - b));
    return () => {
      const count = (registrations.current.get(id) ?? 1) - 1;
      if (count > 0) registrations.current.set(id, count);
      else {
        registrations.current.delete(id);
        if (alive.current) setIds(current => current.filter(value => value !== id));
      }
    };
  }).current;
  async function toggle(id: number) {
    if (!userId) { guestTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setGuestService(id); return; }
    if (locked.current.has(id) || !membership.isSuccess) return;
    locked.current.add(id);
    const desired = !(overrides.get(id) ?? savedIds.has(id));
    setPending(current => new Set(current).add(id));
    setErrors(current => { const next = new Set(current); next.delete(id); return next; });
    await client.cancelQueries({ queryKey: ["wishlist-membership", userId] });
    if (!alive.current) return;
    setOverrides(current => new Map(current).set(id, desired));
    try {
      await apiRequest(desired ? "PUT" : "DELETE", `/api/wishlist/services/${id}`);
      if (!alive.current) return;
      await Promise.all([client.invalidateQueries({ queryKey: ["wishlist-membership", userId] }), client.invalidateQueries({ queryKey: wishlistListKey(userId) }), client.invalidateQueries({ queryKey: ["inbox"] })]);
    } catch (error) {
      if (!alive.current) return;
      setErrors(current => new Set(current).add(id));
      if (error instanceof Error && error.message.startsWith("401:")) client.setQueryData(["/api/auth/user"], null);
    } finally {
      locked.current.delete(id);
      if (alive.current) {
        setOverrides(current => { const next = new Map(current); next.delete(id); return next; });
        setPending(current => { const next = new Set(current); next.delete(id); return next; });
      }
    }
  }
  return <WishlistContext.Provider value={{ userId, register, saved: id => overrides.get(id) ?? savedIds.has(id), ready: authReady && (!userId || membership.isSuccess),
    failed: !!userId && membership.isError, pending, errors, toggle, retry: () => { void membership.refetch(); } }}>
    {children}
    <Dialog open={guestService !== null} onOpenChange={open => { if (!open) setGuestService(null); }}>
      <DialogContent dir={i18n.dir()} closeLabel={t("wishlist.close")} className="max-w-[calc(100%-2rem)] rounded-xl"
        onCloseAutoFocus={event => { event.preventDefault(); if (guestTrigger.current?.isConnected) guestTrigger.current.focus(); }}>
        <DialogHeader><DialogTitle>{t("wishlist.signInTitle")}</DialogTitle><DialogDescription>{t("wishlist.signInHelp")}</DialogDescription></DialogHeader>
        <Button asChild><Link onClick={() => setGuestService(null)} href={`/login?returnTo=${encodeURIComponent(guestService ? serviceReturnTo(guestService) : "/wishlist")}`}>{t("wishlist.signIn")}</Link></Button>
      </DialogContent>
    </Dialog>
  </WishlistContext.Provider>;
}

export function useWishlist(serviceId?: number) {
  const state = useContext(WishlistContext);
  useEffect(() => { if (serviceId && state) return state.register(serviceId); }, [serviceId, state?.register]);
  return state;
}
