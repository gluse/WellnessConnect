// 26 Oct selected local pricing/source extension. No I/O or activation on import.
import {BILLING_PROFILE_TABLES,BILLING_PROFILE_SEQUENCES,BILLING_REVOKE_ROLES} from './contract.mjs';
export const INITIAL_OFFER_ID='b0241900-0000-4000-8000-000000000001';
export const BILLING_V2_EXPORTS=Object.freeze(['billingOfferRevisions','billingOfferSettings','billingPriceMappings','billingSourceState']);
export const BILLING_V2_TABLES=Object.freeze(['billing_offer_revisions','billing_offer_settings','billing_price_mappings','billing_source_state']);
export const BILLING_V2_PROFILE_TABLES=Object.freeze([...BILLING_PROFILE_TABLES,...BILLING_V2_TABLES]);
export const BILLING_V2_SEQUENCES=BILLING_PROFILE_SEQUENCES;
export const BILLING_V2_RIGHTS=Object.freeze({billing_offer_revisions:['SELECT','INSERT'],billing_offer_settings:['SELECT','UPDATE'],billing_price_mappings:['SELECT','INSERT','UPDATE'],billing_source_state:['SELECT','INSERT','UPDATE']});
export const BILLING_V2_FILES=Object.freeze({schema:'migrations/0012_monthly_billing_offers.sql',runtime:'migrations/0013_monthly_billing_offers_runtime.sql',columns:'migrations/billing/v2-columns.json',transferSecurity:'migrations/billing/v2-transfer-security.sql'});
export const BILLING_V2_PREFIX=`-- TASK-024 selected Stripe/EUR19 inclusive/new-subscribers-only local catalog.
-- Prepared, not applied. No processor calls, source backfill or entitlement activation.
BEGIN;
SET TRANSACTION READ WRITE;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL idle_in_transaction_session_timeout='60s';
SET LOCAL search_path=pg_catalog,pg_temp;
DO $billing$ BEGIN
 IF current_user<>session_user OR current_user<>'postgres' OR current_setting('server_version_num')::integer/10000<>17
  OR (SELECT count(*) FROM pg_catalog.pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind IN('r','p'))<>23
  OR (SELECT count(*) FROM pg_catalog.pg_policy p JOIN pg_catalog.pg_class c ON c.oid=p.polrelid
   WHERE c.relnamespace='public'::regnamespace AND c.relname IN('billing_accounts','billing_subscriptions','billing_invoices','billing_operations','billing_events','manual_pro_grants')
   AND p.polname='fmt_billing_server')<>6
 THEN RAISE EXCEPTION 'Verified choice-2 v1 source required'; END IF;
END $billing$;
-- BEGIN GENERATED BILLING V2 DDL
`;
export const BILLING_V2_SUFFIX=`
-- END GENERATED BILLING V2 DDL
${BILLING_V2_TABLES.map(name=>`REVOKE ALL ON TABLE public.${name} FROM ${BILLING_REVOKE_ROLES.join(', ')};`).join('\n')}
-- Immutable local prices are never updated in-place, including by owner-connected code.
CREATE FUNCTION public.reject_billing_offer_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $offer$
BEGIN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Billing offer revisions are immutable'; END $offer$;
REVOKE ALL ON FUNCTION public.reject_billing_offer_mutation() FROM PUBLIC,anon,authenticated,service_role,fm_app_runtime;
CREATE TRIGGER billing_offer_immutable BEFORE UPDATE OR DELETE ON public.billing_offer_revisions
FOR EACH ROW EXECUTE FUNCTION public.reject_billing_offer_mutation();
CREATE FUNCTION public.guard_billing_price_mapping() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $mapping$
BEGIN
 IF ROW(NEW.id,NEW.offer_id,NEW.provider,NEW.merchant_account,NEW.mode,NEW.fingerprint,NEW.created_at)
  IS DISTINCT FROM ROW(OLD.id,OLD.offer_id,OLD.provider,OLD.merchant_account,OLD.mode,OLD.fingerprint,OLD.created_at)
  OR (OLD.processor_price_id IS NOT NULL AND NEW.processor_price_id IS DISTINCT FROM OLD.processor_price_id)
 THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Billing price identity is immutable'; END IF;
 RETURN NEW;
END $mapping$;
REVOKE ALL ON FUNCTION public.guard_billing_price_mapping() FROM PUBLIC,anon,authenticated,service_role,fm_app_runtime;
CREATE TRIGGER billing_price_identity_immutable BEFORE UPDATE ON public.billing_price_mappings
FOR EACH ROW EXECUTE FUNCTION public.guard_billing_price_mapping();
CREATE FUNCTION public.guard_billing_offer_settings() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $settings$
BEGIN
 IF NEW.singleton IS DISTINCT FROM OLD.singleton OR NEW.revision<>OLD.revision+1
  OR NEW.current_offer_id=OLD.current_offer_id
  OR NOT EXISTS(SELECT 1 FROM public.billing_offer_revisions r WHERE r.id=NEW.current_offer_id
    AND r.version=NEW.revision AND r.issued_by IS NOT DISTINCT FROM NEW.updated_by)
 THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Billing offer pointer revision conflict'; END IF;
 RETURN NEW;
END $settings$;
REVOKE ALL ON FUNCTION public.guard_billing_offer_settings() FROM PUBLIC,anon,authenticated,service_role,fm_app_runtime;
CREATE TRIGGER billing_offer_settings_cas BEFORE UPDATE ON public.billing_offer_settings
FOR EACH ROW EXECUTE FUNCTION public.guard_billing_offer_settings();
CREATE FUNCTION public.guard_billing_subscription_offer() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $subscription$
BEGIN
 IF ROW(NEW.id,NEW.account_id,NEW.workspace_id,NEW.provider,NEW.merchant_account,NEW.mode,
    NEW.processor_subscription_id,NEW.approved_offer_ref,NEW.currency,NEW.interval)
  IS DISTINCT FROM ROW(OLD.id,OLD.account_id,OLD.workspace_id,OLD.provider,OLD.merchant_account,OLD.mode,
    OLD.processor_subscription_id,OLD.approved_offer_ref,OLD.currency,OLD.interval)
  OR (OLD.offer_revision_id IS NOT NULL AND NEW.offer_revision_id IS DISTINCT FROM OLD.offer_revision_id)
  OR (OLD.price_mapping_id IS NOT NULL AND NEW.price_mapping_id IS DISTINCT FROM OLD.price_mapping_id)
 THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Existing subscription agreed offer is immutable'; END IF;
 RETURN NEW;
END $subscription$;
REVOKE ALL ON FUNCTION public.guard_billing_subscription_offer() FROM PUBLIC,anon,authenticated,service_role,fm_app_runtime;
CREATE TRIGGER billing_subscription_offer_immutable BEFORE UPDATE ON public.billing_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.guard_billing_subscription_offer();
INSERT INTO public.billing_offer_revisions(id,version,amount_minor,currency,interval,tax_included,issued_by)
VALUES('${INITIAL_OFFER_ID}',1,1900,'EUR','month',true,NULL);
INSERT INTO public.billing_offer_settings(singleton,current_offer_id,revision,updated_by)
VALUES(true,'${INITIAL_OFFER_ID}',1,NULL);
SELECT true AS billing_local_offers_created;
COMMIT;
`;
