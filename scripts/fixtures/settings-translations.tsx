import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../../client/src/lib/queryClient";
import SettingsPage from "../../client/src/pages/provider/settings";
import { useToast } from "../../client/src/hooks/use-toast";

declare const __FORM_RESOURCES__: Record<string, { translation: object }>;
const params = new URLSearchParams(location.search);
const company = !params.has("individual");
const user = { id: "synthetic-provider", providerType: company ? "company" : "individual", companyName: company ? "Synthetic company" : null, currentRole: "provider" };
const context = { company: company ? { id: 7, name: "Synthetic company" } : null, membership: null, workspaces: [], permissions: { manageServices: !params.has("denied"), manageTeam: company && !params.has("noTeam"), isOwner: false } };
let employees = params.has("empty") ? [] : [{ id: 11, name: "Synthetic visible", showName: true }, { id: 12, name: "Synthetic hidden", showName: false }];
const fixture = {
  ready: false, result: "success", release: null as (() => void) | null,
  writes: [] as { path: string; method: string; body: Record<string, unknown> }[], unexpected: [] as string[],
  language: async (language: string) => { await i18next.changeLanguage(language); document.documentElement.lang = language; },
};
Object.assign(window, { phase2Fixture: fixture });
const held = () => new Promise<void>(resolve => { fixture.release = resolve; });
window.fetch = async (input, options = {}) => {
  const path = String(input), method = options.method || "GET", body = options.body ? JSON.parse(String(options.body)) : {};
  if (method !== "GET") {
    fixture.writes.push({ path, method, body });
    if (fixture.result === "pending") await held();
    if (fixture.result === "error") return Response.json({ message: "Untranslated server detail" }, { status: 503 });
    if (path === "/api/provider/profile") {
      if (context.company) context.company.name = body.companyName;
      return Response.json({});
    }
    if (path === "/api/provider/employees") { employees = [...employees, { id: 13, ...body }]; return Response.json({}); }
    if (path.startsWith("/api/provider/employees/")) {
      const id = Number(path.split("/").at(-1));
      employees = method === "DELETE" ? employees.filter(employee => employee.id !== id) : employees.map(employee => employee.id === id ? { ...employee, ...body } : employee);
      return Response.json({});
    }
  } else {
    if (path === "/api/auth/user") return Response.json(user);
    if (path === "/api/company/context") {
      if (params.has("loading")) await held();
      return Response.json(context);
    }
    if (path === "/api/provider/employees") {
      if (params.get("employees") === "pending") await held();
      if (params.get("employees") === "error") return Response.json({}, { status: 503 });
      return Response.json(employees);
    }
  }
  fixture.unexpected.push(method + " " + path); throw Error("Unexpected fixture request");
};
queryClient.setQueryData(["/api/auth/user"], user);
if (!params.has("loading")) queryClient.setQueryData(["/api/company/context"], context);
await i18next.use(initReactI18next).init({ lng: params.get("lang") || "en", fallbackLng: false, resources: __FORM_RESOURCES__, interpolation: { escapeValue: false } });
document.documentElement.lang = i18next.language;
function Receipts() {
  const { toasts } = useToast();
  return <aside aria-live="polite">{toasts.filter(toast => toast.open).map(toast => <div key={toast.id} data-receipt><p>{toast.title}</p><p>{toast.description}</p></div>)}</aside>;
}
createRoot(document.getElementById("root")!).render(<StrictMode><QueryClientProvider client={queryClient}>
  <main className="mx-auto max-w-4xl p-4"><SettingsPage /><Receipts /></main>
</QueryClientProvider></StrictMode>);
fixture.ready = true;
