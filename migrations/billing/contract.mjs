// TASK-024 choice-2 opt-in manifest. Inert: no files, environment or connections.
import {APP_SEQUENCES,ROLES} from '../audit/runtime-contract.mjs';
import {LOCATION_TABLES} from '../audit/search-location-contract.mjs';
export const BILLING_EXPORTS=Object.freeze([
  'billingAccounts','billingSubscriptions','billingInvoices','billingOperations','billingEvents','manualProGrants',
]);
export const BILLING_TABLES=Object.freeze([
  'billing_accounts','billing_subscriptions','billing_invoices','billing_operations','billing_events','manual_pro_grants',
]);
export const BILLING_PROFILE_TABLES=Object.freeze([...LOCATION_TABLES,...BILLING_TABLES]);
export const BILLING_PROFILE_SEQUENCES=APP_SEQUENCES; // UUID keys add no sequences.
export const BILLING_RUNTIME_RIGHTS=Object.freeze(['SELECT','INSERT','UPDATE']);
export const BILLING_SOURCE_ROLES=Object.freeze(['fm_app_runtime',ROLES.app,ROLES.capture,ROLES.worker]);
export const BILLING_REVOKE_ROLES=Object.freeze(['PUBLIC','anon','authenticated','service_role',...BILLING_SOURCE_ROLES]);
export const BILLING_FILES=Object.freeze({
  schema:'migrations/0010_monthly_billing.sql',
  runtime:'migrations/0011_monthly_billing_runtime.sql',
  transferSecurity:'migrations/billing/transfer-security.sql',
});
export function billingRepositoryCompatibility(text){
  const names=[...text.matchAll(/\bpgTable\(\s*["']([a-z0-9_]+)["']/g)].map(m=>m[1]);
  return names.length===BILLING_PROFILE_TABLES.length && new Set(names).size===names.length &&
    BILLING_PROFILE_TABLES.every(name=>names.includes(name));
}
export function qualifyBillingDDL(sql){
  return sql.replace(/(CREATE TABLE |ALTER TABLE | ON )"(billing_[a-z_]+|manual_pro_grants)"/g,'$1"public"."$2"');
}
export const BILLING_SCHEMA_PREFIX=`-- TASK-024 choice 2, additive DORMANT expansion. Prepared, not applied.
-- No entitlement backfill, projection update, runtime grant or activation.
BEGIN;
SET TRANSACTION READ WRITE;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL idle_in_transaction_session_timeout='60s';
SET LOCAL search_path=pg_catalog,pg_temp;
DO $billing$ BEGIN
  IF current_user<>session_user OR current_user<>'postgres'
     OR current_setting('server_version_num')::integer/10000<>17 THEN
    RAISE EXCEPTION 'Billing principal/version precondition failed';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p'))<>17
     OR EXISTS(SELECT 1 FROM unnest(ARRAY[${LOCATION_TABLES.map(n=>`'${n}'`).join(',')}]::text[]) expected(name)
       WHERE to_regclass('public.' || expected.name) IS NULL) THEN
    RAISE EXCEPTION 'Verified seventeen-table source foundation required';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_roles WHERE rolname IN
      ('fm_app_runtime','fmt_app_dev','fmt_audit_capture_dev','fmt_audit_worker_dev','anon','authenticated','service_role'))<>7 THEN
    RAISE EXCEPTION 'Billing source runtime/browser role baseline missing';
  END IF;
END $billing$;
-- BEGIN GENERATED BILLING DDL
`;
export const BILLING_SCHEMA_SUFFIX=`
-- END GENERATED BILLING DDL
${BILLING_TABLES.map(name=>`REVOKE ALL ON TABLE public.${name} FROM ${BILLING_REVOKE_ROLES.join(', ')};`).join('\n')}
SELECT true AS billing_dormant_expansion_created;
COMMIT;
`;
