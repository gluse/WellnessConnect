// Credentials may be bound only after these SAME transaction/session controls
// are effective. No global/role logging overrides or literal credential SQL.
import {requireThat} from './runtime-support.mjs';
import {ROLES} from './runtime-contract.mjs';
export const SECRET_SESSION_CONTROLS=Object.freeze({log_statement:'none',log_duration:'off',
 log_min_duration_statement:'-1',log_parameter_max_length:'0',log_parameter_max_length_on_error:'0',
 log_min_error_statement:'panic',log_min_messages:'panic','pg_stat_statements.track':'none',
 'pg_stat_statements.track_utility':'off','pgaudit.log':'none','pgaudit.role':'','pgaudit.log_statement':'off',
 'auto_explain.log_min_duration':'-1','auto_explain.log_parameter_max_length':'0'});
export const IMMUTABLE_SAFE_DEFAULTS=Object.freeze({log_min_duration_sample:'-1',log_transaction_sample_rate:'0',
 'pgaudit.log_parameter':'off',local_preload_libraries:'',password_encryption:'scram-sha-256'});
const guarded=new WeakSet();
export async function beginPrivateSession(x){
 guarded.delete(x);
 try{
  await x.query('BEGIN');await x.query('SET TRANSACTION READ WRITE');
  for(const[name,value]of Object.entries(SECRET_SESSION_CONTROLS))await x.query(`SET LOCAL ${name} = '${value}'`);
  const expected={...SECRET_SESSION_CONTROLS,...IMMUTABLE_SAFE_DEFAULTS};
  const {rows}=await x.query('SELECT name,setting FROM pg_catalog.pg_settings WHERE name=ANY($1::text[])',[Object.keys(expected)]);
  requireThat(rows.length===Object.keys(expected).length&&rows.every(row=>Object.hasOwn(expected,row.name)&&expected[row.name]===row.setting),
   'PRIVATE_SESSION_LOGGING_NOT_SAFE');
  const identity=(await x.query("SELECT current_user='postgres' AND session_user=current_user AND current_setting('server_version_num')::integer/10000=17 AS ok")).rows[0];
  requireThat(identity?.ok===true,'PRIVATE_SESSION_IDENTITY_REJECTED');guarded.add(x);
 }catch(e){guarded.delete(x);try{await x.query('ROLLBACK');}catch{}throw e;}
}
export async function bindRolePassword(x,target,role,password){
 requireThat(guarded.has(x),'PRIVATE_SESSION_GUARD_REQUIRED');
 const permitted=target==='source'?[ROLES.app,ROLES.capture,ROLES.worker,ROLES.test]:target==='destination'?[ROLES.writer,ROLES.test]:[];
 requireThat(permitted.includes(role)&&/^[A-Za-z0-9_-]{43}$/.test(password),'PRIVATE_ROLE_PASSWORD_SCOPE_REJECTED');
 try{
 await x.query("SELECT set_config('audit_setup.credential',$1,true) IS NOT NULL AS bound",[password]);
 // The top-level activity text contains only this fixed DO, never the password.
 // Privileged setup administrators remain trusted; no absolute memory secrecy claim.
 await x.query(`DO $credential$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='${role}' AND NOT rolcanlogin
 AND NOT (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls))
 THEN RAISE EXCEPTION 'Expected disabled restricted runtime role missing'; END IF;
 EXECUTE format('ALTER ROLE %I PASSWORD %L','${role}',current_setting('audit_setup.credential'));
 PERFORM set_config('audit_setup.credential','',true);
 END $credential$;`);
 }catch(e){guarded.delete(x);throw e;}
}
export async function finishPrivateSession(x,commit){
 requireThat(guarded.has(x),'PRIVATE_SESSION_GUARD_REQUIRED');guarded.delete(x);
 const result=await x.query(commit?'COMMIT':'ROLLBACK');
 requireThat(result.command===(commit?'COMMIT':'ROLLBACK'),'PRIVATE_SESSION_OUTCOME_UNCERTAIN');
}
export function forgetPrivateSession(x){guarded.delete(x);}
