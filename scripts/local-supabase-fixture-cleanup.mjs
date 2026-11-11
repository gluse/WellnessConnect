// TASK-064 exact local-only smoke fixture cleanup; business audit triggers stay active.
import fs from 'node:fs';
import pg from 'pg';
import {privateArtifact,quoteIdentifier,verifyPrivateDirectoryAgain,localAdminConnection} from './local-supabase-copy.mjs';
import {requireThat,safeCode} from '../migrations/audit/runtime-support.mjs';
try{
  const fixture=JSON.parse(fs.readFileSync(privateArtifact('smoke-fixture.json'),'utf8'));
  requireThat(fixture.email==='local-copy-smoke-20261109@fixture.invalid'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(fixture.userId),'LOCAL_FIXTURE_IDENTITY_REJECTED');
  const status=JSON.parse(fs.readFileSync(privateArtifact('supabase-status.json'),'utf8'));
  const x=new pg.Client(localAdminConnection('source',status,{}));
  let result;
  try{
    await x.connect();await x.query('BEGIN');
    requireThat((await x.query('SELECT id FROM public.users WHERE id=$1 AND email=$2 FOR UPDATE',[fixture.userId,fixture.email])).rowCount===1,'LOCAL_FIXTURE_PROFILE_NOT_EXACT');
    requireThat((await x.query('SELECT id FROM auth.users WHERE id=$1::uuid AND email=$2',[fixture.userId,fixture.email])).rowCount===1,'LOCAL_FIXTURE_AUTH_NOT_EXACT');
    const dependencies=(await x.query(`SELECT n.nspname AS schema,c.relname AS table_name,a.attname AS column_name FROM pg_constraint q JOIN pg_class c ON c.oid=q.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=q.conkey[1] WHERE q.contype='f' AND q.confrelid='public.users'::regclass AND array_length(q.conkey,1)=1 ORDER BY n.nspname,c.relname,q.conname`)).rows;
    for(const ref of dependencies){const count=(await x.query(`SELECT count(*)::int AS count FROM ${quoteIdentifier(ref.schema)}.${quoteIdentifier(ref.table_name)} WHERE ${quoteIdentifier(ref.column_name)}::text=$1`,[fixture.userId])).rows[0].count;requireThat(count===0,'LOCAL_FIXTURE_HAS_DEPENDENT_BUSINESS_ROWS');}
    const sessions=(await x.query("DELETE FROM public.sessions WHERE sess->'auth'->>'userId'=$1",[fixture.userId])).rowCount;
    const profiles=(await x.query('DELETE FROM public.users WHERE id=$1 AND email=$2',[fixture.userId,fixture.email])).rowCount;
    requireThat(profiles===1,'LOCAL_FIXTURE_PROFILE_DELETE_REJECTED');
    await x.query('COMMIT');result={status:'passed',hostedAccess:false,profilesRemoved:profiles,sessionsRemoved:sessions,businessAuditTriggersPreserved:true,authDeletionNext:true};
  }catch(e){await x.query('ROLLBACK').catch(()=>{});throw e;}finally{await x.end();}
  verifyPrivateDirectoryAgain();
  fs.writeFileSync('output/supabase-local-copy-2026-11-09/fixture-profile-cleanup.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify(result));
}catch(e){console.error(JSON.stringify({status:'stopped',code:safeCode(e),hostedAccess:false}));process.exitCode=1;}
