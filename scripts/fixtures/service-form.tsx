import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import i18next from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";
import { QueryClientProvider } from "@tanstack/react-query";
import { Link, Route, Switch, useLocation } from "wouter";
import ServiceEditor from "../../client/src/components/provider/service-editor";
import ServiceEditPage from "../../client/src/pages/provider/service-edit";
import ServicesPage from "../../client/src/pages/provider/services";
import { installServiceNavigationTracking, requestServiceEditorExit } from "../../client/src/components/provider/service-navigation-guard";
import { queryClient } from "../../client/src/lib/queryClient";
import type { Service } from "../../shared/schema";

declare const __SERVICE_FORM_RESOURCES__: Record<string, { translation: object }>;
const parameters = new URLSearchParams(location.search);
const syntheticService = {
  id: 7, providerId: "synthetic-provider", companyId: null, employeeId: null,
  name: "Synthetic service", description: "Synthetic description", category: "education", serviceType: "one_to_one",
  price: "25.00", duration: 45, cleanupTime: 15, maxCapacity: 1, ageGroups: ["adults"], targetGender: "both",
  instantBooking: false, advancePaymentPercent: 30, addressId: 3, imageUrl: "", externalUrl: "", isActive: parameters.get("mode") !== "inactive",
} as Service;
const permissions = { manageServices: parameters.get("mode") !== "denied", manageSchedules: true, manageBookings: true, manageTeam: true, isOwner: true, readAll: true };
const fixture = { writes: [] as unknown[], unexpected: [] as string[], pending: null as (() => void) | null, result: "success", workspaceChanges: 0, workspaceReject: false, categoryResult: parameters.get("categories") || "success", addressResult: parameters.get("addresses") || "success" };
Object.assign(window, { serviceFormFixture: fixture });
window.fetch = async (input, options = {}) => {
  const path = String(input);
  if (path === "/api/categories") {
    if (fixture.categoryResult === "pending") return new Promise<Response>(() => {});
    if (fixture.categoryResult === "error") return Response.json({}, { status: 503 });
    return Response.json(fixture.categoryResult === "empty" ? [] : [{ key: "education", name: "Synthetic category", icon: "", searchKeywords: "" }]);
  }
  if (path === "/api/addresses") {
    if (fixture.addressResult === "pending") return new Promise<Response>(() => {});
    if (fixture.addressResult === "error") return Response.json({}, { status: 503 });
    return Response.json(fixture.addressResult === "empty" ? [] : [{ id: 3, address: "Synthetic address" }]);
  }
  if (path === "/api/provider/employees") return Response.json([{ id: 5, name: "Synthetic employee" }]);
  if (path === "/api/company/context") return Response.json({ company: null, permissions, workspaces: [] });
  if (path === "/api/auth/user") return Response.json({ id: "synthetic-provider", currentRole: "provider" });
  if (path === "/api/notifications/capabilities") return Response.json({ hasPro: false, automationEnabled: false, channels: { email: false, sms: false, whatsapp: false } });
  if (path === "/api/services/provider") return Response.json([syntheticService]);
  if ((path === "/api/services/7" && options.method === "PATCH") || (path === "/api/services" && options.method === "POST")) {
    const payload = JSON.parse(String(options.body)); fixture.writes.push(payload);
    if (fixture.result === "pending") await new Promise<void>(resolve => { fixture.pending = resolve; });
    if (fixture.result === "error") return Response.json({ message: "<img src=x onerror=alert(1)> synthetic failure" }, { status: 500 });
    if (fixture.result === "forbidden") return Response.json({}, { status: 403 });
    if (fixture.result === "unauthorized") return Response.json({}, { status: 401 });
    return Response.json({ ...syntheticService, ...payload });
  }
  fixture.unexpected.push(path); throw new Error("Unexpected fixture request");
};
await i18next.use(initReactI18next).init({ lng: parameters.get("lang") || "en", fallbackLng: false, resources: __SERVICE_FORM_RESOURCES__, interpolation: { escapeValue: false } });
function Fixture() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const [theme, setTheme] = useState(false);
  useEffect(() => { document.documentElement.classList.toggle("dark", theme); }, [theme]);
  return <div className="bg-background min-h-screen text-foreground">
    <nav aria-label="Fixture controls" className="flex flex-wrap gap-3 border-b p-4">
      <Link href="/away" className="underline min-h-11 py-2">Leave editor</Link>
      <button type="button" onClick={() => requestServiceEditorExit(async () => { fixture.workspaceChanges++; if (fixture.workspaceReject) throw new Error("Synthetic workspace rejection"); navigate("/away"); })}>Switch workspace</button>
      <label>Fixture language<select id="fixture-language" value={i18next.language} onChange={event => void i18next.changeLanguage(event.target.value)}>
        {Object.keys(__SERVICE_FORM_RESOURCES__).map(lang => <option key={lang}>{lang}</option>)}
      </select></label>
      <label>Next save result<select id="fixture-result" onChange={event => { fixture.result = event.target.value; }}>
        {["success", "error", "forbidden", "pending", "unauthorized"].map(value => <option key={value}>{value}</option>)}
      </select></label>
      <button type="button" onClick={() => fixture.pending?.()}>Resolve pending save</button>
      <button type="button" onClick={() => setTheme(previous => !previous)}>Toggle fixture theme</button>
    </nav>
    <main className="p-4 sm:p-6">
      <Switch>
        <Route path="/my-services/services" component={ServicesPage} />
        <Route path="/away"><h1>Left editor</h1><button onClick={() => navigate("/my-services/services/7/edit")}>Return to editor</button></Route>
        <Route>{parameters.get("mode") === "denied" ? <ServiceEditPage /> : <ServiceEditor service={parameters.get("mode") === "new" ? undefined : syntheticService} company employees={[{ id: 5, name: "Synthetic employee" } as never]} />}</Route>
      </Switch>
    </main>
    <p className="p-4" data-testid="fixture-saved-label">{t("serviceForm.saved")}</p>
  </div>;
}
installServiceNavigationTracking();
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={queryClient}><Fixture /></QueryClientProvider>);
