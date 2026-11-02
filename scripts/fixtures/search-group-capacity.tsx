import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../../client/src/lib/queryClient";
import ServiceCard from "../../client/src/components/service-card";
import ServiceDetailModal from "../../client/src/components/service-detail-modal";
import type { ServiceWithProvider } from "../../shared/schema";

declare const __FORM_RESOURCES__: Record<string, { translation: object }>;
const params = new URLSearchParams(location.search);
const language = params.get("lang") || "en";
document.documentElement.lang = language;
const service = {
  id: 7, providerId: "synthetic-provider", name: "Synthetic group session", category: "fitness",
  serviceType: params.get("type") || "group", maxCapacity: params.has("legacy") ? null : Number(params.get("maximum") || 6),
  availableCapacity: 2, price: "25.00", duration: 45, isActive: true, locationSource: "manual",
  instantBooking: true, description: "Synthetic service for isolated capacity checks.",
  provider: { id: "synthetic-provider", firstName: "Synthetic", lastName: "Provider" },
} as ServiceWithProvider;
const fixture = { ready: false, unexpected: [] as string[], bookings: 0 };
Object.assign(window, { phase2Fixture: fixture });
window.fetch = async input => { fixture.unexpected.push(String(input)); throw Error("Unexpected fixture request"); };
queryClient.setQueryData(["/api/categories"], [{ key: "fitness", name: "Fitness" }]);
await i18next.use(initReactI18next).init({ lng: language, fallbackLng: false, resources: __FORM_RESOURCES__, interpolation: { escapeValue: false } });

function Fixture() {
  const [open, setOpen] = useState(false);
  return <main className="search-design">
    <ServiceCard service={service} searchLayout onViewDetails={() => setOpen(true)} onBook={() => { fixture.bookings++; }} />
    <ServiceDetailModal service={service} searchLayout open={open} onClose={() => setOpen(false)} onBook={() => { fixture.bookings++; }} />
  </main>;
}
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={queryClient}><Fixture /></QueryClientProvider>);
fixture.ready = true;
