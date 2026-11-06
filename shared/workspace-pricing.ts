import { z } from "zod";
import { isSupportedCountry, isSupportedCurrency } from "./currencies";

export const pricingWorkspaceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("user"), id: z.string().min(1).max(128) }).strict(),
  z.object({ kind: z.literal("company"), id: z.number().int().positive().max(2147483647) }).strict(),
]);
export type PricingWorkspace = z.infer<typeof pricingWorkspaceSchema>;
const currency = z.string().refine(isSupportedCurrency, "Choose a supported currency.");
const country = z.string().refine(isSupportedCountry, "Choose a supported country.");
export const workspacePricingViewSchema = z.object({
  workspace: pricingWorkspaceSchema,
  defaultCurrency: currency.nullable(),
  businessCountryCode: country.nullable(),
  revision: z.number().int().min(0).max(2147483647),
  canEdit: z.boolean(),
}).strict();
export type WorkspacePricingSettingsView = z.infer<typeof workspacePricingViewSchema>;
export const workspacePricingSettingsViewSchema = workspacePricingViewSchema;
export const workspacePricingUpdateSchema = z.object({
  // Comparison binding only. The server always selects the target workspace.
  expectedWorkspace: pricingWorkspaceSchema,
  expectedRevision: z.number().int().min(0).max(2147483646),
  defaultCurrency: currency.nullable().optional(),
  businessCountryCode: country.nullable().optional(),
}).strict().refine(input => input.defaultCurrency !== undefined || input.businessCountryCode !== undefined, "Choose a setting to update.");
export type WorkspacePricingUpdate = z.infer<typeof workspacePricingUpdateSchema>;
export class WorkspacePricingError extends Error {
  constructor(readonly status: number, readonly code: "WORKSPACE_PRICING_CHANGED" | "WORKSPACE_CHANGED" | "WORKSPACE_PRICING_FORBIDDEN", message: string) { super(message); }
}
export const samePricingWorkspace = (left: PricingWorkspace, right: PricingWorkspace) => left.kind === right.kind && left.id === right.id;
