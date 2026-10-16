import type { ServiceWithProvider } from "@shared/schema";

export type ServiceSort = "default" | "distance-asc" | "distance-desc" |
  "price-asc" | "price-desc" | "rating-asc" | "rating-desc";

export function serviceRating(service: Pick<ServiceWithProvider, "rating">): number | undefined {
  return typeof service.rating === "number" && Number.isFinite(service.rating) &&
    service.rating >= 1 && service.rating <= 5 ? service.rating : undefined;
}

// Semantic search does not always supply distances, so derive them from coordinates too.
export function sortServices(
  services: readonly ServiceWithProvider[],
  sort: ServiceSort,
  location: { lat: number; lng: number } | null,
): ServiceWithProvider[] {
  const results = services.map(service => {
    if (!location || typeof service.latitude !== "number" || typeof service.longitude !== "number" ||
      !Number.isFinite(service.latitude) || !Number.isFinite(service.longitude)) return service;
    const radians = Math.PI / 180;
    const a = Math.sin((service.latitude - location.lat) * radians / 2) ** 2 +
      Math.cos(location.lat * radians) * Math.cos(service.latitude * radians) *
      Math.sin((service.longitude - location.lng) * radians / 2) ** 2;
    const distance = 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
    return { ...service, distance: Math.round(distance * 10) / 10 };
  });
  if (sort === "default" || (sort.startsWith("distance-") && !location)) return results;

  const value = (service: ServiceWithProvider): number | undefined => {
    if (sort.startsWith("rating-")) return serviceRating(service);
    if (sort.startsWith("distance-")) {
      return typeof service.distance === "number" && Number.isFinite(service.distance) && service.distance >= 0
        ? service.distance : undefined;
    }
    const price = typeof service.price === "string" && service.price.trim() !== "" ? Number(service.price) : NaN;
    return Number.isFinite(price) && price >= 0 ? price : undefined;
  };
  const direction = sort.endsWith("desc") ? -1 : 1;
  return results.sort((left, right) => {
    const a = value(left), b = value(right);
    // Missing data stays last in either direction; ties preserve the search's ordering.
    if (a === undefined) return b === undefined ? 0 : 1;
    if (b === undefined) return -1;
    return (a - b) * direction;
  });
}
