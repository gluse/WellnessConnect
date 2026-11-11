export const CUSTOMER_NOTIFICATION_APPLICATION_READINESS_SQL: string;
export const CUSTOMER_NOTIFICATION_APPLICATION_READINESS_KEYS: readonly string[];
export function customerNotificationApplicationReadinessArguments(): unknown[];
export class CustomerServiceNotificationDatabaseReadinessError extends Error {
  code: string;
  checks: readonly string[];
  constructor(checks: readonly string[]);
}
export function assertCustomerServiceNotificationDatabaseReadiness(rows: unknown): void;
export function verifyCustomerServiceNotificationDatabaseReadiness(query: (text: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>): Promise<void>;
