// Offline schema/SQL/readiness checks only. No env files, DB, auth or services.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import * as schema from '../../shared/schema.ts';
import {wishlistDDL,wishlistSnapshots,wishlistRuntimeContract,WISHLIST_PRIVATE_TABLES} from './contract.mjs';
import {WISHLIST_RUNTIME_CONTRACT_JSON,WISHLIST_RUNTIME_RIGHTS,WISHLIST_READINESS_CTES,WISHLIST_READINESS_SELECT} from './runtime-contract.mjs';
import {WISHLIST_APPLICATION_READINESS_SQL,WISHLIST_APPLICATION_READINESS_KEYS,wishlistApplicationReadinessArguments,assertWishlistApplicationReadiness} from './application-readiness.mjs';
import {billingApplicationReadinessArguments} from '../billing/application-readiness.mjs';
import {canonicalNotificationExpression} from '../notifications/normalize-expression.mjs';
let checks=0;const check=fn=>{fn();checks++;};
const ddl=await readFile(new URL('./0018_wishlist.sql',import.meta.url),'utf8');
const runtime=await readFile(new URL('./0019_wishlist_runtime.sql',import.meta.url),'utf8');
const expectedDDL=await wishlistDDL(schema);
const manifest=JSON.parse(await readFile(new URL('./runtime-contract.json',import.meta.url),'utf8'));
const generated=ddl.split('-- BEGIN GENERATED WISHLIST DDL\n')[1]?.split('\n-- END GENERATED WISHLIST DDL')[0];
check(()=>assert.ok(generated,'reviewable generated section'));
check(()=>assert.equal(generated.replaceAll('\r',''),expectedDDL.replaceAll('\r','')));
check(()=>assert.doesNotMatch(generated,/(?:^|;)\s*(?:DROP|TRUNCATE|INSERT|UPDATE|DELETE)\b/im));
check(()=>assert.deepEqual([...generated.matchAll(/CREATE TABLE "public"\."([^"]+)"/g)].map(m=>m[1]).sort(),[...WISHLIST_PRIVATE_TABLES].sort()));
const {previous,current}=wishlistSnapshots(schema);
for(const [name,table] of Object.entries(previous.tables))check(()=>assert.deepEqual(table,current.tables[name],'existing table unchanged '+name));
const profile=wishlistRuntimeContract(schema);
check(()=>assert.deepEqual(manifest,profile));
check(()=>assert.equal(WISHLIST_RUNTIME_CONTRACT_JSON,JSON.stringify(profile)));
check(()=>assert.equal(profile.columns.length,31));
check(()=>assert.equal(profile.constraints.length,22));
check(()=>assert.equal(profile.constraints.filter(row=>row.type==='f').length,13));
check(()=>assert.equal(profile.constraints.filter(row=>row.type==='c').length,4));
check(()=>assert.equal(profile.indexes.length,22));
for(const table of WISHLIST_PRIVATE_TABLES){
 check(()=>assert.equal(current.tables[`public.${table}`].isRLSEnabled,true));
 check(()=>assert.ok(ddl.includes(`REVOKE ALL ON TABLE public.${table} FROM PUBLIC, anon, authenticated, service_role, fm_app_runtime, fmt_app_dev, fmt_audit_capture_dev, fmt_audit_worker_dev;`)));
 check(()=>assert.ok(runtime.includes(`GRANT SELECT,INSERT,UPDATE,DELETE ON public.${table} TO fm_app_runtime;`)));
 check(()=>assert.ok(runtime.includes(`CREATE POLICY fmt_wishlist_server ON public.${table} FOR ALL TO fm_app_runtime USING(true) WITH CHECK(true);`)));
 check(()=>assert.deepEqual(WISHLIST_RUNTIME_RIGHTS.find(row=>row.name===table).rights,['SELECT','INSERT','UPDATE','DELETE']));
}
for(const fk of profile.constraints.filter(row=>row.type==='f')){
 check(()=>assert.equal(fk.onDelete,'c','cleanup cascade '+fk.name));
 check(()=>assert.deepEqual(fk.referenceColumns,['id']));
}
const idx=name=>profile.indexes.find(row=>row.name===name);
const shape=name=>profile.constraints.find(row=>row.name===name).expression;
const column=(table,name)=>profile.columns.find(row=>row.table===table&&row.name===name);
check(()=>assert.deepEqual(profile.constraints.find(row=>row.table==='wishlist_services'&&row.type==='p').columns,['user_id','service_id']));
check(()=>assert.deepEqual(profile.constraints.find(row=>row.table==='booking_message_reads'&&row.type==='p').columns,['user_id','message_id','context_key']));
check(()=>assert.deepEqual(profile.constraints.find(row=>row.table==='service_activity_reads'&&row.type==='p').columns,['user_id','group_id']));
check(()=>assert.deepEqual(idx('wishlist_user_saved_idx').columns,['user_id','saved_at','service_id']));
check(()=>assert.deepEqual(idx('wishlist_user_saved_idx').descending,[false,true,true]));
check(()=>assert.deepEqual(idx('product_wishlist_daily_identity').columns,['user_id','service_id','reporting_day']));
check(()=>assert.equal(idx('product_wishlist_daily_identity').unique,true));
check(()=>assert.equal(idx('product_wishlist_daily_identity').predicate,"kind='wishlist_additions'"));
check(()=>assert.equal(idx('product_activity_pending_idx').predicate,'processed_atisnull'));
check(()=>assert.deepEqual(idx('service_activity_group_identity').columns,['kind','service_id','reporting_day','scope_key']));
check(()=>assert.equal(idx('service_activity_group_identity').unique,true));
check(()=>assert.deepEqual(idx('service_activity_scope_day_idx').descending,[false,true,true]));
check(()=>assert.equal(column('product_activity_events','user_id').notNull,false,'anonymous views allowed'));
for(const table of ['product_activity_events','service_activity_groups']){
 check(()=>assert.equal(column(table,'reporting_day').type,'date'));
 check(()=>assert.equal(column(table,'expires_at').type,'timestamp with time zone'));
 check(()=>assert.equal(column(table,'expires_at').notNull,true));
}
check(()=>assert.match(shape('product_activity_shape'),/user_idisnotnull/));
check(()=>assert.match(shape('product_activity_shape'),/reporting_day=occurred_atattimezone'utc'::date/));
check(()=>assert.match(shape('product_activity_shape'),/'2160:00:00'::interval/));
check(()=>assert.match(shape('product_activity_shape'),/processed_atisnullorprocessed_at>=occurred_at/));
check(()=>assert.match(shape('service_activity_group_shape'),/count>0andrevision>0/));
check(()=>assert.match(shape('service_activity_group_shape'),/scope_key=casewhencompany_idisnullthen'provider:'\|\|provider_idelse'company:'\|\|company_idend/));
check(()=>assert.match(shape('booking_message_read_context_check'),/provider:company:\[1-9\]\[0-9\]\*\$/));
check(()=>assert.equal(column('booking_message_reads','context_key').type,'character varying(100)'));
check(()=>assert.equal(shape('service_activity_read_revision_check'),'read_revision>=0'));
check(()=>assert.doesNotMatch(profile.columns.map(row=>row.name).join(','),/body|email|phone|token|search|latitude|longitude/));
// Static PG17 deparser fixtures; these are not connected catalog evidence.
const eventDeparsed=`(((kind)::text = ANY ((ARRAY['wishlist_additions'::character varying,'service_views'::character varying])::text[])) AND (((kind)::text <> 'wishlist_additions'::text) OR (user_id IS NOT NULL)) AND (reporting_day = ((occurred_at AT TIME ZONE 'UTC'::text))::date) AND (expires_at > occurred_at) AND (expires_at <= (occurred_at + '2160:00:00'::interval)) AND ((processed_at IS NULL) OR (processed_at >= occurred_at)))`;
check(()=>assert.equal(canonicalNotificationExpression(eventDeparsed),shape('product_activity_shape')));
const groupDeparsed=`(((kind)::text = ANY ((ARRAY['wishlist_additions'::character varying,'service_views'::character varying])::text[])) AND (count > 0) AND (revision > 0) AND (expires_at > updated_at) AND ((scope_key)::text = CASE WHEN (company_id IS NULL) THEN ('provider:'::text || (provider_id)::text) ELSE ('company:'::text || (company_id)::text) END))`;
check(()=>assert.equal(canonicalNotificationExpression(groupDeparsed),shape('service_activity_group_shape')));
check(()=>assert.match(WISHLIST_READINESS_CTES,/\$5::jsonb/));
check(()=>assert.match(WISHLIST_READINESS_CTES,/descending boolean\[\]/));
for(const token of ['convalidated','indisready','indisvalid','indoption','a.grantee<>c.relowner','pg_catalog.pg_attribute att','polwithcheck','fmt_wishlist_server'])check(()=>assert.ok(WISHLIST_READINESS_SELECT.includes(token),token));
const historical=billingApplicationReadinessArguments(),args=wishlistApplicationReadinessArguments();
check(()=>assert.equal(historical.length,4));
check(()=>assert.equal(JSON.parse(historical[0]).length,35,'historical integrated profile unchanged'));
check(()=>assert.equal(args.length,5));
check(()=>assert.equal(args[4],JSON.stringify(profile)));
check(()=>assert.equal(JSON.parse(args[0]).length,40));
check(()=>assert.equal(new Set(JSON.parse(args[0]).map(row=>row.name)).size,40));
check(()=>assert.deepEqual(args.slice(1,4),historical.slice(1)));
check(()=>assert.equal(WISHLIST_APPLICATION_READINESS_KEYS.length,26));
const valid=Object.fromEntries(WISHLIST_APPLICATION_READINESS_KEYS.map(key=>[key,true]));
check(()=>assert.doesNotThrow(()=>assertWishlistApplicationReadiness([valid])));
for(const key of WISHLIST_APPLICATION_READINESS_KEYS){
 check(()=>assert.ok(WISHLIST_APPLICATION_READINESS_SQL.includes(' AS '+key),key));
 for(const value of [false,null,undefined])check(()=>assert.throws(()=>assertWishlistApplicationReadiness([{...valid,[key]:value}]),error=>error.code==='BILLING_DB_NOT_READY'&&JSON.stringify(error.checks)===JSON.stringify([key])));
}
for(const rows of [[],[valid,valid],[{...valid,extra:true}],[{}],null])check(()=>assert.throws(()=>assertWishlistApplicationReadiness(rows),error=>error.code==='BILLING_DB_NOT_READY'&&JSON.stringify(error.checks)===JSON.stringify(['readiness_result_shape'])));
for(const sql of [ddl,runtime]){
 check(()=>assert.match(sql,/PREPARED, NOT APPLIED/));
 check(()=>assert.match(sql,/do not retry blindly/));
 check(()=>assert.match(sql,/statement_timeout='60s'/));
 check(()=>assert.doesNotMatch(sql,/TO\s+(?:PUBLIC|anon|authenticated|service_role)\b/i));
 check(()=>assert.doesNotMatch(sql,/(?:^|;)\s*(?:DROP|TRUNCATE|DELETE|UPDATE|INSERT)\b/im));
}
const inert=spawnSync(process.execPath,['--input-type=module','-e',"await import('./migrations/wishlist/application-readiness.mjs');process.stdout.write('inert')"],{encoding:'utf8'});
check(()=>assert.equal(inert.status,0,inert.stderr));
check(()=>assert.equal(inert.stdout,'inert'));
console.log(`Passed ${checks} offline wishlist ORM/SQL, UTC90 history, cascades, receipts, private runtime and integrated40 readiness checks. No database or services accessed.`);
