// Offline metadata generation only. No environment, clients, network or SQL execution.
import { createRequire } from 'node:module';
import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core';
const { generateDrizzleJson, generateMigration } = createRequire(import.meta.url)('drizzle-kit/api');
const dialect = new PgDialect();

export function serviceReminderMessageContract(schema) {
  const table = getTableConfig(schema.services);
  const column = table.columns.find(value => value.name === 'reminder_message');
  const constraint = table.checks.find(value => value.name === 'services_reminder_message_check');
  const query = dialect.sqlToQuery(constraint.value);
  if (query.params.length) throw new Error('Parameterized reminder constraint');
  return { version: 'service-reminder-message-v1', column: { name: column.name, type: column.getSQLType(), notNull: column.notNull, default: column.default },
    constraint: { name: constraint.name, expression: query.sql.replaceAll('"services".', '') } };
}

export async function serviceReminderMessageDDL(schema) {
  const current = generateDrizzleJson({ services: schema.services });
  for (const table of Object.values(current.tables)) table.schema = 'public';
  const previous = structuredClone(current), table = previous.tables['public.services'];
  delete table.columns.reminder_message;
  delete table.checkConstraints.services_reminder_message_check;
  return (await generateMigration(previous, current)).join('\n');
}

export async function serviceReminderMessageMigration(schema) {
  return `-- TASK-049 custom service reminder message expansion. PREPARED ONLY; NOT APPLIED.
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
${await serviceReminderMessageDDL(schema)}
-- END GENERATED SERVICE REMINDER MESSAGE DDL
COMMIT;
`;
}
