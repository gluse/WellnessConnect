// Injected metadata guard only. No configuration, connections or SQL on import.
import { WISHLIST_APPLICATION_READINESS_SQL, WISHLIST_APPLICATION_READINESS_KEYS, wishlistApplicationReadinessArguments } from '../wishlist/application-readiness.mjs';
import { PRICING_RUNTIME_CONTRACT_JSON, PRICING_RUNTIME_RIGHTS, PRICING_READINESS_CTES, PRICING_READINESS_SELECT } from './runtime-contract.mjs';
const marker = '\nSELECT current_user=';
if (WISHLIST_APPLICATION_READINESS_SQL.split(marker).length !== 2) throw new Error('WORKSPACE_PRICING_BASE_PROFILE_CHANGED');
export const WORKSPACE_PRICING_APPLICATION_READINESS_SQL = WISHLIST_APPLICATION_READINESS_SQL.replace(marker, `, ${PRICING_READINESS_CTES}${marker}`) + `, ${PRICING_READINESS_SELECT}`;
export const WORKSPACE_PRICING_APPLICATION_READINESS_KEYS = Object.freeze([...WISHLIST_APPLICATION_READINESS_KEYS,
  'workspace_pricing_columns','workspace_pricing_constraints','workspace_pricing_indexes','workspace_pricing_private_acl','workspace_pricing_policies','workspace_pricing_schema_access']);
export function workspacePricingApplicationReadinessArguments() {
  const base = wishlistApplicationReadinessArguments();
  return [JSON.stringify([...JSON.parse(base[0]), PRICING_RUNTIME_RIGHTS]), ...base.slice(1), PRICING_RUNTIME_CONTRACT_JSON];
}
export class WorkspacePricingDatabaseReadinessError extends Error {
  code = 'WORKSPACE_PRICING_DB_NOT_READY';
  constructor(checks) { super('WORKSPACE_PRICING_DB_NOT_READY'); this.checks = checks; }
}
export function assertWorkspacePricingApplicationReadiness(rows) {
  const keys = WORKSPACE_PRICING_APPLICATION_READINESS_KEYS;
  const shape = Array.isArray(rows) && rows.length === 1 && rows[0] && typeof rows[0] === 'object' && Object.keys(rows[0]).length === keys.length;
  if (!shape || keys.some(key => rows[0][key] !== true)) throw new WorkspacePricingDatabaseReadinessError(shape ? keys.filter(key => rows[0][key] !== true) : ['readiness_result_shape']);
}
export async function verifyWorkspacePricingDatabaseReadiness(query) {
  let rows;
  try { ({ rows } = await query(WORKSPACE_PRICING_APPLICATION_READINESS_SQL, workspacePricingApplicationReadinessArguments())); }
  catch { throw new WorkspacePricingDatabaseReadinessError(['metadata_query']); }
  assertWorkspacePricingApplicationReadiness(rows);
}
