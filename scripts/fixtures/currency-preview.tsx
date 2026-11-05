import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import ServiceResultCard from "../../client/src/components/service-result-card";
import AppointmentStats from "../../client/src/components/provider/appointment-stats";
import SearchResultsSort from "../../client/src/components/search-results-sort";
import { formatMoney } from "../../client/src/lib/money";
import type { BookingWithDetails, Service } from "../../shared/schema";
declare const __FORM_RESOURCES__: Record<string, { translation: object }>;
const params = new URLSearchParams(location.search);
await i18next.use(initReactI18next).init({ lng: params.get("lang") || "en", fallbackLng: false, resources: __FORM_RESOURCES__, interpolation: { escapeValue: false } });
const pairs = [["EUR", "50.25"], ["USD", "50.25"], ["CAD", "50.25"], ["GBP", "50.25"], ["JPY", "50"], ["KWD", "50.001"]];
function Fixture() {
  const [sort, setSort] = useState<"default">("default");
  useEffect(() => { Object.assign(window, { phase2Fixture: { ready: true } }); }, []);
  return <main className="search-design max-w-5xl mx-auto p-4 space-y-4">
    <AppointmentStats bookings={[
      { status: "confirmed", currency: "EUR", totalAmount: "0.10" },
      { status: "completed", currency: "EUR", totalAmount: "0.20" },
      { status: "confirmed", currency: "USD", totalAmount: "25.00" },
      { status: "cancelled", currency: "USD", totalAmount: "999.00" },
    ] as BookingWithDetails[]} />
    <SearchResultsSort value={sort} onChange={() => setSort("default")} hasLocation hasRatings priceSortAvailable={false} />
    <div className="grid gap-4 sm:grid-cols-2">{pairs.map(([currency, price], index) => <div data-currency={currency} key={currency}>
      <ServiceResultCard provider="Synthetic provider" service={{ id: index, currency, price, name: currency + " service", duration: 30, serviceType: "one_to_one" } as Service} />
    </div>)}</div>
    <p data-testid="large-money">{formatMoney("9007199254740993.05", "EUR", i18next.language)}</p>
  </main>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
