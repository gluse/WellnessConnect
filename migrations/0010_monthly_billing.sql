-- TASK-024 choice 2, additive DORMANT expansion. Prepared, not applied.
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
     OR EXISTS(SELECT 1 FROM unnest(ARRAY['sessions','users','companies','company_memberships','company_invitations','provider_subscriptions','storefronts','employees','categories','addresses','services','geocoding_cache','bookings','service_reviews','service_embeddings','availability','user_search_locations']::text[]) expected(name)
       WHERE to_regclass('public.' || expected.name) IS NULL) THEN
    RAISE EXCEPTION 'Verified seventeen-table source foundation required';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_roles WHERE rolname IN
      ('fm_app_runtime','fmt_app_dev','fmt_audit_capture_dev','fmt_audit_worker_dev','anon','authenticated','service_role'))<>7 THEN
    RAISE EXCEPTION 'Billing source runtime/browser role baseline missing';
  END IF;
END $billing$;
-- BEGIN GENERATED BILLING DDL
CREATE TABLE "public"."billing_accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"provider" varchar(64) NOT NULL,
	"merchant_account" varchar(255) NOT NULL,
	"mode" varchar(4) NOT NULL,
	"customer_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_account_binding" UNIQUE("id","workspace_id","provider","merchant_account","mode"),
	CONSTRAINT "billing_account_shape" CHECK ("billing_accounts"."mode" IN ('test','live') AND length(trim("billing_accounts"."provider")) > 0 AND length(trim("billing_accounts"."merchant_account")) > 0 AND ("billing_accounts"."customer_id" IS NULL OR length(trim("billing_accounts"."customer_id")) > 0))
);

ALTER TABLE "public"."billing_accounts" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "public"."billing_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"provider" varchar(64) NOT NULL,
	"merchant_account" varchar(255) NOT NULL,
	"mode" varchar(4) NOT NULL,
	"account_id" uuid,
	"workspace_id" integer,
	"operation_id" uuid,
	"event_id" varchar(255) NOT NULL,
	"event_type" varchar(128) NOT NULL,
	"object_id" varchar(255) NOT NULL,
	"fingerprint" varchar(64) NOT NULL,
	"state" varchar DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"lease_token" uuid,
	"lease_until" timestamp with time zone,
	"failure_code" varchar(64),
	"occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	CONSTRAINT "billing_event_shape" CHECK ("billing_events"."mode" IN ('test','live') AND length(trim("billing_events"."provider")) > 0 AND length(trim("billing_events"."merchant_account")) > 0 AND length(trim("billing_events"."event_id")) > 0 AND length(trim("billing_events"."event_type")) > 0 AND length(trim("billing_events"."object_id")) > 0 AND "billing_events"."fingerprint" ~ '^[a-f0-9]{64}$' AND "billing_events"."state" IN ('pending','processing','processed','quarantined') AND "billing_events"."attempts" >= 0 AND (("billing_events"."account_id" IS NULL) = ("billing_events"."workspace_id" IS NULL)) AND ("billing_events"."operation_id" IS NULL OR "billing_events"."account_id" IS NOT NULL) AND (("billing_events"."lease_token" IS NULL) = ("billing_events"."lease_until" IS NULL)) AND (("billing_events"."state" = 'processed') = ("billing_events"."processed_at" IS NOT NULL)) AND ("billing_events"."state" <> 'processed' OR "billing_events"."account_id" IS NOT NULL))
);

ALTER TABLE "public"."billing_events" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "public"."billing_invoices" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"provider" varchar(64) NOT NULL,
	"merchant_account" varchar(255) NOT NULL,
	"mode" varchar(4) NOT NULL,
	"account_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"processor_invoice_id" varchar(255) NOT NULL,
	"status" varchar NOT NULL,
	"processor_status" varchar(64),
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"currency" varchar(3) NOT NULL,
	"amount_due" numeric(18, 0) NOT NULL,
	"amount_paid" numeric(18, 0) NOT NULL,
	"amount_refunded" numeric(18, 0) DEFAULT '0' NOT NULL,
	"payment_reference" varchar(255),
	"refund_references" varchar(255)[] DEFAULT ARRAY[]::varchar(255)[] NOT NULL,
	"dispute_references" varchar(255)[] DEFAULT ARRAY[]::varchar(255)[] NOT NULL,
	"reconciled_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_invoice_shape" CHECK ("billing_invoices"."mode" IN ('test','live') AND "billing_invoices"."status" IN ('paid','unpaid','reversed') AND "billing_invoices"."currency" = 'EUR' AND length(trim("billing_invoices"."processor_invoice_id")) > 0 AND "billing_invoices"."period_end" > "billing_invoices"."period_start" AND "billing_invoices"."amount_due" >= 0 AND "billing_invoices"."amount_paid" >= 0 AND "billing_invoices"."amount_refunded" >= 0 AND "billing_invoices"."amount_refunded" <= "billing_invoices"."amount_paid" AND cardinality("billing_invoices"."refund_references") <= 100 AND cardinality("billing_invoices"."dispute_references") <= 100 AND array_position("billing_invoices"."refund_references", NULL) IS NULL AND array_position("billing_invoices"."dispute_references", NULL) IS NULL AND array_position("billing_invoices"."refund_references", '') IS NULL AND array_position("billing_invoices"."dispute_references", '') IS NULL)
);

ALTER TABLE "public"."billing_invoices" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "public"."billing_operations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"provider" varchar(64) NOT NULL,
	"merchant_account" varchar(255) NOT NULL,
	"mode" varchar(4) NOT NULL,
	"account_id" uuid NOT NULL,
	"kind" varchar NOT NULL,
	"initiator_id" varchar,
	"idempotency_key" varchar(128) NOT NULL,
	"fingerprint" varchar(64) NOT NULL,
	"approved_offer_ref" varchar(255),
	"terms_version" varchar(128),
	"state" varchar NOT NULL,
	"remote_checkout_id" varchar(255),
	"resolved_at" timestamp with time zone,
	"failure_code" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_operation_binding" UNIQUE("id","account_id","workspace_id","provider","merchant_account","mode"),
	CONSTRAINT "billing_operation_shape" CHECK ("billing_operations"."mode" IN ('test','live') AND "billing_operations"."kind" IN ('checkout','portal','cancel','reconcile') AND "billing_operations"."state" IN ('reserved','unknown','completed','failed') AND "billing_operations"."fingerprint" ~ '^[a-f0-9]{64}$' AND length(trim("billing_operations"."idempotency_key")) > 0 AND ("billing_operations"."kind" = 'reconcile' OR "billing_operations"."initiator_id" IS NOT NULL) AND ("billing_operations"."kind" <> 'checkout' OR ("billing_operations"."approved_offer_ref" IS NOT NULL AND length(trim("billing_operations"."approved_offer_ref")) > 0 AND "billing_operations"."terms_version" IS NOT NULL AND length(trim("billing_operations"."terms_version")) > 0)) AND ("billing_operations"."kind" <> 'checkout' OR "billing_operations"."state" <> 'completed' OR ("billing_operations"."remote_checkout_id" IS NOT NULL AND length(trim("billing_operations"."remote_checkout_id")) > 0)))
);

ALTER TABLE "public"."billing_operations" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "public"."billing_subscriptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"provider" varchar(64) NOT NULL,
	"merchant_account" varchar(255) NOT NULL,
	"mode" varchar(4) NOT NULL,
	"account_id" uuid NOT NULL,
	"processor_subscription_id" varchar(255) NOT NULL,
	"state" varchar NOT NULL,
	"processor_status" varchar(64) NOT NULL,
	"approved_offer_ref" varchar(255) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"interval" varchar(5) DEFAULT 'month' NOT NULL,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"paid_through" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"generation" integer DEFAULT 0 NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"lease_token" uuid,
	"lease_until" timestamp with time zone,
	"reconciled_at" timestamp with time zone,
	"next_reconcile_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_subscription_binding" UNIQUE("id","account_id","workspace_id","provider","merchant_account","mode"),
	CONSTRAINT "billing_subscription_shape" CHECK ("billing_subscriptions"."mode" IN ('test','live') AND "billing_subscriptions"."state" IN ('pending','running','attention','ended') AND "billing_subscriptions"."currency" = 'EUR' AND "billing_subscriptions"."interval" = 'month' AND length(trim("billing_subscriptions"."processor_subscription_id")) > 0 AND length(trim("billing_subscriptions"."processor_status")) > 0 AND length(trim("billing_subscriptions"."approved_offer_ref")) > 0 AND "billing_subscriptions"."generation" >= 0 AND "billing_subscriptions"."revision" >= 0 AND (("billing_subscriptions"."period_start" IS NULL AND "billing_subscriptions"."period_end" IS NULL) OR ("billing_subscriptions"."period_start" IS NOT NULL AND "billing_subscriptions"."period_end" IS NOT NULL AND "billing_subscriptions"."period_end" > "billing_subscriptions"."period_start")) AND (("billing_subscriptions"."lease_token" IS NULL) = ("billing_subscriptions"."lease_until" IS NULL)))
);

ALTER TABLE "public"."billing_subscriptions" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "public"."manual_pro_grants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"source" varchar NOT NULL,
	"source_reference" varchar(255) NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"issued_by" varchar,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"legacy_updated_by" varchar,
	"legacy_updated_at" timestamp with time zone,
	"reason_code" varchar(64),
	"revoked_at" timestamp with time zone,
	"revoked_by" varchar,
	CONSTRAINT "manual_pro_grant_shape" CHECK ("manual_pro_grants"."source" IN ('legacy_manual','administrator') AND length(trim("manual_pro_grants"."source_reference")) > 0 AND "manual_pro_grants"."ends_at" > "manual_pro_grants"."starts_at" AND ("manual_pro_grants"."source" <> 'administrator' OR "manual_pro_grants"."issued_by" IS NOT NULL) AND ("manual_pro_grants"."revoked_by" IS NULL OR "manual_pro_grants"."revoked_at" IS NOT NULL))
);

ALTER TABLE "public"."manual_pro_grants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."billing_accounts" ADD CONSTRAINT "billing_accounts_workspace_id_provider_subscriptions_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."provider_subscriptions"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "public"."billing_events" ADD CONSTRAINT "billing_event_account_binding" FOREIGN KEY ("account_id","workspace_id","provider","merchant_account","mode") REFERENCES "public"."billing_accounts"("id","workspace_id","provider","merchant_account","mode") ON DELETE no action ON UPDATE no action;
ALTER TABLE "public"."billing_events" ADD CONSTRAINT "billing_event_operation_binding" FOREIGN KEY ("operation_id","account_id","workspace_id","provider","merchant_account","mode") REFERENCES "public"."billing_operations"("id","account_id","workspace_id","provider","merchant_account","mode") ON DELETE no action ON UPDATE no action;
ALTER TABLE "public"."billing_invoices" ADD CONSTRAINT "billing_invoices_workspace_id_provider_subscriptions_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."provider_subscriptions"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "public"."billing_invoices" ADD CONSTRAINT "billing_invoice_subscription_binding" FOREIGN KEY ("subscription_id","account_id","workspace_id","provider","merchant_account","mode") REFERENCES "public"."billing_subscriptions"("id","account_id","workspace_id","provider","merchant_account","mode") ON DELETE no action ON UPDATE no action;
ALTER TABLE "public"."billing_operations" ADD CONSTRAINT "billing_operations_workspace_id_provider_subscriptions_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."provider_subscriptions"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "public"."billing_operations" ADD CONSTRAINT "billing_operations_initiator_id_users_id_fk" FOREIGN KEY ("initiator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "public"."billing_operations" ADD CONSTRAINT "billing_operation_account_binding" FOREIGN KEY ("account_id","workspace_id","provider","merchant_account","mode") REFERENCES "public"."billing_accounts"("id","workspace_id","provider","merchant_account","mode") ON DELETE no action ON UPDATE no action;
ALTER TABLE "public"."billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_workspace_id_provider_subscriptions_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."provider_subscriptions"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "public"."billing_subscriptions" ADD CONSTRAINT "billing_subscription_account_binding" FOREIGN KEY ("account_id","workspace_id","provider","merchant_account","mode") REFERENCES "public"."billing_accounts"("id","workspace_id","provider","merchant_account","mode") ON DELETE no action ON UPDATE no action;
ALTER TABLE "public"."manual_pro_grants" ADD CONSTRAINT "manual_pro_grants_workspace_id_provider_subscriptions_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."provider_subscriptions"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "public"."manual_pro_grants" ADD CONSTRAINT "manual_pro_grants_issued_by_users_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "public"."manual_pro_grants" ADD CONSTRAINT "manual_pro_grants_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
CREATE UNIQUE INDEX "billing_account_workspace_scope" ON "public"."billing_accounts" USING btree ("workspace_id","provider","merchant_account","mode");
CREATE UNIQUE INDEX "billing_account_customer_identity" ON "public"."billing_accounts" USING btree ("provider","merchant_account","mode","customer_id");
CREATE UNIQUE INDEX "billing_event_identity" ON "public"."billing_events" USING btree ("provider","merchant_account","mode","event_id");
CREATE INDEX "billing_event_pending" ON "public"."billing_events" USING btree ("next_attempt_at") WHERE "billing_events"."state" IN ('pending','processing');
CREATE UNIQUE INDEX "billing_invoice_identity" ON "public"."billing_invoices" USING btree ("provider","merchant_account","mode","processor_invoice_id");
CREATE INDEX "billing_invoice_coverage" ON "public"."billing_invoices" USING btree ("subscription_id","period_start","period_end");
CREATE UNIQUE INDEX "billing_operation_idempotency" ON "public"."billing_operations" USING btree ("workspace_id","mode","kind","idempotency_key");
CREATE UNIQUE INDEX "billing_checkout_workspace_slot" ON "public"."billing_operations" USING btree ("workspace_id","mode") WHERE "billing_operations"."kind" = 'checkout' AND "billing_operations"."resolved_at" IS NULL;
CREATE UNIQUE INDEX "billing_subscription_identity" ON "public"."billing_subscriptions" USING btree ("provider","merchant_account","mode","processor_subscription_id");
CREATE UNIQUE INDEX "billing_subscription_workspace_slot" ON "public"."billing_subscriptions" USING btree ("workspace_id","mode") WHERE "billing_subscriptions"."state" <> 'ended';
CREATE INDEX "billing_subscription_due" ON "public"."billing_subscriptions" USING btree ("next_reconcile_at");
CREATE UNIQUE INDEX "manual_pro_grant_source" ON "public"."manual_pro_grants" USING btree ("workspace_id","source","source_reference");
CREATE INDEX "manual_pro_grant_coverage" ON "public"."manual_pro_grants" USING btree ("workspace_id","starts_at","ends_at");

-- END GENERATED BILLING DDL
REVOKE ALL ON TABLE public.billing_accounts FROM PUBLIC, anon, authenticated, service_role, fm_app_runtime, fmt_app_dev, fmt_audit_capture_dev, fmt_audit_worker_dev;
REVOKE ALL ON TABLE public.billing_subscriptions FROM PUBLIC, anon, authenticated, service_role, fm_app_runtime, fmt_app_dev, fmt_audit_capture_dev, fmt_audit_worker_dev;
REVOKE ALL ON TABLE public.billing_invoices FROM PUBLIC, anon, authenticated, service_role, fm_app_runtime, fmt_app_dev, fmt_audit_capture_dev, fmt_audit_worker_dev;
REVOKE ALL ON TABLE public.billing_operations FROM PUBLIC, anon, authenticated, service_role, fm_app_runtime, fmt_app_dev, fmt_audit_capture_dev, fmt_audit_worker_dev;
REVOKE ALL ON TABLE public.billing_events FROM PUBLIC, anon, authenticated, service_role, fm_app_runtime, fmt_app_dev, fmt_audit_capture_dev, fmt_audit_worker_dev;
REVOKE ALL ON TABLE public.manual_pro_grants FROM PUBLIC, anon, authenticated, service_role, fm_app_runtime, fmt_app_dev, fmt_audit_capture_dev, fmt_audit_worker_dev;
SELECT true AS billing_dormant_expansion_created;
COMMIT;
