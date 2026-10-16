import type { QueryClient } from "@tanstack/react-query";
import { currentLocation } from "@shared/locations";

// Long-lived search/booking queries must not retain Google content indefinitely.
// Preserve references for unchanged data to avoid unnecessary updates/renders.
function expireData(value: unknown, now: number): unknown {
  if (Array.isArray(value)) {
    const updated = value.map(item => expireData(item, now));
    return updated.some((item, index) => item !== value[index]) ? updated : value;
  }
  if (!value || typeof value !== "object" || value instanceof Date) return value;
  const original = value as Record<string, unknown>;
  let updated = original;
  if (original.locationSource === "google" && "latitude" in original && "longitude" in original) {
    updated = currentLocation(original as typeof original & { latitude: number | null; longitude: number | null; locationSource: string }, now);
  }
  for (const [key, child] of Object.entries(updated)) {
    const expired = expireData(child, now);
    if (expired !== child) { if (updated === original) updated = { ...original }; updated[key] = expired; }
  }
  return updated;
}

export function expireCachedLocations(client: QueryClient, now = Date.now()) {
  for (const query of client.getQueryCache().getAll()) {
    const data = query.state.data;
    const expired = expireData(data, now);
    if (expired !== data) client.setQueryData(query.queryKey, expired);
  }
}

export function startLocationExpiry(client: QueryClient) {
  const timer = setInterval(() => expireCachedLocations(client), 60_000);
  // Node-based UI tests should not stay alive just for the browser cleanup timer.
  if (typeof timer === "object" && "unref" in timer) timer.unref();
  return () => clearInterval(timer);
}
