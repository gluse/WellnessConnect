-- TASK-048 service photo expansion. PREPARED ONLY; NOT APPLIED.
-- Stop service writers through application cutover. New target/recovery approval required.
BEGIN;
SET TRANSACTION READ WRITE;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL idle_in_transaction_session_timeout='60s';
SET LOCAL search_path=pg_catalog,pg_temp;
DO $photos$ BEGIN
 IF current_user<>session_user OR current_user<>'postgres'
 OR current_setting('server_version_num')::integer/10000<>17
 OR (SELECT count(*) FROM pg_catalog.pg_class WHERE relnamespace='public'::regnamespace AND relkind IN('r','p'))<>41
 OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class WHERE oid='public.services'::regclass AND relowner='postgres'::regrole AND relrowsecurity)
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='public.services'::regclass AND attname='image_urls' AND NOT attisdropped)
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.services'::regclass AND conname IN('services_image_urls_shape_check','services_image_urls_cover_check'))
 OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE t.tgrelid='public.services'::regclass AND t.tgname='fmt_audit_record_changed' AND t.tgenabled='O' AND n.nspname='audit_capture' AND p.proname='business_record_changed' AND p.pronargs=0 AND p.prorettype='pg_catalog.trigger'::regtype)
 THEN RAISE EXCEPTION 'Service photo preconditions failed; inspect and do not retry'; END IF;
END $photos$;
LOCK TABLE public.services IN ACCESS EXCLUSIVE MODE;
-- BEGIN GENERATED SERVICE PHOTO DDL
ALTER TABLE "public"."services" ADD COLUMN "image_urls" text[] DEFAULT ARRAY[]::text[] NOT NULL;
ALTER TABLE "public"."services" ADD CONSTRAINT "services_image_urls_shape_check" CHECK (cardinality("services"."image_urls") <= 10 AND (cardinality("services"."image_urls") = 0 OR (array_ndims("services"."image_urls") = 1 AND array_lower("services"."image_urls", 1) = 1)) AND array_position("services"."image_urls", NULL) IS NULL AND NOT ('' = ANY("services"."image_urls")));
ALTER TABLE "public"."services" ADD CONSTRAINT "services_image_urls_cover_check" CHECK (cardinality("services"."image_urls") = 0 OR ("services"."image_url" IS NOT NULL AND "services"."image_url" = "services"."image_urls"[1]));
-- END GENERATED SERVICE PHOTO DDL
-- Preserve cover/other service fields. Existing audit trigger stays enabled;
-- one redacted image_urls field-change event is captured per backfilled service.
UPDATE public.services SET image_urls=ARRAY[image_url] WHERE image_url IS NOT NULL AND image_url<>'';
SELECT count(*)::integer AS legacy_images_backfilled FROM public.services WHERE cardinality(image_urls)=1;
COMMIT;
