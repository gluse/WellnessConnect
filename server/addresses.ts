import { and, asc, eq, isNull } from "drizzle-orm";
import { addresses, type Address, type AddressLocation, type Service, services } from "@shared/schema";
import { currentLocation } from "@shared/locations";
import { db } from "./db";
import { AccessError } from "./companyAccess";
import { serviceMoneyDto } from "./money";

type Owner = { providerId: string; companyId?: number };
const owned = (owner: Owner) => owner.companyId != null ? eq(addresses.companyId, owner.companyId)
  : and(eq(addresses.providerId, owner.providerId), isNull(addresses.companyId));

export function serviceLocation(service: typeof services.$inferSelect, location?: Address | null): Service {
  return { ...serviceMoneyDto(service), ...currentLocation({
    address: location?.address ?? null, latitude: location?.latitude ?? null, longitude: location?.longitude ?? null,
    countryCode: location?.countryCode ?? null,
    locationSource: location?.locationSource ?? "legacy", locationKey: location?.locationKey ?? null,
    locationPlaceId: location?.locationPlaceId ?? null, locationExpiresAt: location?.locationExpiresAt ?? null,
    locationAddressSource: location?.locationAddressSource ?? "user",
  }) };
}

export const addressStore = {
  async list(owner: Owner) {
    const rows = await db.select().from(addresses).where(owned(owner)).orderBy(asc(addresses.id));
    return rows.map(row => currentLocation(row));
  },
  async get(id: number, owner: Owner) {
    const [row] = await db.select().from(addresses).where(and(eq(addresses.id, id), owned(owner)));
    if (!row) throw new AccessError(403, "Choose an address from this workspace.");
    return currentLocation(row);
  },
  async save(location: AddressLocation & { pricingCurrency?: string | null }, owner: Owner, id?: number) {
    const values: AddressLocation & { pricingCurrency?: string | null } = {
      address: location.address, latitude: location.latitude, longitude: location.longitude,
      countryCode: location.countryCode ?? null,
      ...(location.pricingCurrency !== undefined ? { pricingCurrency: location.pricingCurrency } : {}),
      locationSource: location.locationSource, locationKey: location.locationKey,
      locationPlaceId: location.locationPlaceId, locationExpiresAt: location.locationExpiresAt,
      locationAddressSource: location.locationAddressSource,
    };
    if (id != null) {
      const [row] = await db.update(addresses).set({ ...values, updatedAt: new Date() })
        .where(and(eq(addresses.id, id), owned(owner))).returning();
      if (!row) throw new AccessError(403, "Choose an address from this workspace.");
      return currentLocation(row);
    }
    const [row] = await db.insert(addresses).values({ ...values, providerId: owner.providerId, companyId: owner.companyId ?? null }).returning();
    return currentLocation(row);
  },
  async remove(id: number, owner: Owner) {
    // The service foreign key also protects against concurrent assignment.
    const [row] = await db.delete(addresses).where(and(eq(addresses.id, id), owned(owner))).returning();
    if (!row) throw new AccessError(403, "Choose an address from this workspace.");
  },
};
