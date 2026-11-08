// Read-only injected metadata guard. No environment/client/query on import.
import profile from './schema-contract.json' with { type: 'json' };
export const canonicalServiceReminderMessageExpression = value => value.replace(/"services"\./g, '').replace(/\bpg_catalog\./g, '').replace(/[\s()\"]/g, '').toLowerCase();
export const SERVICE_REMINDER_MESSAGE_READINESS_SQL = `SELECT
 EXISTS(SELECT 1 FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
 WHERE a.attrelid='public.services'::regclass AND a.attname='reminder_message' AND NOT a.attisdropped AND a.attnotnull
 AND pg_catalog.format_type(a.atttypid,a.atttypmod)='text'
 AND pg_catalog.pg_get_expr(d.adbin,d.adrelid)=$3) AS service_reminder_message_column,
 EXISTS(SELECT 1 FROM pg_catalog.pg_constraint c WHERE c.conrelid='public.services'::regclass AND c.conname=$1
 AND c.contype='c' AND c.convalidated AND NOT c.connoinherit
 AND lower(regexp_replace(replace(pg_catalog.pg_get_expr(c.conbin,c.conrelid), 'pg_catalog.', ''), '[[:space:]()"]', '', 'g'))=$2) AS service_reminder_message_constraint`;
export const SERVICE_REMINDER_MESSAGE_READINESS_KEYS = Object.freeze(['service_reminder_message_column', 'service_reminder_message_constraint']);
export const serviceReminderMessageReadinessArguments = () => [profile.constraint.name, canonicalServiceReminderMessageExpression(profile.constraint.expression), "''::text"];
export class ServiceReminderMessageDatabaseReadinessError extends Error {
 code = 'SERVICE_REMINDER_MESSAGE_DB_NOT_READY';
 constructor(checks) { super('SERVICE_REMINDER_MESSAGE_DB_NOT_READY'); this.checks = checks; }
}
export function assertServiceReminderMessageReadiness(rows) {
 const shape=Array.isArray(rows)&&rows.length===1&&rows[0]&&typeof rows[0]==='object'&&Object.keys(rows[0]).length===SERVICE_REMINDER_MESSAGE_READINESS_KEYS.length;
 if(!shape||SERVICE_REMINDER_MESSAGE_READINESS_KEYS.some(key=>rows[0][key]!==true)) throw new ServiceReminderMessageDatabaseReadinessError(shape?SERVICE_REMINDER_MESSAGE_READINESS_KEYS.filter(key=>rows[0][key]!==true):['readiness_result_shape']);
}
export async function verifyServiceReminderMessageDatabaseReadiness(query) {
 let rows;
 try { ({ rows } = await query(SERVICE_REMINDER_MESSAGE_READINESS_SQL, serviceReminderMessageReadinessArguments())); }
 catch { throw new ServiceReminderMessageDatabaseReadinessError(['metadata_query']); }
 assertServiceReminderMessageReadiness(rows);
}
