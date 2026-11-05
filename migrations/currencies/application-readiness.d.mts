export const CURRENCY_READINESS_SQL: string;
export const CURRENCY_READINESS_KEYS: readonly string[];
export function canonicalCurrencyExpression(value: string): string;
export function currencyReadinessArguments(): string[];
export function assertCurrencyReadiness(rows: unknown): void;
export class CurrencyDatabaseReadinessError extends Error { readonly code: 'CURRENCY_DB_NOT_READY'; checks: string[]; }
export function verifyCurrencyDatabaseReadiness(query: (text: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>): Promise<void>;
