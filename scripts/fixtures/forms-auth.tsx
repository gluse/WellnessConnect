import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../../client/src/lib/queryClient";
import Login from "../../client/src/pages/login";

declare const __FORM_RESOURCES__: Record<string, { translation: object }>;
const params = new URLSearchParams(location.search);
const fixture = { ready: false, writes: [] as { path: string; body: Record<string, unknown> }[], unexpected: [] as string[], result: "success", providers: params.get("providers") || "all", resolve: null as (() => void) | null, resolveProviders: null as (() => void) | null };
Object.assign(window, { phase2Fixture: fixture, authFixture: fixture });
window.fetch = async (input, options = {}) => {
  const path = String(input), method = options.method || "GET", body = options.body ? JSON.parse(String(options.body)) : {};
  if (path === "/api/auth/user") return Response.json(null);
  if (path === "/api/auth/providers") {
    if (fixture.providers === "loading") await new Promise<void>(resolve => { fixture.resolveProviders = resolve; });
    if (fixture.providers === "error") return Response.json({}, { status: 503 });
    return Response.json({ google: fixture.providers !== "none", facebook: fixture.providers === "all", apple: fixture.providers === "all", microsoft: fixture.providers === "all" });
  }
  if (method === "POST" && ["/api/auth/login", "/api/auth/signup", "/api/auth/invite-recovery", "/api/auth/google", "/api/auth/facebook", "/api/auth/apple", "/api/auth/microsoft"].includes(path)) {
    fixture.writes.push({ path, body });
    if (fixture.result === "pending") await new Promise<void>(resolve => { fixture.resolve = resolve; });
    if (fixture.result === "error") return Response.json({ message: "<img src=x onerror=alert(1)>" }, { status: 503 });
    if (fixture.result === "unauthorized") return Response.json({}, { status: 401 });
    if (fixture.result === "rateLimited") return Response.json({}, { status: 429 });
    if (fixture.result === "invalid") return Response.json({}, { status: 400 });
    if (path === "/api/auth/signup") return Response.json({ signedIn: fixture.result === "signedIn", message: "Check your email to confirm your account. Open the link in this browser." });
    if (path === "/api/auth/login") return Response.json({ success: true });
    if (path === "/api/auth/invite-recovery") return Response.json({ message: "If this address has an active invitation and an account, a fresh sign-in email will arrive. Open the newest link in this browser to set your password." });
    return Response.json({ url: "/synthetic-provider-redirect" });
  }
  fixture.unexpected.push(method + " " + path); throw Error("Unexpected synthetic auth request");
};
await i18next.use(initReactI18next).init({ lng: params.get("lang") || "en", fallbackLng: false, supportedLngs: Object.keys(__FORM_RESOURCES__), resources: __FORM_RESOURCES__, interpolation: { escapeValue: false } });
queryClient.setQueryData(["/api/auth/user"], null);
function Fixture() {
  const [dark, setDark] = useState(false);
  useEffect(() => { fixture.ready = true; }, []);
  useEffect(() => { document.documentElement.classList.toggle("dark", dark); }, [dark]);
  return <div className="bg-background text-foreground min-h-screen"><nav aria-label="Fixture controls" className="p-4"><button id="fixture-theme" onClick={() => setDark(!dark)}>Toggle fixture theme</button></nav><Login /></div>;
}
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={queryClient}><Fixture /></QueryClientProvider>);
