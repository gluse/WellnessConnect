-- TASK-042 wishlist/activity/message-read expansion. PREPARED, NOT APPLIED.
-- Exact-target execution needs separate DB authorization. Stop on first failure.
BEGIN;
SET TRANSACTION READ WRITE;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL idle_in_transaction_session_timeout='60s';
SET LOCAL search_path=pg_catalog,pg_temp;
DO $wishlist$ BEGIN
 IF current_user<>session_user OR current_user<>'postgres'
 OR current_setting('server_version_num')::integer/10000<>17
 OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='fm_app_runtime'
  AND NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication)
 OR (SELECT count(*) FROM pg_catalog.pg_class WHERE relnamespace='public'::regnamespace AND relkind IN('r','p'))<>35
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_class WHERE relnamespace='public'::regnamespace AND relname IN ('wishlist_services','product_activity_events','service_activity_groups','service_activity_reads','booking_message_reads'))
 THEN RAISE EXCEPTION 'Wishlist expansion preconditions failed; inspect target and do not retry blindly'; END IF;
END $wishlist$;
-- BEGIN GENERATED WISHLIST DDL
CREATE TABLE "public"."booking_message_reads" (
	"user_id" varchar NOT NULL,
	"message_id" uuid NOT NULL,
	"context_key" varchar(100) NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_message_reads_user_id_message_id_context_key_pk" PRIMARY KEY("user_id","message_id","context_key"),
	CONSTRAINT "booking_message_read_context_check" CHECK ("booking_message_reads"."context_key" IN ('customer','provider:personal') OR "booking_message_reads"."context_key" ~ '^provider:company:[1-9][0-9]*$')
);

ALTER TABLE "public"."booking_message_reads" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "public"."product_activity_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" varchar NOT NULL,
	"user_id" varchar,
	"service_id" integer NOT NULL,
	"provider_id" varchar NOT NULL,
	"company_id" integer,
	"reporting_day" date NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"processed_at" timestamp with time zone,
	CONSTRAINT "product_activity_shape" CHECK ("product_activity_events"."kind" IN ('wishlist_additions','service_views') AND ("product_activity_events"."kind" <> 'wishlist_additions' OR "product_activity_events"."user_id" IS NOT NULL) AND "product_activity_events"."reporting_day" = ("product_activity_events"."occurred_at" AT TIME ZONE 'UTC')::date AND "product_activity_events"."expires_at" > "product_activity_events"."occurred_at" AND "product_activity_events"."expires_at" <= "product_activity_events"."occurred_at" + '2160:00:00'::interval AND ("product_activity_events"."processed_at" IS NULL OR "product_activity_events"."processed_at" >= "product_activity_events"."occurred_at"))
);

ALTER TABLE "public"."product_activity_events" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "public"."service_activity_groups" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" varchar NOT NULL,
	"service_id" integer NOT NULL,
	"provider_id" varchar NOT NULL,
	"company_id" integer,
	"scope_key" varchar NOT NULL,
	"reporting_day" date NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "service_activity_group_shape" CHECK ("service_activity_groups"."kind" IN ('wishlist_additions','service_views') AND "service_activity_groups"."count" > 0 AND "service_activity_groups"."revision" > 0 AND "service_activity_groups"."expires_at" > "service_activity_groups"."updated_at" AND "service_activity_groups"."scope_key" = CASE WHEN "service_activity_groups"."company_id" IS NULL THEN 'provider:' || "service_activity_groups"."provider_id" ELSE 'company:' || "service_activity_groups"."company_id"::text END)
);

ALTER TABLE "public"."service_activity_groups" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "public"."service_activity_reads" (
	"user_id" varchar NOT NULL,
	"group_id" uuid NOT NULL,
	"read_revision" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "service_activity_reads_user_id_group_id_pk" PRIMARY KEY("user_id","group_id"),
	CONSTRAINT "service_activity_read_revision_check" CHECK ("service_activity_reads"."read_revision" >= 0)
);

ALTER TABLE "public"."service_activity_reads" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "public"."wishlist_services" (
	"user_id" varchar NOT NULL,
	"service_id" integer NOT NULL,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wishlist_services_user_id_service_id_pk" PRIMARY KEY("user_id","service_id")
);

ALTER TABLE "public"."wishlist_services" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."booking_message_reads" ADD CONSTRAINT "booking_message_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "public"."booking_message_reads" ADD CONSTRAINT "booking_message_reads_message_id_booking_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."booking_messages"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "public"."product_activity_events" ADD CONSTRAINT "product_activity_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "public"."product_activity_events" ADD CONSTRAINT "product_activity_events_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "public"."product_activity_events" ADD CONSTRAINT "product_activity_events_provider_id_users_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "public"."product_activity_events" ADD CONSTRAINT "product_activity_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "public"."service_activity_groups" ADD CONSTRAINT "service_activity_groups_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "public"."service_activity_groups" ADD CONSTRAINT "service_activity_groups_provider_id_users_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "public"."service_activity_groups" ADD CONSTRAINT "service_activity_groups_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "public"."service_activity_reads" ADD CONSTRAINT "service_activity_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "public"."service_activity_reads" ADD CONSTRAINT "service_activity_reads_group_id_service_activity_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."service_activity_groups"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "public"."wishlist_services" ADD CONSTRAINT "wishlist_services_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "public"."wishlist_services" ADD CONSTRAINT "wishlist_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "booking_message_read_message_idx" ON "public"."booking_message_reads" USING btree ("message_id");
CREATE UNIQUE INDEX "product_wishlist_daily_identity" ON "public"."product_activity_events" USING btree ("user_id","service_id","reporting_day") WHERE "product_activity_events"."kind" = 'wishlist_additions';
CREATE INDEX "product_activity_pending_idx" ON "public"."product_activity_events" USING btree ("reporting_day","occurred_at","id") WHERE "product_activity_events"."processed_at" IS NULL;
CREATE INDEX "product_activity_expiry_idx" ON "public"."product_activity_events" USING btree ("expires_at");
CREATE INDEX "product_activity_user_idx" ON "public"."product_activity_events" USING btree ("user_id");
CREATE INDEX "product_activity_service_idx" ON "public"."product_activity_events" USING btree ("service_id");
CREATE INDEX "product_activity_provider_idx" ON "public"."product_activity_events" USING btree ("provider_id");
CREATE INDEX "product_activity_company_idx" ON "public"."product_activity_events" USING btree ("company_id");
CREATE UNIQUE INDEX "service_activity_group_identity" ON "public"."service_activity_groups" USING btree ("kind","service_id","reporting_day","scope_key");
CREATE INDEX "service_activity_scope_day_idx" ON "public"."service_activity_groups" USING btree ("scope_key","reporting_day" DESC NULLS LAST,"id" DESC NULLS LAST);
CREATE INDEX "service_activity_group_expiry_idx" ON "public"."service_activity_groups" USING btree ("expires_at");
CREATE INDEX "service_activity_group_service_idx" ON "public"."service_activity_groups" USING btree ("service_id");
CREATE INDEX "service_activity_group_provider_idx" ON "public"."service_activity_groups" USING btree ("provider_id");
CREATE INDEX "service_activity_group_company_idx" ON "public"."service_activity_groups" USING btree ("company_id");
CREATE INDEX "service_activity_read_group_idx" ON "public"."service_activity_reads" USING btree ("group_id");
CREATE INDEX "wishlist_user_saved_idx" ON "public"."wishlist_services" USING btree ("user_id","saved_at" DESC NULLS LAST,"service_id" DESC NULLS LAST);
CREATE INDEX "wishlist_service_idx" ON "public"."wishlist_services" USING btree ("service_id");
-- END GENERATED WISHLIST DDL
REVOKE ALL ON TABLE public.wishlist_services FROM PUBLIC, anon, authenticated, service_role, fm_app_runtime, fmt_app_dev, fmt_audit_capture_dev, fmt_audit_worker_dev;
REVOKE ALL ON TABLE public.product_activity_events FROM PUBLIC, anon, authenticated, service_role, fm_app_runtime, fmt_app_dev, fmt_audit_capture_dev, fmt_audit_worker_dev;
REVOKE ALL ON TABLE public.service_activity_groups FROM PUBLIC, anon, authenticated, service_role, fm_app_runtime, fmt_app_dev, fmt_audit_capture_dev, fmt_audit_worker_dev;
REVOKE ALL ON TABLE public.service_activity_reads FROM PUBLIC, anon, authenticated, service_role, fm_app_runtime, fmt_app_dev, fmt_audit_capture_dev, fmt_audit_worker_dev;
REVOKE ALL ON TABLE public.booking_message_reads FROM PUBLIC, anon, authenticated, service_role, fm_app_runtime, fmt_app_dev, fmt_audit_capture_dev, fmt_audit_worker_dev;
DO $privacy$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_class c,
  LATERAL pg_catalog.aclexplode(coalesce(c.relacl,pg_catalog.acldefault('r',c.relowner))) a
  WHERE c.relnamespace='public'::regnamespace AND c.relname IN ('wishlist_services','product_activity_events','service_activity_groups','service_activity_reads','booking_message_reads') AND a.grantee<>c.relowner)
 THEN RAISE EXCEPTION 'Unexpected wishlist default privileges; inspect before retry'; END IF;
END $privacy$;
SELECT true AS wishlist_expansion_created;
COMMIT;
