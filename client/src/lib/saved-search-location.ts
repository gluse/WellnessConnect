import { decodeSearchLocation, encodeSearchLocation, SEARCH_LOCATION_COOKIE, SEARCH_LOCATION_MAX_AGE, searchLocationSchema, type SearchLocationPreference } from "@shared/search-location";
import { loadGeocoder } from "./google-maps";

export type ResolvedSearchLocation = { name: string; coords: { lat: number; lng: number }; current?: boolean; preference: SearchLocationPreference };
export function forgetGuestLocation() {
  document.cookie = `${SEARCH_LOCATION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
}
export function readGuestLocation(): SearchLocationPreference | null {
  const value = document.cookie?.split(";").map(item => item.trim()).find(item => item.startsWith(SEARCH_LOCATION_COOKIE + "="))?.slice(SEARCH_LOCATION_COOKIE.length + 1);
  if (!value) return null;
  const preference = decodeSearchLocation(value);
  if (!preference) forgetGuestLocation();
  return preference;
}
export function saveGuestLocation(preference: SearchLocationPreference) {
  const value = encodeSearchLocation(preference);
  document.cookie = `${SEARCH_LOCATION_COOKIE}=${value}; Path=/; Max-Age=${SEARCH_LOCATION_MAX_AGE}; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
  if (JSON.stringify(readGuestLocation()) !== JSON.stringify(searchLocationSchema.parse(preference))) throw new Error("Preference cookie is unavailable");
}
export async function resolveSearchLocation(input: SearchLocationPreference): Promise<ResolvedSearchLocation> {
  const preference = searchLocationSchema.parse(input);
  if (preference.source === "device") return { name: "", coords: { lat: preference.latitude, lng: preference.longitude }, current: true, preference };
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const operation = (async () => {
    const { Geocoder } = await loadGeocoder();
    return new Promise<google.maps.GeocoderResult>((resolve, reject) => {
      new Geocoder().geocode(preference.placeId ? { placeId: preference.placeId } : { address: preference.inputText },
        (results, status) => status === "OK" && results?.[0] ? resolve(results[0]) : reject(new Error("Location unavailable")));
    });
  })();
  const result = await Promise.race([operation, new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new Error("Location lookup timed out")), 15000);
  })]).finally(() => clearTimeout(timeout));
  const latitude = result.geometry.location.lat(), longitude = result.geometry.location.lng();
  searchLocationSchema.parse({ source: "device", latitude, longitude });
  return { name: preference.inputText, coords: { lat: latitude, lng: longitude }, preference: { ...preference, ...(result.place_id ? { placeId: result.place_id } : {}) } };
}
export async function accountSearchLocation(method: "GET" | "PUT" | "POST" | "DELETE", signal: AbortSignal, preference?: SearchLocationPreference) {
  const controller = new AbortController(), cancel = () => controller.abort();
  if (signal.aborted) controller.abort(); else signal.addEventListener("abort", cancel, { once: true });
  const timeout = setTimeout(cancel, 10000);
  try {
    const response = await fetch("/api/account/search-location" + (method === "POST" ? "/adopt" : ""), { method, signal: controller.signal, credentials: "include",
      ...(preference ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(searchLocationSchema.parse(preference)) } : {}) });
    if (!response.ok) throw new Error("Location preference is unavailable");
    if (method !== "GET" && method !== "POST") return null;
    const value: unknown = await response.json();
    return value === null ? null : searchLocationSchema.parse(value);
  } finally { clearTimeout(timeout); signal.removeEventListener("abort", cancel); }
}
