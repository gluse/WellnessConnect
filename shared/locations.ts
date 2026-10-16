// Compare user-supplied addresses conservatively: do not discard accents, unit
// numbers or punctuation that could distinguish two real locations.
export function normalizeAddress(address: string) {
  return address.normalize("NFKC").trim().replace(/\s+/g, " ").replace(/\s*,\s*/g, ",").toLocaleLowerCase("en");
}

export function addressError(input: unknown): string | undefined {
  if (typeof input !== "string" || input.trim().length < 5 || input.length > 500
    || !new RegExp("\\p{L}", "u").test(input) || /[\x00-\x1f\x7f]|https?:\/\/|www\.|@/i.test(input)) {
    return "Enter a street or venue address, town and country (5–500 characters).";
  }
}

export function validCoordinates(latitude: unknown, longitude: unknown): boolean {
  return typeof latitude === "number" && Number.isFinite(latitude) && Math.abs(latitude) <= 90
    && typeof longitude === "number" && Number.isFinite(longitude) && Math.abs(longitude) <= 180;
}

export function currentLocation<T extends { latitude: number | null; longitude: number | null; distance?: number; address?: string | null; locationAddressSource?: string; locationSource?: string; locationExpiresAt?: Date | string | null }>(location: T, now = Date.now()): T {
  if (location.locationSource === "google" && (!location.locationExpiresAt || !(new Date(location.locationExpiresAt).getTime() > now))) {
    if (location.latitude == null && location.longitude == null && location.distance === undefined
      && (location.locationAddressSource !== "google" || location.address == null)) return location;
    return { ...location, latitude: null, longitude: null,
      ...("distance" in location ? { distance: undefined } : {}),
      ...(location.locationAddressSource === "google" ? { address: null } : {}) };
  }
  return location;
}
