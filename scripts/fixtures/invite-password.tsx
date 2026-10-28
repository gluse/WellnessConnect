import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../../client/src/lib/queryClient";
import Invite from "../../client/src/pages/invite";

declare const __FORM_RESOURCES__: Record<string, { translation: object }>;
const params = new URLSearchParams(location.search);
const fixture = { ready: false, needsPassword: params.get("password") !== "set", rejectPassword: false, writes: [] as { path: string; body: unknown }[], unexpected: [] as string[] };
Object.assign(window, { phase2Fixture: fixture });
const invitation = { id: "synthetic-invitation", companyName: "Synthetic company", role: "viewer" };
queryClient.setQueryData(["/api/auth/user"], { id: "synthetic-user", email: "synthetic@example.test" });
queryClient.setQueryData(["/api/company/my-invitations"], [invitation]);
window.fetch = async (input, options = {}) => {
  const path = String(input);
  if (path === "/api/auth/invite-status") return Response.json({ needsPassword: fixture.needsPassword });
  if (options.method === "POST" && ["/api/auth/invite-password", "/api/company/invitations/accept"].includes(path)) {
    fixture.writes.push({ path, body: JSON.parse(String(options.body)) });
    if (path === "/api/auth/invite-password") {
      if (fixture.rejectPassword) return Response.json({ message: "Synthetic password rejection" }, { status: 400 });
      fixture.needsPassword = false;
      return Response.json({ success: true });
    }
    // Keep the fixture on this screen to inspect the completed password setup.
    return Response.json({ message: "Synthetic acceptance rejection" }, { status: 409 });
  }
  fixture.unexpected.push(path); throw Error("Unexpected fixture request");
};
await i18next.use(initReactI18next).init({ lng: params.get("lang") || "en", fallbackLng: false, resources: __FORM_RESOURCES__, interpolation: { escapeValue: false } });
document.documentElement.lang = i18next.language;
function Fixture() {
  useEffect(() => { fixture.ready = true; }, []);
  return <Invite />;
}
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={queryClient}><Fixture /></QueryClientProvider>);
