import { z } from "zod";
import type { ProviderSubscription, ServiceWithProvider, Storefront } from "./schema";

export const storefrontSlugSchema = z.string().trim().min(3).max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and single hyphens.");
const imagePath = z.string().regex(/^\/objects\/[a-zA-Z0-9_-]+\/[a-f0-9-]{36}\.(?:jpg|png|webp|gif)$/).nullable();
export const storefrontSchema = z.object({
  slug: storefrontSlugSchema,
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(3000),
  logoUrl: imagePath,
  coverUrl: imagePath,
  isPublished: z.boolean(),
}).strict();
export type StorefrontInput = z.infer<typeof storefrontSchema>;
export const subscriptionTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("user"), id: z.string().trim().min(1).max(128) }).strict(),
  z.object({ kind: z.literal("company"), id: z.coerce.number().int().positive().max(2147483647) }).strict(),
]);
export type SubscriptionTarget = z.infer<typeof subscriptionTargetSchema>;
export const subscriptionOptionsSchema = z.object({
  kind: z.enum(["user", "company"]),
  search: z.string().trim().max(200).default(""),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
}).strict();
export type SubscriptionOptionsQuery = z.infer<typeof subscriptionOptionsSchema>;
export type SubscriptionOption = { target: SubscriptionTarget; name: string; detail: string | null; isActive: boolean | null };
export type SubscriptionOptionsPage = { items: SubscriptionOption[]; hasMore: boolean };
export const subscriptionUpdateSchema = z.object({
  target: subscriptionTargetSchema,
  plan: z.enum(["free", "pro"]),
  proUntil: z.string().datetime({ offset: true }).nullable(),
}).strict().refine(value => value.plan === "free" || (value.proUntil != null && Date.parse(value.proUntil) > Date.now()), "Pro access must have a future expiry date.");

export function hasPro(subscription: Pick<ProviderSubscription, "plan" | "proUntil"> | null, now = Date.now()) {
  return subscription?.plan === "pro" && subscription.proUntil != null && new Date(subscription.proUntil).getTime() > now;
}
export type StorefrontSettings = {
  subscription: Pick<ProviderSubscription, "plan" | "proUntil"> | null;
  hasPro: boolean;
  storefront: Storefront | null;
};
export type PublicStorefront = {
  slug: string; name: string; description: string; logoUrl: string | null; coverUrl: string | null;
  services: ServiceWithProvider[];
};
export type AdminSubscription = { name: string; subscription: ProviderSubscription | null };
export class StorefrontError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
