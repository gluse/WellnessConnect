// TASK-014 committed-source reconciliation: fixed runtime roles and bounded
// extra relation/column/sequence ACL metadata; no data rows or mutation path.
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadPrivateConfiguration,booleanSnapshot} from './execute-runtime-setup.mjs';
import {INSTALL_SQL,INACCESSIBLE_PROVIDER_VIEW,roleContracts,relationContracts} from './execute-runtime-disabled.mjs';
import {APP_SEQUENCES} from './runtime-contract.mjs';
import {client,connect,requireThat,safeCode,emit} from './runtime-support.mjs';
const COMMON=`WITH roles AS (SELECT * FROM unnest($1::text[]) names(name)),
 expected AS (SELECT * FROM jsonb_to_recordset($2::jsonb) AS e(role text,schema text,name text,rights text[]))`;
const TABLE_FILTER=`c.relkind IN ('r','p','v','m','f') AND n.nspname NOT IN ('pg_catalog','information_schema')
 AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp%'`;
const NOT_EXPECTED=`NOT EXISTS(SELECT 1 FROM expected a WHERE a.role=r.rolname AND a.schema=n.nspname
 AND a.name=c.relname AND rights.privilege=ANY(a.rights))
 AND NOT(rights.privilege='SELECT' AND (${INACCESSIBLE_PROVIDER_VIEW}))`;
const ORIGIN=`CASE WHEN acl.grantee IS NULL THEN 'unresolved' WHEN acl.grantee=0 THEN 'PUBLIC'
 WHEN acl.grantee=r.oid THEN 'direct-runtime' ELSE 'inherited-role' END`;
const ACL_JOIN=expression=>`LEFT JOIN LATERAL (SELECT a.* FROM aclexplode(${expression}) a
 WHERE a.privilege_type=rights.privilege AND CASE WHEN a.grantee=0 THEN true ELSE pg_has_role(r.oid,a.grantee,'USAGE') END) acl ON true
 LEFT JOIN pg_catalog.pg_roles grantee ON grantee.oid=acl.grantee LEFT JOIN pg_catalog.pg_roles grantor ON grantor.oid=acl.grantor`;
export const SOURCE_RELATION_ACL_SQL=`${COMMON} SELECT r.rolname AS role,n.nspname AS schema,c.relname AS relation,c.relkind::text AS kind,
 owner.rolname AS owner,has_schema_privilege(r.oid,n.oid,'USAGE') AS schema_usage,rights.privilege,
 ${ORIGIN} AS origin,CASE WHEN acl.grantee=0 THEN 'PUBLIC' ELSE grantee.rolname END AS grantee,
 grantor.rolname AS grantor,acl.is_grantable AS grant_option,(count(*) OVER ())::text AS total_rows
 FROM roles e JOIN pg_catalog.pg_roles r ON r.rolname=e.name CROSS JOIN pg_catalog.pg_class c
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_roles owner ON owner.oid=c.relowner
 CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) rights(privilege)
 ${ACL_JOIN("coalesce(c.relacl,acldefault('r',c.relowner))")}
 WHERE ${TABLE_FILTER} AND has_table_privilege(r.oid,c.oid,rights.privilege) AND ${NOT_EXPECTED}
 ORDER BY r.rolname,n.nspname,c.relname,rights.privilege,origin,grantee,grantor LIMIT 65`;
export const SOURCE_COLUMN_ACL_SQL=`${COMMON} SELECT r.rolname AS role,n.nspname AS schema,c.relname AS relation,col.attname AS column,
 has_schema_privilege(r.oid,n.oid,'USAGE') AS schema_usage,rights.privilege,
 has_table_privilege(r.oid,c.oid,rights.privilege) AS via_relation_privilege,
 CASE WHEN acl.grantee IS NULL AND has_table_privilege(r.oid,c.oid,rights.privilege) THEN 'relation-level'
 ELSE ${ORIGIN} END AS origin,CASE WHEN acl.grantee=0 THEN 'PUBLIC' ELSE grantee.rolname END AS grantee,
 grantor.rolname AS grantor,acl.is_grantable AS grant_option,(count(*) OVER ())::text AS total_rows
 FROM roles e JOIN pg_catalog.pg_roles r ON r.rolname=e.name CROSS JOIN pg_catalog.pg_class c
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 JOIN pg_catalog.pg_attribute col ON col.attrelid=c.oid AND col.attnum>0 AND NOT col.attisdropped
 CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','REFERENCES']) rights(privilege)
 ${ACL_JOIN('col.attacl')}
 WHERE ${TABLE_FILTER} AND has_column_privilege(r.oid,c.oid,col.attnum,rights.privilege) AND ${NOT_EXPECTED}
 ORDER BY r.rolname,n.nspname,c.relname,col.attnum,rights.privilege,origin,grantee,grantor LIMIT 257`;
export const SOURCE_SEQUENCE_ACL_SQL=`SELECT r.rolname AS role,n.nspname AS schema,c.relname AS sequence,
 owner.rolname AS owner,has_schema_privilege(r.oid,n.oid,'USAGE') AS schema_usage,rights.privilege,
 ${ORIGIN} AS origin,CASE WHEN acl.grantee=0 THEN 'PUBLIC' ELSE grantee.rolname END AS grantee,
 grantor.rolname AS grantor,acl.is_grantable AS grant_option,(count(*) OVER ())::text AS total_rows
 FROM unnest($1::text[]) e(name) JOIN pg_catalog.pg_roles r ON r.rolname=e.name CROSS JOIN pg_catalog.pg_class c
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_roles owner ON owner.oid=c.relowner
 CROSS JOIN unnest(ARRAY['USAGE','SELECT','UPDATE']) rights(privilege)
 ${ACL_JOIN("coalesce(c.relacl,acldefault('s',c.relowner))")}
 WHERE c.relkind='S' AND n.nspname NOT IN ('pg_catalog','information_schema')
 AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp%'
 AND has_sequence_privilege(r.oid,c.oid,rights.privilege)
 AND NOT(r.rolname IN ('fm_app_runtime','fmt_app_dev') AND n.nspname='public' AND c.relname=ANY($2::text[]) AND rights.privilege='USAGE')
 ORDER BY r.rolname,n.nspname,c.relname,rights.privilege,origin,grantee,grantor LIMIT 65`;
async function main(){
 requireThat(process.argv.length===2,'MODE_REJECTED');const {configs,cas}=loadPrivateConfiguration();let x;
 try{x=await client(configs.source,'source',cas.source);await connect(x);await x.query('BEGIN READ ONLY');
  try{const roles=roleContracts('source'),names=roles.map(r=>r.name);
   const state=booleanSnapshot(await x.query(INSTALL_SQL.roleState,[JSON.stringify(roles)]));
   requireThat(Object.values(state).every(v=>v===true),'SOURCE_ROLE_STATE_CHANGED');
   emit('source-runtime-acl-role-state',{target:'source',...state});
   for(const [kind,sql,args,bound]of [
    ['relation',SOURCE_RELATION_ACL_SQL,[names,JSON.stringify(relationContracts('source'))],64],
    ['column',SOURCE_COLUMN_ACL_SQL,[names,JSON.stringify(relationContracts('source'))],256],
    ['sequence',SOURCE_SEQUENCE_ACL_SQL,[names,APP_SEQUENCES],64]]){
    const {rows}=await x.query(sql,args);
    requireThat(rows.length<=bound&&rows.every(r=>Number(r.total_rows)<=bound),'CATALOG_OUTPUT_BOUND_EXCEEDED');
    emit('source-runtime-extra-acl-catalog',{kind,count:rows.length,rows:rows.map(({total_rows,...row})=>row),readOnly:true});
   }
  }finally{await x.query('ROLLBACK');}
 }finally{if(x)try{await x.end();}catch{/* Safe caller reports no driver objects. */}}
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 try{await main();}catch(e){emit('source-runtime-acl-stopped',{code:safeCode(e)});process.exitCode=1;}
}
