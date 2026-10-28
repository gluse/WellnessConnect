import type { SearchFilters } from "../components/service-filters";
import type { ServiceWithProvider } from "@shared/schema";

export const SEARCH_QUERY_LIMIT = 200;
export const SEARCH_DATE_LIMIT_DAYS = 31;

export function searchValidationKey(filters: SearchFilters): string | undefined {
  if (filters.searchQuery.trim().length > SEARCH_QUERY_LIMIT) return "publicSearch.queryTooLong";
  if (filters.dateEnd && !filters.date) return "publicSearch.startDateRequired";
  const parseDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
    const timestamp = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? timestamp : NaN;
  };
  const start = filters.date ? parseDate(filters.date) : undefined;
  const end = filters.dateEnd ? parseDate(filters.dateEnd) : start;
  if ((start !== undefined && !Number.isFinite(start)) || (end !== undefined && !Number.isFinite(end))) return "publicSearch.invalidDates";
  if (start !== undefined && end !== undefined && (end < start || (end - start) / 86_400_000 + 1 > SEARCH_DATE_LIMIT_DAYS)) return "publicSearch.dateRange";
  if (filters.availableOnly && !filters.date) return "publicSearch.startDateRequired";
  if ([filters.time, filters.timeEnd].some(time => time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) return "publicSearch.invalidTimes";
  if (filters.time && filters.timeEnd && filters.timeEnd <= filters.time) return "publicSearch.invalidTimes";
}

export class PublicSearchError extends Error {
  constructor(public readonly status: number) {
    super("Public search request failed");
  }
}

export function searchErrorKey(error: unknown): string {
  if (error instanceof PublicSearchError && error.status === 429) return "publicSearch.rateLimited";
  if (error instanceof PublicSearchError && error.status === 422) return "publicSearch.tooBroad";
  if (error instanceof PublicSearchError && error.status === 400) return "publicSearch.invalidFilters";
  return "publicSearch.loadError";
}

export interface PublicSearchResult {
  services: ServiceWithProvider[];
  truncated: boolean;
}

export async function fetchPublicSearch(filters: SearchFilters, location: { lat: number; lng: number } | null, signal?: AbortSignal): Promise<PublicSearchResult> {
  const params = new URLSearchParams();
  params.set("limit", "50");
  const semantic = filters.searchMode === "semantic" && Boolean(filters.searchQuery.trim());
  if (filters.searchQuery.trim()) params.set(semantic ? "query" : "searchQuery", filters.searchQuery.trim());
  for (const key of ["category", "serviceType", "date", "dateEnd", "time", "timeEnd"] as const) {
    if (filters[key]) params.set(key, filters[key]);
  }
  filters.ageGroups.forEach(age => params.append("ageGroups", age));
  if (filters.availableOnly) params.set("availableOnly", "true");
  if (location) {
    params.set("latitude", String(location.lat));
    params.set("longitude", String(location.lng));
    params.set("radius", String(filters.distance));
  }
  const response = await fetch(`/api/services/${semantic ? "semantic-search" : "search"}?${params}`, { signal });
  if (!response.ok) throw new PublicSearchError(response.status);
  return { services: await response.json(), truncated: response.headers.get("X-Search-Truncated") === "true" };
}
