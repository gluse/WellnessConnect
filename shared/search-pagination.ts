import type { ServiceWithProvider } from "./schema";

export const SEARCH_SORTS = ["default", "distance-asc", "distance-desc", "price-asc", "price-desc", "rating-asc", "rating-desc"] as const;
export type SearchSort = typeof SEARCH_SORTS[number];
export type SearchPageMode = "text" | "semantic" | "text-fallback";
export type SearchPage = { services: ServiceWithProvider[]; nextCursor: string | null; mode: SearchPageMode };
