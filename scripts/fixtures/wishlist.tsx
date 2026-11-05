import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { QueryClientProvider } from "@tanstack/react-query";
import { Link, Route, Switch, useLocation } from "wouter";
import { queryClient } from "../../client/src/lib/queryClient";
import { WishlistProvider } from "../../client/src/components/wishlist-provider";
import AppHeader from "../../client/src/components/app-header";
import MobileNavigationLayout from "../../client/src/components/mobile-navigation";
import ServiceCard from "../../client/src/components/service-card";
import ServiceResultCard from "../../client/src/components/service-result-card";
import ServiceDetailModal from "../../client/src/components/service-detail-modal";
import Wishlist from "../../client/src/pages/wishlist";
import Home from "../../client/src/pages/home";
import Inbox from "../../client/src/pages/inbox";
import { TooltipProvider } from "../../client/src/components/ui/tooltip";
import type { BookingWithDetails, ServiceWithProvider, User } from "../../shared/schema";

declare const __FORM_RESOURCES__: Record<string, { translation: object }>;
const params = new URLSearchParams(location.search);
const customer = { id: "wishlist-customer", firstName: "Synthetic", lastName: "Customer", email: "customer@example.test", currentRole: "seeker" } as User;
const other = { ...customer, id: "wishlist-other", firstName: "Other" };
const provider = { ...customer, id: "wishlist-provider", currentRole: "provider", firstName: "Synthetic", lastName: "Provider" } as User;
const photo = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#dce9df"/><circle cx="100" cy="95" r="55" fill="#6a947c"/></svg>');
const makeService = (id: number, name: string, imageUrl: string | null = null) => ({
  id, providerId: provider.id, name, description: "Synthetic private-boundary fixture", imageUrl,
  provider, category: "yoga", serviceType: "one_to_one", price: "25.00", duration: 45,
  isActive: true, companyActive: true, locationSource: "manual", instantBooking: false,
  address: "Synthetic studio", cleanupTime: 0, advancePaymentPercent: 0, reviewCount: 0,
  reminderEnabled: false, targetGender: "both", ageGroups: ["adults"], availableCapacity: 1,
} as ServiceWithProvider);
const services = [makeService(7, "Synthetic Yoga <script>not executable</script>", photo), makeService(8, "Synthetic Massage")];
const booking = { id: 31, serviceId: 7, seekerId: customer.id, providerId: provider.id, service: services[0],
  seeker: customer, provider, scheduledDate: "2030-01-16T09:00:00.000Z", status: "confirmed",
  totalAmount: "25.00", advanceAmount: "0", participantCount: 1, paymentStatus: "pending" } as BookingWithDetails;
let identity: User | null = params.has("guest") ? null : params.has("provider") ? provider : customer;
const savedByUser = new Map<string, Map<number, string>>([[customer.id, new Map(params.has("seed") ? [[7, "2026-11-03T12:00:00.000Z"], [99, "2026-11-02T12:00:00.000Z"]] : [])], [other.id, new Map()]]);
const unavailable = new Set([99]);
let context: any = { company: null, workspaces: [], memberships: [], permissions: { manageBookings: true, readAll: true, manageServices: true } };
const messages = [{ id: "11111111-1111-4111-8111-111111111111", bookingId: 31, authorId: provider.id, authorRole: "provider", authorName: "Synthetic Provider", body: "Private message only in conversation", createdAt: "2026-11-03T12:00:00.000Z", broadcastId: null }];
if (params.has("scrollReceipt")) {
  messages[0].body = "Visible incoming message\n".repeat(45);
  messages.push({ ...messages[0], id: "33333333-3333-4333-8333-333333333333", body: "Offscreen incoming message" });
  messages.push({ ...messages[0], id: "44444444-4444-4444-8444-444444444444", authorId: customer.id, authorRole: "customer", authorName: "Synthetic Customer", body: "Own reply never unread" });
}
const readIds = new Set<string>();
let unreadMessages = messages.filter(message => message.authorId !== customer.id).length, unreadNotifications = 1;
const persistentBadges = params.has("scopeBadges");
let providerUnread = persistentBadges ? 3 : 0;
if (persistentBadges) { unreadMessages = 2; unreadNotifications = 4; }
const notifications = [{ id: "22222222-2222-4222-8222-222222222222", kind: "wishlist_additions", serviceId: 7, serviceName: "Synthetic Yoga", reportingDay: "2026-11-03", count: 5, revision: 1, read: false, available: true, updatedAt: "2026-11-04T00:15:00.000Z" }];
const fixture = {
  ready: false, writes: [] as { path: string; method: string; body: unknown; actor: string | null }[], reads: [] as string[], unexpected: [] as string[],
  details: 0, books: 0, failSave: false, failList: false, failMembership: false, failRead: false,
  failMessageRead: params.has("failMessageRead"),
  holdSave: false, releaseSave: () => {}, holdMembership: false, releaseMembership: () => {},
  setUnread: (messages: number, activity: number) => { unreadMessages = messages; unreadNotifications = activity; return queryClient.invalidateQueries({ queryKey: ["inbox"] }); },
  setUser: (id: "customer" | "other" | "provider" | "guest") => {
    identity = id === "guest" ? null : id === "other" ? other : id === "provider" ? provider : customer;
    queryClient.setQueryData(["/api/auth/user"], identity);
  },
  refresh: () => queryClient.invalidateQueries(),
  unavailable: (id: number, value: boolean) => { if (value) unavailable.add(id); else unavailable.delete(id); return queryClient.invalidateQueries(); },
  saved: (id: string) => [...(savedByUser.get(id)?.keys() ?? [])],
  navigate: (path: string) => { history.pushState(null, '', path); dispatchEvent(new PopStateEvent('popstate')); },
  workspace: (id: number | null) => {
    context = { ...context, company: id ? { id, name: `Workspace ${id}`, isActive: true } : null, invalid: false };
    providerUnread = persistentBadges ? id === 2 ? 6 : 3 : 0;
    unreadNotifications = persistentBadges ? id === 2 ? 7 : 4 : 1;
    queryClient.setQueryData(["/api/company/context"], context);
  },
  appendIncoming: () => {
    messages.push({ ...messages[0], id: "55555555-5555-4555-8555-555555555555", body: "Incoming while outer dialog is scrolled away" });
    unreadMessages++;
    return queryClient.invalidateQueries({ predicate: query => query.queryKey[0] === "booking-collaboration" });
  },
};
(window as any).phase2Fixture = fixture;
window.fetch = async (input, options = {}) => {
  const url = new URL(String(input), location.origin), path = url.pathname, method = options.method || "GET";
  const actor = identity?.id ?? null;
  const body = options.body ? JSON.parse(String(options.body)) : undefined;
  if (method === "GET") fixture.reads.push(path + url.search);
  else fixture.writes.push({ path, method, body, actor });
  if (path === "/api/auth/user") return identity ? Response.json(identity) : Response.json({}, { status: 401 });
  if (path === "/api/company/context") return Response.json(context);
  if (path === "/api/admin/access") return Response.json({ isAdmin: false });
  if (path === "/api/categories") return Response.json([{ key: "yoga", name: "Yoga", icon: "Y" }]);
  if (path === "/api/account/search-location") return Response.json(null);
  if (path === "/api/services/search") return Response.json(services);
  if (path === "/api/wishlist/membership") {
    if (!actor) return Response.json({}, { status: 401 });
    const ids = (url.searchParams.get("serviceIds") || "").split(",").map(Number);
    const result = ids.filter(id => savedByUser.get(actor)?.has(id));
    if (fixture.holdMembership) { fixture.holdMembership = false; await new Promise<void>(resolve => { fixture.releaseMembership = resolve; }); }
    return fixture.failMembership ? Response.json({}, { status: 503 }) : Response.json({ serviceIds: result });
  }
  if (path === "/api/wishlist/services" && method === "GET") {
    if (fixture.failList) return Response.json({}, { status: 503 });
    const items = [...(savedByUser.get(actor!) ?? [])].sort((a, b) => b[1].localeCompare(a[1])).map(([serviceId, savedAt]) => {
      const service = services.find(service => service.id === serviceId);
      return unavailable.has(serviceId) || !service ? { serviceId, savedAt, available: false } : { serviceId, savedAt, available: true, service };
    });
    return Response.json({ items, nextCursor: null });
  }
  if (/^\/api\/wishlist\/services\/\d+$/.test(path)) {
    if (!actor) return Response.json({}, { status: 401 });
    if (fixture.holdSave) { fixture.holdSave = false; await new Promise<void>(resolve => { fixture.releaseSave = resolve; }); }
    if (fixture.failSave) { fixture.failSave = false; return Response.json({}, { status: 503 }); }
    const id = Number(path.split("/").at(-1));
    if (!savedByUser.has(actor)) savedByUser.set(actor, new Map());
    if (method === "PUT") savedByUser.get(actor)!.set(id, "2026-11-04T12:00:00.000Z");
    else if (method === "DELETE") savedByUser.get(actor)!.delete(id);
    else throw Error("Unexpected wishlist write");
    return new Response(null, { status: 204 });
  }
  if (path === "/api/inbox/summary") {
    const scope = url.searchParams.get('scope');
    const isolated = !persistentBadges || actor === customer.id;
    return Response.json({ unreadMessages: isolated ? scope === 'provider' ? providerUnread : scope === 'all' ? unreadMessages + providerUnread : unreadMessages : 0,
      unreadNotifications: isolated && scope !== 'customer' ? unreadNotifications : 0 });
  }
  if (path === "/api/inbox/messages") {
    const scope = url.searchParams.get('scope');
    const items: any[] = scope !== 'provider' && unreadMessages ? [{ bookingId: 31, serviceName: services[0].name, counterpartName: "Synthetic Provider", scheduledDate: booking.scheduledDate, updatedAt: messages[0].createdAt, unreadCount: unreadMessages, canSend: true, viewer: "customer" }] : [];
    if (scope !== 'customer' && providerUnread) items.push({ bookingId: 32, serviceName: 'Provider workspace booking', counterpartName: 'Synthetic Customer', scheduledDate: booking.scheduledDate, updatedAt: messages[0].createdAt, unreadCount: providerUnread, canSend: true, viewer: 'provider', companyId: context.company?.id ?? null });
    return Response.json({ items, nextCursor: null });
  }
  if (path === "/api/inbox/notifications") return Response.json({ items: url.searchParams.get('scope') === 'customer' ? [] : notifications, nextCursor: null });
  if (path === "/api/inbox/notifications/read") {
    if (fixture.failRead) { fixture.failRead = false; return Response.json({}, { status: 503 }); }
    unreadNotifications = 0; notifications.forEach(item => { item.read = true; }); return new Response(null, { status: 204 });
  }
  if (/^\/api\/inbox\/messages\/31$/.test(path)) return Response.json(booking);
  if (path === "/api/inbox/messages/31/read") {
    if (fixture.failMessageRead) { fixture.failMessageRead = false; return Response.json({}, { status: 503 }); }
    body.messageIds.forEach((id: string) => readIds.add(id));
    unreadMessages = messages.filter(message => message.authorId !== customer.id && !readIds.has(message.id)).length;
    return new Response(null, { status: 204 });
  }
  if (/^\/api\/bookings\/31\/conversation(?:\/read)?$/.test(path)) {
    if (method === "GET") return Response.json({ messages, nextCursor: null });
    if (path.endsWith("/read")) { unreadMessages = 0; return new Response(null, { status: 204 }); }
    return Response.json({ ...messages[0], id: crypto.randomUUID(), authorRole: "customer", body: body.body });
  }
  if (/^\/api\/services\/\d+$/.test(path) && method === "GET") {
    const service = services.find(service => String(service.id) === path.split("/").at(-1));
    return service && !unavailable.has(service.id) ? Response.json(service) : Response.json({}, { status: 404 });
  }
  if (/^\/api\/services\/\d+\/view$/.test(path)) return new Response(null, { status: 204 });
  fixture.unexpected.push(method + " " + path + url.search); throw Error("Unexpected wishlist fixture request: " + method + " " + path);
};
queryClient.setQueryData(["/api/auth/user"], identity);
queryClient.setQueryData(["/api/company/context"], context);
await i18next.use(initReactI18next).init({ lng: params.get("lang") || "en", fallbackLng: false, resources: __FORM_RESOURCES__, interpolation: { escapeValue: false } });
document.documentElement.lang = i18next.language;
function Gallery() {
  const [detail, setDetail] = useState<ServiceWithProvider | null>(null);
  return <main className="max-w-4xl mx-auto p-4 space-y-4" id="fixture-gallery">
    <div className="search-design grid sm:grid-cols-2 gap-4" data-fixture-cards>
      {services.map(service => <ServiceCard key={service.id} service={service} searchLayout onBook={() => { fixture.books++; }} onViewDetails={() => { fixture.details++; setDetail(service); }} />)}
    </div>
    <div className="search-design" data-fixture-duplicate><ServiceCard service={services[0]} searchLayout onBook={() => { fixture.books++; }} onViewDetails={() => { fixture.details++; setDetail(services[0]); }} /></div>
    <div className="search-design" data-fixture-preview><ServiceResultCard service={services[1]} provider="Unpublished preview" /></div>
    <ServiceDetailModal service={detail} open={!!detail} searchLayout onClose={() => setDetail(null)} onBook={() => { fixture.books++; }} />
  </main>;
}
function Login() {
  const [, navigate] = useLocation();
  return <button id="fixture-login" onClick={() => { fixture.setUser("customer"); navigate(new URLSearchParams(location.search).get("returnTo") || "/wishlist"); }}>Complete synthetic sign-in</button>;
}
function Fixture() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WishlistProvider><MobileNavigationLayout>
    <AppHeader />
    <nav className="p-3 flex gap-4" aria-label="Fixture routes"><Link href="/gallery">Gallery</Link><Link href="/wishlist" id="fixture-wishlist-link">Wishlist</Link></nav>
    <Switch><Route path="/wishlist" component={Wishlist} /><Route path="/inbox" component={Inbox} /><Route path="/search" component={Home} /><Route path="/login" component={Login} /><Route component={Gallery} /></Switch>
  </MobileNavigationLayout></WishlistProvider></TooltipProvider></QueryClientProvider>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
fixture.ready = true;
