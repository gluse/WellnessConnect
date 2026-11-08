import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { queryClient } from "../../client/src/lib/queryClient";
import MyServices from "../../client/src/pages/my-services";
import MobileNavigationLayout from "../../client/src/components/mobile-navigation";
declare const __FORM_RESOURCES__: Record<string, { translation: object }>;
const params = new URLSearchParams(location.search);
await i18next.use(initReactI18next).init({ lng: params.get("lang") || "en", fallbackLng: false, resources: __FORM_RESOURCES__, interpolation: { escapeValue: false } });
const fixture = { ready: false, unexpected: [] as string[], writes: [] as string[], requests: [] as string[], downloads: [] as { mime: string; size: number; base64: string }[], pdfText: [] as { text: string; x: number; y: number; width: number; height: number }[], workspace: params.has("company") ? "company" : "personal", employeeResult: params.get("employees") || "success", catalogResult: params.get("catalog") || "success", resolveEmployee: null as (() => void) | null };
Object.assign(window, { phase2Fixture: fixture });
const originalFillText = CanvasRenderingContext2D.prototype.fillText;
CanvasRenderingContext2D.prototype.fillText = function(text: string, x: number, y: number, maxWidth?: number) {
  fixture.pdfText.push({ text, x, y, width: this.measureText(text).width, height: Number(this.font.match(/([\d.]+)px/)?.[1] ?? 22) });
  if (maxWidth === undefined) originalFillText.call(this, text, x, y);
  else originalFillText.call(this, text, x, y, maxWidth);
};
const originalUrl = URL.createObjectURL.bind(URL);
URL.createObjectURL = (blob: Blob) => { void blob.arrayBuffer().then(bytes => fixture.downloads.push({ mime: blob.type, size: blob.size, base64: btoa(Array.from(new Uint8Array(bytes), byte => String.fromCharCode(byte)).join("")) })); return originalUrl(blob); };
const user = { id: "synthetic-provider", currentRole: "provider" };
const permissions = { readAll: true, manageBookings: true, manageServices: true, manageTeam: true, manageSchedules: true, isOwner: true };
const context = () => ({ company: fixture.workspace === "personal" ? null : { id: fixture.workspace === "company2" ? 2 : 1, name: fixture.workspace === "company2" ? "Second workspace" : "Synthetic company", isActive: true }, membership: fixture.workspace === "restricted" ? { employeeId: 11, role: "provider" } : null, workspaces: [], permissions: { ...permissions, readAll: fixture.workspace !== "restricted" } });
const now = new Date();
const bookings = ["completed", "confirmed", "pending", "cancelled"].map((status, index) => ({ id: index + 1, serviceId: 101 + index, employeeId: null, status, totalAmount: String((index + 1) * 10), currency: "EUR", scheduledDate: new Date(now.getFullYear(), now.getMonth(), 7, 12).toISOString(), service: { id: 101 + index, name: index === 0 ? "Ārstēšana — Услуга" : `Wellness session ${index + 1}` } }));
const employees = [{ id: 11, name: "Anna Visible" }, { id: 12, name: "Boris Visible" }];
const catalog = [
  { id: 101, name: "Massage", employeeId: 12, currency: "EUR", isActive: true },
  { id: 102, name: "Massage", employeeId: 12, currency: "EUR", isActive: true },
  { id: 103, name: "Unused treatment", employeeId: 11, currency: "EUR", isActive: true },
  { id: 104, name: "Inactive treatment", employeeId: 12, currency: "EUR", isActive: false },
  { id: 105, name: "Shared treatment", employeeId: null, currency: "EUR", isActive: true },
];
if (params.get("graph") === "many") catalog.push(...Array.from({ length: 24 }, (_, index) => ({ id: 200 + index, name: `Long named service ${index + 1} — Ārstēšana и восстановление with extended descriptive wording`, employeeId: 11, currency: "EUR", isActive: true })));
const companyBookings = [
  ...bookings.map((booking, index) => ({ ...booking, employeeId: [11, 12, null, 11][index], serviceId: [101, 102, 101, 999][index], service: { id: [101, 102, 101, 999][index], name: index === 3 ? "Historical treatment" : "Massage", employeeId: 12 } })),
  { ...bookings[0], id: 5, employeeId: 11, serviceId: 101, currency: "USD", totalAmount: "7.00", service: catalog[0] },
  { ...bookings[0], id: 6, employeeId: 11, serviceId: 102, totalAmount: "3.00", service: catalog[1] },
];
const setWorkspace = (workspace: string) => { fixture.workspace = workspace; queryClient.setQueryData(["/api/company/context"], context()); };
Object.assign(fixture, { setWorkspace });
// Poison unscoped global caches; report-local scope keys must never use them.
queryClient.setQueryData(["/api/provider/employees"], [{ id: 9999, name: "UNSCOPED SECRET" }]);
queryClient.setQueryData(["/api/services/provider"], [{ id: 9999, name: "UNSCOPED SECRET", currency: "EUR" }]);
window.fetch = async (input, options = {}) => {
  const path = String(input), method = options.method || "GET";
  fixture.requests.push(`${method} ${path}`);
  if (method !== "GET") { fixture.writes.push(`${method} ${path}`); throw Error("No fixture writes permitted"); }
  if (path === "/api/auth/user") return Response.json(user);
  if (path === "/api/company/context") return Response.json(context());
  if (path === "/api/provider/employees") {
    if (fixture.employeeResult === "pending") await new Promise<void>((resolve, reject) => { fixture.resolveEmployee = resolve; options.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true }); });
    if (fixture.employeeResult === "error") return Response.json({}, { status: 403 });
    return Response.json(fixture.workspace === "company2" ? [{ id: 21, name: "Second worker" }] : fixture.workspace === "restricted" ? employees.slice(0, 1) : employees);
  }
  if (path === "/api/services/provider") {
    if (fixture.catalogResult === "error") return Response.json({}, { status: 503 });
    return Response.json(fixture.workspace === "personal" ? bookings.map(booking => ({ ...booking.service, currency: "EUR", employeeId: null })) : fixture.workspace === "company2" ? [{ id: 201, name: "Second workspace service", employeeId: 21, currency: "EUR" }] : fixture.workspace === "restricted" ? catalog.filter(service => service.employeeId === 11) : catalog);
  }
  if (path === "/api/bookings/provider") {
    if (params.get("state") === "error") return Response.json({}, { status: 403 });
    const visible = fixture.workspace === "personal" ? bookings : fixture.workspace === "restricted" ? companyBookings.filter(booking => booking.employeeId === 11) : fixture.workspace === "company2" ? [{ ...bookings[0], serviceId: 201, employeeId: 21, service: { id: 201, name: "Second workspace service" } }] : companyBookings;
    let selected = params.get("state") === "empty" ? [] : params.get("state") === "pending" ? visible.filter(booking => booking.status === "pending") : params.get("state") === "confirmed" ? visible.filter(booking => booking.status === "confirmed") : visible;
    if (params.get("graph") === "days") selected = selected.map((booking, index) => ({ ...booking, scheduledDate: new Date(now.getFullYear(), now.getMonth(), [3, 7, 11][index % 3], 12).toISOString() }));
    if (params.get("graph") === "manyDays") selected = Array.from({ length: 24 }, (_, index) => ({ ...visible[index % visible.length], id: 1000 + index, scheduledDate: new Date(now.getFullYear(), now.getMonth(), index + 1, 12).toISOString() }));
    if (params.get("graph") === "tiny") selected = visible.slice(0, 3).map((booking, index) => ({ ...booking, currency: "KWD", totalAmount: ["0.001", "0.002", "0.003"][index] }));
    return Response.json(params.get("sums") === "large" ? selected.map(booking => ({ ...booking, totalAmount: "99999999.99" })) : params.get("sums") === "zero" ? selected.map(booking => ({ ...booking, totalAmount: "0.00" })) : selected);
  }
  fixture.unexpected.push(`${method} ${path}`); throw Error(`Unexpected fixture request: ${method} ${path}`);
};
function Fixture() {
  const [language, setLanguage] = useState(i18next.language);
  useEffect(() => { fixture.ready = true; }, []);
  return <><label>Fixture language<select id="fixture-language" value={language} onChange={event => { setLanguage(event.target.value); void i18next.changeLanguage(event.target.value); }}>{["en", "lv", "ru"].map(value => <option key={value}>{value}</option>)}</select></label><Router><MobileNavigationLayout><MyServices /></MobileNavigationLayout></Router></>;
}
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={queryClient}><Fixture /></QueryClientProvider>);
