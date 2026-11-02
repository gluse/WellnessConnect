// Pure CURRENT application metadata profile. No ORM, file reads, env, connections,
// or historical billing/audit profile changes. PostgreSQL 17 catalog only.
import manifest from './runtime-contract.json' with {type:'json'};
import {canonicalCatalogExpression} from '../notifications/normalize-expression.mjs';
export const APPOINTMENT_RUNTIME_TABLES=Object.freeze([...manifest.tables]);
export const APPOINTMENT_RUNTIME_CONTRACT_JSON=JSON.stringify(manifest);
export const APPOINTMENT_RUNTIME_RIGHTS=Object.freeze(APPOINTMENT_RUNTIME_TABLES.map(name=>Object.freeze({name,rights:Object.freeze(['SELECT','INSERT','UPDATE','DELETE'])})));
const normalizedCheck=canonicalCatalogExpression('pg_catalog.pg_get_expr(q.conbin,q.conrelid)');
const normalizedPredicate=canonicalCatalogExpression('pg_catalog.pg_get_expr(i.indpred,i.indrelid)');

export const APPOINTMENT_READINESS_CTES=`appointment_profile AS (SELECT $4::jsonb AS profile),
 appointment_tables AS (SELECT jsonb_array_elements_text(profile->'tables') AS name FROM appointment_profile),
 appointment_columns_expected AS (SELECT e.* FROM appointment_profile n,
  LATERAL jsonb_to_recordset(n.profile->'columns') AS e("table" text,name text,type text,"notNull" boolean,"default" text)),
 appointment_constraints_expected AS (SELECT e.* FROM appointment_profile n,
  LATERAL jsonb_to_recordset(n.profile->'constraints') AS e("table" text,name text,type text,expression text,columns text[],"referenceTable" text,"referenceColumns" text[],"onDelete" text)),
 appointment_indexes_expected AS (SELECT e.* FROM appointment_profile n,
  LATERAL jsonb_to_recordset(n.profile->'indexes') AS e("table" text,name text,"unique" boolean,columns text[],predicate text))`;

export const APPOINTMENT_READINESS_SELECT=`NOT EXISTS(SELECT 1 FROM appointment_columns_expected e WHERE NOT EXISTS(
 SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attname=e.name AND a.attnum>0 AND NOT a.attisdropped
 LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
 WHERE n.nspname='public' AND c.relname=e."table" AND format_type(a.atttypid,a.atttypmod)=e.type
 AND a.attnotnull=e."notNull" AND regexp_replace(pg_catalog.pg_get_expr(d.adbin,d.adrelid),'::(character varying|text)','', 'g') IS NOT DISTINCT FROM e."default"))
 AND NOT EXISTS(SELECT 1 FROM appointment_tables e JOIN pg_catalog.pg_class c ON c.relname=e.name
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
 AND (SELECT count(*) FROM pg_catalog.pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped)
 <> (SELECT count(*) FROM appointment_columns_expected col WHERE col."table"=e.name)) AS appointment_columns,
 NOT EXISTS(SELECT 1 FROM appointment_constraints_expected e WHERE NOT EXISTS(
 SELECT 1 FROM pg_catalog.pg_constraint q JOIN pg_catalog.pg_class c ON c.oid=q.conrelid
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname=e."table" AND q.conname=e.name AND q.contype::text=e.type
 AND q.convalidated AND NOT q.condeferrable AND NOT q.condeferred
 AND CASE WHEN e.type='c' THEN ${normalizedCheck}=e.expression
 ELSE ARRAY(SELECT a.attname::text FROM unnest(q.conkey) WITH ORDINALITY k(attnum,position)
  JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum=k.attnum ORDER BY k.position)=e.columns END
 AND (e.type<>'f' OR (q.confrelid=to_regclass('public.'||e."referenceTable") AND q.confdeltype::text=e."onDelete" AND q.confupdtype='a' AND q.confmatchtype='s'
  AND ARRAY(SELECT a.attname::text FROM unnest(q.confkey) WITH ORDINALITY k(attnum,position)
   JOIN pg_catalog.pg_attribute a ON a.attrelid=q.confrelid AND a.attnum=k.attnum ORDER BY k.position)=e."referenceColumns"))))
 AND NOT EXISTS(SELECT 1 FROM appointment_tables e JOIN pg_catalog.pg_class c ON c.relname=e.name
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
 AND (SELECT count(*) FROM pg_catalog.pg_constraint q WHERE q.conrelid=c.oid AND q.contype IN('c','f','p','u','x'))
 <> (SELECT count(*) FROM appointment_constraints_expected expected WHERE expected."table"=e.name)) AS appointment_constraints,
 NOT EXISTS(SELECT 1 FROM appointment_indexes_expected e WHERE NOT EXISTS(
 SELECT 1 FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class t ON t.oid=i.indrelid
 JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace JOIN pg_catalog.pg_class idx ON idx.oid=i.indexrelid
 JOIN pg_catalog.pg_am am ON am.oid=idx.relam
 WHERE n.nspname='public' AND t.relname=e."table" AND idx.relname=e.name AND am.amname='btree'
 AND i.indisvalid AND i.indisready AND i.indislive AND i.indisunique=e."unique" AND i.indnkeyatts=i.indnatts
 AND i.indexprs IS NULL AND NOT i.indnullsnotdistinct
 AND ARRAY(SELECT a.attname::text FROM unnest(i.indkey) WITH ORDINALITY k(attnum,position)
  JOIN pg_catalog.pg_attribute a ON a.attrelid=t.oid AND a.attnum=k.attnum ORDER BY k.position)=e.columns
 AND ${normalizedPredicate} IS NOT DISTINCT FROM e.predicate)) AS appointment_indexes,
 NOT EXISTS(SELECT 1 FROM appointment_tables e JOIN pg_catalog.pg_class c ON c.relname=e.name
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND (
 EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(c.relacl,pg_catalog.acldefault('r',c.relowner))) a
  WHERE a.grantee<>c.relowner AND (a.grantee<>(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='fm_app_runtime')
   OR a.privilege_type NOT IN('SELECT','INSERT','UPDATE','DELETE') OR a.is_grantable))
 OR EXISTS(SELECT 1 FROM unnest(ARRAY['anon','authenticated','service_role','fmt_audit_capture_dev','fmt_audit_worker_dev']) r(role_name)
  WHERE has_table_privilege(r.role_name,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') IS DISTINCT FROM false)
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_attribute att, LATERAL pg_catalog.aclexplode(att.attacl) a
  WHERE att.attrelid=c.oid AND att.attnum>0 AND NOT att.attisdropped AND a.grantee<>c.relowner))) AS appointment_private_acl,
 NOT EXISTS(SELECT 1 FROM appointment_tables e WHERE NOT EXISTS(
 SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 JOIN pg_catalog.pg_policy p ON p.polrelid=c.oid WHERE n.nspname='public' AND c.relname=e.name
 AND c.relrowsecurity AND NOT c.relforcerowsecurity AND c.relowner='postgres'::regrole
 AND p.polname='fmt_appointment_server' AND p.polcmd='*' AND p.polpermissive
 AND p.polroles=ARRAY[(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='fm_app_runtime')]
 AND pg_catalog.pg_get_expr(p.polqual,p.polrelid)='true' AND pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid)='true'
 AND (SELECT count(*) FROM pg_catalog.pg_policy other WHERE other.polrelid=c.oid)=1)) AS appointment_policies,
 has_schema_privilege(current_user,'public','USAGE') AND NOT has_schema_privilege(current_user,'public','CREATE')
 AND pg_has_role(current_user,'fm_app_runtime','USAGE') AND EXISTS(SELECT 1 FROM pg_catalog.pg_roles r
 WHERE r.rolname='fm_app_runtime' AND NOT(r.rolcanlogin OR r.rolsuper OR r.rolbypassrls OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication)) AS appointment_schema_access`;

