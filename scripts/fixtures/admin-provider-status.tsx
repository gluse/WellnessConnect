import React from "react";
import { createRoot } from "react-dom/client";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { QueryClientProvider } from "@tanstack/react-query";
import { Route, Switch } from "wouter";
import { queryClient } from "../../client/src/lib/queryClient";
import Administration from "../../client/src/pages/administration";
import type { AdminUser } from "../../shared/admin";

declare const __FORM_RESOURCES__: Record<string, { translation: object }>;
const params = new URLSearchParams(location.search);
const noPro = { enabled: false, proUntil: null };
const entries: AdminUser[] = [true, false, null].map((isServiceProvider, index) => ({
  id: `synthetic-${index}`, name: ["Provider without services", "Buyer with Pro", "Account without profile"][index],
  email: `synthetic-${index}@example.test`, emailVerified: true, accountStatus: "active",
  isServiceProvider, proSubscription: index === 1 ? { enabled: true, proUntil: "2099-01-01T00:00:00Z" } : noPro,
  companies: index === 1 ? [{ id: 1, name: "Synthetic company", role: "admin", isActive: true, proSubscription: noPro }] : [],
  createdAt: "2026-11-01T10:00:00Z", lastSignInAt: null,
}));
const fixture = {
  ready: false, result: "success", unexpected: [] as string[], reads: [] as string[],
  release: null as (() => void) | null,
  activate: () => { entries[1].isServiceProvider = true; },
  language: (lang: string) => i18next.changeLanguage(lang),
};
Object.assign(window, { phase2Fixture: fixture });
window.fetch = async (input, options = {}) => {
  const path = String(input);
  if (options.method && options.method !== "GET") { fixture.unexpected.push(`${options.method} ${path}`); throw Error("Unexpected write"); }
  fixture.reads.push(path);
  if (path === "/api/auth/user") return Response.json({ id: "synthetic-support" });
  if (path === "/api/admin/access") return Response.json({ isAdmin: !params.has("denied") });
  if (path === "/api/admin/audit/access") return Response.json({ canRead: false, canExport: false, available: false });
  if (path.startsWith("/api/admin/users?")) {
    if (fixture.result === "pending") await new Promise<void>(resolve => { fixture.release = resolve; });
    if (fixture.result === "error") return Response.json({}, { status: 503 });
    if (fixture.result === "forbidden") return Response.json({}, { status: 403 });
    return Response.json({ users: params.has("empty") ? [] : entries, page: 1, pageSize: 50, total: params.has("empty") ? 0 : 3, totalPages: 1, hasNextPage: false });
  }
  fixture.unexpected.push(path); throw Error("Unexpected request");
};
queryClient.setQueryData(["/api/auth/user"], { id: "synthetic-support" });
await i18next.use(initReactI18next).init({ lng: params.get("lang") || "en", fallbackLng: false, resources: __FORM_RESOURCES__, interpolation: { escapeValue: false } });
document.documentElement.lang = i18next.language;
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={queryClient}><Switch>
  <Route path="/login"><p>Sign in</p></Route><Route><Administration /></Route>
</Switch></QueryClientProvider>);
fixture.ready = true;
