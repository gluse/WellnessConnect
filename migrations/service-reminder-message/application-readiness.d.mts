export const SERVICE_REMINDER_MESSAGE_READINESS_SQL: string;
export const SERVICE_REMINDER_MESSAGE_READINESS_KEYS: readonly string[];
export function canonicalServiceReminderMessageExpression(value: string): string;
export function serviceReminderMessageReadinessArguments(): string[];
export class ServiceReminderMessageDatabaseReadinessError extends Error { code: string; checks: string[]; constructor(checks: string[]); }
export function assertServiceReminderMessageReadiness(rows: unknown): void;
export function verifyServiceReminderMessageDatabaseReadiness(query: (text: string, values: string[]) => Promise<{ rows: unknown[] }>): Promise<void>;
