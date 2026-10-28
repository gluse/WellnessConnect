import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import Home from "../../client/src/pages/home";
import { queryClient } from "../../client/src/lib/queryClient";
import type { ServiceWithProvider } from "../../shared/schema";

declare const __FORM_RESOURCES__: Record<string, { translation: object }>;
const fixture = { ready: false, requests: [] as string[], unexpected: [] as string[], aborted: [] as string[], result: "success", categoriesError: false, geocode: new URLSearchParams(location.search).get("geocode") ?? "success", mapsConfig: "success", configRequests: 0, geolocation: "success", locationCoords: { latitude: 0, longitude: 0 }, geolocationQueue: [] as string[], locationRequests: [] as PositionOptions[], resolveLocation: null as (() => void) | null, resolve: null as (() => void) | null, resolveGeocode: null as (() => void) | null };
const savedFixture = { authUser: null as { id: string } | null, preferences: {} as Record<string, object>, preferenceError: false, writes: [] as { method: string; userId: string; body: object | null }[], geocodes: 0 };
Object.assign(window, { phase2Fixture: fixture, searchFixture: fixture, savedLocationFixture: savedFixture,
  setFixtureUser: (user: { id: string } | null) => { savedFixture.authUser = user; queryClient.setQueryData(["/api/auth/user"], user); } });
const provider = { id: "synthetic-provider", firstName: "Synthetic", lastName: "Provider", providerType: "individual" };
const rows = [
  { id: 1, name: "Restorative yoga", description: "A slower practice to release tension and reconnect with your breath.", category: "health_wellness", serviceType: "group", price: "18", duration: 60, instantBooking: true, rating: 4.9, reviewCount: 28 },
  { id: 2, name: "Deep tissue massage", description: "Focused bodywork for tight muscles and a calmer, lighter feeling.", category: "health_wellness", serviceType: "one_to_one", price: "55", duration: 60, instantBooking: false, rating: 4.8, reviewCount: 42 },
  { id: 3, name: "Personal training", description: "A personal session built around your goals, strength and confidence.", category: "fitness", serviceType: "one_to_one", price: "40", duration: 45, instantBooking: true, rating: 4.9, reviewCount: 16 },
].map(row => ({ ...row, provider, providerId: provider.id, isActive: true, latitude: 0, longitude: row.id / 100, address: "Synthetic studio address", ageGroups: ["adults"], targetGender: "both", maxCapacity: 8, availableCapacity: 0 })) as ServiceWithProvider[];
Object.assign(window, { google: { maps: { importLibrary: async (name: string) => {
  if (name === "geocoding") return { Geocoder: class {
    geocode(_request: unknown, callback: (results: unknown[], status: string) => void) {
      savedFixture.geocodes++;
      const finish = () => callback([{ formatted_address: "Synthetic city", geometry: { location: { lat: () => 0, lng: () => 0 } } }], fixture.geocode === "error" ? "ZERO_RESULTS" : "OK");
      if (fixture.geocode === "pending") fixture.resolveGeocode = finish; else finish();
    }
  } };
  throw new Error("Synthetic map unavailable");
} } } });
Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition(success: PositionCallback, failure: PositionErrorCallback, options: PositionOptions) {
  fixture.locationRequests.push(options);
  const outcome = fixture.geolocationQueue.shift() ?? fixture.geolocation;
  if (outcome === "throw") throw new Error("Synthetic device failure");
  const finish = () => {
    const codes: Record<string, number> = { error: 1, unavailable: 2, timeout: 3 };
    const code = codes[outcome];
    if (code) failure({ code } as GeolocationPositionError);
    else success({ coords: { ...fixture.locationCoords, ...(outcome === "invalid" ? { latitude: NaN } : {}) } } as GeolocationPosition);
  };
  if (outcome === "pending") fixture.resolveLocation = finish; else finish();
} } });
window.fetch = async (input, options = {}) => {
  const path = String(input), method = options.method || "GET";
  if (path === "/api/account/search-location" || path === "/api/account/search-location/adopt") {
    if (savedFixture.preferenceError) return Response.json({}, { status: 503 });
    const userId = savedFixture.authUser?.id;
    if (!userId) return Response.json({}, { status: 401 });
    if (method === "GET") return Response.json(savedFixture.preferences[userId] ?? null);
    if (method === "POST" && path.endsWith("/adopt")) {
      const body = JSON.parse(String(options.body));
      savedFixture.writes.push({ method, userId, body });
      savedFixture.preferences[userId] ??= body;
      return Response.json(savedFixture.preferences[userId]);
    }
    if (method === "PUT" || method === "DELETE") {
      const body = options.body ? JSON.parse(String(options.body)) : null;
      savedFixture.writes.push({ method, userId, body });
      if (method === "PUT") savedFixture.preferences[userId] = body; else delete savedFixture.preferences[userId];
      return new Response(null, { status: 204 });
    }
  }
  if (method !== "GET") { fixture.unexpected.push(method + " " + path); throw new Error("Writes are not allowed in this fixture"); }
  if (path === "/api/auth/user") return Response.json(savedFixture.authUser);
  if (path === "/api/categories") return Response.json([{ key: "health_wellness", name: "Health & wellness", icon: "" }, { key: "fitness", name: "Fitness", icon: "" }], { status: fixture.categoriesError ? 503 : 200 });
  if (path === "/api/config/maps") {
    fixture.configRequests++;
    if (fixture.mapsConfig === "missing") return Response.json({});
    if (fixture.mapsConfig === "error") return Response.json({}, { status: 503 });
    return Response.json({ apiKey: "synthetic-key" });
  }
  if (/^\/api\/services\/(search|semantic-search)\?/.test(path)) {
    fixture.requests.push(path);
    if (fixture.result === "pending") await new Promise<void>((resolve, reject) => {
      fixture.resolve = resolve;
      options.signal?.addEventListener("abort", () => { fixture.aborted.push(path); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
    });
    if (fixture.result === "error") return Response.json({ message: "<img src=x onerror=alert(1)>" }, { status: 503 });
    if (fixture.result === "rateLimited") return Response.json({}, { status: 429 });
    const params = new URL(path, location.origin).searchParams;
    const query = (params.get("searchQuery") || params.get("query") || "").toLowerCase();
    const found = rows.filter(row => (!params.get("category") || row.category === params.get("category")) && (!params.get("serviceType") || row.serviceType === params.get("serviceType")) && (!query || row.name.toLowerCase().includes(query)));
    return Response.json(fixture.result === "empty" ? [] : found, { headers: { "X-Search-Truncated": String(fixture.result === "truncated") } });
  }
  if (/^\/api\/services\/\d+\/reviews\?/.test(path)) return Response.json({ reviews: [], page: 1, hasMore: false });
  fixture.unexpected.push(method + " " + path); throw new Error("Unexpected fixture request");
};
await i18next.use(initReactI18next).init({ lng: "en", fallbackLng: false, supportedLngs: ["en", "lv", "ru"], resources: __FORM_RESOURCES__, interpolation: { escapeValue: false } });
queryClient.setQueryData(["/api/auth/user"], null);
function Fixture() {
  const [dark, setDark] = useState(false);
  useEffect(() => { fixture.ready = true; }, []);
  useEffect(() => { document.documentElement.classList.toggle("dark", dark); }, [dark]);
  return <><nav aria-label="Fixture controls" className="flex flex-wrap gap-4 p-3"><label>Language <select id="fixture-language" onChange={event => void i18next.changeLanguage(event.target.value)}><option value="en">English</option><option value="lv">Latviešu</option><option value="ru">Русский</option></select></label><button id="fixture-theme" onClick={() => setDark(!dark)}>Toggle fixture theme</button></nav><Home /></>;
}
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={queryClient}><Router><Fixture /></Router></QueryClientProvider>);
