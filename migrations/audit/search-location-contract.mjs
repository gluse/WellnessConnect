// Pure TASK-026 metadata shared by runtime readiness and owner-only tooling.
// Keep installer/verifier implementations outside application bundle imports.
import { APP_TABLES } from './runtime-contract.mjs';

export const LOCATION_TABLE = 'user_search_locations';
export const LOCATION_TABLES = Object.freeze([...APP_TABLES, LOCATION_TABLE]);
export const LOCATION_RIGHTS = Object.freeze(['SELECT', 'INSERT', 'UPDATE', 'DELETE']);
