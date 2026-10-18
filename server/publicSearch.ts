import type { Express, RequestHandler, Response } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import type { ServiceWithProvider } from "@shared/schema";
import { cosineSimilarity } from "./vectors";
import { assertSearchSize, MAX_SEMANTIC_RESULTS, publicSearchSchema, SearchError, semanticSearchSchema, type SearchFilters } from "./searchInput";

export interface PublicSearchDependencies {
  searchServices(filters: SearchFilters): Promise<ServiceWithProvider[]>;
  getPublicServiceEmbeddings(filters: SearchFilters): Promise<{ serviceId: number; embedding: number[] }[]>;
  generateEmbedding(text: string, options: { timeout: number; maxRetries: number; signal: AbortSignal }): Promise<number[]>;
}
export interface PublicSearchPolicy {
  windowMs: number; readsPerIp: number; readsPerProcess: number;
  semanticPerIp: number; semanticPerProcess: number; concurrentEmbeddings: number;
}
const defaultPolicy: PublicSearchPolicy = {
  windowMs: 60000, readsPerIp: 60, readsPerProcess: 300,
  semanticPerIp: 10, semanticPerProcess: 30, concurrentEmbeddings: 2,
};
function failure(error: unknown, res: Response) {
  if (error instanceof z.ZodError) return res.status(400).json({ code: "INVALID_SEARCH", message: "Choose valid search filters, a query up to 200 characters, and a date range of at most 31 days." });
  if (error instanceof SearchError) return res.status(error.status).json({ code: error.code, message: error.message });
  return res.status(503).json({ code: "SEARCH_UNAVAILABLE", message: "Search is temporarily unavailable. Please try again." });
}

export function setupPublicSearchRoutes(app: Express, dependencies: PublicSearchDependencies, policy: PublicSearchPolicy = defaultPolicy) {
  const limiter = (limit: number, global = false) => rateLimit({
    windowMs: policy.windowMs, limit, standardHeaders: "draft-7", legacyHeaders: false,
    ...(global ? { keyGenerator: () => "process" } : {}),
    handler: (_req, res) => res.status(429).json({ code: "SEARCH_RATE_LIMITED", message: "Too many searches. Please wait before trying again." }),
  });
  const readLimit = limiter(policy.readsPerIp), processReadLimit = limiter(policy.readsPerProcess, true);
  const semanticLimit = limiter(policy.semanticPerIp), processSemanticLimit = limiter(policy.semanticPerProcess, true);
  const noStore: RequestHandler = (_req, res, next) => { res.set("Cache-Control", "no-store"); next(); };
  app.get("/api/services/search", noStore, readLimit, processReadLimit, async (req, res) => {
    try {
      const filters = publicSearchSchema.parse(req.query);
      const services = await dependencies.searchServices(filters);
      assertSearchSize(services.length);
      res.json(services);
    } catch (error) { failure(error, res); }
  });

  let activeEmbeddings = 0;
  app.get("/api/services/semantic-search", noStore, readLimit, processReadLimit, semanticLimit, processSemanticLimit, async (req, res) => {
    const parsed = semanticSearchSchema.safeParse(req.query);
    if (!parsed.success) return failure(parsed.error, res);
    const { query, ...filters } = parsed.data;
    const exactFilters = { ...filters, searchQuery: query };
    try {
      const textMatches = await dependencies.searchServices(exactFilters);
      assertSearchSize(textMatches.length);
      if (textMatches.length) return res.json(textMatches);
      const candidates = await dependencies.getPublicServiceEmbeddings(filters);
      assertSearchSize(candidates.length);
      if (!candidates.length) return res.json([]);
      if (activeEmbeddings >= policy.concurrentEmbeddings) {
        res.set("Retry-After", "1");
        throw new SearchError(429, "SEARCH_RATE_LIMITED", "Search is busy. Please try again shortly.");
      }
      activeEmbeddings++;
      const controller = new AbortController();
      const onClose = () => { if (!res.writableEnded) controller.abort(); };
      res.on("close", onClose);
      let queryEmbedding: number[];
      try {
        queryEmbedding = await dependencies.generateEmbedding(query, { timeout: 8000, maxRetries: 0, signal: controller.signal });
      } finally {
        activeEmbeddings--;
        res.off("close", onClose);
      }
      const scored = candidates.map(candidate => ({ serviceId: candidate.serviceId, score: cosineSimilarity(queryEmbedding, candidate.embedding) }))
        .filter(item => Number.isFinite(item.score) && item.score >= 0.30)
        .sort((a, b) => b.score - a.score || a.serviceId - b.serviceId);
      res.set("X-Search-Truncated", String(scored.length > MAX_SEMANTIC_RESULTS));
      const ids = scored.slice(0, MAX_SEMANTIC_RESULTS).map(item => item.serviceId);
      if (!ids.length) return res.json([]);
      const services = await dependencies.searchServices({ ...filters, serviceIds: ids });
      const positions = new Map(ids.map((id, index) => [id, index]));
      res.json(services.filter(service => positions.has(service.id)).sort((a, b) => positions.get(a.id)! - positions.get(b.id)!));
    } catch (error) {
      if (error instanceof SearchError || error instanceof z.ZodError) return failure(error, res);
      // A provider failure may degrade to text search, but a second failure must
      // still produce a controlled response under Express 4.
      try {
        const services = await dependencies.searchServices(exactFilters);
        assertSearchSize(services.length);
        res.set("X-Search-Fallback", "true").json(services);
      } catch (fallbackError) { failure(fallbackError, res); }
    }
  });
}
