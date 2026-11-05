import "./search-redesign";
import { queryClient } from "../../client/src/lib/queryClient";
import type { ServiceWithProvider } from "../../shared/schema";

// Real Home/query/observer/card components. Only the network boundary is synthetic.
const params = new URLSearchParams(location.search);
if (params.has("noObserver")) Object.defineProperty(window, "IntersectionObserver", { configurable: true, value: undefined });
const provider = { id: "pagination-provider", firstName: "Synthetic", lastName: "Provider", providerType: "individual" };
const rows = Array.from({ length: 157 }, (_, index) => ({
  id: index + 1, name: `Synthetic ${index % 2 ? "Massage" : "Yoga"} ${String(index + 1).padStart(3, "0")}`,
  description: "Isolated pagination fixture service", category: index % 2 ? "health_wellness" : "fitness",
  serviceType: "one_to_one", provider, providerId: provider.id, isActive: true, companyActive: true,
  price: String(158 - index), rating: 1 + index % 5, reviewCount: 3, duration: 45,
  instantBooking: true, latitude: 0, longitude: index / 1000, address: "Synthetic studio",
  ageGroups: ["adults"], targetGender: "both", maxCapacity: 1, availableCapacity: 1,
})) as ServiceWithProvider[];
const fixture = {
  requests: [] as { path: string; cursor: string | null; sort: string; query: string; limit: number }[],
  aborted: [] as string[], failNext: false, expireNext: false, invalidNext: false, holdNext: false, overlapNext: false,
  release: () => {}, mode: "text" as "text" | "semantic" | "text-fallback",
};
Object.assign(window, { paginationFixture: fixture });
const previousFetch = window.fetch.bind(window);
window.fetch = async (input, options = {}) => {
  const url = new URL(String(input), location.origin);
  if (url.pathname === "/api/company/context") return Response.json({ company: null, workspaces: [], memberships: [], permissions: { manageBookings: false, readAll: false, manageServices: false } });
  if (!/^\/api\/services\/(search|semantic-search)\/page$/.test(url.pathname)) return previousFetch(input, options);
  const cursor = url.searchParams.get("cursor"), sort = url.searchParams.get("sort") ?? "default";
  const query = (url.searchParams.get("query") ?? url.searchParams.get("searchQuery") ?? "").toLowerCase();
  const limit = Number(url.searchParams.get("limit"));
  fixture.requests.push({ path: url.pathname, cursor, sort, query, limit });
  const filtered = rows.filter(row => !query || row.name.toLowerCase().includes(query));
  filtered.sort((a, b) => {
    const direction = sort.endsWith("desc") ? -1 : 1;
    const difference = sort.startsWith("price-") ? Number(a.price) - Number(b.price)
      : sort.startsWith("rating-") ? a.rating! - b.rating!
      : sort.startsWith("distance-") ? a.longitude! - b.longitude! : 0;
    return difference * direction || a.id - b.id;
  });
  const offset = cursor ? Number(cursor.replace("synthetic-page-", "")) : 0;
  if (cursor && fixture.holdNext) {
    fixture.holdNext = false;
    await new Promise<void>((resolve, reject) => {
      fixture.release = resolve;
      options.signal?.addEventListener("abort", () => { fixture.aborted.push(cursor); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
    });
  }
  if (cursor && fixture.failNext) { fixture.failNext = false; return Response.json({ code: "SEARCH_UNAVAILABLE" }, { status: 503 }); }
  if (cursor && fixture.expireNext) { fixture.expireNext = false; return Response.json({ code: "SEARCH_EXPIRED" }, { status: 410 }); }
  if (cursor && fixture.invalidNext) { fixture.invalidNext = false; return Response.json({ code: "INVALID_SEARCH_CURSOR" }, { status: 400 }); }
  let services = filtered.slice(offset, offset + limit);
  if (cursor && fixture.overlapNext) { fixture.overlapNext = false; services = [filtered[offset - 1], ...services]; }
  return Response.json({ services, nextCursor: offset + limit < filtered.length ? `synthetic-page-${offset + limit}` : null,
    mode: url.pathname.includes("semantic") ? fixture.mode === "text" ? "semantic" : fixture.mode : "text" });
};
// Ensure any initial request scheduled by the base fixture uses this adapter.
void queryClient.invalidateQueries({ queryKey: ["/api/services/search"] });
