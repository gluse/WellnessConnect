import React from "react";
import { createRoot } from "react-dom/client";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { queryClient } from "../../client/src/lib/queryClient";
import { installServiceNavigationTracking } from "../../client/src/components/provider/service-navigation-guard";
import type { WorkspaceContext } from "../../shared/schema";

declare const __FORM_RESOURCES__: Record<string, { translation: object }>;
const params = new URLSearchParams(location.search);
const user = { id: "synthetic-provider", firstName: "Synthetic", lastName: "Provider", email: "synthetic@example.invalid", currentRole: "provider", providerType: "individual" };
let signedIn = !params.has("guest");
const workspaces: WorkspaceContext["workspaces"] = [
  { id: 2, name: "Synthetic company with a long workspace name <script>test</script>", role: "admin" },
  { id: 3, name: "Second synthetic company", role: "viewer" },
];
workspaces.splice(Number(params.get("companies") ?? 2));
const permissions = { manageCompany: true, manageTeam: true, manageServices: true, manageSchedules: true, manageBookings: true, readAll: true, isOwner: true };
const personal: WorkspaceContext = { company: null, membership: null, workspaces, permissions, invalid: false };
let context = personal;
const fixture = {
  ready: false, result: "success", contextResult: params.get("context") ?? "success", writes: [] as { companyId: number | null }[], unexpected: [] as string[],
  release: null as (() => void) | null, releaseContext: null as (() => void) | null,
  refresh: () => queryClient.invalidateQueries({ queryKey: ["/api/company/context"] }),
  signOut: () => { signedIn = false; queryClient.setQueryData(["/api/auth/user"], null); },
};
Object.assign(window, { phase2Fixture: fixture });
window.fetch = async (input, options = {}) => {
  const path = String(input), method = options.method || "GET";
  if (path === "/api/auth/user" && method === "GET") return Response.json(signedIn ? user : null);
  if (path === "/api/company/context") {
    if (method === "POST") {
      const body = JSON.parse(String(options.body)); fixture.writes.push(body);
      if (fixture.result === "pending") await new Promise<void>(resolve => { fixture.release = resolve; });
      if (fixture.result === "error") return Response.json({}, { status: 503 });
      const selected = workspaces.find(row => row.id === body.companyId);
      context = selected ? { ...personal, company: { id: selected.id, name: selected.name, isActive: true }, membership: { role: selected.role },
        permissions: selected.role === "viewer" ? { manageCompany: false, manageTeam: false, manageServices: false, manageSchedules: false, manageBookings: false, readAll: false, isOwner: false } : permissions } as WorkspaceContext : personal;
    } else {
      if (fixture.contextResult === "pending") await new Promise<void>(resolve => { fixture.releaseContext = resolve; });
      if (fixture.contextResult === "error") return Response.json({}, { status: 503 });
    }
    return Response.json(context);
  }
  if (method === "GET") {
    if (path.startsWith("/api/inbox/summary?")) return Response.json({ unreadMessages: 0, unreadNotifications: 0 });
    if (["/api/bookings/provider", "/api/bookings/seeker", "/api/provider/employees", "/api/services/provider", "/api/addresses", "/api/availability/provider", "/api/categories"].includes(path)) return Response.json([]);
    if (path.startsWith("/api/services/search/page?")) return Response.json({ services: [], nextCursor: null, mode: "text" });
    if (path === "/api/account/search-location") return Response.json(null);
    if (path === "/api/admin/access") return Response.json({ isAdmin: false });
    if (path === "/api/auth/providers") return Response.json({ google: false, facebook: false, apple: false, microsoft: false });
    if (path === "/api/billing/runtime") return Response.json({ subscriptionsReady: false, administrationReady: false, hostedOrigins: [] });
    if (path === "/api/account/communication") return Response.json({ phone: null, preferredMethod: null, language: "en", smsOptIn: false, whatsappOptIn: false, phoneVerified: false });
    if (path === "/api/notifications/capabilities") return Response.json({ hasPro: false, automationEnabled: false, channels: { email: false, sms: false, whatsapp: false } });
  }
  fixture.unexpected.push(`${method} ${path}`);
  throw Error(`Unexpected mocked request: ${method} ${path}`);
};
await i18next.use(initReactI18next).init({ lng: "en", fallbackLng: "en", resources: __FORM_RESOURCES__, interpolation: { escapeValue: false } });
const { default: App } = await import("../../client/src/App");
const language = params.get("lang") || "en";
await i18next.init({ lng: language, fallbackLng: "en", supportedLngs: ["en", "lv", "ru"], resources: __FORM_RESOURCES__, interpolation: { escapeValue: false } });
document.documentElement.lang = language;
localStorage.clear();
queryClient.setQueryData(["/api/auth/user"], signedIn ? user : null);
if (fixture.contextResult === "success") queryClient.setQueryData(["/api/company/context"], context);
installServiceNavigationTracking();
createRoot(document.getElementById("root")!).render(<App />);
fixture.ready = true;
