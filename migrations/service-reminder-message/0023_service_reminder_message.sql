-- TASK-049 custom service reminder message expansion. PREPARED ONLY; NOT APPLIED.
-- Apply after 0022 only with target-specific execution/recovery approval.
-- Stop app/notification writers before migration and keep stopped through cutover.
BEGIN;
SET TRANSACTION READ WRITE;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL idle_in_transaction_session_timeout='60s';
SET LOCAL search_path=pg_catalog,pg_temp;
DO $reminder$ BEGIN
 IF current_user<>session_user OR current_user<>'postgres'
 OR current_setting('server_version_num')::integer/10000<>17
 OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class WHERE oid='public.services'::regclass AND relowner='postgres'::regrole AND relrowsecurity)
 OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='public.services'::regclass AND attname='image_urls' AND NOT attisdropped)
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='public.services'::regclass AND attname='reminder_message' AND NOT attisdropped)
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.services'::regclass AND conname='services_reminder_message_check')
 THEN RAISE EXCEPTION 'Service reminder message preconditions failed; inspect and do not retry'; END IF;
END $reminder$;
LOCK TABLE public.services IN ACCESS EXCLUSIVE MODE;
-- BEGIN GENERATED SERVICE REMINDER MESSAGE DDL
ALTER TABLE "public"."services" ADD COLUMN "reminder_message" text DEFAULT '' NOT NULL;
ALTER TABLE "public"."services" ADD CONSTRAINT "services_reminder_message_check" CHECK (char_length("services"."reminder_message") <= 1000);
-- END GENERATED SERVICE REMINDER MESSAGE DDL
COMMIT;
