-- Customer listing-change notifications. PREPARED ONLY; NOT APPLIED.
-- Apply after 0023 with exact-target execution/recovery authorization.
-- Stop application/activity writers through migration and application cutover.
BEGIN;
SET TRANSACTION READ WRITE;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL idle_in_transaction_session_timeout='60s';
SET LOCAL search_path=pg_catalog,pg_temp;
DO $customer_notice$ BEGIN
 IF current_user<>session_user OR current_user<>'postgres'
 OR current_setting('server_version_num')::integer/10000<>17
 OR (SELECT count(*) FROM pg_catalog.pg_class WHERE relnamespace='public'::regnamespace AND relkind IN('r','p'))<>41
 OR to_regclass('public.customer_service_notifications') IS NOT NULL
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='public.services'::regclass AND attname='deleted_at' AND NOT attisdropped)
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.services'::regclass AND conname='services_deleted_inactive_check')
 OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='public.services'::regclass AND attname='reminder_message' AND NOT attisdropped)
 OR (SELECT count(*) FROM pg_catalog.pg_roles WHERE rolname IN ('fm_app_runtime','fmt_app_dev','fmt_audit_capture_dev','fmt_audit_worker_dev','anon','authenticated','service_role'))<>7
 OR to_regprocedure('pg_catalog.gen_random_uuid()') IS NULL
 THEN RAISE EXCEPTION 'Customer notification expansion preconditions failed; inspect target and do not retry'; END IF;
END $customer_notice$;
LOCK TABLE public.services IN ACCESS EXCLUSIVE MODE;
-- BEGIN GENERATED CUSTOMER NOTIFICATION DDL
CREATE TABLE "public"."customer_service_notifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"seeker_id" varchar NOT NULL,
	"booking_id" integer NOT NULL,
	"service_id" integer NOT NULL,
	"changed_fields" jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "customer_service_notification_fields_check" CHECK (jsonb_typeof("customer_service_notifications"."changed_fields") = 'array' AND jsonb_array_length("customer_service_notifications"."changed_fields") >= 1 AND jsonb_array_length("customer_service_notifications"."changed_fields") <= 18 AND "customer_service_notifications"."changed_fields" <@ '["name","description","category","serviceType","price","currency","duration","cleanupTime","maxCapacity","ageGroups","targetGender","instantBooking","advancePaymentPercent","imageUrls","externalUrl","addressId","employeeId","isActive"]'::jsonb),
	CONSTRAINT "customer_service_notification_retention_check" CHECK ("customer_service_notifications"."expires_at" > "customer_service_notifications"."created_at" AND "customer_service_notifications"."expires_at" <= "customer_service_notifications"."created_at" + '2160:00:00'::interval AND ("customer_service_notifications"."read_at" IS NULL OR "customer_service_notifications"."read_at" >= "customer_service_notifications"."created_at"))
);

ALTER TABLE "public"."customer_service_notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."services" ADD COLUMN "deleted_at" timestamp with time zone;
ALTER TABLE "public"."customer_service_notifications" ADD CONSTRAINT "customer_service_notifications_seeker_id_users_id_fk" FOREIGN KEY ("seeker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "public"."customer_service_notifications" ADD CONSTRAINT "customer_service_notifications_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "public"."customer_service_notifications" ADD CONSTRAINT "customer_service_notifications_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "customer_service_notification_inbox_idx" ON "public"."customer_service_notifications" USING btree ("seeker_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);
CREATE INDEX "customer_service_notification_expiry_idx" ON "public"."customer_service_notifications" USING btree ("expires_at","id");
CREATE INDEX "customer_service_notification_booking_idx" ON "public"."customer_service_notifications" USING btree ("booking_id");
CREATE INDEX "customer_service_notification_service_idx" ON "public"."customer_service_notifications" USING btree ("service_id");
ALTER TABLE "public"."services" ADD CONSTRAINT "services_deleted_inactive_check" CHECK ("services"."deleted_at" IS NULL OR "services"."is_active" IS FALSE);
-- END GENERATED CUSTOMER NOTIFICATION DDL
REVOKE ALL ON TABLE public.customer_service_notifications FROM PUBLIC, anon, authenticated, service_role, fm_app_runtime, fmt_app_dev, fmt_audit_capture_dev, fmt_audit_worker_dev;
DO $privacy$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_class c,
 LATERAL pg_catalog.aclexplode(coalesce(c.relacl,pg_catalog.acldefault('r',c.relowner))) a
 WHERE c.oid='public.customer_service_notifications'::regclass AND a.grantee<>c.relowner)
 THEN RAISE EXCEPTION 'Unexpected customer notification default privileges; inspect before retry'; END IF;
END $privacy$;
COMMIT;
