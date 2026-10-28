// Non-secret connection-local capability probe. Literal SET LOCAL exercises
// provider ProcessUtility hooks; all changes roll back. No password/role/data writes.
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadPrivateConfiguration} from './execute-runtime-setup.mjs';
import {client,connect,requireThat,emit,safeCode} from './runtime-support.mjs';
export const PRIVATE_SESSION_SETTINGS=Object.freeze({log_statement:'none',log_duration:'off',
 log_min_duration_statement:'-1',log_min_duration_sample:'-1',log_statement_sample_rate:'0',log_transaction_sample_rate:'0',
 log_parameter_max_length:'0',log_parameter_max_length_on_error:'0',log_min_error_statement:'panic',
 log_min_messages:'panic',log_error_verbosity:'terse','pg_stat_statements.track':'none',
 'pg_stat_statements.track_utility':'off','pgaudit.log':'none','pgaudit.role':'','pgaudit.log_parameter':'off',
 'pgaudit.log_statement':'off','auto_explain.log_min_duration':'-1','auto_explain.log_parameter_max_length':'0',track_activities:'off'});
export function localSettingStatement(name,value){
 requireThat(Object.hasOwn(PRIVATE_SESSION_SETTINGS,name)&&PRIVATE_SESSION_SETTINGS[name]===value
  &&/^[a-z_]+(?:\.[a-z_]+)?$/.test(name)&&/^[a-z0-9_-]*$/.test(value),'SESSION_SETTING_SCOPE_REJECTED');
 return`SET LOCAL ${name} = '${value}'`;
}
export async function probeSession(x){
 const results={};await x.query('BEGIN READ ONLY');
 try{
  for(const [name,value]of Object.entries(PRIVATE_SESSION_SETTINGS)){
   await x.query('SAVEPOINT logging_probe');
   try{
    await x.query(localSettingStatement(name,value));
    const actual=(await x.query('SELECT current_setting($1) AS value',[name])).rows[0]?.value;
    requireThat(actual===value,'SESSION_SETTING_NOT_EFFECTIVE');results[name]={effective:true};
    await x.query('RELEASE SAVEPOINT logging_probe');
   }catch(e){await x.query('ROLLBACK TO SAVEPOINT logging_probe');await x.query('RELEASE SAVEPOINT logging_probe');
    results[name]={effective:false,code:safeCode(e)};
   }
  }return results;
 }finally{await x.query('ROLLBACK');}
}
async function main(){
 requireThat(process.argv.length===2,'MODE_REJECTED');const{configs,cas}=loadPrivateConfiguration();
 for(const target of ['destination','source']){let x;
  try{x=await client(configs[target],target,cas[target]);await connect(x);
   const localPreload=(await x.query("SELECT current_setting('local_preload_libraries') AS value")).rows[0]?.value;
   emit('private-session-probe',{target,method:'literal-SET-LOCAL',settings:await probeSession(x),secretsGenerated:false,secretsTransmitted:false,
    persistentChanges:false,localPreloadLibraries:localPreload});
  }finally{if(x)try{await x.end();}catch{/* No driver output. */}}
 }
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 try{await main();}catch(e){emit('private-session-probe-stopped',{code:safeCode(e)});process.exitCode=1;}
}
