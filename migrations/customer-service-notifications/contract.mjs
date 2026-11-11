// Offline ORM/DDL preparation. No environment, connections or SQL execution.
import { createRequire } from 'node:module';
import { canonicalNotificationExpression } from '../notifications/normalize-expression.mjs';
const { generateDrizzleJson, generateMigration } = createRequire(import.meta.url)('drizzle-kit/api');
export const CUSTOMER_NOTIFICATION_TABLE = 'customer_service_notifications';
export const CUSTOMER_NOTIFICATION_RIGHTS = Object.freeze({ name: CUSTOMER_NOTIFICATION_TABLE, rights: Object.freeze(['SELECT','INSERT','UPDATE','DELETE']) });
export function customerNotificationSnapshots(schema) {
  const current = generateDrizzleJson(schema);
  for (const table of Object.values(current.tables)) table.schema = 'public';
  const previous = structuredClone(current);
  delete previous.tables['public.' + CUSTOMER_NOTIFICATION_TABLE];
  delete previous.tables['public.services'].columns.deleted_at;
  delete previous.tables['public.services'].checkConstraints.services_deleted_inactive_check;
  return { previous, current };
}
export async function customerNotificationDDL(schema) {
  const { previous, current } = customerNotificationSnapshots(schema);
  return (await generateMigration(previous, current)).join('\n');
}
export function customerNotificationRuntimeContract(schema) {
  const { current } = customerNotificationSnapshots(schema);
  const name = CUSTOMER_NOTIFICATION_TABLE, table = current.tables['public.' + name];
  const columns = Object.values(table.columns).map(column => ({ table: name, name: column.name,
    type: column.type.replace(/^varchar/, 'character varying'), notNull: column.notNull, default: column.default === undefined ? null : String(column.default) }));
  const deleted = current.tables['public.services'].columns.deleted_at;
  columns.push({ table: 'services', name: deleted.name, type: deleted.type, notNull: deleted.notNull, default: null });
  const constraints = Object.values(table.checkConstraints).map(check => ({ table: name, name: check.name, type: 'c', expression: canonicalNotificationExpression(check.value) }));
  const deletedCheck = current.tables['public.services'].checkConstraints.services_deleted_inactive_check;
  constraints.push({ table: 'services', name: deletedCheck.name, type: 'c', expression: canonicalNotificationExpression(deletedCheck.value) });
  const primary = Object.values(table.columns).filter(column => column.primaryKey).map(column => column.name);
  constraints.push({ table: name, name: name + '_pkey', type: 'p', columns: primary });
  for (const fk of Object.values(table.foreignKeys)) constraints.push({ table: name, name: fk.name, type: 'f', columns: fk.columnsFrom,
    referenceTable: fk.tableTo, referenceColumns: fk.columnsTo, onDelete: fk.onDelete === 'cascade' ? 'c' : 'a' });
  const indexes = [{ table: name, name: name + '_pkey', unique: true, columns: primary, predicate: null },
    ...Object.values(table.indexes).map(index => ({ table: name, name: index.name, unique: index.isUnique, columns: index.columns.map(column => column.expression), predicate: canonicalNotificationExpression(index.where ?? null) }))];
  return { version: 'customer-service-notifications-v1', tables: [name], columns, constraints, indexes };
}
export async function customerNotificationMigration(schema) {
  return `-- Customer listing-change notifications. PREPARED ONLY; NOT APPLIED.
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
${await customerNotificationDDL(schema)}
-- END GENERATED CUSTOMER NOTIFICATION DDL
REVOKE ALL ON TABLE public.customer_service_notifications FROM PUBLIC, anon, authenticated, service_role, fm_app_runtime, fmt_app_dev, fmt_audit_capture_dev, fmt_audit_worker_dev;
DO $privacy$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_class c,
 LATERAL pg_catalog.aclexplode(coalesce(c.relacl,pg_catalog.acldefault('r',c.relowner))) a
 WHERE c.oid='public.customer_service_notifications'::regclass AND a.grantee<>c.relowner)
 THEN RAISE EXCEPTION 'Unexpected customer notification default privileges; inspect before retry'; END IF;
END $privacy$;
COMMIT;
`;
}
