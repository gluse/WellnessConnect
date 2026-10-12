import assert from "node:assert/strict";
import { geocodeAddress, GeocodingError } from "../server/geocoding";

process.env.GOOGLE_GEOCODING_API_KEY = "test-server-key";
const mock = (body: object, status = 200) => (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
await assert.rejects(() => geocodeAddress(["address"], mock({})), (error: unknown) => error instanceof GeocodingError && error.status === 400);
await assert.rejects(() => geocodeAddress("Spēkavota pirts", mock({ status: "REQUEST_DENIED", error_message: "API keys with referer restrictions cannot be used with this API." })), (error: unknown) => error instanceof GeocodingError && error.status === 503 && error.code === "REQUEST_DENIED" && error.message.includes("server IP"));
await assert.rejects(() => geocodeAddress("not found", mock({ status: "ZERO_RESULTS" }, 404)), (error: unknown) => error instanceof GeocodingError && error.status === 404 && error.code === "ZERO_RESULTS");
await assert.rejects(() => geocodeAddress("Riga", mock({ status: "OVER_QUERY_LIMIT" })), (error: unknown) => error instanceof GeocodingError && error.status === 503);
await assert.rejects(() => geocodeAddress("Riga", mock({ status: "OK", results: [] })), (error: unknown) => error instanceof GeocodingError && error.status === 503);
const result = await geocodeAddress("  Rīga, Latvia  ", (async (input) => {
  const url = new URL(String(input));
  assert.equal(url.searchParams.get("address"), "Rīga, Latvia");
  assert.equal(url.searchParams.get("key"), "test-server-key");
  return new Response(JSON.stringify({ status: "OK", results: [{ geometry: { location: { lat: 56.95, lng: 24.1 } }, formatted_address: "Rīga, Latvia" }] }));
}) as typeof fetch);
assert.deepEqual(result, { lat: 56.95, lng: 24.1, formattedAddress: "Rīga, Latvia" });
console.log("Geocoding tests passed: validation, rejected key, no results, quota, malformed response, and Unicode address lookup.");
