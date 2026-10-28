// Offline only; synthetic process records. No inventory/private/config/DB access.
import assert from 'node:assert/strict';
import {windowsArguments,classifyProcesses} from '../migrations/billing/local-quiescence.mjs';
const root='C:/Source/Private/WellnessConnect';let checks=0;
const check=fn=>{fn();checks++;};
const record=(command,extra={})=>({pid:123,name:'node.exe',parent:12,creation:'2026-10-27T01:00:00Z',command,...extra});
check(()=>assert.deepEqual(windowsArguments('"C:\\Program Files\\nodejs\\node.exe" --import tsx "C:\\Source\\Private\\WellnessConnect\\server\\index.ts"'),
 ['C:\\Program Files\\nodejs\\node.exe','--import','tsx','C:\\Source\\Private\\WellnessConnect\\server\\index.ts']));
for(const command of [
 'node.exe -e "const source=\"server/index.ts\"; const task=\"billing:dev\""',
 'node.exe --eval="server/audit/run-worker.ts"',
 'node.exe scripts/test-runtime.mjs server/index.ts billing:dev',
 'node.exe C:/other/project/server/index.ts',
 'node.exe --check server/index.ts',
 'node.exe C:/tools/agent.mjs "server/index.ts audit:worker"',
])check(()=>assert.deepEqual(classifyProcesses([record(command)],root),[]));
for(const[script,role]of [['server/index.ts','application'],['server/audit/run-worker.ts','audit-worker'],['scripts/start-stripe-local.mjs','billing-launcher'],['dist/index.js','application']]){
 const [match]=classifyProcesses([record(`node.exe --env-file=.env --import tsx ${root}/${script}`)],root);
 check(()=>assert.equal(match.role,role));check(()=>assert.equal(match.project,'verified'));
}
{
 const [match]=classifyProcesses([record(`node.exe ${root}/node_modules/tsx/dist/cli.mjs watch server/index.ts`)],root);
 check(()=>assert.equal(match.project,'verified'));
 check(()=>assert.equal(match.role,'application'));
}
{
 const [match]=classifyProcesses([record('node.exe --import tsx server/index.ts')],root);
 check(()=>assert.equal(match.project,'unresolved'));
 check(()=>assert.equal(match.pid,123));
}
{
 const records=[record('node.exe --import tsx server/index.ts'),record(`node.exe ${root}/scripts/start-stripe-local.mjs`,{pid:12,parent:1})];
 const matches=classifyProcesses(records,root);
 check(()=>assert.equal(matches[0].project,'verified'));
 check(()=>assert.equal(matches[0].parentPid,12));
 check(()=>assert.equal(matches[0].parentCreation,'2026-10-27T01:00:00Z'));
 check(()=>assert.equal(JSON.stringify(matches).includes('command'),false));
}
process.stdout.write(JSON.stringify({status:'passed',checks,offline:true,processInventory:false,privateAccess:false,databaseAccess:false})+'\n');
