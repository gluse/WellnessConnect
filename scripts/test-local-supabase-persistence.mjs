import assert from 'node:assert/strict';
import {normalizeContainerSnapshot,containerSnapshotSql} from './local-supabase-persistence.mjs';
const fromContainer={
 tables:[{sha256:'fixture-hash',rows:'2',acl:null,owner:'postgres',rls:true,name:'users',schema:'public'}],
 functions:[{acl:null,volatility:'s',securitydefiner:true,config:['search_path=pg_catalog, pg_temp'],owner:'fm_audit_contract_owner',hash:'function-hash',arguments:'value text',name:'fixture',schema:'audit_contract'}],
 sequences:[{last_value:'9223372036854775806',cache_size:'1',cycle:false,increment_by:'1',max_value:'9223372036854775807',min_value:'1',start_value:'1',data_type:'bigint',sequenceowner:'postgres',sequencename:'fixture_id_seq',schemaname:'public'}],
 roles:[{rolbypassrls:false,rolreplication:false,rolcreaterole:false,rolcreatedb:false,rolsuper:false,rolconnlimit:5,rolinherit:true,rolcanlogin:true,rolname:'fmt_app_dev'}],
 constraints:[{convalidated:true,definition:'PRIMARY KEY (id)',conname:'users_pkey',table_name:'users',schema:'public'}],
};
const canonical=normalizeContainerSnapshot(fromContainer);
assert.deepEqual(canonical,fromContainer);
assert.deepEqual(Object.keys(canonical.tables[0]),['schema','name','rls','owner','acl','rows','sha256']);
assert.equal(canonical.sequences[0].max_value,'9223372036854775807');
assert.equal(canonical.sequences[0].last_value,'9223372036854775806');
assert.equal(typeof canonical.roles[0].rolconnlimit,'number');
for(const target of ['source','destination']){
 const sql=containerSnapshotSql(target);
 assert.match(sql,/^BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;/);
 assert.match(sql,/ROLLBACK;$/);
 assert(!/\b(?:INSERT INTO|UPDATE |DELETE FROM|CREATE TABLE|ALTER ROLE|GRANT )/.test(sql));
 assert.match(sql,/start_value::text/);assert.match(sql,/last_value::text/);
 assert(!sql.includes('$1'));
}
assert.throws(()=>containerSnapshotSql('hosted'));
console.log('Local persistence transport/precision/read-only safety checks passed (offline).');
