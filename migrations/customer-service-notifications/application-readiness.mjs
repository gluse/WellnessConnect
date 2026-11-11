// Current42 metadata profile. Historical migration/readiness profiles are frozen.
// Imports never read configuration or open a connection.
import manifest from './runtime-contract.json' with { type: 'json' };
import { WORKSPACE_PRICING_APPLICATION_READINESS_SQL, WORKSPACE_PRICING_APPLICATION_READINESS_KEYS, workspacePricingApplicationReadinessArguments } from '../workspace-pricing/application-readiness.mjs';
import { APPOINTMENT_READINESS_CTES, APPOINTMENT_READINESS_SELECT } from '../appointments/runtime-contract.mjs';
const CUSTOMER_NOTIFICATION_RIGHTS = Object.freeze({ name: 'customer_service_notifications', rights: Object.freeze(['SELECT','INSERT','UPDATE','DELETE']) });
const marker = '\nSELECT current_user=';
if (WORKSPACE_PRICING_APPLICATION_READINESS_SQL.split(marker).length !== 2) throw new Error('CUSTOMER_NOTIFICATION_BASE_PROFILE_CHANGED');
const ctes = APPOINTMENT_READINESS_CTES.replaceAll('appointment', 'customer_notice').replace('$4::jsonb', '$7::jsonb');
const select = APPOINTMENT_READINESS_SELECT.replaceAll('appointment', 'customer_notice');
export const CUSTOMER_NOTIFICATION_APPLICATION_READINESS_SQL = WORKSPACE_PRICING_APPLICATION_READINESS_SQL.replace(marker, `, ${ctes}${marker}`) + `, ${select}`;
export const CUSTOMER_NOTIFICATION_APPLICATION_READINESS_KEYS = Object.freeze([...WORKSPACE_PRICING_APPLICATION_READINESS_KEYS,
  'customer_notice_columns','customer_notice_constraints','customer_notice_indexes','customer_notice_private_acl','customer_notice_policies','customer_notice_schema_access']);
export function customerNotificationApplicationReadinessArguments() {
  const base = workspacePricingApplicationReadinessArguments();
  return [JSON.stringify([...JSON.parse(base[0]), CUSTOMER_NOTIFICATION_RIGHTS]), ...base.slice(1), JSON.stringify(manifest)];
}
export class CustomerServiceNotificationDatabaseReadinessError extends Error {
  code = 'CUSTOMER_SERVICE_NOTIFICATION_DB_NOT_READY';
  constructor(checks) { super('CUSTOMER_SERVICE_NOTIFICATION_DB_NOT_READY'); this.checks = checks; }
}
export function assertCustomerServiceNotificationDatabaseReadiness(rows) {
  const keys = CUSTOMER_NOTIFICATION_APPLICATION_READINESS_KEYS;
  const shape = Array.isArray(rows) && rows.length === 1 && rows[0] && typeof rows[0] === 'object' && Object.keys(rows[0]).length === keys.length;
  if (!shape || keys.some(key => rows[0][key] !== true)) throw new CustomerServiceNotificationDatabaseReadinessError(shape ? keys.filter(key => rows[0][key] !== true) : ['readiness_result_shape']);
}
export async function verifyCustomerServiceNotificationDatabaseReadiness(query) {
  let rows;
  try { ({ rows } = await query(CUSTOMER_NOTIFICATION_APPLICATION_READINESS_SQL, customerNotificationApplicationReadinessArguments())); }
  catch { throw new CustomerServiceNotificationDatabaseReadinessError(['metadata_query']); }
  assertCustomerServiceNotificationDatabaseReadiness(rows);
}
