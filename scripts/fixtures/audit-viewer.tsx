import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { queryClient } from "../../client/src/lib/queryClient";
import Administration from "../../client/src/pages/administration";
declare const __FORM_RESOURCES__: Record<string, { translation: object }>;
const params = new URLSearchParams(location.search);
await i18next.use(initReactI18next).init({ lng: params.get("lang") || "en", fallbackLng: false, resources: __FORM_RESOURCES__, interpolation: { escapeValue: false } });
let user = { id: "11111111-1111-4111-8111-111111111111", currentRole: "provider" };
const fixture = { ready: false, unexpected: [] as string[], writes: [] as string[], requests: [] as string[], downloads: [] as { size: number; text: string }[], status: 200, denied: params.get("state") === "denied", exports: params.get("state") !== "readonly", pending: false, release: null as null | (() => void) };
Object.assign(window, { phase2Fixture: fixture });
Object.assign(fixture, { switchAccount() { user = { ...user, id: "66666666-6666-4666-8666-666666666666" }; queryClient.setQueryData(["/api/auth/user"], user); } });
const originalUrl = URL.createObjectURL.bind(URL);
URL.createObjectURL = (blob: Blob) => { void blob.text().then(text => fixture.downloads.push({ size: blob.size, text })); return originalUrl(blob); };
window.fetch = async (input, options = {}) => {
  const path = String(input), method = options.method || "GET";
  if (method !== "GET") { fixture.writes.push(`${method} ${path}`); throw Error("No fixture writes permitted"); }
  if (path === "/api/auth/user") return Response.json(user);
  if (path === "/api/admin/access") return Response.json({ isAdmin: false });
  if (path === "/api/admin/audit/access") return Response.json({ canRead: !fixture.denied, canExport: fixture.exports && !fixture.denied, available: params.get("state") !== "unavailable" });
  if (path.startsWith("/api/admin/audit/events?") || path.startsWith("/api/admin/audit/export?")) {
    const currentUser = user;
    fixture.requests.push(path);
    if (fixture.pending) await new Promise<void>(resolve => fixture.release = resolve);
    if (fixture.status !== 200) return Response.json({ message: "Synthetic failure" }, { status: fixture.status });
    if (path.startsWith("/api/admin/audit/export?")) return new Response('"Time (UTC)","Activity"\r\n"2026-11-07T10:30:00Z","Account details changed"', { headers: { "Content-Type": "text/csv" } });
    const query = new URL(path, "http://localhost").searchParams;
    const second = query.has("cursor");
    const event = { eventId: second ? "33333333-3333-4333-8333-333333333333" : "22222222-2222-4222-8222-222222222222", eventName: "account.details_changed.v1", occurredAt: "2026-11-07T10:30:00Z", receivedAt: "2026-11-07T10:30:01Z", expiresAt: "2027-11-07T10:30:00Z", actor: { kind: "user", userId: currentUser.id }, scope: { kind: "personal", workspaceId: currentUser.id }, target: { type: "user", id: currentUser.id }, outcome: "succeeded", changes: [{ field: "firstName", redacted: true }, { field: "currentRole", before: "seeker", after: "provider" }], source: { application: "fitsmytime", environment: "test", component: "account" }, requestId: "44444444-4444-4444-8444-444444444444", operationId: "55555555-5555-4555-8555-555555555555", retentionClass: "B" };
    if (params.get('state') === 'database') Object.assign(event, { eventName:'data.record_updated.v1', actor:{kind:'service',serviceId:'database-runtime'},scope:{kind:'unknown'},target:{type:'database_record',id:'services:17'},changes:[{field:'price',redacted:true}] });
    if (params.get('state') === 'read') Object.assign(event, { eventName:'activity.records_read.v1',target:{type:'request'},changes:[{field:'action',before:null,after:'bookings.seeker'}] });
    if (params.get('state') === 'intent') Object.assign(event, { eventName:'auth.operation_requested.v1',target:{type:'request'},changes:[{field:'operation',before:null,after:'login'}] });
    if (params.get('state') === 'integration') Object.assign(event, { eventName:'integration.operation_reported.v1',actor:{kind:'service',serviceId:'integration-runtime'},scope:{kind:'unknown'},target:{type:'request'},changes:[{field:'operation',before:null,after:'geocoding'}] });
    return Response.json({ events: params.get("state") === "empty" || query.get("action") && query.get("action") !== event.eventName ? [] : [event], nextCursor: second ? null : "fixture-second-page", hasMore: !second, query: Object.fromEntries(query) });
  }
  fixture.unexpected.push(`${method} ${path}`); throw Error(`Unexpected fixture request ${path}`);
};
queryClient.setQueryData(["/api/auth/user"], user);
function Fixture() {
  const [language, setLanguage] = useState(i18next.language);
  useEffect(() => { fixture.ready = true; }, []);
  return <><label>Fixture language<select id="fixture-language" value={language} onChange={event => { setLanguage(event.target.value); void i18next.changeLanguage(event.target.value); }}>{["en", "lv", "ru"].map(value => <option key={value}>{value}</option>)}</select></label><Router><Administration /></Router></>;
}
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={queryClient}><Fixture /></QueryClientProvider>);
