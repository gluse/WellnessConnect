import { createHash } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "./db";
import { geocodingCache, services, type InsertService, type Service } from "@shared/schema";
import { addressError, normalizeAddress, validCoordinates } from "@shared/locations";
import { GeocodingError, geocodeRegisteredAddress } from "./geocoding";

// 29 days plus hourly deletion leaves a margin inside Google's 30-day limit.
export const GOOGLE_COORDINATE_TTL = 29 * 24 * 60 * 60 * 1000;
type CachedLocation = typeof geocodingCache.$inferSelect;
type Owner = { providerId: string; companyId?: number };
type ManualLocation = { latitude: number | null; longitude: number | null };
export interface LocationStore {
  manual(address: string, owner: Owner): Promise<ManualLocation | undefined>;
  get(key: string): Promise<CachedLocation | undefined>;
  put(location: CachedLocation): Promise<void>;
  locked<T>(key: string, action: (store: LocationStore) => Promise<T>): Promise<T>;
}

function databaseStore(connection: typeof db): LocationStore {
  const store: LocationStore = {
    async manual(address, owner) {
      const rows = await connection.select().from(services).where(and(eq(services.locationSource, "manual"),
        owner.companyId != null ? eq(services.companyId, owner.companyId)
          : and(eq(services.providerId, owner.providerId), isNull(services.companyId))));
      return rows.find(row => row.address && normalizeAddress(row.address) === normalizeAddress(address)
        && validCoordinates(row.latitude, row.longitude));
    },
    async get(key) { return (await connection.select().from(geocodingCache).where(eq(geocodingCache.addressKey, key)))[0]; },
    async put(location) {
      await connection.insert(geocodingCache).values(location).onConflictDoUpdate({ target: geocodingCache.addressKey, set: location });
    },
    async locked(key, action) {
      return connection.transaction(async tx => {
        // Serialize identical addresses across app instances; recheck after locking.
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
        return action(databaseStore(tx as unknown as typeof db));
      });
    },
  };
  return store;
}
export const locationStore = databaseStore(db);
export const addressKey = (address: string) => createHash("sha256").update(normalizeAddress(address)).digest("hex");
const eligible = (row: CachedLocation | undefined): row is CachedLocation => Boolean(row && row.expiresAt.getTime() > Date.now() && validCoordinates(row.latitude, row.longitude));
const googleLocation = (row: CachedLocation) => ({ latitude: row.latitude!, longitude: row.longitude!,
  locationSource: "google" as const, locationKey: row.addressKey, locationPlaceId: row.placeId, locationExpiresAt: row.expiresAt,
  locationAddressSource: "user" as const });
const inFlight = new Map<string, Promise<ReturnType<typeof googleLocation> & { reused: boolean }>>();

export async function registerLocation(input: unknown, owner: Owner, store = locationStore, lookup = geocodeRegisteredAddress) {
  const error = addressError(input);
  if (error) throw new GeocodingError(400, "INVALID_ADDRESS", error);
  const address = (input as string).trim();
  const manual = await store.manual(address, owner);
  if (manual) return { latitude: manual.latitude!, longitude: manual.longitude!, locationSource: "manual" as const,
    locationKey: null, locationPlaceId: null, locationExpiresAt: null, reused: true };
  const key = addressKey(address);
  const cached = await store.get(key);
  if (eligible(cached)) return { ...googleLocation(cached), reused: true };
  const pending = inFlight.get(key);
  if (pending) return pending;
  const operation = store.locked(key, async locked => {
    const cached = await locked.get(key);
    if (eligible(cached)) return { ...googleLocation(cached), reused: true };
    const startedAt = Date.now();
    const result = await lookup(address);
    const row = { addressKey: key, ...result, expiresAt: new Date(startedAt + GOOGLE_COORDINATE_TTL) };
    await locked.put(row);
    return { ...googleLocation(row), reused: false };
  });
  inFlight.set(key, operation);
  try { return await operation; } finally { if (inFlight.get(key) === operation) inFlight.delete(key); }
}

// The client may identify a verification but cannot set its lifetime or Place ID.
// Saving/copying an unchanged Google location never starts a new cache period.
export async function resolveServiceLocation(input: Partial<InsertService>, body: Record<string, unknown>, existing?: Service, store = locationStore): Promise<Partial<InsertService>> {
  if (body.locationSource !== undefined && !["manual", "google", "legacy"].includes(String(body.locationSource))) {
    throw new GeocodingError(400, "INVALID_LOCATION", "Choose a valid coordinate source.");
  }
  if (existing && !["address", "latitude", "longitude", "locationSource", "locationKey"].some(key => key in body)) return {};
  const address = input.address === undefined ? existing?.address : input.address;
  const latitude = input.latitude === undefined ? existing?.latitude : input.latitude;
  const longitude = input.longitude === undefined ? existing?.longitude : input.longitude;
  if (existing && address === existing.address && latitude === existing.latitude && longitude === existing.longitude
    && body.locationSource !== "manual" && (body.locationKey == null || body.locationKey === existing.locationKey)) {
    return { locationSource: existing.locationSource, locationKey: existing.locationKey,
      locationPlaceId: existing.locationPlaceId, locationExpiresAt: existing.locationExpiresAt, locationAddressSource: existing.locationAddressSource };
  }
  const error = addressError(address);
  if (error || !validCoordinates(latitude, longitude)) throw new GeocodingError(400, "INVALID_LOCATION", error || "Provide valid latitude (−90 to 90) and longitude (−180 to 180).");
  const changedAddress = existing && normalizeAddress(address!) !== normalizeAddress(existing.address || "");
  if ((changedAddress || (existing?.locationSource === "google" && body.locationSource === "manual"))
    && (!validCoordinates(input.latitude, input.longitude))) {
    throw new GeocodingError(400, "VERIFY_LOCATION", "A changed address or manual location needs a complete new coordinate pair.");
  }
  if (body.locationSource === "google") {
    const key = addressKey(address!);
    const cached = body.locationKey === key ? await store.get(key) : undefined;
    if (!eligible(cached) || Math.abs(cached.latitude! - latitude!) > 0.00001 || Math.abs(cached.longitude! - longitude!) > 0.00001) {
      throw new GeocodingError(409, "LOCATION_EXPIRED", "Address verification has expired or changed. Verify the address again.");
    }
    return googleLocation(cached);
  }
  if (existing?.locationSource === "google" && body.locationSource !== "manual") {
    throw new GeocodingError(400, "VERIFY_LOCATION", "Verify the changed address or explicitly enter coordinates manually.");
  }
  return { address: address!.trim(), latitude, longitude, locationSource: "manual", locationKey: null,
    locationPlaceId: null, locationExpiresAt: null, locationAddressSource: "user" };
}
