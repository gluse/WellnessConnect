import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import Panel from "../../client/src/components/provider/monthly-billing-panel";
import { BillingClientError, type MonthlyBillingTransport } from "../../client/src/lib/monthly-billing";
import { billingStatus, billingTarget } from "./monthly-billing.mjs";
import PriceEditor from "../../client/src/components/admin-billing-price";
import Administration from "../../client/src/pages/administration";
import Settings from "../../client/src/pages/provider/settings";
import { createBillingRuntime } from "../../client/src/lib/billing-http";
import { BillingRuntimeContext, BillingRuntimeProvider } from "../../client/src/components/billing-runtime";
import { useAuth } from "../../client/src/hooks/useAuth";
import { WORKSPACE_CHANGE_KEY } from "../../client/src/hooks/use-provider-workspace";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../../client/src/lib/queryClient";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";

declare const __FORM_RESOURCES__: Record<string, { translation: object }>;
const params = new URLSearchParams(location.search), language = params.get("lang") || "en", mode = params.get("mode");
if (!["en", "lv", "ru"].includes(language)) throw Error("Deferred locale");
const fixture = {
  ready: false, reads: 0, checkouts: [] as object[], portals: 0, navigations: [] as string[], unexpected: [] as string[],
  result: billingStatus(), switchScope: () => {},
  requests: [] as { path: string; method: string; body: unknown }[], priceResult: "success",
  price: { amount: "19.00", revision: "1", currency: "EUR", interval: "month", taxIncluded: true },
  capabilities: { subscriptionsReady: params.get("disabled") !== "true", administrationReady: params.get("disabled") !== "true", hostedOrigins: params.get("disabled") === "true" ? [] : ["https://checkout.stripe.com", "https://billing.stripe.com"] },
  startWorkspaceSwitch: () => {}, finishWorkspaceSwitch: () => {},
};
if (mode === "http-manual" || mode === "settings" || mode === "runtime-settings") fixture.result = billingStatus({ unavailableReason: "manual_grant", manualUntil: "2030-01-01T00:00:00Z", effectiveAccess: { hasPro: true, until: "2030-01-01T00:00:00Z" }, capabilities: { checkout: false, recover: false, manage: false } });
if (mode === "cancel" || mode === "failed" || mode === "expired") fixture.result = billingStatus({
  state: mode === "failed" ? "payment_failed" : mode === "expired" ? "expired" : "active",
  manualUntil: "2030-01-01T00:00:00Z", paidThrough: "2030-02-01T00:00:00Z",
  effectiveAccess: { hasPro: mode !== "expired", until: mode === "expired" ? null : "2030-02-01T00:00:00Z" },
  cancelAtPeriodEnd: mode === "cancel", offer: null,
  capabilities: { checkout: false, manage: true, recover: mode === "failed" },
});
Object.assign(window, { phase2Fixture: fixture });
window.fetch = async (input, options = {}) => {
  const path = String(input), method = options.method || "GET", body = options.body ? JSON.parse(String(options.body)) : null;
  fixture.requests.push({ path, method, body });
  if (path === "/api/billing/runtime") return params.get("missing") === "true" ? Response.json({}, { status: 404 }) : Response.json(fixture.capabilities);
  if (path === "/api/auth/user") return Response.json({ id: "synthetic-admin", firstName: "Synthetic", lastName: "Admin", currentRole: "provider" });
  if (path === "/api/admin/access") return Response.json({ isAdmin: params.get("denied") !== "true" });
  if (path.startsWith("/api/admin/users?")) return Response.json({ users: [], page: 1, totalPages: 1, total: 0, hasNextPage: false });
  if (path === "/api/company/context") return Response.json({ company: { id: 42, name: "Synthetic workspace" }, workspaces: [], permissions: { manageServices: false, isOwner: true, manageTeam: false } });
  if (path === "/api/provider/employees") return Response.json([]);
  if (path === "/api/admin/billing/offer") {
    if (params.get("denied") === "true" || fixture.priceResult === "denied") return Response.json({}, { status: 403 });
    if (method === "GET") return Response.json(fixture.price);
    if (method === "PUT") {
      if (fixture.priceResult === "conflict") return Response.json({}, { status: 409 });
      if (fixture.priceResult === "error") throw Error("Synthetic save outcome unknown");
      if (body.expectedRevision !== fixture.price.revision) return Response.json({}, { status: 409 });
      fixture.price = { ...fixture.price, amount: body.amount, revision: String(Number(fixture.price.revision) + 1) }; return Response.json(fixture.price);
    }
  }
  if (path.startsWith("/api/billing/subscription?")) return params.get("denied") === "true" ? Response.json({}, { status: 403 }) : Response.json(fixture.result);
  if (path === "/api/billing/checkout" || path === "/api/billing/portal") return Response.json({ state: "pending", target: billingTarget });
  fixture.unexpected.push(path); throw Error("Unexpected network in isolated billing fixture");
};
const runtime = createBillingRuntime({ subscriptionsReady: true, administrationReady: true, hostedOrigins: ["https://billing.example.test"] });
const api: MonthlyBillingTransport = {
  hostedOrigins: ["https://billing.example.test"],
  async read(scope) {
    fixture.reads++;
    if (mode === "denied") throw new BillingClientError("denied");
    return { ...fixture.result, target: scope.target };
  },
  async checkout(scope, input) {
    fixture.checkouts.push({ target: scope.target, ...input });
    fixture.result = billingStatus({ operation: "unknown" });
    throw Error("Synthetic ambiguous checkout");
  },
  async portal(scope) { fixture.portals++; return { state: "redirect", target: scope.target, url: "https://billing.example.test/secure" }; },
};
async function main() {
  await i18next.use(initReactI18next).init({ lng: language, fallbackLng: "en", resources: __FORM_RESOURCES__, interpolation: { escapeValue: false } });
  document.documentElement.lang = language;
  if (params.get("dark") === "true") document.documentElement.classList.add("dark");
  function AuthenticatedRuntime({ children }: { children: React.ReactNode }) {
    const { user, isLoading, isError } = useAuth();
    return <BillingRuntimeProvider identityId={!isLoading && !isError && user ? user.id : null}>{children}</BillingRuntimeProvider>;
  }
  function App() {
    const [scope, setScope] = useState({ actorId: "synthetic-actor", target: billingTarget });
    fixture.switchScope = () => setScope({ actorId: "synthetic-other", target: { kind: "company", id: 43 } });
    fixture.startWorkspaceSwitch = () => {
      const mutation = queryClient.getMutationCache().build(queryClient, { mutationKey: WORKSPACE_CHANGE_KEY, mutationFn: () => new Promise<void>(resolve => { fixture.finishWorkspaceSwitch = resolve; }) });
      void mutation.execute(undefined);
    };
    if (["admin-page", "settings", "runtime-admin-page", "runtime-settings"].includes(mode || "")) {
      const settings = mode === "settings" || mode === "runtime-settings";
      const page = <Router hook={memoryLocation({ path: settings ? "/my-services/settings/billing" : "/administration" }).hook}>{settings ? <Settings /> : <Administration />}</Router>;
      return <QueryClientProvider client={queryClient}>{mode?.startsWith("runtime-") ? <AuthenticatedRuntime>{page}</AuthenticatedRuntime> : <BillingRuntimeContext.Provider value={runtime}>{page}</BillingRuntimeContext.Provider>}</QueryClientProvider>;
    }
    if (mode === "admin") return <main className="max-w-3xl mx-auto p-3 sm:p-6"><PriceEditor actorId={scope.actorId} authorized={params.get("denied") !== "true"} transport={params.get("unavailable") === "true" ? undefined : runtime.adminPricingTransport} /></main>;
    if (mode === "http-manual") return <main className="max-w-3xl mx-auto p-3 sm:p-6"><Panel {...scope} transport={runtime.subscriptionTransport} /></main>;
    return <main className="max-w-3xl mx-auto p-3 sm:p-6"><Panel {...scope} transport={mode === "unavailable" ? undefined : api} returned={params.get("returned") === "true"} navigate={url => fixture.navigations.push(url)} /></main>;
  }
  createRoot(document.getElementById("root")!).render(<App />);
  fixture.ready = true;
}
void main();
