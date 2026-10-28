import { eq } from "drizzle-orm";
import { userSearchLocations } from "@shared/schema";
import { searchLocationSchema } from "@shared/search-location";
import { db } from "./db";
import type { SearchLocationStore } from "./searchLocationRoutes";

function locationFields(preference: Parameters<SearchLocationStore["put"]>[1]) {
  const value = searchLocationSchema.parse(preference);
  return value.source === "device"
    ? { source: value.source, latitude: value.latitude, longitude: value.longitude, inputText: null, placeId: null }
    : { source: value.source, inputText: value.inputText, placeId: value.placeId ?? null, latitude: null, longitude: null };
}

export const searchLocationStore: SearchLocationStore = {
  async get(userId) {
    const [row] = await db.select().from(userSearchLocations).where(eq(userSearchLocations.userId, userId));
    if (!row) return null;
    return searchLocationSchema.parse(row.source === "device"
      ? { source: "device", latitude: row.latitude, longitude: row.longitude }
      : { source: "address", inputText: row.inputText, ...(row.placeId ? { placeId: row.placeId } : {}) });
  },
  async put(userId, preference) {
    const fields = locationFields(preference);
    await db.insert(userSearchLocations).values({ userId, ...fields })
      .onConflictDoUpdate({ target: userSearchLocations.userId, set: { ...fields, updatedAt: new Date() } });
  },
  async adopt(userId, preference) {
    // A concurrent selection on another device wins over guest migration.
    await db.insert(userSearchLocations).values({ userId, ...locationFields(preference) })
      .onConflictDoNothing({ target: userSearchLocations.userId });
    return searchLocationStore.get(userId);
  },
  async remove(userId) { await db.delete(userSearchLocations).where(eq(userSearchLocations.userId, userId)); },
};
