import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { WorkspaceContext } from "@shared/schema";
import type { InboxScope } from "@shared/wishlist";
import { useAuth } from "@/hooks/useAuth";

export function inboxQuery(scope: InboxScope) {
  const query = new URLSearchParams({ scope: scope.scope });
  if (scope.scope !== "customer" && scope.companyId) query.set("companyId", String(scope.companyId));
  return query.toString();
}
export function useInboxScope(viewer?: "customer" | "provider" | "all") {
  const { user, isLoading, isError } = useAuth();
  const [location] = useLocation();
  const search = useSearch();
  const parameters = new URLSearchParams(search);
  const requestedScope = location === "/inbox" ? parameters.get("scope") : null;
  const invalidScope = !viewer && requestedScope !== null && !["customer", "provider", "all"].includes(requestedScope);
  const kind = viewer ?? (location === "/inbox" ? requestedScope === "customer" || requestedScope === "provider" ? requestedScope : "all" : location.startsWith("/my-services") ? "provider" : "customer");
  const needsContext = kind !== "customer";
  const context = useQuery<WorkspaceContext>({ queryKey: ["/api/company/context"], enabled: !!user && needsContext, retry: false });
  const scope: InboxScope = { scope: kind, ...(needsContext && context.data?.company ? { companyId: context.data.company.id } : {}) };
  const ready = !!user && !isLoading && !isError && (!needsContext || context.isSuccess && !context.data.invalid);
  const requestedCompany = !viewer && location === "/inbox" ? parameters.get("companyId") : null;
  const mismatched = invalidScope || requestedCompany !== null && (!needsContext || requestedCompany !== String(scope.companyId));
  return { scope, query: inboxQuery(scope), ready: ready && !mismatched, denied: mismatched || needsContext && (context.isError || !!context.data?.invalid),
    userId: user?.id ?? null, canSend: kind === "customer" || !!context.data?.permissions.manageBookings,
    label: needsContext ? context.data?.company?.name : undefined };
}

export function usePageVisible() {
  const [visible, setVisible] = useState(() => typeof document === "undefined" || document.visibilityState !== "hidden");
  useEffect(() => { const update = () => setVisible(document.visibilityState !== "hidden"); document.addEventListener("visibilitychange", update); return () => document.removeEventListener("visibilitychange", update); }, []);
  return visible;
}
