import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { QueryClientProvider } from "@tanstack/react-query";
import MyServices from "../../client/src/pages/my-services";
import { queryClient } from "../../client/src/lib/queryClient";
import { Toaster } from "../../client/src/components/ui/toaster";
import type { Service, User, WorkspaceContext } from "../../shared/schema";

declare const __FORM_RESOURCES__: Record<string, { translation: object }>;
const params = new URLSearchParams(location.search);
const user = { id: "synthetic-provider", firstName: "Alex", lastName: "Provider", currentRole: "provider", providerType: "individual" } as User;
const permissions = { manageCompany: true, manageTeam: true, manageServices: true, manageSchedules: true, manageBookings: true, readAll: true, isOwner: true };
let context = { company: null, membership: null, workspaces: [], permissions, invalid: false } as WorkspaceContext;
if (params.get("mode") === "readonly") context = { ...context, permissions: { ...permissions, manageServices: false } };
if (params.get("mode") === "company") context = { ...context, company: { id: 2, name: "Balance Studio", isActive: true } } as WorkspaceContext;
const canvas = document.createElement("canvas"); canvas.width = 300; canvas.height = 180;
const paint = canvas.getContext("2d")!; paint.fillStyle = "#d5e5dd"; paint.fillRect(0, 0, 300, 180); paint.fillStyle = "#61816f"; paint.fillRect(80, 15, 140, 165);
const rows = [
  { id: 1, name: "Morning yoga", description: "Gentle movement and breathwork for all levels.", serviceType: "group", price: "18.00", duration: 60, instantBooking: true, isActive: true, imageUrl: canvas.toDataURL(), employeeId: 5 },
  { id: 2, name: "Sports massage", description: "Targeted treatment to release muscle tension.", serviceType: "one_to_one", price: "45.00", duration: 60, instantBooking: false, isActive: false, imageUrl: null, employeeId: null },
  { id: 3, name: "Personal training", description: "A focused session built around your goals.", serviceType: "one_to_one", price: "35.00", duration: 45, instantBooking: true, isActive: false, imageUrl: "data:image/png;base64,broken", employeeId: 99 },
  { id: 4, name: "Pilates flow", description: "Build strength, balance and flexibility.", serviceType: "group", price: "22.00", duration: 50, instantBooking: false, isActive: true, imageUrl: canvas.toDataURL(), employeeId: null },
  { id: 5, name: "Mindful movement with a very long service title for small screens", description: "A calm and supportive small group session.", serviceType: "group", price: "20.00", duration: 50, instantBooking: true, isActive: false, imageUrl: null, employeeId: 5 },
  { id: 6, name: '<img src=x onerror="window.injected=true">', description: '<script>window.injected=true</script> Text stays text.', serviceType: "one_to_one", price: "40.00", duration: 30, instantBooking: false, isActive: true, imageUrl: null, employeeId: null },
].map(row => ({ ...row, providerId: user.id, companyId: context.company?.id ?? null, category: "health_wellness", latitude: null, longitude: null, ageGroups: ["adults"], targetGender: "both", maxCapacity: 8, cleanupTime: 0, addressId: 3, advancePaymentPercent: 0 })) as Service[];
const fixture = {
  ready: false, requests: [] as string[], writes: [] as string[], unexpected: [] as string[],
  result: params.get("mode") || "success", copyResult: "success", releaseCopy: null as (() => void) | null,
  releaseServices: null as (() => void) | null,
  refresh: () => queryClient.invalidateQueries({ queryKey: ["/api/services/provider"] }),
  readonly: () => { context = { ...context, permissions: { ...permissions, manageServices: false } }; queryClient.setQueryData(["/api/company/context"], context); },
};
Object.assign(window, { phase2Fixture: fixture, providerServiceViews: fixture });
window.fetch = async (input, options = {}) => {
  const path = String(input), method = options.method || "GET";
  fixture.requests.push(`${method} ${path}`);
  if (method === "GET") {
    if (path === "/api/auth/user") return Response.json(user);
    if (path === "/api/company/context") return Response.json(context);
    if (path === "/api/provider/employees") return Response.json([{ id: 5, name: "Emma Coach" }]);
    if (path === "/api/services/provider") {
      if (fixture.result === "pending") await new Promise<void>(resolve => { fixture.releaseServices = resolve; });
      return Response.json(fixture.result === "error" ? {} : fixture.result === "empty" ? [] : rows, { status: fixture.result === "error" ? 503 : 200 });
    }
    if (path === "/api/categories") return Response.json([{ key: "health_wellness", name: "Health and wellness", icon: "" }]);
    if (path === "/api/addresses") return Response.json([{ id: 3, address: "Synthetic studio address" }]);
    if (path === "/api/notifications/capabilities") return Response.json({ hasPro: false, automationEnabled: false, channels: { email: false, sms: false, whatsapp: false } });
  }
  if (method === "POST" && /^\/api\/services\/\d+\/copy$/.test(path)) {
    fixture.writes.push(path);
    if (fixture.copyResult === "pending") await new Promise<void>(resolve => { fixture.releaseCopy = resolve; });
    if (fixture.copyResult === "error") return Response.json({ message: "Synthetic copy failure" }, { status: 503 });
    const source = rows.find(row => row.id === Number(path.split("/")[3]))!;
    const copy = { ...source, id: 90, name: `${source.name} (copy)`, isActive: false };
    rows.push(copy); return Response.json(copy);
  }
  if (method === "POST" && path === "/api/admin/generate-embeddings") { fixture.writes.push(path); return Response.json({ success: true }); }
  fixture.unexpected.push(`${method} ${path}`); throw Error(`Unexpected mocked request ${method} ${path}`);
};
await i18next.use(initReactI18next).init({ lng: params.get("lang") || "en", fallbackLng: "en", supportedLngs: ["en","lv","ru"], resources: __FORM_RESOURCES__, interpolation: { escapeValue: false } });
queryClient.setQueryData(["/api/auth/user"], user);
queryClient.setQueryData(["/api/company/context"], context);
function Fixture() {
  const [dark, setDark] = useState(false);
  useEffect(() => { fixture.ready = true; }, []);
  useEffect(() => { document.documentElement.classList.toggle("dark", dark); }, [dark]);
  return <><nav aria-label="Fixture controls" className="p-2 flex flex-wrap gap-3"><label>Language<select id="fixture-language" onChange={event => void i18next.changeLanguage(event.target.value)}>{['en','lv','ru'].map(language => <option key={language}>{language}</option>)}</select></label><button id="fixture-dark" onClick={() => setDark(value => !value)}>Toggle theme</button></nav><MyServices /><Toaster /></>;
}
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={queryClient}><Fixture /></QueryClientProvider>);
