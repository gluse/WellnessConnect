// Side-effect-free current metadata, preserving historical 40-table profiles.
import manifest from './runtime-contract.json' with { type: 'json' };
import { APPOINTMENT_READINESS_CTES, APPOINTMENT_READINESS_SELECT } from '../appointments/runtime-contract.mjs';
export const PRICING_RUNTIME_CONTRACT_JSON = JSON.stringify(manifest);
export const PRICING_RUNTIME_RIGHTS = Object.freeze({ name: 'workspace_pricing_settings', rights: Object.freeze(['SELECT','INSERT','UPDATE']) });
export const PRICING_READINESS_CTES = APPOINTMENT_READINESS_CTES.replaceAll('appointment', 'workspace_pricing').replace('$4::jsonb', '$6::jsonb');
const marker = "a.privilege_type NOT IN('SELECT','INSERT','UPDATE','DELETE')";
if (!APPOINTMENT_READINESS_SELECT.includes(marker)) throw new Error('WORKSPACE_PRICING_ACL_BASE_CHANGED');
export const PRICING_READINESS_SELECT = APPOINTMENT_READINESS_SELECT.replaceAll('appointment', 'workspace_pricing')
  .replace(marker, "a.privilege_type NOT IN('SELECT','INSERT','UPDATE')");
