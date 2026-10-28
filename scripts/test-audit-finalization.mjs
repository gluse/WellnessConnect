// Offline lifecycle checks; no private files, connections or ACL writes.
import assert from 'node:assert/strict';
import {requireCompletedCohort,revokeTestAccess} from '../migrations/audit/finalize-runtime-development.mjs';
import {RUN_ID,EVENT_IDS} from '../migrations/audit/runtime-contract.mjs';
const state={runId:RUN_ID,passed:true,completedAt:'2026-10-23T10:00:00Z',retainUntil:'2027-10-23T10:00:00Z',
 cohort:EVENT_IDS.map(eventId=>({eventId,passed:true,completedAt:'2026-10-23T10:00:00Z'}))};
requireCompletedCohort(state);
for(const patch of [{passed:false},{runId:'other'},{cohort:state.cohort.slice(1)},
 {cohort:state.cohort.map((c,i)=>i?c:{...c,passed:false})},{retainUntil:state.completedAt}])assert.throws(()=>requireCompletedCohort({...state,...patch}));
for(const self of [false,true]){
 const calls=[];const rows=[{roleid:1,member:2,grantor:3,admin_option:true,inherit_option:false,set_option:false,self_grantor:self}];
 const x={query:async(sql)=>{calls.push(sql);return sql.startsWith('SELECT m.roleid')?{rows}:
  sql.startsWith('SELECT NOT pg_has_role')?{rows:[{ok:true}]}:{command:sql,rows:[]};}};
 assert.equal(await revokeTestAccess(x,'source'),'committed');
 assert.equal(calls.filter(s=>s.startsWith('REVOKE EXECUTE')).length,6);
 assert.equal(calls.filter(s=>s==='REVOKE USAGE ON SCHEMA audit_rehearsal FROM fmt_audit_test_dev').length,1);
 assert.ok(calls.includes('ALTER ROLE fmt_audit_test_dev NOLOGIN'));
 assert.equal(calls.at(-1),'COMMIT');
 assert.equal(calls.some(s=>s.startsWith('REVOKE fm_audit_rehearsal_owner FROM')), !self);
 assert.ok(!calls.some(s=>/\b(?:DROP|DELETE|TRUNCATE|PASSWORD)\b/.test(s)));
}
const calls=[];
await assert.rejects(revokeTestAccess({query:async sql=>{calls.push(sql);if(sql.includes('NOLOGIN'))throw new Error('fixture');return{rows:[]};}},'source'));
assert.equal(calls.at(-1),'ROLLBACK');assert.ok(!calls.includes('COMMIT'));
await assert.rejects(revokeTestAccess({query:async()=>assert.fail('unexpected query')},'production'));
console.log('Focused finalization checks passed (offline; no private/DB/ACL access)');
