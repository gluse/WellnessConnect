import { z } from "zod";
import type { ServiceWithProvider } from "./schema";

export const providerCatalogSchema = z.union([
  z.object({ companyId: z.coerce.number().int().positive().max(2147483647) }).strict(),
  z.object({ providerId: z.string().trim().min(1).max(128) }).strict(),
]);

export function providerCatalogQuery(service: Pick<ServiceWithProvider, "companyId" | "providerId">): string {
  return new URLSearchParams(service.companyId != null
    ? { companyId: String(service.companyId) }
    : { providerId: service.providerId }).toString();
}
