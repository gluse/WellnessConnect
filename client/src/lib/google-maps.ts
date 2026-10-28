import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

let configuration: Promise<void> | undefined;
const MAPS_TIMEOUT_MS = 8000;

// Configuration and Google's script loader can both hang without rejecting.
// Always settle the UI; a late external result cannot initialize a failed map.
function withDeadline<T>(operation: Promise<T>, onTimeout?: () => void): Promise<T> {
  let timeout: ReturnType<typeof setTimeout>;
  return Promise.race([operation, new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => { onTimeout?.(); reject(new Error("Map loading timed out")); }, MAPS_TIMEOUT_MS);
  })]).finally(() => clearTimeout(timeout));
}

async function configureMaps() {
  if (!configuration) {
    const controller = new AbortController();
    configuration = withDeadline((async () => {
      const response = await fetch("/api/config/maps", { signal: controller.signal });
      if (!response.ok) throw new Error("Unable to load map configuration");
      const { apiKey } = await response.json();
      if (controller.signal.aborted) throw new Error("Map configuration timed out");
      if (!apiKey) throw new Error("Browser Maps API key is not configured");
      setOptions({ key: apiKey, v: "weekly" });
    })(), () => controller.abort()).catch(error => { configuration = undefined; throw error; });
  }
  await configuration;
}

export async function loadMapLibraries() {
  await configureMaps();
  const [maps, marker] = await withDeadline(Promise.all([importLibrary("maps"), importLibrary("marker")]));
  return { ...maps, ...marker };
}

export async function loadGeocoder() {
  await configureMaps();
  return withDeadline(importLibrary("geocoding"));
}
