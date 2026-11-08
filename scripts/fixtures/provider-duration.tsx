import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { QueryClientProvider } from "@tanstack/react-query";
import { Router, Route } from "wouter";
import { queryClient } from "../../client/src/lib/queryClient";
import StorefrontPage from "../../client/src/pages/storefront";

declare const __FORM_RESOURCES__: Record<string, { translation: object }>;
const params = new URLSearchParams(location.search);
await i18next.use(initReactI18next).init({ lng: params.get("lang") || "en", fallbackLng: false, resources: __FORM_RESOURCES__, interpolation: { escapeValue: false } });
const fixture = { ready: false, unexpected: [] as string[], writes: [] as string[], recordedViews: [] as string[] };
Object.assign(window, { phase2Fixture: fixture });
const services = [45, 90, 240, 1501].map((duration, index) => ({
  id: index + 1, providerId: "synthetic-provider", name: `Session ${index + 1}`, description: "Synthetic service", category: "education",
  serviceType: "one_to_one", price: "25.00", currency: "EUR", duration, maxCapacity: 1, instantBooking: true,
  ageGroups: ["adults"], targetGender: "both", advancePaymentPercent: 0, provider: { id: "synthetic-provider", firstName: "Synthetic", lastName: "Provider" },
}));
window.fetch = async (input, options = {}) => {
  const path = String(input), method = options.method || "GET";
  if (method === "POST" && /^\/api\/services\/[1-4]\/view$/.test(path)) { fixture.recordedViews.push(path); return new Response(null, { status: 204 }); }
  if (method !== "GET") { fixture.writes.push(`${method} ${path}`); throw Error("No fixture writes permitted"); }
  if (path === "/api/storefronts/teskaistumam") return Response.json({ slug: "teskaistumam", name: "Synthetic provider", services });
  if (path === "/api/categories") return Response.json([{ id: 1, key: "education", name: "Synthetic category", icon: "" }]);
  if (path === "/api/auth/user") return Response.json({ id: "synthetic-user", currentRole: "seeker" });
  if (path.startsWith("/api/wishlist")) return Response.json([]);
  if (path.startsWith("/api/availability/month/")) return Response.json({ days: [] });
  fixture.unexpected.push(`${method} ${path}`);
  throw Error(`Unexpected fixture request: ${method} ${path}`);
};
function Fixture() {
  const [language, setLanguage] = useState(i18next.language);
  useEffect(() => { fixture.ready = true; }, []);
  return <><label>Fixture language<select id="fixture-language" value={language} onChange={event => { setLanguage(event.target.value); void i18next.changeLanguage(event.target.value); }}>{["en", "lv", "ru"].map(value => <option key={value}>{value}</option>)}</select></label>
    <Router><Route path="/providers/:slug" component={StorefrontPage} /></Router></>;
}
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={queryClient}><Fixture /></QueryClientProvider>);
