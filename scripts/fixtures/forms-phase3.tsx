import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../../client/src/lib/queryClient";
import AvailabilityPage from "../../client/src/pages/provider/availability";
import CompanyTeam from "../../client/src/components/company-team";
import AdminCategories from "../../client/src/components/admin-categories";
import AdminUserFiltersForm from "../../client/src/components/admin-user-filters";
import StorefrontEditor from "../../client/src/components/provider/storefront-editor";
import AdminSubscriptions from "../../client/src/components/admin-subscriptions";
import { defaultAdminUserFilters } from "../../shared/admin";
import type { Availability, Employee, WorkspaceContext } from "../../shared/schema";
declare const __FORM_RESOURCES__: Record<string, { translation: object }>;
const params = new URLSearchParams(location.search), mode = params.get("mode") || "availability";
const context = { company: { id: 7, name: "Synthetic company", isActive: true }, membership: { role: params.get("viewer") ? "viewer" : "owner" }, workspaces: [], invalid: false,
  permissions: { manageCompany: true, manageTeam: !params.has("denied"), manageServices: !params.has("denied"), manageSchedules: !params.has("denied"), manageBookings: true, readAll: true, isOwner: !params.has("denied") } } as unknown as WorkspaceContext;
const employees = [{ id: 10, name: "Synthetic employee" }, { id: 11, name: "Other synthetic employee" }] as Employee[];
const baseSchedule = { id: 1, providerId: "synthetic-user", serviceId: null, scheduleType: "recurring", daysOfWeek: [1], startTime: "09:00", endTime: "17:00", timezone: "UTC", isActive: true, breaks: [] };
let schedules = [baseSchedule, { ...baseSchedule, id: 2, serviceId: 7, startTime: "10:00", endTime: "14:00" }, { ...baseSchedule, id: 3, scheduleType: "specific", daysOfWeek: null, specificDate: "2030-01-20T00:00:00Z", startTime: "00:00", endTime: "00:00" }] as unknown as Availability[];
let categories = [{ key: "synthetic", name: "Synthetic category", icon: "", searchKeywords: "" }];
const team = { members: [{ userId: "owner", email: "owner@example.test", firstName: "Synthetic", lastName: "Owner", role: "owner", employeeId: null }, { userId: "member", email: "member@example.test", firstName: "Synthetic", lastName: "Member", role: "provider", employeeId: 10 }], invitations: [{ id: "invite", email: "invite@example.test", role: "admin", employeeId: null, expiresAt: "2099-01-01" }] };
let storefront: Record<string, unknown> | null = params.has("existing") ? { slug: "synthetic-store", name: "Synthetic store", description: "Synthetic description", logoUrl: null, coverUrl: null, isPublished: true } : null;
const fixture = { ready: false, writes: [] as { path: string; method: string; body: Record<string, unknown> }[], unexpected: [] as string[], result: "success", resolve: null as (() => void) | null, applied: [] as object[], accessError: "", confirm: true, confirmations: [] as string[], refresh: () => queryClient.invalidateQueries({ queryKey: ["/api/availability/provider"] }) };
Object.assign(window, { phase2Fixture: fixture, phase3Fixture: fixture });
const held = () => new Promise<void>(resolve => { fixture.resolve = resolve; });
window.confirm = message => { fixture.confirmations.push(message || ""); return fixture.confirm; };
window.fetch = async (input, options = {}) => {
  const path = String(input), method = options.method || "GET", body = options.body ? JSON.parse(String(options.body)) : {};
  if (method !== "GET") {
    fixture.writes.push({ path, method, body });
    if (fixture.result === "pending") await held();
    if (fixture.result === "error") return Response.json({ message: "<img src=x onerror=alert(1)>" }, { status: 503 });
    if (fixture.result === "forbidden") return Response.json({}, { status: 403 });
    if (fixture.result === "conflict") return Response.json({}, { status: 409 });
  }
  if (path === "/api/auth/user") return Response.json({ id: "synthetic-user", firstName: "Synthetic", lastName: "Provider" });
  if (path === "/api/company/context") return Response.json(context);
  if (path === "/api/services/provider") return Response.json([{ id: 7, name: "Synthetic service" }, { id: 8, name: "Inherited service" }]);
  if (path === "/api/availability/provider") { if (params.has("loadError")) return Response.json({}, { status: 503 }); return Response.json(schedules); }
  if (path === "/api/availability/weekly") {
    schedules = schedules.filter(row => row.serviceId !== body.serviceId || row.scheduleType !== "recurring");
    if (!body.inherit) for (const day of body.days) for (const range of day.intervals) schedules.push({ ...baseSchedule, ...range, serviceId: body.serviceId, timezone: body.timezone, daysOfWeek: [day.day], id: 20 + schedules.length } as Availability);
    return Response.json({});
  }
  if (path.startsWith("/api/availability/override")) {
    const date = method === "DELETE" ? new URL(path, location.origin).searchParams.get("date") : body.date;
    schedules = schedules.filter(row => row.scheduleType !== "specific" || !String(row.specificDate).startsWith(date));
    if (method !== "DELETE") for (const range of body.intervals.length ? body.intervals : [{ startTime: "00:00", endTime: "00:00" }]) schedules.push({ ...baseSchedule, ...range, id: 50, scheduleType: "specific", serviceId: body.serviceId, timezone: body.timezone, specificDate: date + "T00:00:00Z" } as Availability);
    return Response.json({});
  }
  if (path === "/api/company/team") { if (params.has("loadError")) return Response.json({}, { status: 503 }); return Response.json(team); }
  if (path.startsWith("/api/company/members/")) { if (method === "DELETE") team.members = team.members.filter(item => item.userId !== path.split("/").at(-1)); else Object.assign(team.members.find(item => item.userId === "member")!, body); return Response.json({}); }
  if (path === "/api/company/invitations") return Response.json({ invitationUrl: location.origin + "/invitation?token=synthetic-token", emailSent: body.sendEmail });
  if (path.startsWith("/api/company/invitations/")) { team.invitations = []; return Response.json({}); }
  if (path === "/api/company/transfer" || path === "/api/company/active") return Response.json({});
  if (path === "/api/categories") return Response.json(categories);
  if (path.startsWith("/api/admin/categories")) { if (method === "POST") categories.push(body); if (method === "PATCH") Object.assign(categories[0], body); if (method === "DELETE") categories = []; return Response.json({}); }
  if (path === "/api/provider/storefront") {
    if (method === "PUT") { storefront = { ...body }; return Response.json(storefront); }
    return Response.json({ subscription: { plan: "pro", proUntil: "2099-01-01T00:00:00Z" }, hasPro: !params.has("noPro"), storefront });
  }
  if (path.startsWith("/api/services/catalog?")) return Response.json([]);
  if (path.startsWith("/api/admin/subscriptions/options?")) return Response.json({ items: [{ target: { kind: "company", id: 7 }, name: "Synthetic company", detail: "synthetic@example.test", isActive: true }], hasMore: false });
  if (path.startsWith("/api/admin/subscriptions")) return Response.json({ name: "Synthetic company", subscription: { plan: "pro", proUntil: body.proUntil || "2099-01-01T00:00:00Z" } });
  fixture.unexpected.push(method + " " + path); throw Error("Unexpected synthetic request");
};
await i18next.use(initReactI18next).init({ lng: params.get("lang") || "en", fallbackLng: false, resources: __FORM_RESOURCES__, interpolation: { escapeValue: false } });
function Fixture() {
  const [dark, setDark] = useState(false);
  useEffect(() => { fixture.ready = true; }, []);
  useEffect(() => { document.documentElement.classList.toggle("dark", dark); }, [dark]);
  const fail = (error: Error) => { fixture.accessError = error.message; };
  return <div className="bg-background text-foreground min-h-screen"><nav aria-label="Fixture controls" className="flex flex-wrap gap-4 p-4 border-b"><label>Fixture language<select id="fixture-language" value={i18next.language} onChange={event => void i18next.changeLanguage(event.target.value)}>{Object.keys(__FORM_RESOURCES__).map(language => <option key={language}>{language}</option>)}</select></label><button id="fixture-theme" onClick={() => setDark(!dark)}>Toggle fixture theme</button></nav><main className="max-w-3xl mx-auto p-4">
    {mode === "availability" ? <AvailabilityPage /> : mode === "team" ? <CompanyTeam context={context} employees={employees} /> : mode === "categories" ? <AdminCategories onAccessError={fail} /> : mode === "filters" ? <AdminUserFiltersForm filters={{ ...defaultAdminUserFilters, timezone: "UTC" }} onApply={filters => fixture.applied.push(filters)} /> : mode === "subscriptions" ? <AdminSubscriptions onAccessError={fail} /> : <StorefrontEditor context={context} />}
  </main></div>;
}
queryClient.setQueryData(["/api/auth/user"], { id: "synthetic-user", firstName: "Synthetic", lastName: "Provider" });
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={queryClient}><Fixture /></QueryClientProvider>);
