import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { queryClient } from "../../client/src/lib/queryClient";
import MyServices from "../../client/src/pages/my-services";
import MobileNavigationLayout from "../../client/src/components/mobile-navigation";
import { serviceViewReportWindow } from "../../shared/service-view-report";

declare const __FORM_RESOURCES__: Record<string, { translation: object }>;
const params = new URLSearchParams(location.search);
await i18next.use(initReactI18next).init({ lng: params.get("lang") || "en", fallbackLng: false, resources: __FORM_RESOURCES__, interpolation: { escapeValue: false } });
const fixture = {
  ready: false, unexpected: [] as string[], writes: [] as string[], requests: [] as string[], downloads: [] as { mime: string; base64: string }[],
  workspace: params.get("workspace") || "personal", plan: params.get("plan") || "pro", tracking: params.get("tracking") !== "false",
  capabilityError: false, reportState: params.get("state") || "success", proUntil: new Date(Date.now() + (params.has("expiry") ? 2000 : 86400000)).toISOString(),
  resolveReport: null as (() => void) | null,
};
const context = () => ({ company: fixture.workspace === "personal" ? null : { id: fixture.workspace === "second" ? 2 : 1, name: "Synthetic company", isActive: true }, membership: fixture.workspace === "employee" ? { employeeId: 11, role: "provider" } : null,
 permissions: { readAll: fixture.workspace !== "employee", manageBookings: true, manageServices: true, manageTeam: true, manageSchedules: true, isOwner: fixture.workspace !== "employee" }, workspaces: [] });
Object.assign(fixture, { setWorkspace(workspace: string) { fixture.workspace = workspace; queryClient.setQueryData(["/api/company/context"], context()); },
  refreshAccess() { return queryClient.refetchQueries({ queryKey: ["/api/reports/service-views/capabilities"] }); },
  language(language: string) { return i18next.changeLanguage(language); },
});
Object.assign(window, { phase2Fixture: fixture });
const originalUrl = URL.createObjectURL.bind(URL);
URL.createObjectURL = blob => { void blob.arrayBuffer().then(bytes => fixture.downloads.push({ mime: blob.type, base64: btoa(Array.from(new Uint8Array(bytes), byte => String.fromCharCode(byte)).join("")) })); return originalUrl(blob); };
queryClient.setQueryData(["/api/provider/employees"], [{ id: 999, name: "UNSCOPED SECRET" }]);
const history = () => ({ trackingEnabled: fixture.tracking, retentionDays: 90, timezone: "UTC", ...serviceViewReportWindow(new Date()), asOf: new Date().toISOString(), measurement: "recorded_detail_opens", historyCoverage: "unknown", captureStartedAt: null });
window.fetch = async (input, options = {}) => {
  const path = String(input), method = options.method || "GET"; fixture.requests.push(`${method} ${path}`);
  if (method !== "GET") { fixture.writes.push(`${method} ${path}`); throw Error("No fixture writes permitted"); }
  if (path === "/api/auth/user") return Response.json({ id: "synthetic-provider", currentRole: "provider" });
  if (path === "/api/company/context") return Response.json(context());
  if (path === "/api/reports/service-views/capabilities") return fixture.capabilityError ? Response.json({}, { status: 503 }) : Response.json({ ...history(), hasPro: fixture.plan === "pro", proUntil: fixture.plan === "pro" ? fixture.proUntil : null });
  if (path === "/api/provider/employees") return Response.json(fixture.workspace === "second" ? [{ id: 21, name: "Second worker" }] : fixture.workspace === "employee" ? [{ id: 11, name: "Anna" }] : [{ id: 11, name: "Anna" }, { id: 12, name: "Boris" }]);
  if (path.startsWith("/api/reports/service-views?")) {
    const requestedWorkspace = fixture.workspace;
    if (fixture.reportState === "pending") await new Promise<void>(resolve => { fixture.resolveReport = resolve; }); // Deliberately ignore abort to test stale responses.
    if (fixture.reportState === "denied") return Response.json({ code: "pro_required" }, { status: 403 });
    if (fixture.reportState === "error") return Response.json({}, { status: 503 });
    if (fixture.reportState === "unavailable") return Response.json({ code: "tracking_unavailable" }, { status: 503 });
    const query = new URLSearchParams(path.split("?")[1]);
    const base = requestedWorkspace === "second" ? [{ serviceId: 201, service: "Second workspace service", employeeId: 21, employeeName: "Second worker", views: "2" }] : [
      { serviceId: 101, service: "Massage — Ārstēšana и восстановление with a deliberately very long service name", employeeId: 11, employeeName: "Anna", views: "9007199254740993" },
      { serviceId: 102, service: "Massage", employeeId: 12, employeeName: "Boris", views: "7" },
      { serviceId: 103, service: "Unused service", employeeId: null, employeeName: null, views: "0" },
    ];
    const employee = query.get("employee") || "all";
    const rows = fixture.reportState === "empty" ? [] : base.filter(row => (requestedWorkspace !== "employee" || row.employeeId === 11) && (employee === "all" || employee === "unassigned" && row.employeeId === null || String(row.employeeId) === employee));
    return Response.json({ ...history(), trackingEnabled: true, proUntil: fixture.proUntil, from: query.get("from"), to: query.get("to"), employee, rows, totalViews: rows.reduce((sum, row) => sum + BigInt(row.views), 0n).toString() });
  }
  fixture.unexpected.push(`${method} ${path}`); throw Error(`Unexpected fixture request: ${method} ${path}`);
};
function Fixture() {
  useEffect(() => { fixture.ready = true; }, []);
  return <Router><MobileNavigationLayout><MyServices /></MobileNavigationLayout></Router>;
}
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={queryClient}><Fixture /></QueryClientProvider>);
