// Offline metadata/generation only. No settings, network, database or SQL execution.
import { createRequire } from 'node:module';
import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core';
const { generateDrizzleJson, generateMigration } = createRequire(import.meta.url)('drizzle-kit/api');
const dialect = new PgDialect();
export function photoSchemaContract(schema) {
  const table = getTableConfig(schema.services);
  const column = table.columns.find(value => value.name === 'image_urls');
  const checks = table.checks.filter(value => value.name.startsWith('services_image_urls_'));
  return { version: 'service-photos-v1', column: { name: column.name, type: column.getSQLType(), notNull: column.notNull, default: dialect.sqlToQuery(column.default).sql },
    constraints: checks.map(value => { const query = dialect.sqlToQuery(value.value); if (query.params.length) throw new Error('Parameterized photo constraint'); return { name: value.name, expression: query.sql.replaceAll('"services".', '') }; }) };
}
export async function photoDDL(schema) {
  const current = generateDrizzleJson({ services: schema.services });
  for (const table of Object.values(current.tables)) table.schema = 'public';
  const previous = structuredClone(current), table = previous.tables['public.services'];
  delete table.columns.image_urls;
  for (const name of Object.keys(table.checkConstraints)) if (name.startsWith('services_image_urls_')) delete table.checkConstraints[name];
  return (await generateMigration(previous, current)).join('\n');
}
export async function photoMigration(schema) {
  return `-- TASK-048 service photo expansion. PREPARED ONLY; NOT APPLIED.
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
${await photoDDL(schema)}
-- END GENERATED SERVICE PHOTO DDL
-- Preserve cover/other service fields. Existing audit trigger stays enabled;
-- one redacted image_urls field-change event is captured per backfilled service.
UPDATE public.services SET image_urls=ARRAY[image_url] WHERE image_url IS NOT NULL AND image_url<>'';
SELECT count(*)::integer AS legacy_images_backfilled FROM public.services WHERE cardinality(image_urls)=1;
COMMIT;
`;
}
