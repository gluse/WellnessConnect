// Versioned, inert application-runtime metadata. Historical profiles stay intact.
import manifest from './runtime-contract.json' with {type:'json'};
import {APPOINTMENT_READINESS_CTES,APPOINTMENT_READINESS_SELECT} from '../appointments/runtime-contract.mjs';
export const WISHLIST_RUNTIME_TABLES=Object.freeze([...manifest.tables]);
export const WISHLIST_RUNTIME_CONTRACT_JSON=JSON.stringify(manifest);
export const WISHLIST_RUNTIME_RIGHTS=Object.freeze(WISHLIST_RUNTIME_TABLES.map(name=>Object.freeze({name,rights:Object.freeze(['SELECT','INSERT','UPDATE','DELETE'])})));
// Reuse the same exact PG17 constraint/ACL/policy checks with a separate parameter
// and policy name, then additionally verify descending index-key directions.
export const WISHLIST_READINESS_CTES=APPOINTMENT_READINESS_CTES.replaceAll('appointment','wishlist').replace('$4::jsonb','$5::jsonb').replace('columns text[],predicate text)','columns text[],descending boolean[],predicate text)');
export const WISHLIST_READINESS_SELECT=APPOINTMENT_READINESS_SELECT.replaceAll('appointment','wishlist').replace('AND i.indexprs IS NULL',`AND ARRAY(SELECT (option & 1)=1 FROM unnest(i.indoption::smallint[]) WITH ORDINALITY k(option,position) ORDER BY k.position)=e.descending
 AND i.indexprs IS NULL`);
