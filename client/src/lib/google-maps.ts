import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

let configuration: Promise<void> | undefined;

async function configureMaps() {
  if (!configuration) {
    configuration = (async () => {
      const response = await fetch("/api/config/maps");
      if (!response.ok) throw new Error("Unable to load map configuration");
      const { apiKey } = await response.json();
      if (!apiKey) throw new Error("Browser Maps API key is not configured");
      setOptions({ key: apiKey, v: "weekly" });
    })().catch(error => { configuration = undefined; throw error; });
  }
  await configuration;
}

export async function loadMapLibraries() {
  await configureMaps();
  const [maps, marker] = await Promise.all([importLibrary("maps"), importLibrary("marker")]);
  return { ...maps, ...marker };
}

export async function loadGeocoder() {
  await configureMaps();
  return importLibrary("geocoding");
}
