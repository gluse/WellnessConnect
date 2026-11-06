export const WORKSPACE_PRICING_APPLICATION_READINESS_SQL: string;
export const WORKSPACE_PRICING_APPLICATION_READINESS_KEYS: readonly string[];
export function workspacePricingApplicationReadinessArguments(): string[];
export function assertWorkspacePricingApplicationReadiness(rows: unknown): void;
export class WorkspacePricingDatabaseReadinessError extends Error { readonly code: 'WORKSPACE_PRICING_DB_NOT_READY'; checks: string[]; }
export function verifyWorkspacePricingDatabaseReadiness(query: (text: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>): Promise<void>;
