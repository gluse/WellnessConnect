export const WISHLIST_APPLICATION_READINESS_SQL: string;
export const WISHLIST_APPLICATION_READINESS_KEYS: readonly string[];
export function wishlistApplicationReadinessArguments(): [string,string,string,string,string];
export function assertWishlistApplicationReadiness(rows: Record<string,unknown>[]): void;
