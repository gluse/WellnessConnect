// Current integrated40 profile; immutable billing/appointment profiles remain35.
import {BILLING_APPLICATION_READINESS_SQL,BILLING_APPLICATION_READINESS_KEYS,billingApplicationReadinessArguments} from '../billing/application-readiness.mjs';
import {WISHLIST_RUNTIME_RIGHTS,WISHLIST_RUNTIME_CONTRACT_JSON,WISHLIST_READINESS_CTES,WISHLIST_READINESS_SELECT} from './runtime-contract.mjs';
const marker='\nSELECT current_user=';
if(BILLING_APPLICATION_READINESS_SQL.split(marker).length!==2)throw new Error('WISHLIST_BASE_PROFILE_CHANGED');
export const WISHLIST_APPLICATION_READINESS_SQL=BILLING_APPLICATION_READINESS_SQL.replace(marker,`, ${WISHLIST_READINESS_CTES}${marker}`)+`, ${WISHLIST_READINESS_SELECT}`;
export const WISHLIST_APPLICATION_READINESS_KEYS=Object.freeze([...BILLING_APPLICATION_READINESS_KEYS,'wishlist_columns','wishlist_constraints','wishlist_indexes','wishlist_private_acl','wishlist_policies','wishlist_schema_access']);
export function wishlistApplicationReadinessArguments(){const base=billingApplicationReadinessArguments();return [JSON.stringify([...JSON.parse(base[0]),...WISHLIST_RUNTIME_RIGHTS]),...base.slice(1),WISHLIST_RUNTIME_CONTRACT_JSON];}
export function assertWishlistApplicationReadiness(rows){
 const keys=WISHLIST_APPLICATION_READINESS_KEYS;
 if(!Array.isArray(rows)||rows.length!==1||!rows[0]||Object.keys(rows[0]).length!==keys.length||keys.some(key=>rows[0][key]!==true)){
  const error=new Error('BILLING_DB_NOT_READY');error.code='BILLING_DB_NOT_READY';
  error.checks=Array.isArray(rows)&&rows.length===1&&rows[0]&&Object.keys(rows[0]).length===keys.length?keys.filter(key=>rows[0][key]!==true):['readiness_result_shape'];throw error;
 }
}
