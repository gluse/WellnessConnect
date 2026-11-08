export const SERVICE_PHOTO_READINESS_SQL: string;
export const SERVICE_PHOTO_READINESS_KEYS: readonly string[];
export function canonicalPhotoExpression(value: string): string;
export function servicePhotoReadinessArguments(): string[];
export class ServicePhotoDatabaseReadinessError extends Error {
  code: 'SERVICE_PHOTO_DB_NOT_READY';
  checks: string[];
  constructor(checks: string[]);
}
export function assertServicePhotoReadiness(rows: unknown): void;
export function verifyServicePhotoDatabaseReadiness(query: (text: string, values: string[]) => Promise<{ rows: unknown[] }>): Promise<void>;
