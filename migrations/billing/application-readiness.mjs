// Nonprivileged app-role metadata only. No files/configuration/connections on import.
import {BILLING_TABLES} from './contract.mjs';
import {BILLING_V2_TABLES,BILLING_V2_RIGHTS} from './v2-contract.mjs';
import {APP_TABLES,DELETE_TABLES} from '../audit/runtime-contract.mjs';
export const EXPECTED_BILLING_PARSERS=Object.freeze([
 Object.freeze({name:'parse_event',hash:'986d13a576a6bb53a5204670117f448d505defd7703f639ce3665adbc9f9e8d5'}),
 Object.freeze({name:'parse_event_before_billing',hash:'c7086d4ceee43b586e0efca334ef9a3c7926ac8c856ca3aeb8e79913fe77698b'}),
 Object.freeze({name:'parse_event_before_portal',hash:'8125d3d26bb142b52ab7abbde95fefaa3123e601744aa67292bee8e6a308f796'}),
]);
export const BILLING_APPLICATION_READINESS_SQL=`WITH required AS (
 SELECT * FROM jsonb_to_recordset($1::jsonb) AS e(name text,rights text[])
), parsers AS (SELECT * FROM jsonb_to_recordset($2::jsonb) AS e(name text,hash text))
SELECT current_user='fmt_app_dev' AND current_user=session_user AND EXISTS(
 SELECT 1 FROM pg_catalog.pg_roles r WHERE r.rolname=current_user AND r.rolcanlogin
 AND NOT(r.rolsuper OR r.rolbypassrls OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication)) AS restricted_principal,
 current_setting('server_version_num')::integer/10000=17 AS expected_version,
 (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN('r','p'))=27 AS expected_table_count,
 NOT EXISTS(SELECT 1 FROM required e WHERE NOT EXISTS(
  SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname=e.name AND c.relkind='r' AND c.relrowsecurity
  AND NOT EXISTS(SELECT 1 FROM unnest(e.rights) p(privilege) WHERE NOT has_table_privilege(current_user,c.oid,p.privilege)))) AS required_dml,
 NOT EXISTS(SELECT 1 FROM required e JOIN pg_catalog.pg_class c ON c.relname=e.name
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND e.name IN (${[...BILLING_TABLES,...BILLING_V2_TABLES].map(name=>`'${name}'`).join(',')})
 AND has_table_privilege(current_user,c.oid,'DELETE,TRUNCATE')) AS no_destructive_billing_access,
 NOT EXISTS(SELECT 1 FROM required e JOIN pg_catalog.pg_class c ON c.relname=e.name
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) p(privilege)
 WHERE n.nspname='public' AND has_table_privilege(current_user,c.oid,p.privilege) IS DISTINCT FROM (p.privilege=ANY(e.rights)))
 AND NOT EXISTS(SELECT 1 FROM required e JOIN pg_catalog.pg_class c ON c.relname=e.name
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid
 CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','REFERENCES']) p(privilege)
 WHERE n.nspname='public' AND a.attnum>0 AND NOT a.attisdropped AND NOT p.privilege=ANY(e.rights)
 AND has_column_privilege(current_user,c.oid,a.attnum,p.privilege))
 AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) p(privilege)
 WHERE n.nspname='public' AND c.relkind IN('r','p','v','m','f') AND NOT EXISTS(SELECT 1 FROM required e WHERE e.name=c.relname)
 AND has_table_privilege(current_user,c.oid,p.privilege)) AS exact_public_dml,
 NOT EXISTS(SELECT 1 FROM parsers e WHERE NOT EXISTS(
 SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 JOIN pg_catalog.pg_roles owner ON owner.oid=p.proowner
 WHERE n.nspname='audit_contract' AND p.proname=e.name AND oidvectortypes(p.proargtypes)='text, text, text'
 AND p.prorettype='jsonb'::regtype AND p.prosecdef AND p.provolatile='s'
 AND owner.rolname='fm_audit_contract_owner' AND NOT(owner.rolcanlogin OR owner.rolsuper OR owner.rolbypassrls)
 AND cardinality(p.proconfig)=1 AND regexp_replace(p.proconfig[1],'[[:space:]]','','g')='search_path=pg_catalog,pg_temp'
 AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')=e.hash)) AS expected_audit_parsers,
 (SELECT count(*) FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal
 AND t.tgenabled='O' AND (c.relname,t.tgname) IN (
 ('billing_offer_revisions','billing_offer_immutable'),('billing_price_mappings','billing_price_identity_immutable'),
 ('billing_offer_settings','billing_offer_settings_cas'),('billing_subscriptions','billing_subscription_offer_immutable')))=4 AS immutable_guards`;
const rights=Object.freeze([
 ...APP_TABLES.map(name=>({name,rights:['SELECT','INSERT','UPDATE',...(DELETE_TABLES.includes(name)?['DELETE']:[])]})),
 {name:'user_search_locations',rights:['SELECT','INSERT','UPDATE','DELETE']},
 ...BILLING_TABLES.map(name=>({name,rights:['SELECT','INSERT','UPDATE']})),
 ...BILLING_V2_TABLES.map(name=>({name,rights:BILLING_V2_RIGHTS[name]})),
]);
const parameters=Object.freeze([JSON.stringify(rights),JSON.stringify(EXPECTED_BILLING_PARSERS)]);
export function billingApplicationReadinessArguments(){return [...parameters];}
const keys=Object.freeze(['restricted_principal','expected_version','expected_table_count','required_dml','no_destructive_billing_access','exact_public_dml','expected_audit_parsers','immutable_guards']);
export function assertBillingApplicationReadiness(rows){
 if(!Array.isArray(rows)||rows.length!==1||!rows[0]||Object.keys(rows[0]).length!==keys.length||keys.some(key=>rows[0][key]!==true)){
  const error=new Error('BILLING_DB_NOT_READY');error.code='BILLING_DB_NOT_READY';throw error;
 }
}
