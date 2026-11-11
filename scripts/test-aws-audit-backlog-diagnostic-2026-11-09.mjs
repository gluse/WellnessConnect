import assert from 'node:assert/strict';
import { HEALTH_SQL, sanitizeHealth, inspect, main } from './aws-audit-backlog-diagnostic-2026-11-09.mjs';
const row = { status: 'quarantined', event_count: '234', oldest_created_at: new Date('2026-11-08T15:20:00Z'), oldest_occurred_at: new Date('2026-11-08T15:19:00Z'),
  max_attempts: '1', earliest_next_attempt_at: new Date('2026-11-08T15:20:00Z'), expired_count: '0', canonical_json: 'private-data-must-not-leak', event_id: 'private-id' };
const result = sanitizeHealth([row]);
assert.equal(result[0].eventCount, '234'); assert(!JSON.stringify(result).includes('private'));
assert.deepEqual(Object.keys(result[0]), ['status', 'eventCount', 'oldestCreatedAt', 'oldestOccurredAt', 'maxAttempts', 'earliestNextAttemptAt', 'expiredCount']);
for (const change of [{ status: 'untrusted' }, { event_count: '-1' }, { event_count: '0' }, { expired_count: '235' }, { oldest_created_at: null }, { max_attempts: 'NaN' }]) assert.throws(() => sanitizeHealth([{ ...row, ...change }]));
assert.throws(() => sanitizeHealth([row, row]));
assert(HEALTH_SQL.includes('FROM audit_capture.delivery_health') && HEALTH_SQL.includes('LIMIT 5'));
assert(!/canonical_json|envelope|event_id|last_error|audit_outbox|claim\(/.test(HEALTH_SQL));
for (const wrongIdentity of [false, true]) {
  let closed = 0; const statements = [];
  const x = { async query(sql) { statements.push(sql);
    if (sql === HEALTH_SQL) return { rows: [row] };
    if (sql.startsWith('SELECT current_user')) return { rows: [{ principal: wrongIdentity ? 'postgres' : 'fmt_audit_worker_dev', same_principal: true, expected_version: true, read_only: true, rolcanlogin: true, rolconnlimit: 2 }] };
    assert(['BEGIN TRANSACTION READ ONLY', 'COMMIT'].includes(sql)); return { rows: [] };
  }, async end() { closed++; } };
  if (wrongIdentity) { await assert.rejects(inspect({}, async () => x, async () => {})); assert(!statements.includes(HEALTH_SQL)); assert(!statements.includes('COMMIT')); }
  else { assert.deepEqual(await inspect({}, async () => x, async () => {}), result); assert.equal(statements.at(-1), 'COMMIT'); }
  assert.equal(closed, 1);
}
assert.equal(await main(['missing', '--execute-readonly=TASK-036-PUBLISH-2026-11-09']), 1);
assert.equal(await main(['missing', '--execute-readonly=TASK-036-AUDIT-HEALTH-2026-11-09']), 1);
console.log(JSON.stringify({ passed: true, boundedHealthOnly: true, payloadsOmitted: true, privateReads: false, connections: false, writes: false }));
