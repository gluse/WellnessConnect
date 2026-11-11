// Receipt/endpoint guards only. No subprocesses, private configuration or DB.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { main, localConnection, EXECUTION_FLAG } from './execute-local.mjs';
const parent = fs.realpathSync(os.tmpdir());
const directory = fs.mkdtempSync(path.join(parent, 'fmt-customer-notification-receipt-'));
assert.ok(path.resolve(directory).startsWith(parent + path.sep));
const filename = path.join(directory, 'local-database-migration-attempt.json');
const previous = Buffer.from(JSON.stringify({ state: 'stopped', migrations: [{ file: '0024_customer_service_notifications.sql', committed: true }], retry: false }) + '\n');
fs.writeFileSync(filename, previous, { flag: 'wx' });
let privateReads = 0, stoppedChecks = 0;
const originalWrite = process.stdout.write;
let output = '';
try {
  process.stdout.write = value => { output += value; return true; };
  const result = await main([EXECUTION_FLAG], { attemptDirectory: directory, checkStopped() { stoppedChecks++; },
    readEnvironment() { privateReads++; throw new Error('PRIVATE_READ_MUST_NOT_OCCUR'); } });
  assert.equal(result, 1);
  assert.equal(stoppedChecks, 1);
  assert.equal(privateReads, 0);
  assert.deepEqual(fs.readFileSync(filename), previous, 'Duplicate attempt must preserve exact previous commit/attempt history');
  assert.equal(JSON.parse(output).code, 'EEXIST');
  assert.equal(JSON.parse(output).retry, false);
  const approved = localConnection('postgresql://postgres:synthetic-password@127.0.0.1:15422/postgres', 'postgres');
  assert.equal(approved.host, '127.0.0.1'); assert.equal(approved.port, 15422); assert.equal(approved.ssl, false);
  for (const uri of ['postgresql://postgres:p@127.0.0.1:15432/postgres', 'postgresql://postgres:p@localhost:15422/postgres',
    'postgresql://postgres:p@db.example.com:15422/postgres', 'postgresql://postgres:p@127.0.0.1:15422/other',
    'postgresql://supabase_admin:p@127.0.0.1:15422/postgres', 'postgresql://postgres:p@127.0.0.1:15422/postgres?options=unsafe']) assert.throws(() => localConnection(uri, 'postgres'));
} finally {
  process.stdout.write = originalWrite;
  assert.ok(path.resolve(directory).startsWith(parent + path.sep) && path.basename(directory).startsWith('fmt-customer-notification-receipt-'));
  fs.rmSync(directory, { recursive: true });
}
console.log('PASS: duplicate one-shot attempt preserves prior receipt byte-for-byte without private reads/subprocesses/connections; exact local endpoint/principal guards reject alternate targets.');
