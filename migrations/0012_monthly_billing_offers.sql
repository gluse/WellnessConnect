-- TASK-024 selected Stripe/EUR19 inclusive/new-subscribers-only local catalog.
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
CREATE TABLE "public"."billing_offer_revisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"interval" varchar(5) DEFAULT 'month' NOT NULL,
	"tax_included" boolean DEFAULT true NOT NULL,
	"issued_by" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_offer_shape" CHECK ("billing_offer_revisions"."version" > 0 AND "billing_offer_revisions"."amount_minor" > 0 AND "billing_offer_revisions"."currency" = 'EUR' AND "billing_offer_revisions"."interval" = 'month' AND "billing_offer_revisions"."tax_included" AND ("billing_offer_revisions"."issued_by" IS NOT NULL OR "billing_offer_revisions"."version" = 1))
);

ALTER TABLE "public"."billing_offer_revisions" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "public"."billing_offer_settings" (
	"singleton" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"current_offer_id" uuid NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_by" varchar,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_offer_settings_shape" CHECK ("billing_offer_settings"."singleton" AND "billing_offer_settings"."revision" > 0 AND ("billing_offer_settings"."updated_by" IS NOT NULL OR "billing_offer_settings"."revision" = 1))
);

ALTER TABLE "public"."billing_offer_settings" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "public"."billing_price_mappings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"offer_id" uuid NOT NULL,
	"provider" varchar(64) NOT NULL,
	"merchant_account" varchar(255) NOT NULL,
	"mode" varchar(4) NOT NULL,
	"processor_price_id" varchar(255),
	"state" varchar NOT NULL,
	"fingerprint" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_price_binding" UNIQUE("id","offer_id","provider","merchant_account","mode"),
	CONSTRAINT "billing_price_shape" CHECK ("billing_price_mappings"."provider" = 'stripe' AND length(trim("billing_price_mappings"."merchant_account")) > 0 AND "billing_price_mappings"."mode" IN ('test','live') AND "billing_price_mappings"."state" IN ('reserved','unknown','ready') AND "billing_price_mappings"."fingerprint" ~ '^[a-f0-9]{64}$' AND (("billing_price_mappings"."state" = 'ready') = ("billing_price_mappings"."processor_price_id" IS NOT NULL)) AND ("billing_price_mappings"."processor_price_id" IS NULL OR length(trim("billing_price_mappings"."processor_price_id")) > 0))
);

ALTER TABLE "public"."billing_price_mappings" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "public"."billing_source_state" (
	"workspace_id" integer PRIMARY KEY NOT NULL,
	"imported_at" timestamp with time zone NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "billing_source_revision" CHECK ("billing_source_state"."revision" >= 0)
);

ALTER TABLE "public"."billing_source_state" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."billing_operations" ADD COLUMN "offer_revision_id" uuid;
ALTER TABLE "public"."billing_operations" ADD COLUMN "price_mapping_id" uuid;
ALTER TABLE "public"."billing_subscriptions" ADD COLUMN "offer_revision_id" uuid;
ALTER TABLE "public"."billing_subscriptions" ADD COLUMN "price_mapping_id" uuid;
ALTER TABLE "public"."billing_offer_revisions" ADD CONSTRAINT "billing_offer_revisions_issued_by_users_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "public"."billing_offer_settings" ADD CONSTRAINT "billing_offer_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "public"."billing_offer_settings" ADD CONSTRAINT "billing_offer_settings_current_offer_fk" FOREIGN KEY ("current_offer_id") REFERENCES "public"."billing_offer_revisions"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "public"."billing_price_mappings" ADD CONSTRAINT "billing_price_mappings_offer_id_billing_offer_revisions_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."billing_offer_revisions"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "public"."billing_source_state" ADD CONSTRAINT "billing_source_state_workspace_id_provider_subscriptions_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."provider_subscriptions"("id") ON DELETE no action ON UPDATE no action;
CREATE UNIQUE INDEX "billing_offer_version" ON "public"."billing_offer_revisions" USING btree ("version");
CREATE UNIQUE INDEX "billing_price_offer_scope" ON "public"."billing_price_mappings" USING btree ("offer_id","provider","merchant_account","mode");
CREATE UNIQUE INDEX "billing_price_remote_identity" ON "public"."billing_price_mappings" USING btree ("provider","merchant_account","mode","processor_price_id");
ALTER TABLE "public"."billing_operations" ADD CONSTRAINT "billing_operation_offer_revision_fk" FOREIGN KEY ("offer_revision_id") REFERENCES "public"."billing_offer_revisions"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "public"."billing_operations" ADD CONSTRAINT "billing_operation_price_binding" FOREIGN KEY ("price_mapping_id","offer_revision_id","provider","merchant_account","mode") REFERENCES "public"."billing_price_mappings"("id","offer_id","provider","merchant_account","mode") ON DELETE no action ON UPDATE no action;
ALTER TABLE "public"."billing_subscriptions" ADD CONSTRAINT "billing_subscription_offer_revision_fk" FOREIGN KEY ("offer_revision_id") REFERENCES "public"."billing_offer_revisions"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "public"."billing_subscriptions" ADD CONSTRAINT "billing_subscription_price_binding" FOREIGN KEY ("price_mapping_id","offer_revision_id","provider","merchant_account","mode") REFERENCES "public"."billing_price_mappings"("id","offer_id","provider","merchant_account","mode") ON DELETE no action ON UPDATE no action;
ALTER TABLE "public"."billing_operations" ADD CONSTRAINT "billing_operation_offer_binding" CHECK ("billing_operations"."price_mapping_id" IS NULL OR "billing_operations"."offer_revision_id" IS NOT NULL);
ALTER TABLE "public"."billing_subscriptions" ADD CONSTRAINT "billing_subscription_offer_binding" CHECK ("billing_subscriptions"."price_mapping_id" IS NULL OR "billing_subscriptions"."offer_revision_id" IS NOT NULL);

-- END GENERATED BILLING V2 DDL
REVOKE ALL ON TABLE public.billing_offer_revisions FROM PUBLIC, anon, authenticated, service_role, fm_app_runtime, fmt_app_dev, fmt_audit_capture_dev, fmt_audit_worker_dev;
REVOKE ALL ON TABLE public.billing_offer_settings FROM PUBLIC, anon, authenticated, service_role, fm_app_runtime, fmt_app_dev, fmt_audit_capture_dev, fmt_audit_worker_dev;
REVOKE ALL ON TABLE public.billing_price_mappings FROM PUBLIC, anon, authenticated, service_role, fm_app_runtime, fmt_app_dev, fmt_audit_capture_dev, fmt_audit_worker_dev;
REVOKE ALL ON TABLE public.billing_source_state FROM PUBLIC, anon, authenticated, service_role, fm_app_runtime, fmt_app_dev, fmt_audit_capture_dev, fmt_audit_worker_dev;
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
VALUES('b0241900-0000-4000-8000-000000000001',1,1900,'EUR','month',true,NULL);
INSERT INTO public.billing_offer_settings(singleton,current_offer_id,revision,updated_by)
VALUES(true,'b0241900-0000-4000-8000-000000000001',1,NULL);
SELECT true AS billing_local_offers_created;
COMMIT;
