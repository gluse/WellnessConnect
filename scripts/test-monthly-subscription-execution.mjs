// Offline only: no private configuration, PostgreSQL or application startup.
import assert from 'node:assert/strict';
import {STAGES,loadScripts,confirmCommit,executeStages,selectedSettings} from '../migrations/billing/execute-development-setup.mjs';
let checks=0;
const check=(fn)=>{fn();checks++;};
const scripts=loadScripts();
check(()=>assert.equal(scripts.size,8));
check(()=>assert.deepEqual(STAGES.map(s=>s.target),['source','source','source','source','destination','destination','source','source']));
check(()=>assert.equal([...scripts.values()].every(s=>s.includes('SET TRANSACTION READ WRITE;')),true));
const receipt=(stage)=>[{fields:[{name:stage.receipt}],rows:[{[stage.receipt]:true}],command:'SELECT'},{command:'COMMIT'}];
for(const stage of STAGES)check(()=>confirmCommit(receipt(stage),stage.receipt));
check(()=>assert.throws(()=>confirmCommit([{command:'ROLLBACK'}],STAGES[0].receipt),/UNCERTAIN/));
check(()=>assert.throws(()=>confirmCommit([{command:'COMMIT'}],STAGES[0].receipt),/RECEIPT/));
check(()=>assert.deepEqual(selectedSettings('DATABASE_URL="kept"\nUNRELATED="unterminated',['DATABASE_URL']),{DATABASE_URL:'kept'}));
check(()=>assert.throws(()=>selectedSettings('DATABASE_URL=a\nDATABASE_URL=b',['DATABASE_URL']),/DUPLICATE/));
{
 let cursor=0;const events=[];
 const clients=Object.fromEntries(['source','destination'].map(target=>[target,{query:async ({text})=>{
  const stage=STAGES[cursor++];assert.equal(stage.target,target);assert.equal(text,scripts.get(stage.file));return receipt(stage);
 }}]));
 const commits=await executeStages({clients,scripts,verify:async()=>({groups:1,booleans:2}),onEvent:e=>events.push(e)});
 check(()=>assert.deepEqual(commits,STAGES.map(s=>s.file)));
 check(()=>assert.equal(events.length,8));
 check(()=>assert.equal(events.every(e=>e.status==='committed-and-verified'),true));
}
for(const failure of ['statement','uncertain','verification']){
 let attempts=0,rollbacks=0;const events=[];
 const x={query:async arg=>{
  if(arg==='ROLLBACK'){rollbacks++;return{command:'ROLLBACK'};}
  const stage=STAGES[attempts++];
  if(attempts===2&&failure==='statement'){const e=new Error('private driver detail');e.code='23514';throw e;}
  if(attempts===2&&failure==='uncertain')return[{command:'SELECT'}];
  return receipt(stage);
 }};
 let error;
 try{await executeStages({clients:{source:x,destination:x},scripts,
  verify:async()=>{if(attempts===2&&failure==='verification')throw new Error('failed check');return{};},onEvent:e=>events.push(e)});}catch(e){error=e;}
 check(()=>assert.equal(attempts,2));
 check(()=>assert.equal(error.stoppedStage,STAGES[1].file));
 check(()=>assert.deepEqual(error.confirmedCommits,STAGES.slice(0,failure==='verification'?2:1).map(s=>s.file)));
 check(()=>assert.equal(rollbacks,failure==='verification'?0:1));
 if(failure!=='verification')check(()=>assert.equal(events.at(-1).automaticRetry,false));
 if(failure==='statement')check(()=>assert.equal(events.at(-1).outcome,'rolled-back'));
 if(failure==='uncertain')check(()=>assert.equal(events.at(-1).outcome,'uncertain'));
}
process.stdout.write(JSON.stringify({status:'passed',checks,offline:true,privateAccess:false,databaseAccess:false})+'\n');
