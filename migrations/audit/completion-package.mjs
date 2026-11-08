// Pure SQL builder. Import never reads private files or accesses a database.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
import {requireThat} from './runtime-support.mjs';
const directory=path.dirname(fileURLToPath(import.meta.url));
export const COMPLETION_VERSION='completion-v1-0008';
export const READER_ROLE='fmt_audit_reader_dev';
export const COMPLETION_PINS=Object.freeze({
 '0008_destination_completion.sql':'d34ac24a00d4e768bb5a2e0609de25574e0a217c1c840d0396efe146e747ba72',
 '0008_source_completion.sql':'ae2d0118bafe397982ed3b71dba48028e1d68bb82a7a1fab72afd54403ad79b6',
 '_completion_v1.sql':'e977064a1c96caaa540ec8f604052e74b803a67e6bb5537cf70f2280b272f1b8',
 '_business_triggers_v1.sql':'9db6f5eaaa994eb6b9bacbdd3a2357d604ed31171f59b04358b644bfc2e7fcdb',
});
export const BUSINESS_TABLES=Object.freeze({users:'id',companies:'id',company_memberships:'company_id,user_id',company_invitations:'id',services:'id',addresses:'id',employees:'id',availability:'id',bookings:'id',service_reviews:'id',categories:'key',storefronts:'id',provider_subscriptions:'id',workspace_pricing_settings:'id',booking_messages:'id',booking_reschedule_requests:'id',manual_pro_grants:'id',billing_offer_revisions:'id',billing_offer_settings:'singleton',billing_accounts:'id',billing_subscriptions:'id',billing_operations:'id',billing_invoices:'id',billing_events:'id',billing_price_mappings:'id',service_embeddings:'id'});
export const completionFile=target=>`0008_${target}_completion.sql`;
const digest=value=>createHash('sha256').update(value).digest('hex');
const inertRole=role=>`DO $membership$ BEGIN
 IF pg_has_role(current_user,'${role}','USAGE') OR pg_has_role(current_user,'${role}','SET') THEN RAISE EXCEPTION 'Setup owner baseline must be inert'; END IF;
 PERFORM set_config('audit_completion.${role}',(SELECT coalesce(jsonb_agg(jsonb_build_object('roleid',m.roleid,'member',m.member,'grantor',m.grantor,'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option) ORDER BY m.grantor),'[]'::jsonb)::text FROM pg_auth_members m WHERE m.roleid='${role}'::regrole AND m.member=current_user::regrole),true);
 EXECUTE format('GRANT ${role} TO %I WITH ADMIN %s, INHERIT FALSE, SET TRUE GRANTED BY %I',current_user,CASE WHEN coalesce((SELECT admin_option FROM pg_auth_members WHERE roleid='${role}'::regrole AND member=current_user::regrole AND grantor=current_user::regrole),false) THEN 'TRUE' ELSE 'FALSE' END,current_user);
END $membership$;`;
const restoreRole=role=>`DO $restore$ DECLARE original jsonb:=current_setting('audit_completion.${role}')::jsonb; prior jsonb; observed jsonb; BEGIN
 SELECT value INTO prior FROM jsonb_array_elements(original) WHERE (value->>'grantor')::oid=current_user::regrole;
 IF prior IS NULL THEN EXECUTE format('REVOKE ${role} FROM %I GRANTED BY %I RESTRICT',current_user,current_user);
 ELSE EXECUTE format('GRANT ${role} TO %I WITH ADMIN %s, INHERIT %s, SET %s GRANTED BY %I',current_user,prior->>'admin',prior->>'inherit',prior->>'set',current_user); END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('roleid',m.roleid,'member',m.member,'grantor',m.grantor,'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option) ORDER BY m.grantor),'[]'::jsonb) INTO observed FROM pg_auth_members m WHERE m.roleid='${role}'::regrole AND m.member=current_user::regrole;
 IF observed IS DISTINCT FROM original OR pg_has_role(current_user,'${role}','USAGE') OR pg_has_role(current_user,'${role}','SET') THEN RAISE EXCEPTION 'Exact completion setup membership restoration failed'; END IF;
END $restore$;`;
export function buildCompletionSQL(target){
 requireThat(['source','destination'].includes(target),'COMPLETION_TARGET_REJECTED');
 const storageOwner=`fm_audit_${target}_owner`,schema=target==='source'?'audit_capture':'audit',table=target==='source'?'audit_outbox':'events';
 const ref=target==='source'?'hbkooiknruimukkhshrk':'ynygqodmtgjrngiudalw';
 const parser=fs.readFileSync(path.join(directory,'_completion_v1.sql'),'utf8');
 const portal=fs.readFileSync(path.join(directory,'_billing_portal_v1.sql'),'utf8').match(/AS \$portal\$([\s\S]*?)\$portal\$;/)?.[1];requireThat(portal,'COMPLETION_BASE_PARSER_MISSING');
 const rows=`BEGIN;
SET TRANSACTION READ WRITE;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL idle_in_transaction_session_timeout='60s';
SET LOCAL timezone='UTC';
SET LOCAL search_path=pg_catalog,pg_temp;
DO $identity$ BEGIN IF current_user<>'postgres' OR current_user<>session_user OR current_setting('server_version_num')::integer/10000<>17 THEN RAISE EXCEPTION 'Fixed PG17 setup identity required'; END IF; END $identity$;
${inertRole('fm_audit_contract_owner')}
${inertRole(storageOwner)}
SET LOCAL ROLE fm_audit_contract_owner;
DO $baseline$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM audit_contract.installation WHERE singleton AND project_ref='${ref}' AND environment='development')
 OR NOT EXISTS(SELECT 1 FROM audit_contract.migrations WHERE version='billing-portal-v1-0007')
 OR EXISTS(SELECT 1 FROM audit_contract.migrations WHERE version='${COMPLETION_VERSION}')
 OR to_regprocedure('audit_contract.parse_event_before_completion(text,text,text)') IS NOT NULL
 OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='audit_contract.parse_event(text,text,text)'::regprocedure AND proowner=current_user::regrole AND encode(sha256(convert_to(prosrc,'UTF8')),'hex')='${digest(portal)}')
 THEN RAISE EXCEPTION 'Completion fixed baseline rejected'; END IF;
END $baseline$;
${parser}
GRANT EXECUTE ON FUNCTION audit_contract.parse_event(text,text,text) TO ${storageOwner};
INSERT INTO audit_contract.migrations(version) VALUES('${COMPLETION_VERSION}');
RESET ROLE;
SET LOCAL ROLE ${storageOwner};
ALTER TABLE ${schema}.${table} DROP CONSTRAINT service_view_retention_v1;
ALTER TABLE ${schema}.${table} ADD CONSTRAINT audit_policy_retention_v2 CHECK ((
 (envelope->>'retentionClass'='R' AND expires_at=occurred_at+interval '7776000 seconds')
 OR (envelope->>'retentionClass' IN ('B','S') AND expires_at=occurred_at+interval '31536000 seconds')) IS TRUE);
${target==='source'?`${fs.readFileSync(path.join(directory,'_business_triggers_v1.sql'),'utf8')}
GRANT EXECUTE ON FUNCTION audit_capture.business_record_changed() TO postgres;
RESET ROLE;
${Object.entries(BUSINESS_TABLES).map(([t,key])=>`CREATE TRIGGER fmt_audit_record_changed AFTER INSERT OR UPDATE OR DELETE ON public.${t} FOR EACH ROW EXECUTE FUNCTION audit_capture.business_record_changed('${key}');`).join('\n')}
SET LOCAL ROLE fm_audit_source_owner;
REVOKE EXECUTE ON FUNCTION audit_capture.business_record_changed() FROM postgres;`:''}
INSERT INTO ${schema}.schema_migrations(version) VALUES('${target}-${COMPLETION_VERSION}');
RESET ROLE;
${target==='destination'?`CREATE ROLE ${READER_ROLE} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 2;
GRANT fm_audit_reader TO ${READER_ROLE} WITH ADMIN FALSE,INHERIT TRUE,SET TRUE;
DO $reader$ BEGIN IF has_database_privilege('${READER_ROLE}',current_database(),'CREATE') OR EXISTS(SELECT 1 FROM pg_namespace n WHERE has_schema_privilege('${READER_ROLE}',n.oid,'CREATE')) OR has_table_privilege('${READER_ROLE}','audit.events','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') OR NOT has_table_privilege('${READER_ROLE}','audit.reader_events','SELECT') THEN RAISE EXCEPTION 'Reader capability mismatch'; END IF; END $reader$;`:''}
${restoreRole(storageOwner)}
${restoreRole('fm_audit_contract_owner')}
SELECT true AS completion_version_recorded;
COMMIT;
`;
 return `-- Forward development audit completion, no backup by explicit user request 7 November 2026.\n-- Target ${target} ${ref}; execute only through complete-audit-development.mjs.\n${rows}`;
}
export function loadCompletionScripts(){
 for(const[file,pin]of Object.entries(COMPLETION_PINS))requireThat(digest(fs.readFileSync(path.join(directory,file)))===pin,'COMPLETION_SQL_PIN_MISMATCH');
 return new Map(['destination','source'].map(target=>{
 const bytes=fs.readFileSync(path.join(directory,completionFile(target)),'utf8');requireThat(bytes===buildCompletionSQL(target),'COMPLETION_SQL_REVIEW_MISMATCH');
 requireThat((bytes.match(/^BEGIN;$/gm)||[]).length===1&&(bytes.match(/^COMMIT;$/gm)||[]).length===1&&!/^\s*(?:TRUNCATE|DELETE FROM public|DROP TABLE|ALTER SYSTEM|ALTER DATABASE)\b/im.test(bytes),'COMPLETION_SQL_SCOPE_REJECTED');
 return[target,bytes];
}));}
