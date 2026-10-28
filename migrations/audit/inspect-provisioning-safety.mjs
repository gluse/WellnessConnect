// Fixed safe metadata discovery only. No secret generation/transmission/mutation.
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadPrivateConfiguration} from './execute-runtime-setup.mjs';
import {client,connect,requireThat,emit,safeCode} from './runtime-support.mjs';
export const SAFETY_SETTINGS=Object.freeze(['log_statement','log_duration','log_min_duration_statement',
 'log_min_duration_sample','log_statement_sample_rate','log_parameter_max_length','log_parameter_max_length_on_error',
 'log_min_error_statement','log_min_messages','log_error_verbosity','log_transaction_sample_rate',
 'log_statement_stats','log_parser_stats','log_planner_stats','log_executor_stats','track_activities',
 'shared_preload_libraries','session_preload_libraries',
 'pg_stat_statements.track','pg_stat_statements.track_utility','pgaudit.log','pgaudit.role','pgaudit.log_parameter',
 'pgaudit.log_statement','auto_explain.log_min_duration','auto_explain.log_analyze','auto_explain.log_nested_statements',
 'auto_explain.log_parameter_max_length',
 'max_connections','reserved_connections','superuser_reserved_connections','password_encryption']);
export const SAFETY_SQL=`SELECT name,setting,context,pending_restart,
 has_parameter_privilege(current_user,name,'SET') AS explicit_set_privilege
 FROM pg_catalog.pg_settings WHERE name=ANY($1::text[]) ORDER BY name`;
export const CAPACITY_SQL=`SELECT count(*) FILTER(WHERE backend_type='client backend')::integer AS client_connections,
 count(*) FILTER(WHERE usename IN ('fmt_app_dev','fmt_audit_capture_dev','fmt_audit_worker_dev','fmt_audit_writer_dev','fmt_audit_test_dev'))::integer AS runtime_connections
 FROM pg_catalog.pg_stat_activity`;
async function main(){
 requireThat(process.argv.length===2,'MODE_REJECTED');const {configs,cas}=loadPrivateConfiguration();
 for(const target of ['destination','source']){let x;
  try{x=await client(configs[target],target,cas[target]);await connect(x);await x.query('BEGIN READ ONLY');
   try{
    const identity=(await x.query("SELECT current_user='postgres' AND current_user=session_user AND current_setting('server_version_num')::integer/10000=17 AS expected_identity")).rows[0];
    requireThat(identity?.expected_identity===true,'PROVISIONING_IDENTITY_REJECTED');
    const settings=(await x.query(SAFETY_SQL,[SAFETY_SETTINGS])).rows;
    requireThat(settings.length<=SAFETY_SETTINGS.length,'SETTINGS_BOUND_REJECTED');
    emit('provisioning-safety-discovery',{target,settings,capacity:(await x.query(CAPACITY_SQL)).rows[0],
     readOnly:true,secretsGenerated:false,secretsTransmitted:false});
   }finally{await x.query('ROLLBACK');}
  }finally{if(x)try{await x.end();}catch{/* No raw driver output. */}}
 }
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 try{await main();}catch(e){emit('provisioning-safety-stopped',{code:safeCode(e)});process.exitCode=1;}
}
