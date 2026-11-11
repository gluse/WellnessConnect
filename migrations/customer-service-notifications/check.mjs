// Offline schema/SQL parity and injected startup-guard regressions. No DB clients.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core';
import { searchPageSQL } from '../../server/search-pagination/query.ts';
import * as schema from '../../shared/schema.ts';
import { customerNotificationDDL, customerNotificationMigration, customerNotificationRuntimeContract, CUSTOMER_NOTIFICATION_RIGHTS } from './contract.mjs';
import { CUSTOMER_NOTIFICATION_APPLICATION_READINESS_SQL, CUSTOMER_NOTIFICATION_APPLICATION_READINESS_KEYS, customerNotificationApplicationReadinessArguments,
  assertCustomerServiceNotificationDatabaseReadiness, verifyCustomerServiceNotificationDatabaseReadiness } from './application-readiness.mjs';
const migration = await readFile(new URL('./0024_customer_service_notifications.sql', import.meta.url), 'utf8');
const activation = await readFile(new URL('./0025_customer_service_notifications_runtime.sql', import.meta.url), 'utf8');
const manifest = JSON.parse(await readFile(new URL('./runtime-contract.json', import.meta.url), 'utf8'));
assert.equal(migration, await customerNotificationMigration(schema));
assert.deepEqual(manifest, customerNotificationRuntimeContract(schema));
const ddl = await customerNotificationDDL(schema);
assert.equal((ddl.match(/CREATE TABLE /g) || []).length, 1);
assert.equal((ddl.match(/ADD CONSTRAINT /g) || []).length, 4);
assert.doesNotMatch(ddl, /DROP |ALTER (?:TABLE|TYPE) "public"\."(?!(?:customer_service_notifications|services)")/);
assert.match(ddl, /ALTER TABLE "public"\."services" ADD COLUMN "deleted_at" timestamp with time zone/);
assert.match(ddl, /ADD CONSTRAINT "services_deleted_inactive_check" CHECK \("services"\."deleted_at" IS NULL OR "services"\."is_active" IS FALSE\)/);
assert.equal(manifest.columns.length, 9);
assert.equal(manifest.constraints.length, 7);
assert.equal(manifest.indexes.length, 5);
assert.equal(getTableConfig(schema.customerServiceNotifications).enableRLS, true);
assert.deepEqual(manifest.columns.find(column => column.table === 'services' && column.name === 'deleted_at'), { table: 'services', name: 'deleted_at', type: 'timestamp with time zone', notNull: false, default: null });
assert.equal(schema.insertServiceSchema.partial().parse({ deletedAt: new Date() }).deletedAt, undefined, 'Untrusted service input cannot set or clear the deletion marker');
assert.equal(manifest.columns.find(column => column.name === 'created_at').default, 'now()');
for (const name of ['created_at','expires_at','read_at']) assert.equal(manifest.columns.find(column => column.name === name).type, 'timestamp with time zone');
const fields = manifest.constraints.find(constraint => constraint.name === 'customer_service_notification_fields_check').expression;
assert.ok(fields.includes('jsonb_typeofchanged_fields=\'array\''));
assert.ok(fields.includes('jsonb_array_lengthchanged_fields>=1'));
assert.ok(fields.includes('jsonb_array_lengthchanged_fields<=18'));
assert.ok(fields.includes('changed_fields<@'));
assert.doesNotMatch(fields, /reminderMessage|phone|email|firstName|lastName/i);
assert.ok(manifest.constraints.some(constraint => constraint.name === 'customer_service_notification_retention_check' && constraint.expression.includes("2160:00:00")));
for (const sql of [migration, activation]) {
  assert.match(sql, /lock_timeout='5s'/);
  assert.match(sql, /statement_timeout='60s'/);
  assert.match(sql, /current_user<>session_user OR current_user<>'postgres'/);
  assert.match(sql, /server_version_num.*<>17/);
  assert.doesNotMatch(sql, /DROP |DISABLE |session_replication_role|CREATE (?:FUNCTION|TRIGGER)|\b(?:INSERT INTO|UPDATE|DELETE FROM) public\./i);
  assert.ok(sql.endsWith('COMMIT;\n'));
}
assert.match(migration, /REVOKE ALL ON TABLE public.customer_service_notifications FROM PUBLIC, anon, authenticated, service_role, fm_app_runtime, fmt_app_dev, fmt_audit_capture_dev, fmt_audit_worker_dev/);
assert.doesNotMatch(migration, /GRANT /);
assert.match(activation, /GRANT SELECT,INSERT,UPDATE,DELETE ON public.customer_service_notifications TO fm_app_runtime/);
assert.equal((activation.match(/CREATE POLICY/g) || []).length, 1);
assert.match(activation, /FOR ALL TO fm_app_runtime USING\(true\) WITH CHECK\(true\)/);
assert.doesNotMatch(activation, /GRANT .* TO (?:PUBLIC|anon|authenticated|service_role)/);
const args = customerNotificationApplicationReadinessArguments();
assert.equal(args.length, 7);
const rights = JSON.parse(args[0]);
assert.equal(rights.length, 42);
assert.equal(new Set(rights.map(table => table.name)).size, 42);
assert.deepEqual(rights.find(table => table.name === 'customer_service_notifications'), CUSTOMER_NOTIFICATION_RIGHTS);
assert.deepEqual(JSON.parse(args[6]), manifest);
assert.match(CUSTOMER_NOTIFICATION_APPLICATION_READINESS_SQL, /customer_notice_profile AS \(SELECT \$7::jsonb/);
assert.match(CUSTOMER_NOTIFICATION_APPLICATION_READINESS_SQL, /fmt_customer_notice_server/);
assert.match(CUSTOMER_NOTIFICATION_APPLICATION_READINESS_SQL, /customer_notice_private_acl/);
assert.match(CUSTOMER_NOTIFICATION_APPLICATION_READINESS_SQL, /expected_table_count/);
const good = Object.fromEntries(CUSTOMER_NOTIFICATION_APPLICATION_READINESS_KEYS.map(key => [key, true]));
await verifyCustomerServiceNotificationDatabaseReadiness(async (sql, values) => {
  assert.equal(sql, CUSTOMER_NOTIFICATION_APPLICATION_READINESS_SQL);
  assert.deepEqual(values, args);
  return { rows: [good] };
});
for (const key of CUSTOMER_NOTIFICATION_APPLICATION_READINESS_KEYS) assert.throws(() => assertCustomerServiceNotificationDatabaseReadiness([{ ...good, [key]: false }]), error => error.code === 'CUSTOMER_SERVICE_NOTIFICATION_DB_NOT_READY' && error.checks[0] === key);
for (const rows of [[], [good,good], [{}], null, [{ ...good, extra: 'private' }], [{ ...good, customer_notice_columns: 1 }]]) assert.throws(() => assertCustomerServiceNotificationDatabaseReadiness(rows));
await assert.rejects(verifyCustomerServiceNotificationDatabaseReadiness(async () => { throw new Error('private://secret@target'); }), error => error.code === 'CUSTOMER_SERVICE_NOTIFICATION_DB_NOT_READY' && error.checks[0] === 'metadata_query' && !JSON.stringify(error).includes('secret'));
const dialect = new PgDialect();
const plain = dialect.sqlToQuery(searchPageSQL({ filters: {}, sort: 'default', limit: 24 }));
assert.match(plain.sql, /s\.deleted_at IS NULL/);
assert.doesNotMatch(plain.sql, /public\.availability/);
for (const filters of [
  { availableOnly: true, date: '2026-11-11' },
  { availableOnly: true, date: '2026-11-11', dateEnd: '2026-11-18', time: '09:00', timeEnd: '10:30' },
]) {
  const query = dialect.sqlToQuery(searchPageSQL({ filters, sort: 'default', limit: 24 }));
  assert.ok(!query.sql.includes(filters.date) && query.params.includes(filters.date), 'Calendar inputs remain bound parameters');
  assert.match(query.sql, /recurrence_end_type IS DISTINCT FROM 'on_date'.*to_char\(day,'YYYY-MM-DD'\)<=left\(av\.recurrence_end_value,10\)/);
  assert.match(query.sql, /recurrence_end_type IS DISTINCT FROM 'after_events'/);
  assert.match(query.sql, /sw\.service_id=s\.id AND sw\.schedule_type='recurring'/);
  assert.match(query.sql, /sv\.service_id=s\.id AND sv\.schedule_type='specific' AND sv\.specific_date::date=day::date/);
  assert.match(query.sql, /gv\.service_id IS NULL AND gv\.schedule_type='specific'/);
  assert.match(query.sql, /point>=sw\.start_time AND point<sw\.end_time/);
  assert.match(query.sql, /point>=av\.start_time AND point<av\.end_time/);
  assert.equal(query.params.at(-1), 25, 'Schedule filtering precedes bounded ranking');
}
console.log('PASS: customer notifications ORM/DDL parity, recipient FKs/indexes, bounded field-only payload/90-day retention, restricted activation and strict current42 injected readiness; no SQL executed.');
