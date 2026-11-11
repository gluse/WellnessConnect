// One read-only operational health inspection. No outbox/payload access or claims.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, client, connect, requireThat, safeCode } from '../migrations/audit/runtime-support.mjs';
import { readRestrictedWorkerDiagnosticInput } from './aws-publish-db-preflight-2026-11-09.mjs';
export const AUTHORIZATION = 'TASK-036-AUDIT-HEALTH-2026-11-09';
// Root concluded live worker metrics are sufficient and explicitly held DB queries.
// A separate reviewed investigation must release this; a CLI token is not approval.
export const CONNECTED_EXECUTION_RELEASED = false;
export const HEALTH_SQL = `SELECT status,event_count::text AS event_count,oldest_created_at,oldest_occurred_at,
 max_attempts::text AS max_attempts,earliest_next_attempt_at,expired_count::text AS expired_count
 FROM audit_capture.delivery_health ORDER BY status LIMIT 5`;
const emit = value => process.stdout.write(JSON.stringify(value) + '\n');
export function sanitizeHealth(rows) {
  requireThat(Array.isArray(rows) && rows.length <= 4, 'HEALTH_SHAPE_CHANGED');
  const statuses = new Set();
  const integer = value => { const text = String(value); requireThat(/^\d{1,19}$/.test(text) && BigInt(text) <= 9223372036854775807n, 'HEALTH_COUNT_CHANGED'); return text; };
  const timestamp = value => {
    const date = value instanceof Date ? value : new Date(value);
    requireThat(value != null && Number.isFinite(date.getTime()), 'HEALTH_TIMESTAMP_CHANGED'); return date.toISOString();
  };
  return rows.map(row => {
    requireThat(['pending', 'leased', 'delivered', 'quarantined'].includes(row.status) && !statuses.has(row.status), 'HEALTH_STATUS_CHANGED'); statuses.add(row.status);
    const eventCount = integer(row.event_count), expiredCount = integer(row.expired_count);
    requireThat(BigInt(eventCount) > 0n && BigInt(expiredCount) <= BigInt(eventCount), 'HEALTH_COUNT_CHANGED');
    return { status: row.status, eventCount, oldestCreatedAt: timestamp(row.oldest_created_at), oldestOccurredAt: timestamp(row.oldest_occurred_at),
      maxAttempts: integer(row.max_attempts), earliestNextAttemptAt: timestamp(row.earliest_next_attempt_at), expiredCount };
  });
}
export async function inspect(input, open = client, establish = connect) {
  const x = await open(input.value, 'source', input.ca, 'fmt_audit_worker_dev');
  try {
    await establish(x);
    await x.query('BEGIN TRANSACTION READ ONLY');
    const rows = (await x.query(`SELECT current_user AS principal,current_user=session_user AS same_principal,
      current_setting('server_version_num')::integer/10000=17 AS expected_version,
      current_setting('transaction_read_only')='on' AS read_only,rolcanlogin,rolconnlimit
      FROM pg_catalog.pg_roles WHERE rolname=current_user`)).rows;
    requireThat(rows.length === 1 && rows[0].principal === 'fmt_audit_worker_dev' && rows[0].same_principal === true
      && rows[0].expected_version === true && rows[0].read_only === true && rows[0].rolcanlogin === true && rows[0].rolconnlimit === 2, 'RESTRICTED_WORKER_REQUIRED');
    const health = sanitizeHealth((await x.query(HEALTH_SQL)).rows);
    await x.query('COMMIT'); return health;
  } finally { await x.end(); }
}
export async function main(args = process.argv.slice(2)) {
  let stage = 'plan', record, receipt;
  try {
    if (!args.length || (args.length === 1 && args[0] === '--plan')) {
      emit({ authorization: AUTHORIZATION, target: 'hbkooiknruimukkhshrk', principal: 'fmt_audit_worker_dev', source: 'audit_capture.delivery_health',
        maximumStatusRows: 4, readOnly: true, privateRead: false, connected: false, writes: false, claims: false, reasonsAvailable: false }); return 0;
    }
    requireThat(args.length === 2 && args[1] === `--execute-readonly=${AUTHORIZATION}`, 'MODE_REJECTED');
    requireThat(CONNECTED_EXECUTION_RELEASED, 'DIAGNOSTIC_CONNECTED_EXECUTION_NOT_RELEASED');
    const snapshot = path.resolve(ROOT, args[0]);
    requireThat(path.dirname(snapshot) === path.join(ROOT, 'outputs/aws-staging-build') && path.basename(snapshot).startsWith('source-'), 'SNAPSHOT_SCOPE');
    const capacity = JSON.parse(fs.readFileSync(path.join(snapshot, 'db-replacement-capacity-2026-11-09.json'), 'utf8'));
    requireThat(capacity.state === 'passed' && capacity.allConnectionsClosed === true && capacity.newService === 'fitsmytime-staging-20261109'
      && capacity.writes === false && capacity.claims === false, 'REPLACEMENT_CAPACITY_REQUIRED');
    record = { authorization: AUTHORIZATION, executor: '/root/aws_publish_database', source: 'hbkooiknruimukkhshrk', principal: 'fmt_audit_worker_dev',
      startedAt: new Date().toISOString(), stage, state: 'attempted', writes: false, claims: false, retry: false, schemaPreflightRepeated: false };
    receipt = path.join(snapshot, 'audit-backlog-diagnostic-2026-11-09.json');
    fs.writeFileSync(path.join(ROOT, 'outputs/aws-staging-build/audit-backlog-diagnostic-2026-11-09-attempt.json'), JSON.stringify(record, null, 2), { flag: 'wx' });
    fs.writeFileSync(receipt, JSON.stringify(record, null, 2), { flag: 'wx' });
    stage = 'private_worker_input'; const input = readRestrictedWorkerDiagnosticInput();
    stage = 'bounded_health_select'; const health = await inspect(input);
    Object.assign(record, { stage: 'complete', state: 'passed', passed: true, completedAt: new Date().toISOString(), allConnectionsClosed: true,
      sourceWorkerUrlSha256: input.sourceWorkerUrlSha256, health, reasonsAvailable: false, newestTimeBoundsAvailable: false });
    fs.writeFileSync(receipt, JSON.stringify(record, null, 2)); emit(record); return 0;
  } catch (error) {
    const result = { stage, passed: false, safeCode: error?.code === 'EEXIST' ? 'ATTEMPT_ALREADY_EXISTS' : safeCode(error), retry: false };
    if (receipt && record && error?.code !== 'EEXIST') fs.writeFileSync(receipt, JSON.stringify({ ...record, ...result, state: 'stopped', completedAt: new Date().toISOString() }, null, 2));
    emit(result); return 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) process.exitCode = await main();
