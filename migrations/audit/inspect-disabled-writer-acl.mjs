// TASK-014 partial-install reconciliation: one fixed destination/principal,
// bounded catalog ACL metadata only. No relation rows or repair/mutation mode.
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadPrivateConfiguration,booleanSnapshot} from './execute-runtime-setup.mjs';
import {INSTALL_SQL,roleContracts} from './execute-runtime-disabled.mjs';
import {client,connect,requireThat,safeCode,emit} from './runtime-support.mjs';

const COMMON=`WITH writer AS (SELECT oid FROM pg_catalog.pg_roles WHERE rolname='fmt_audit_writer_dev')`;
const FILTER=`c.relkind IN ('r','p','v','m','f') AND n.nspname NOT IN ('pg_catalog','information_schema')
 AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp%'`;
export const RELATION_ACL_SQL=`${COMMON}
 SELECT n.nspname AS schema,c.relname AS relation,c.relkind::text AS kind,owner.rolname AS owner,
 has_schema_privilege(w.oid,n.oid,'USAGE') AS schema_usage,rights.privilege,
 CASE WHEN acl.grantee IS NULL THEN 'unresolved' WHEN acl.grantee=0 THEN 'PUBLIC'
 WHEN acl.grantee=w.oid THEN 'direct-writer' ELSE 'inherited-role' END AS origin,
 CASE WHEN acl.grantee=0 THEN 'PUBLIC' ELSE grantee.rolname END AS grantee,
 grantor.rolname AS grantor,acl.is_grantable AS grant_option,
 count(*) OVER ()::text AS total_rows
 FROM writer w CROSS JOIN pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 JOIN pg_catalog.pg_roles owner ON owner.oid=c.relowner
 CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) rights(privilege)
 LEFT JOIN LATERAL (SELECT a.* FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
 WHERE a.privilege_type=rights.privilege AND CASE WHEN a.grantee=0 THEN true ELSE pg_has_role(w.oid,a.grantee,'USAGE') END) acl ON true
 LEFT JOIN pg_catalog.pg_roles grantee ON grantee.oid=acl.grantee
 LEFT JOIN pg_catalog.pg_roles grantor ON grantor.oid=acl.grantor
 WHERE ${FILTER} AND has_table_privilege(w.oid,c.oid,rights.privilege)
 ORDER BY n.nspname,c.relname,rights.privilege,origin,grantee,grantor LIMIT 65`;
export const COLUMN_ACL_SQL=`${COMMON}
 SELECT n.nspname AS schema,c.relname AS relation,col.attname AS column,rights.privilege,
 has_schema_privilege(w.oid,n.oid,'USAGE') AS schema_usage,
 has_table_privilege(w.oid,c.oid,rights.privilege) AS via_relation_privilege,
 CASE WHEN acl.grantee IS NULL AND has_table_privilege(w.oid,c.oid,rights.privilege) THEN 'relation-level'
 WHEN acl.grantee IS NULL THEN 'unresolved' WHEN acl.grantee=0 THEN 'PUBLIC'
 WHEN acl.grantee=w.oid THEN 'direct-writer' ELSE 'inherited-role' END AS origin,
 CASE WHEN acl.grantee=0 THEN 'PUBLIC' ELSE grantee.rolname END AS grantee,
 grantor.rolname AS grantor,acl.is_grantable AS grant_option,count(*) OVER ()::text AS total_rows
 FROM writer w CROSS JOIN pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 JOIN pg_catalog.pg_attribute col ON col.attrelid=c.oid AND col.attnum>0 AND NOT col.attisdropped
 CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','REFERENCES']) rights(privilege)
 LEFT JOIN LATERAL (SELECT a.* FROM aclexplode(col.attacl) a
 WHERE a.privilege_type=rights.privilege AND CASE WHEN a.grantee=0 THEN true ELSE pg_has_role(w.oid,a.grantee,'USAGE') END) acl ON true
 LEFT JOIN pg_catalog.pg_roles grantee ON grantee.oid=acl.grantee
 LEFT JOIN pg_catalog.pg_roles grantor ON grantor.oid=acl.grantor
 WHERE ${FILTER} AND has_column_privilege(w.oid,c.oid,col.attnum,rights.privilege)
 ORDER BY n.nspname,c.relname,col.attnum,rights.privilege,origin,grantee,grantor LIMIT 257`;

async function main(){
 requireThat(process.argv.length===2,'MODE_REJECTED');
 const {configs,cas}=loadPrivateConfiguration();let x;
 try{
  x=await client(configs.destination,'destination',cas.destination);await connect(x);
  await x.query('BEGIN READ ONLY');
  try{
   const state=booleanSnapshot(await x.query(INSTALL_SQL.roleState,[JSON.stringify(roleContracts('destination'))]));
   requireThat(Object.values(state).every(v=>v===true),'DESTINATION_ROLE_STATE_CHANGED');
   emit('disabled-writer-acl-role-state',{target:'destination',...state});
   for(const [stage,sql,bound]of [['relation',RELATION_ACL_SQL,64],['column',COLUMN_ACL_SQL,256]]){
    const {rows}=await x.query(sql);
    requireThat(rows.length<=bound&&rows.every(r=>Number(r.total_rows)<=bound),'CATALOG_OUTPUT_BOUND_EXCEEDED');
    emit('disabled-writer-acl-catalog',{target:'destination',principal:'fmt_audit_writer_dev',kind:stage,
     count:rows.length,rows:rows.map(({total_rows,...row})=>row),readOnly:true});
   }
  }finally{await x.query('ROLLBACK');}
 }finally{if(x)try{await x.end();}catch{/* Safe caller reports no driver objects. */}}
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 try{await main();}catch(e){emit('disabled-writer-acl-stopped',{code:safeCode(e)});process.exitCode=1;}
}
