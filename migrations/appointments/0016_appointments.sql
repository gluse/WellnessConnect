-- Group appointments expansion. PREPARED ONLY; never applied by this script.
-- Apply separately with a reviewed postgres PG17 connection, stop on any error.
BEGIN;
SET TRANSACTION READ WRITE;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL idle_in_transaction_session_timeout='60s';
SET LOCAL search_path=pg_catalog,pg_temp;
DO $appointments$ BEGIN
 IF current_user<>session_user OR current_user<>'postgres'
 OR current_setting('server_version_num')::integer/10000<>17
 OR (SELECT count(*) FROM pg_catalog.pg_roles WHERE rolname IN
 ('fm_app_runtime','fmt_app_dev','fmt_audit_capture_dev','fmt_audit_worker_dev','anon','authenticated','service_role'))<>7
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relname=ANY(ARRAY['booking_messages','booking_reschedule_requests']::text[]))
 THEN RAISE EXCEPTION 'Appointments expansion preconditions failed; inspect target and do not retry blindly'; END IF;
END $appointments$;
-- BEGIN GENERATED APPOINTMENTS DDL
CREATE TABLE "public"."booking_messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"author_id" varchar NOT NULL,
	"author_role" varchar NOT NULL,
	"body" text NOT NULL,
	"client_request_id" uuid NOT NULL,
	"broadcast_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_message_shape" CHECK ("booking_messages"."author_role" IN ('provider','customer') AND length(trim("booking_messages"."body")) BETWEEN 1 AND 4000 AND length("booking_messages"."body") <= 4000 AND ("booking_messages"."broadcast_id" IS NULL OR "booking_messages"."author_role" = 'provider'))
);

ALTER TABLE "public"."booking_messages" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "public"."booking_reschedule_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"requested_by_id" varchar NOT NULL,
	"requested_by_role" varchar NOT NULL,
	"original_scheduled_date" timestamp with time zone NOT NULL,
	"proposed_scheduled_date" timestamp with time zone NOT NULL,
	"fallback" varchar NOT NULL,
	"state" varchar DEFAULT 'pending' NOT NULL,
	"batch_id" uuid,
	"client_request_id" uuid NOT NULL,
	"note" text,
	"timezone" varchar(100) DEFAULT 'UTC' NOT NULL,
	"base_revision" integer NOT NULL,
	"responded_by_id" varchar,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_reschedule_shape" CHECK ("booking_reschedule_requests"."requested_by_role" IN ('provider','customer') AND "booking_reschedule_requests"."fallback" IN ('keep_original','cancel_booking') AND "booking_reschedule_requests"."state" IN ('pending','accepted','declined','withdrawn','superseded') AND "booking_reschedule_requests"."base_revision" >= 0 AND length(trim("booking_reschedule_requests"."timezone")) BETWEEN 1 AND 100 AND ("booking_reschedule_requests"."note" IS NULL OR length("booking_reschedule_requests"."note") <= 2000) AND "booking_reschedule_requests"."original_scheduled_date" <> "booking_reschedule_requests"."proposed_scheduled_date" AND ("booking_reschedule_requests"."batch_id" IS NULL OR "booking_reschedule_requests"."requested_by_role" = 'provider')),
	CONSTRAINT "booking_reschedule_response_shape" CHECK (("booking_reschedule_requests"."state" <> 'pending' OR ("booking_reschedule_requests"."responded_at" IS NULL AND "booking_reschedule_requests"."responded_by_id" IS NULL)) AND (("booking_reschedule_requests"."state" <> 'accepted' AND "booking_reschedule_requests"."state" <> 'declined') OR ("booking_reschedule_requests"."responded_at" IS NOT NULL AND "booking_reschedule_requests"."responded_by_id" IS NOT NULL)) AND ("booking_reschedule_requests"."responded_at" IS NULL OR "booking_reschedule_requests"."responded_at" >= "booking_reschedule_requests"."created_at"))
);

ALTER TABLE "public"."booking_reschedule_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."bookings" ADD COLUMN "closed_at" timestamp with time zone;
ALTER TABLE "public"."booking_messages" ADD CONSTRAINT "booking_messages_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "public"."booking_messages" ADD CONSTRAINT "booking_messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "public"."booking_reschedule_requests" ADD CONSTRAINT "booking_reschedule_requests_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "public"."booking_reschedule_requests" ADD CONSTRAINT "booking_reschedule_requests_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "public"."booking_reschedule_requests" ADD CONSTRAINT "booking_reschedule_requests_responded_by_id_users_id_fk" FOREIGN KEY ("responded_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
CREATE UNIQUE INDEX "booking_message_request_identity" ON "public"."booking_messages" USING btree ("author_id","client_request_id","booking_id");
CREATE INDEX "booking_message_history_idx" ON "public"."booking_messages" USING btree ("booking_id","created_at","id");
CREATE INDEX "booking_message_broadcast_idx" ON "public"."booking_messages" USING btree ("broadcast_id") WHERE "booking_messages"."broadcast_id" IS NOT NULL;
CREATE UNIQUE INDEX "booking_reschedule_pending_identity" ON "public"."booking_reschedule_requests" USING btree ("booking_id") WHERE "booking_reschedule_requests"."state" = 'pending';
CREATE UNIQUE INDEX "booking_reschedule_request_identity" ON "public"."booking_reschedule_requests" USING btree ("requested_by_id","client_request_id","booking_id");
CREATE INDEX "booking_reschedule_history_idx" ON "public"."booking_reschedule_requests" USING btree ("booking_id","created_at","id");
CREATE INDEX "booking_reschedule_batch_idx" ON "public"."booking_reschedule_requests" USING btree ("batch_id") WHERE "booking_reschedule_requests"."batch_id" IS NOT NULL;
CREATE INDEX "bookings_message_retention_idx" ON "public"."bookings" USING btree ("closed_at","id") WHERE "bookings"."closed_at" IS NOT NULL AND "bookings"."status" IN ('cancelled','completed');
ALTER TABLE "public"."bookings" ADD CONSTRAINT "bookings_closed_at_check" CHECK ("bookings"."closed_at" IS NULL OR "bookings"."status" IN ('cancelled','completed'));
-- END GENERATED APPOINTMENTS DDL
-- Existing closed reservations predate message history. Anchor them at migration
-- time conservatively, never guess a closure instant from timezone-less legacy
-- updated_at or allow an early content purge. New terminal transitions snapshot
-- the actual closure time in application code; later payment updates preserve it.
UPDATE public.bookings SET closed_at=statement_timestamp()
WHERE status IN ('cancelled','completed') AND closed_at IS NULL;
REVOKE ALL ON TABLE public.booking_messages FROM PUBLIC, anon, authenticated, service_role, fm_app_runtime, fmt_app_dev, fmt_audit_capture_dev, fmt_audit_worker_dev;
REVOKE ALL ON TABLE public.booking_reschedule_requests FROM PUBLIC, anon, authenticated, service_role, fm_app_runtime, fmt_app_dev, fmt_audit_capture_dev, fmt_audit_worker_dev;
DO $privacy$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_class c,
  LATERAL pg_catalog.aclexplode(coalesce(c.relacl,pg_catalog.acldefault('r',c.relowner))) a
  WHERE c.relnamespace='public'::regnamespace AND c.relname IN ('booking_messages','booking_reschedule_requests') AND a.grantee<>c.relowner)
 THEN RAISE EXCEPTION 'Unexpected appointments default privileges; inspect target before retry'; END IF;
END $privacy$;
SELECT true AS appointments_expansion_created;
COMMIT;
