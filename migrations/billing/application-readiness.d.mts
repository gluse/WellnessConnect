export const EXPECTED_BILLING_PARSERS: readonly Readonly<{name:string;hash:string}>[];
export const BILLING_APPLICATION_READINESS_SQL: string;
export function billingApplicationReadinessArguments(): [string,string];
export function assertBillingApplicationReadiness(rows: Record<string,unknown>[]): void;
