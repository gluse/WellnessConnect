-- TASK-032 prepared expansion only. No SQL has been applied.
BEGIN;
SET TRANSACTION READ WRITE;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL idle_in_transaction_session_timeout='60s';
SET LOCAL search_path=pg_catalog,pg_temp;
DO $notifications$ BEGIN
 IF current_user<>session_user OR current_user<>'postgres' OR current_setting('server_version_num')::integer/10000<>17
 OR (SELECT count(*) FROM pg_catalog.pg_roles WHERE rolname IN ('fm_app_runtime','fmt_app_dev','fmt_audit_capture_dev','fmt_audit_worker_dev','anon','authenticated','service_role'))<>7
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relname=ANY(ARRAY['user_communication_preferences','phone_verification_challenges','notification_events','notification_jobs','notification_delivery_attempts','notification_callbacks']::text[]))
 THEN RAISE EXCEPTION 'Notifications expansion preconditions failed; inspect target and do not retry blindly'; END IF;
END $notifications$;
-- BEGIN GENERATED NOTIFICATIONS DDL
CREATE TABLE "public"."notification_callbacks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"provider" varchar NOT NULL,
	"provider_event_id" varchar(255) NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_callback_shape" CHECK ("notification_callbacks"."provider" IN ('vonage','resend') AND length(trim("notification_callbacks"."provider_event_id")) > 0)
);

ALTER TABLE "public"."notification_callbacks" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "public"."notification_delivery_attempts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"job_id" uuid NOT NULL,
	"provider" varchar NOT NULL,
	"provider_message_id" varchar(255),
	"state" varchar DEFAULT 'reserved' NOT NULL,
	"error_code" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_attempt_shape" CHECK ("notification_delivery_attempts"."provider" IN ('vonage','resend') AND "notification_delivery_attempts"."state" IN ('reserved','accepted','delivered','failed','unknown'))
);

ALTER TABLE "public"."notification_delivery_attempts" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "public"."notification_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"booking_revision" integer NOT NULL,
	"kind" varchar NOT NULL,
	"scheduled_date" timestamp with time zone NOT NULL,
	"previous_scheduled_date" timestamp with time zone,
	"timezone" varchar(100) DEFAULT 'UTC' NOT NULL,
	"automatic" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_event_shape" CHECK ("notification_events"."booking_revision" >= 0 AND "notification_events"."kind" IN ('accepted','rejected','rescheduled','reminder') AND length(trim("notification_events"."timezone")) BETWEEN 1 AND 100 AND ("notification_events"."kind" <> 'rescheduled' OR "notification_events"."previous_scheduled_date" IS NOT NULL))
);

ALTER TABLE "public"."notification_events" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "public"."notification_jobs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event_id" uuid NOT NULL,
	"channel" varchar,
	"state" varchar DEFAULT 'queued' NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"lease_token" uuid,
	"lease_until" timestamp with time zone,
	"attempted_at" timestamp with time zone,
	"provider_message_id" varchar(255),
	"reason_code" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_job_state_check" CHECK ("notification_jobs"."state" IN ('queued','leased','accepted','delivered','failed','unknown','skipped','cancelled') AND ("notification_jobs"."channel" IS NULL OR "notification_jobs"."channel" IN ('email','sms','whatsapp'))),
	CONSTRAINT "notification_job_lease_check" CHECK ((("notification_jobs"."lease_token" IS NULL) = ("notification_jobs"."lease_until" IS NULL)) AND ("notification_jobs"."state" <> 'leased' OR "notification_jobs"."lease_token" IS NOT NULL)),
	CONSTRAINT "notification_job_expiry_check" CHECK ("notification_jobs"."expires_at" IS NULL OR "notification_jobs"."expires_at" >= "notification_jobs"."due_at")
);

ALTER TABLE "public"."notification_jobs" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "public"."phone_verification_challenges" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"phone" varchar(16) NOT NULL,
	"provider_request_id" varchar(255),
	"status" varchar DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"next_send_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "phone_verification_shape" CHECK ("phone_verification_challenges"."phone" ~ '^\+[1-9][0-9]{7,14}$' AND "phone_verification_challenges"."status" IN ('pending','verified','failed','expired','unknown') AND "phone_verification_challenges"."attempt_count" BETWEEN 0 AND 5 AND "phone_verification_challenges"."expires_at" > "phone_verification_challenges"."created_at" AND "phone_verification_challenges"."next_send_at" >= "phone_verification_challenges"."created_at")
);

ALTER TABLE "public"."phone_verification_challenges" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "public"."user_communication_preferences" (
	"user_id" varchar PRIMARY KEY NOT NULL,
	"phone" varchar(16),
	"phone_verified_at" timestamp with time zone,
	"preferred_method" varchar,
	"email_suppressed" boolean DEFAULT false NOT NULL,
	"language" varchar(8) DEFAULT 'en' NOT NULL,
	"sms_opt_in" boolean DEFAULT false NOT NULL,
	"whatsapp_opt_in" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "communication_preferences_phone_check" CHECK ("user_communication_preferences"."phone" IS NULL OR "user_communication_preferences"."phone" ~ '^\+[1-9][0-9]{7,14}$'),
	CONSTRAINT "communication_preferences_verification_check" CHECK (("user_communication_preferences"."phone_verified_at" IS NULL OR "user_communication_preferences"."phone" IS NOT NULL) AND (NOT "user_communication_preferences"."sms_opt_in" OR "user_communication_preferences"."phone_verified_at" IS NOT NULL) AND (NOT "user_communication_preferences"."whatsapp_opt_in" OR "user_communication_preferences"."phone_verified_at" IS NOT NULL)),
	CONSTRAINT "communication_preferences_method_check" CHECK ("user_communication_preferences"."preferred_method" IS NULL OR "user_communication_preferences"."preferred_method" = 'email' OR ("user_communication_preferences"."preferred_method" = 'sms' AND "user_communication_preferences"."sms_opt_in") OR ("user_communication_preferences"."preferred_method" = 'whatsapp' AND "user_communication_preferences"."whatsapp_opt_in")),
	CONSTRAINT "communication_preferences_language_check" CHECK ("user_communication_preferences"."language" IN ('en','lv','ru','ar','zh','fr','de','hi','ja','pt','es'))
);

ALTER TABLE "public"."user_communication_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."bookings" ADD COLUMN "notification_revision" integer DEFAULT 0 NOT NULL;
ALTER TABLE "public"."services" ADD COLUMN "reminder_enabled" boolean DEFAULT false NOT NULL;
ALTER TABLE "public"."services" ADD COLUMN "reminder_method" varchar DEFAULT 'email' NOT NULL;
ALTER TABLE "public"."services" ADD COLUMN "reminder_hours" integer DEFAULT 24 NOT NULL;
ALTER TABLE "public"."notification_delivery_attempts" ADD CONSTRAINT "notification_delivery_attempts_job_id_notification_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."notification_jobs"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "public"."notification_events" ADD CONSTRAINT "notification_events_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "public"."notification_jobs" ADD CONSTRAINT "notification_jobs_event_id_notification_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."notification_events"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "public"."phone_verification_challenges" ADD CONSTRAINT "phone_verification_challenges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "public"."user_communication_preferences" ADD CONSTRAINT "user_communication_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
CREATE UNIQUE INDEX "notification_callback_identity" ON "public"."notification_callbacks" USING btree ("provider","provider_event_id");
CREATE INDEX "notification_callbacks_retention_idx" ON "public"."notification_callbacks" USING btree ("received_at");
CREATE UNIQUE INDEX "notification_attempt_job_identity" ON "public"."notification_delivery_attempts" USING btree ("job_id");
CREATE INDEX "notification_attempt_recent_idx" ON "public"."notification_delivery_attempts" USING btree ("created_at","job_id");
CREATE UNIQUE INDEX "notification_attempt_provider_identity" ON "public"."notification_delivery_attempts" USING btree ("provider","provider_message_id");
CREATE UNIQUE INDEX "notification_event_revision_identity" ON "public"."notification_events" USING btree ("booking_id","booking_revision","kind");
CREATE UNIQUE INDEX "notification_reminder_identity" ON "public"."notification_events" USING btree ("booking_id","scheduled_date") WHERE "notification_events"."kind" = 'reminder';
CREATE INDEX "notification_events_retention_idx" ON "public"."notification_events" USING btree ("created_at");
CREATE UNIQUE INDEX "notification_job_event_identity" ON "public"."notification_jobs" USING btree ("event_id");
CREATE INDEX "notification_job_due_idx" ON "public"."notification_jobs" USING btree ("due_at") WHERE "notification_jobs"."state" = 'queued';
CREATE INDEX "notification_job_lease_idx" ON "public"."notification_jobs" USING btree ("lease_until") WHERE "notification_jobs"."state" = 'leased';
CREATE INDEX "notification_jobs_retention_idx" ON "public"."notification_jobs" USING btree ("updated_at");
CREATE INDEX "phone_verification_user_created_idx" ON "public"."phone_verification_challenges" USING btree ("user_id","created_at");
CREATE INDEX "phone_verification_phone_created_idx" ON "public"."phone_verification_challenges" USING btree ("phone","created_at");
CREATE INDEX "phone_verification_expiry_idx" ON "public"."phone_verification_challenges" USING btree ("expires_at");
CREATE UNIQUE INDEX "phone_verification_provider_identity" ON "public"."phone_verification_challenges" USING btree ("provider_request_id");
CREATE INDEX "communication_preferences_phone_idx" ON "public"."user_communication_preferences" USING btree ("phone") WHERE "user_communication_preferences"."phone" IS NOT NULL;
ALTER TABLE "public"."bookings" ADD CONSTRAINT "bookings_notification_revision_check" CHECK ("bookings"."notification_revision" >= 0);
ALTER TABLE "public"."services" ADD CONSTRAINT "services_reminder_settings_check" CHECK ("services"."reminder_method" IN ('email','sms','whatsapp') AND "services"."reminder_hours" BETWEEN 1 AND 168);
-- END GENERATED NOTIFICATIONS DDL
REVOKE ALL ON TABLE public.user_communication_preferences FROM PUBLIC, anon, authenticated, service_role, fm_app_runtime, fmt_app_dev, fmt_audit_capture_dev, fmt_audit_worker_dev;
REVOKE ALL ON TABLE public.phone_verification_challenges FROM PUBLIC, anon, authenticated, service_role, fm_app_runtime, fmt_app_dev, fmt_audit_capture_dev, fmt_audit_worker_dev;
REVOKE ALL ON TABLE public.notification_events FROM PUBLIC, anon, authenticated, service_role, fm_app_runtime, fmt_app_dev, fmt_audit_capture_dev, fmt_audit_worker_dev;
REVOKE ALL ON TABLE public.notification_jobs FROM PUBLIC, anon, authenticated, service_role, fm_app_runtime, fmt_app_dev, fmt_audit_capture_dev, fmt_audit_worker_dev;
REVOKE ALL ON TABLE public.notification_delivery_attempts FROM PUBLIC, anon, authenticated, service_role, fm_app_runtime, fmt_app_dev, fmt_audit_capture_dev, fmt_audit_worker_dev;
REVOKE ALL ON TABLE public.notification_callbacks FROM PUBLIC, anon, authenticated, service_role, fm_app_runtime, fmt_app_dev, fmt_audit_capture_dev, fmt_audit_worker_dev;
SELECT true AS notifications_expansion_created;
COMMIT;
