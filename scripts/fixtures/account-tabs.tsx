import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { QueryClientProvider } from "@tanstack/react-query";
import { Route, Switch } from "wouter";
import { queryClient } from "../../client/src/lib/queryClient";
import Account from "../../client/src/pages/account";
import SettingsPage from "../../client/src/pages/provider/settings";
import type { CommunicationSettings } from "../../shared/notifications";

declare const __FORM_RESOURCES__: Record<string, { translation: object }>;
const params = new URLSearchParams(location.search);
let user = { id: "synthetic-account", firstName: "Synthetic", lastName: "User", email: "synthetic@example.test", currentRole: params.get("provider") ? "provider" : "seeker", providerType: "individual" };
let preferences: CommunicationSettings = { phone: null, phoneVerified: false, preferredMethod: "email", language: "en", smsOptIn: false, whatsappOptIn: false, verificationAvailable: !params.has("unavailable") };
let context = { company: null as { id: number; name: string } | null, membership: null, workspaces: [], permissions: { manageServices: !params.has("denied"), manageTeam: false, manageSchedules: false, manageBookings: false, isOwner: false, readAll: true } };
let offset = 0;
const realNow = Date.now;
Date.now = () => realNow() + offset;
const fixture = {
  ready: false, result: "success", verifyResult: "success", roleResult: "success", loadResult: params.get("load") || "success",
  writes: [] as { path: string; body: Record<string, unknown> }[], reads: [] as string[], unexpected: [] as string[], release: null as (() => void) | null,
  preferences: () => preferences,
  advance: (milliseconds: number) => { offset += milliseconds; },
  switchAccount: () => { user = { ...user, id: "synthetic-other", firstName: "Other", currentRole: "seeker" }; preferences = { ...preferences, phone: null, phoneVerified: false }; queryClient.setQueryData(["/api/auth/user"], user); },
  switchWorkspace: () => { context = { ...context, company: { id: 99, name: "Synthetic company" } }; queryClient.setQueryData(["/api/company/context"], context); },
};
Object.assign(window, { phase2Fixture: fixture });
const held = () => new Promise<void>(resolve => { fixture.release = resolve; });
window.fetch = async (input, options = {}) => {
  const path = String(input), method = options.method || "GET", body = options.body ? JSON.parse(String(options.body)) : {};
  if (method !== "GET") fixture.writes.push({ path, body }); else fixture.reads.push(path);
  if (path === "/api/auth/user") return Response.json(params.has("guest") ? null : user);
  if (path === "/api/company/context") return Response.json(context);
  if (path === "/api/provider/employees") return Response.json([]);
  if (path === "/api/account/communication") {
    if (method === "GET") {
      if (fixture.loadResult === "pending") await held();
      if (fixture.loadResult === "error") return Response.json({}, { status: 503 });
    } else {
      if (fixture.result === "pending") await held();
      if (fixture.result === "error") return Response.json({}, { status: 503 });
      const changed = body.phone !== undefined && body.phone !== preferences.phone;
      preferences = { ...preferences, ...body, ...(changed ? { phoneVerified: false, smsOptIn: false, whatsappOptIn: false, preferredMethod: "email" as const } : {}) };
    }
    return Response.json(preferences);
  }
  if (path.endsWith("/verify/start")) {
    if (fixture.verifyResult === "pending") await held();
    if (fixture.verifyResult === "error") return Response.json({}, { status: 503 });
    return Response.json({ status: "pending", expiresAt: new Date(Date.now() + 300_000).toISOString(), nextSendAt: new Date(Date.now() + 60_000).toISOString() });
  }
  if (path.endsWith("/verify/check")) {
    if (fixture.verifyResult === "error") return Response.json({}, { status: 400 });
    preferences = { ...preferences, phoneVerified: true }; return Response.json({ status: "verified" });
  }
  if (path === "/api/users/role") {
    if (fixture.roleResult === "pending") await held();
    if (fixture.roleResult === "error") return Response.json({}, { status: 503 });
    if (fixture.roleResult === "unauthorized") return Response.json({}, { status: 401 });
    user = { ...user, currentRole: "provider" }; return Response.json(user);
  }
  if (path === "/api/addresses") return Response.json([{ id: 3, address: context.company ? "Synthetic company address" : "Synthetic personal address", latitude: 0, longitude: 0, locationSource: "manual" }]);
  if (path === "/api/workspace/pricing-settings") return Response.json({ workspace: context.company ? { kind: "company", id: context.company.id } : { kind: "user", id: user.id }, defaultCurrency: context.company ? "GBP" : "EUR", businessCountryCode: context.company ? "GB" : "LV", revision: 1, canEdit: true });
  fixture.unexpected.push(method + " " + path); throw Error("Unexpected fixture request");
};
queryClient.setQueryData(["/api/auth/user"], params.has("guest") ? null : user);
queryClient.setQueryData(["/api/company/context"], context);
await i18next.use(initReactI18next).init({ lng: params.get("lang") || "en", fallbackLng: false, resources: __FORM_RESOURCES__, interpolation: { escapeValue: false } });
document.documentElement.lang = i18next.language;
createRoot(document.getElementById("root")!).render(<StrictMode><QueryClientProvider client={queryClient}>
  <Switch><Route path="/my-services/settings/*?"><main className="phase2-form max-w-4xl mx-auto p-4"><SettingsPage /></main></Route><Route path="/login"><p>Sign in</p></Route><Route><Account /></Route></Switch>
</QueryClientProvider></StrictMode>);
fixture.ready = true;
