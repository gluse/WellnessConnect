import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../../client/src/lib/queryClient";
import ServiceEditor from "../../client/src/components/provider/service-editor";
import ServiceDetailModal from "../../client/src/components/service-detail-modal";
import ServiceImageGallery from "../../client/src/components/service-image-gallery";
import type { Service, ServiceWithProvider } from "../../shared/schema";

declare const __FORM_RESOURCES__: Record<string, { translation: object }>;
const params = new URLSearchParams(location.search);
await i18next.use(initReactI18next).init({ lng: params.get("lang") || "en", fallbackLng: false, resources: __FORM_RESOURCES__, interpolation: { escapeValue: false } });
const picture = (index: number) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="320"><rect width="640" height="320" fill="${["#265d52", "#305d8a", "#9b5429"][index % 3]}"/><text x="320" y="180" text-anchor="middle" font-size="48" fill="white">Picture ${index + 1}</text></svg>`)}`;
const count = Number(params.get("count") ?? 3);
const images = Array.from({ length: count }, (_, index) => picture(index));
const service = { id: 7, providerId: "synthetic-provider", companyId: null, employeeId: null, name: "Synthetic service", description: "Synthetic description", category: "education", serviceType: "one_to_one", price: "25.00", currency: "EUR", duration: 45, cleanupTime: 15, maxCapacity: 1, ageGroups: ["adults"], targetGender: "both", instantBooking: false, advancePaymentPercent: 30, addressId: 3, imageUrl: images[0] ?? "", imageUrls: images, externalUrl: "", isActive: true } as Service;
const permissions = { manageServices: true, manageSchedules: true, manageBookings: true, manageTeam: true, isOwner: true, readAll: true };
const fixture = { ready: false, unexpected: [] as string[], writes: [] as unknown[], saves: [] as { imageUrls: string[]; imageUrl: string }[], saveResult: 'success', uploads: [] as { path: string; credentials?: RequestCredentials; size?: number }[], pro: params.get("pro") !== "false", uploadResult: "success", pending: null as (() => void) | null, confirmCount: 0,
  changeWorkspace: () => queryClient.setQueryData(["/api/company/context"], { company: { id: 11 }, permissions, workspaces: [] }),
};
Object.assign(window, { phase2Fixture: fixture });
window.fetch = async (input, options = {}) => {
  const path = String(input), method = options.method || "GET";
  if (path === "/api/objects/upload" && method === "POST") {
    fixture.uploads.push({ path, size: JSON.parse(String(options.body)).size });
    if (fixture.uploadResult === "pending") await new Promise<void>(resolve => { fixture.pending = resolve; });
    if (fixture.uploadResult === "error") return Response.json({}, { status: 503 });
    return Response.json({ signedUrl: "https://synthetic.invalid/signed-upload", objectPath: picture(10 + fixture.confirmCount) });
  }
  if (path === "https://synthetic.invalid/signed-upload" && method === "PUT") { fixture.uploads.push({ path, credentials: options.credentials }); return new Response(null, { status: 200 }); }
  if (path === "/api/service-images" && method === "PUT") { fixture.confirmCount++; return Response.json({ objectPath: JSON.parse(String(options.body)).objectPath }); }
  if (path === "/api/services/7" && method === "PATCH") {
    const payload = JSON.parse(String(options.body)); fixture.saves.push(payload);
    return fixture.saveResult === 'error' ? Response.json({ message: 'Synthetic failure' }, { status: 503 }) : Response.json({ ...service, ...payload });
  }
  if (method !== "GET") { fixture.writes.push(`${method} ${path}`); throw Error("No service writes permitted"); }
  if (path === "/api/categories") return Response.json([{ key: "education", name: "Synthetic category", icon: "" }]);
  if (path === "/api/addresses") return Response.json([{ id: 3, address: "Synthetic address", countryCode: "LV", pricingCurrency: null }]);
  if (path === "/api/auth/user") return Response.json({ id: "synthetic-provider", currentRole: "provider" });
  if (path === "/api/company/context") return Response.json({ company: null, permissions, workspaces: [] });
  if (path === "/api/notifications/capabilities") return Response.json({ hasPro: fixture.pro, automationEnabled: false, channels: { email: false, sms: false, whatsapp: false } });
  if (path.startsWith("/api/wishlist")) return Response.json([]);
  fixture.unexpected.push(`${method} ${path}`); throw Error("Unexpected fixture request");
};
function Fixture() {
  const [open, setOpen] = useState(false);
  const [legacy, setLegacy] = useState(false);
  const preview = { ...service, provider: { firstName: "Synthetic", lastName: "Provider" }, employee: null } as ServiceWithProvider;
  useEffect(() => { fixture.ready = true; document.documentElement.lang = i18next.language; }, []);
  return <main className="p-4 max-w-3xl mx-auto space-y-4 bg-background text-foreground">
    {params.get("mode") === "editor" ? <ServiceEditor service={service} company={false} employees={[]} /> : <>
      <ServiceImageGallery key={String(legacy)} service={legacy ? { name: service.name, imageUrl: images[0], imageUrls: [] } : service} />
      <button id="fixture-legacy" onClick={() => setLegacy(value => !value)}>Toggle legacy</button>
      <button id="fixture-open" onClick={() => setOpen(true)}>Open details</button>
      <ServiceDetailModal service={preview} searchLayout={params.get("layout") === "search"} open={open} onClose={() => setOpen(false)} onBook={() => {}} wishlistEnabled={false} />
    </>}
  </main>;
}
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={queryClient}><Fixture /></QueryClientProvider>);
