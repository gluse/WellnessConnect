import { z } from "zod";

// Private account preference. Never add this to public User/provider responses.
export const searchLocationSchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("device"), latitude: z.number().finite().min(-90).max(90), longitude: z.number().finite().min(-180).max(180) }).strict(),
  z.object({ source: z.literal("address"), inputText: z.string().trim().min(1).max(300), placeId: z.string().trim().min(1).max(512).optional() }).strict(),
]);
export type SearchLocationPreference = z.infer<typeof searchLocationSchema>;
export const SEARCH_LOCATION_COOKIE = "fmt.search-location.v1";
export const SEARCH_LOCATION_MAX_AGE = 180 * 24 * 60 * 60;

export function encodeSearchLocation(value: SearchLocationPreference, now = Date.now()): string {
  const preference = searchLocationSchema.parse(value);
  const encoded = encodeURIComponent(JSON.stringify({ version: 1, expiresAt: now + SEARCH_LOCATION_MAX_AGE * 1000, preference }));
  if (encoded.length > 3000) throw new Error("Location preference is too large");
  return encoded;
}

export function decodeSearchLocation(encoded: string, now = Date.now()): SearchLocationPreference | null {
  try {
    if (encoded.length > 3000) return null;
    const parsed = z.object({ version: z.literal(1), expiresAt: z.number().finite().gt(now).max(now + SEARCH_LOCATION_MAX_AGE * 1000), preference: searchLocationSchema }).strict()
      .parse(JSON.parse(decodeURIComponent(encoded)));
    return parsed.preference;
  } catch { return null; }
}
