import assert from 'node:assert/strict';
import { NativeProofClient, safeUser, validateHandoff } from '../../client/src/native/client.ts';

const id = '11111111-1111-4111-8111-111111111111';
const callback = `https://app.fitsmytime.example/native/auth-return?attemptId=${id}&code=${'A'.repeat(43)}`;
assert.equal(validateHandoff(callback), callback);
for (const invalid of [callback + '&unexpected=1', callback + '&attemptId=' + id, callback + '&code=' + 'B'.repeat(43), callback.replace('attemptId=', 'other='), callback.replace('code=', 'other=')]) {
  assert.throws(() => validateHandoff(invalid), error => error.code === 'invalid_handoff');
}
for (const [userId, displayName] of [['proof-alice', 'Alice (synthetic)'], ['proof-bob', 'Bob (synthetic)']]) {
  const user = { id: userId, displayName };
  assert.deepEqual(safeUser(user), user);
  for (const invalid of [null, undefined, false, 0, {}, [], new String(displayName), displayName + ' altered']) {
    assert.throws(() => safeUser({ id: userId, displayName: invalid }), error => error.code === 'invalid_response');
  }
}
for (const invalid of [{ id: 'other', displayName: 'Alice (synthetic)' }, { id: 'proof-alice', displayName: 'Alice (synthetic)', credential: 'synthetic' }]) {
  assert.throws(() => safeUser(invalid), error => error.code === 'invalid_response');
}
const browserUrl = `https://api.fitsmytime.example/api/native-proof/browser/start?attemptId=${id}`;
for (const [url, accepted] of [[browserUrl, true], [browserUrl + '&unexpected=1', false], [browserUrl + '&attemptId=' + id, false], [browserUrl.replace(id, '22222222-2222-4222-8222-222222222222'), false]]) {
  const attempt = { attemptId: id, browserUrl: url, expiresAt: '2027-01-01T00:00:00Z' };
  const client = new NativeProofClient({ beginLogin: async () => attempt });
  if (accepted) assert.deepEqual(await client.beginLogin(), attempt);
  else await assert.rejects(() => client.beginLogin(), error => error.code === 'invalid_destination');
}
console.log('Passed native type-compatibility behavior: exact callback/query acceptance, duplicate/extra rejection, synthetic user string validation and browser attempt binding. No app/database/network/bridge operations.');
