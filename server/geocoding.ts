export class GeocodingError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

async function lookup(input: unknown, request: typeof fetch) {
  if (typeof input !== "string" || !input.trim() || input.length > 500) {
    throw new GeocodingError(400, "INVALID_ADDRESS", "Enter an address of up to 500 characters.");
  }
  const key = process.env.GOOGLE_GEOCODING_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new GeocodingError(503, "NOT_CONFIGURED", "Address lookup is not configured.");
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", input.trim());
  url.searchParams.set("key", key);
  let response: Response;
  let data;
  try {
    response = await request(url, { signal: AbortSignal.timeout(15_000) });
    data = await response.json();
  } catch {
    throw new GeocodingError(503, "UNAVAILABLE", "Address lookup is temporarily unavailable. Please try again.");
  }
  if (!data || typeof data !== "object") {
    throw new GeocodingError(503, "UNAVAILABLE", "Address lookup returned an invalid response.");
  }
  if (data.status === "ZERO_RESULTS") {
    throw new GeocodingError(404, "ZERO_RESULTS", "Address not found. Try the street address, town, and country.");
  }
  if (data.status === "REQUEST_DENIED") {
    const referrerRestricted = /refer(?:er|rer) restrictions/i.test(data.error_message || "");
    throw new GeocodingError(503, "REQUEST_DENIED", referrerRestricted
      ? "Address lookup is misconfigured: the backend needs a Geocoding API key with server IP restrictions, not website restrictions."
      : "Address lookup was denied by Google. Check the server API key, Geocoding API access, and billing.");
  }
  if (["OVER_QUERY_LIMIT", "OVER_DAILY_LIMIT"].includes(data.status) || response.status === 429) {
    throw new GeocodingError(503, data.status || "OVER_QUERY_LIMIT", "Address lookup has reached its quota or billing limit. Please try again later.");
  }
  if (data.status === "INVALID_REQUEST") {
    throw new GeocodingError(400, "INVALID_REQUEST", "Google could not process this address. Try the full street address.");
  }
  const result = data.results?.[0];
  const location = result?.geometry?.location;
  if (!response.ok || data.status !== "OK" || !Array.isArray(data.results) || !Number.isFinite(location?.lat) || !Number.isFinite(location?.lng)) {
    throw new GeocodingError(503, "UNAVAILABLE", "Address lookup is temporarily unavailable. Please try again.");
  }
  if (Math.abs(location.lat) > 90 || Math.abs(location.lng) > 180) {
    throw new GeocodingError(503, "UNAVAILABLE", "Address lookup returned invalid coordinates.");
  }
  return data.results as { partial_match?: boolean; place_id?: string; formatted_address?: string; types?: string[]; geometry: { location: { lat: number; lng: number }; location_type?: string } }[];
}

export async function geocodeAddress(input: unknown, request: typeof fetch = fetch) {
  const [result] = await lookup(input, request);
  return { lat: result.geometry.location.lat, lng: result.geometry.location.lng, formattedAddress: result.formatted_address };
}

export async function geocodeRegisteredAddress(input: string, request: typeof fetch = fetch) {
  const results = await lookup(input, request);
  const result = results[0];
  if (results.length !== 1 || result.partial_match || typeof result.place_id !== "string" || !result.place_id.trim()
    || !["ROOFTOP", "RANGE_INTERPOLATED"].includes(result.geometry.location_type || "")
    || !Array.isArray(result.types) || !result.types.some(type => ["street_address", "premise", "subpremise", "establishment", "point_of_interest"].includes(type))) {
    throw new GeocodingError(422, "UNCERTAIN_MATCH", "The address did not match a specific location confidently. Add the street, building number, town and country, or enter coordinates manually.");
  }
  return { latitude: result.geometry.location.lat, longitude: result.geometry.location.lng, placeId: result.place_id };
}
