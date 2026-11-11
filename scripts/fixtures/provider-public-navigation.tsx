import React from "react";
import { createRoot } from "react-dom/client";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../../client/src/lib/queryClient";
import type { PublicStorefront } from "../../shared/storefront";
import type { ServiceWithProvider, WorkspaceContext } from "../../shared/schema";

declare const __FORM_RESOURCES__: Record<string, { translation: object }>;
const params = new URLSearchParams(location.search);
const user = { id: "synthetic-viewer", firstName: "Synthetic", currentRole: "provider", providerType: "individual" };
const context: WorkspaceContext = { company: null, membership: null, workspaces: [], invalid: false,
  permissions: { manageServices: true, manageSchedules: !params.has("viewer"), manageBookings: true, manageTeam: false, isOwner: true, manageCompany: false, readAll: true } };
const provider = { id: "pro-provider", firstName: "Pro", lastName: "Studio", providerType: "individual" };
const image = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"><rect width="320" height="320" fill="#cadfcf"/><circle cx="160" cy="160" r="85" fill="#537660"/></svg>');
const proService = { id: 1, providerId: provider.id, provider, companyId: null, storefrontSlug: "pro-studio", name: "Morning yoga", description: "A calm practice at our synthetic studio.", category: "wellness", price: "18.00", currency: "EUR", duration: 60, serviceType: "group", maxCapacity: 8, instantBooking: true, isActive: true, ageGroups: ["adults"], targetGender: "both", imageUrl: image, rating: 4.8, reviewCount: 12, employee: null, address: "Synthetic studio address", latitude: null, longitude: null } as unknown as ServiceWithProvider;
const proServices = [proService, { ...proService, id: 5, name: "Evening yoga", duration: 90, imageUrl: "data:image/png;base64,broken" }, { ...proService, id: 6, name: "Weekend retreat", duration: 1440, price: "120.00", imageUrl: null, instantBooking: false }];
const rows = [...proServices,
  { ...proService, id: 2, providerId: "free", provider: { ...provider, id: "free", firstName: "Free", lastName: "Provider" }, storefrontSlug: null, name: "Free provider massage" },
  { ...proService, id: 3, providerId: "expired", provider: { ...provider, id: "expired", firstName: "Expired", lastName: "Provider" }, storefrontSlug: null, name: "Expired provider training" },
  { ...proService, id: 4, companyId: 7, storefrontSlug: "pro-company", provider: { ...provider, providerType: "company", companyName: "Pro Company" }, employee: { name: "Synthetic employee" }, name: "Company Pilates" },
] as ServiceWithProvider[];
const pages: Record<string, PublicStorefront> = {
  "pro-studio": { slug: "pro-studio", name: "Pro Studio", description: "Our published services", logoUrl: null, coverUrl: null, services: proServices },
  "pro-company": { slug: "pro-company", name: "Pro Company", description: "", logoUrl: null, coverUrl: null, services: [rows.at(-1)!] },
};
const fixture = { ready: false, reads: [] as string[], writes: [] as string[], unexpected: [] as string[], pageResult: params.get("result") || "success", release: null as (() => void) | null,
  language: async (language: string) => { await i18next.changeLanguage(language); document.documentElement.lang = language; },
  refresh: () => queryClient.invalidateQueries({ queryKey: ["/api/storefronts"] }),
};
Object.assign(window, { phase2Fixture: fixture });
window.fetch = async (input, options = {}) => {
  const path = String(input), method = options.method || "GET";
  if (method === "GET") fixture.reads.push(path); else fixture.writes.push(`${method} ${path}`);
  // All writes, including analytics, terminate in memory here.
  if (method === "POST" && /^\/api\/services\/\d+\/view$/.test(path)) return new Response(null, { status: 204 });
  if (method === "GET") {
    if (path === "/api/auth/user") return Response.json(params.has("guest") ? null : user);
    if (path === "/api/company/context") return Response.json(context);
    if (path === "/api/categories") return Response.json([{ key: "wellness", name: "Wellness", icon: "" }]);
    if (path.startsWith("/api/services/search/page?")) return Response.json({ services: rows, nextCursor: null, mode: "text" });
    if (path.startsWith("/api/storefronts/")) {
      if (fixture.pageResult === "pending") await new Promise<void>(resolve => { fixture.release = resolve; });
      if (fixture.pageResult === "error") return Response.json({}, { status: 503 });
      const page = pages[path.split("/").at(-1)!];
      return Response.json(fixture.pageResult === "empty" && page ? { ...page, services: [] } : page ?? {}, { status: fixture.pageResult === "missing" || !page ? 404 : 200 });
    }
    if (path === "/api/services/provider") return Response.json([]);
    if (path === "/api/provider/employees") return Response.json([]);
    if (path === "/api/account/search-location") return Response.json(null);
    if (path === "/api/admin/access") return Response.json({ isAdmin: false });
    if (path === "/api/billing/runtime") return Response.json({ subscriptionsReady: false, administrationReady: false, hostedOrigins: [] });
    if (path.startsWith("/api/wishlist/membership?")) return Response.json({ serviceIds: [] });
    if (path.startsWith("/api/inbox/summary?")) return Response.json({ unreadMessages: 0, unreadNotifications: 0 });
    if (/^\/api\/services\/\d+\/reviews\?/.test(path)) return Response.json({ reviews: [], page: 1, hasMore: false });
  }
  fixture.unexpected.push(`${method} ${path}`); throw Error(`Unexpected mocked request: ${method} ${path}`);
};
await i18next.use(initReactI18next).init({ lng: "en", fallbackLng: "en", resources: __FORM_RESOURCES__, interpolation: { escapeValue: false } });
const { default: App } = await import("../../client/src/App");
const { StorefrontView } = await import("../../client/src/pages/storefront");
const { WishlistProvider } = await import("../../client/src/components/wishlist-provider");
await i18next.init({ lng: params.get("lang") || "en", fallbackLng: "en", supportedLngs: ["en", "lv", "ru"], resources: __FORM_RESOURCES__, interpolation: { escapeValue: false } });
document.documentElement.lang = i18next.language;
localStorage.clear();
queryClient.setQueryData(["/api/auth/user"], params.has("guest") ? null : user);
queryClient.setQueryData(["/api/company/context"], context);
createRoot(document.getElementById("root")!).render(params.has("preview")
  ? <QueryClientProvider client={queryClient}><WishlistProvider><StorefrontView page={pages["pro-studio"]} preview /></WishlistProvider></QueryClientProvider>
  : <App />);
fixture.ready = true;
