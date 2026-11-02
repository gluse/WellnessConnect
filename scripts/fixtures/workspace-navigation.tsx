import React from "react";
import { createRoot } from "react-dom/client";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../../client/src/lib/queryClient";
import MyServices from "../../client/src/pages/my-services";
import { Toaster } from "../../client/src/components/ui/toaster";
import type { WorkspaceContext } from "../../shared/schema";

declare const __FORM_RESOURCES__: Record<string, { translation: object }>;
const params = new URLSearchParams(location.search);
const user = { id: "synthetic-provider", firstName: "Synthetic", currentRole: "provider" };
const workspaces: WorkspaceContext["workspaces"] = [
  { id: 2, name: "Synthetic company with a very long workspace name <script>test</script>", role: "admin" },
  { id: 3, name: "Second synthetic company", role: "viewer" },
] satisfies WorkspaceContext["workspaces"];
workspaces.splice(Number(params.get("companies") ?? 1));
const permissions = { manageCompany: true, manageTeam: true, manageServices: true, manageSchedules: true, manageBookings: true, readAll: true, isOwner: true };
const personal: WorkspaceContext = { company: null, membership: null, workspaces, permissions, invalid: false };
let context = personal;
const fixture = { ready: false, result: "success", writes: [] as { companyId: number | null }[], unexpected: [] as string[], release: null as (() => void) | null,
  refresh: () => queryClient.invalidateQueries({ queryKey: ["/api/company/context"] }),
};
Object.assign(window, { phase2Fixture: fixture });
window.fetch = async (input, options = {}) => {
  const path = String(input), method = options.method || "GET";
  if (path === "/api/auth/user" && method === "GET") return Response.json(user);
  if (path === "/api/company/context") {
    if (method === "POST") {
      const body = JSON.parse(String(options.body));
      fixture.writes.push(body);
      if (fixture.result === "pending") await new Promise<void>(resolve => { fixture.release = resolve; });
      if (fixture.result === "error") return Response.json({}, { status: 503 });
      const selected = workspaces.find(row => row.id === body.companyId);
      context = selected ? { ...personal, company: { id: selected.id, name: selected.name, isActive: true }, membership: { role: selected.role },
        permissions: selected.role === "viewer" ? { manageCompany: false, manageTeam: false, manageServices: false, manageSchedules: false, manageBookings: false, readAll: false, isOwner: false } : permissions } as WorkspaceContext : personal;
    }
    return Response.json(context);
  }
  if (method === "GET") {
    if (["/api/bookings/provider", "/api/provider/employees", "/api/services/provider", "/api/addresses", "/api/availability/provider"].includes(path)) return Response.json([]);
    if (path === "/api/categories") return Response.json([]);
    if (path === "/api/notifications/capabilities") return Response.json({ hasPro: false, automationEnabled: false, channels: { email: false, sms: false, whatsapp: false } });
  }
  fixture.unexpected.push(`${method} ${path}`);
  throw Error(`Unexpected mocked request: ${method} ${path}`);
};
const language = params.get("lang") || "en";
await i18next.use(initReactI18next).init({ lng: language, fallbackLng: "en", resources: __FORM_RESOURCES__, interpolation: { escapeValue: false } });
document.documentElement.lang = language;
queryClient.setQueryData(["/api/auth/user"], user);
queryClient.setQueryData(["/api/company/context"], context);
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={queryClient}><MyServices /><Toaster /></QueryClientProvider>);
fixture.ready = true;
