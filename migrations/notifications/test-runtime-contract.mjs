// Offline current-application readiness integration. No database/config/network.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {NOTIFICATION_RUNTIME_TABLES,NOTIFICATION_RUNTIME_RIGHTS,NOTIFICATION_RUNTIME_CONTRACT_JSON,NOTIFICATION_READINESS_SELECT} from './runtime-contract.mjs';
import {canonicalNotificationExpression,canonicalCatalogExpression} from './normalize-expression.mjs';
import {BILLING_APPLICATION_READINESS_KEYS,BILLING_APPLICATION_READINESS_SQL,billingApplicationReadinessArguments,assertBillingApplicationReadiness} from '../billing/application-readiness.mjs';
let checks=0;const check=fn=>{fn();checks++;};
const [rightsJson,parsersJson,notificationsJson]=billingApplicationReadinessArguments();
const profile=JSON.parse(notificationsJson), rights=JSON.parse(rightsJson);
check(()=>assert.equal(rights.length,33));
check(()=>assert.equal(new Set(rights.map(row=>row.name)).size,33));
check(()=>assert.equal(JSON.parse(parsersJson).length,3));
check(()=>assert.equal(notificationsJson,NOTIFICATION_RUNTIME_CONTRACT_JSON));
check(()=>assert.equal(profile.tables.length,6));
check(()=>assert.equal(profile.columns.length,57));
check(()=>assert.equal(profile.indexes.length,23));
check(()=>assert.equal(profile.constraints.filter(c=>c.type==='c').length,13));
check(()=>assert.equal(profile.constraints.filter(c=>c.type==='f').length,5));
check(()=>assert.equal(profile.constraints.filter(c=>c.type==='p').length,6));
for(const name of NOTIFICATION_RUNTIME_TABLES) check(()=>assert.deepEqual(rights.find(row=>row.name===name).rights,['SELECT','INSERT','UPDATE','DELETE']));
check(()=>assert.equal(Object.isFrozen(NOTIFICATION_RUNTIME_RIGHTS),true));
check(()=>assert.match(BILLING_APPLICATION_READINESS_SQL,/\(SELECT count\(\*\) FROM required\)/));
check(()=>assert.doesNotMatch(BILLING_APPLICATION_READINESS_SQL,/>=\s*27|=27 AS expected_table_count/));
for(const key of BILLING_APPLICATION_READINESS_KEYS)check(()=>assert.match(BILLING_APPLICATION_READINESS_SQL,new RegExp(` AS ${key}\\b`)));
for(const token of ['indisvalid','indisready','convalidated','confdeltype','attnotnull','has_column_privilege','has_schema_privilege','pg_catalog.aclexplode','polroles','polwithcheck'])check(()=>assert.ok(BILLING_APPLICATION_READINESS_SQL.includes(token),token));
check(()=>assert.match(NOTIFICATION_READINESS_SELECT,/a\.grantee<>c\.relowner/));
check(()=>assert.match(NOTIFICATION_READINESS_SELECT,/NOT has_schema_privilege\(current_user,'public','CREATE'\)/));
const good=Object.fromEntries(BILLING_APPLICATION_READINESS_KEYS.map(key=>[key,true]));
check(()=>assert.doesNotThrow(()=>assertBillingApplicationReadiness([good])));
for(const key of BILLING_APPLICATION_READINESS_KEYS)for(const value of [false,null,undefined,'true',1]){
 check(()=>assert.throws(()=>assertBillingApplicationReadiness([{...good,[key]:value}]),error=>error.code==='BILLING_DB_NOT_READY'&&error.message==='BILLING_DB_NOT_READY'&&JSON.stringify(error.checks)===JSON.stringify([key])));
}
for(const rows of [[],[good,good],[{...good,private_catalog_value:'PRIVATE_CANARY'}]])check(()=>assert.throws(()=>assertBillingApplicationReadiness(rows),error=>JSON.stringify(error.checks)==='["readiness_result_shape"]'&&!JSON.stringify(error).includes('PRIVATE_CANARY')));
// Known PostgreSQL 17 deparser representations, not live catalog evidence.
const deparserFixtures=[
 ['services_reminder_settings_check',`(((reminder_method)::text = ANY ((ARRAY['email'::character varying, 'sms'::character varying, 'whatsapp'::character varying])::text[])) AND ((reminder_hours >= 1) AND (reminder_hours <= 168)))`],
 ['communication_preferences_language_check',`((language)::text = ANY ((ARRAY['en'::character varying,'lv'::character varying,'ru'::character varying,'ar'::character varying,'zh'::character varying,'fr'::character varying,'de'::character varying,'hi'::character varying,'ja'::character varying,'pt'::character varying,'es'::character varying])::text[]))`],
 ['notification_callback_shape',`(((provider)::text = ANY ((ARRAY['vonage'::character varying,'resend'::character varying])::text[])) AND (length(btrim((provider_event_id)::text)) > 0))`],
 ['notification_callback_shape',`(((provider)::text = ANY ((ARRAY['vonage'::character varying,'resend'::character varying])::text[])) AND (length(TRIM(BOTH FROM provider_event_id)) > 0))`],
 ['notification_event_shape',`((booking_revision >= 0) AND ((kind)::text = ANY ((ARRAY['accepted'::character varying,'rejected'::character varying,'rescheduled'::character varying,'reminder'::character varying])::text[])) AND ((length(TRIM(BOTH FROM timezone)) >= 1) AND (length(TRIM(BOTH FROM timezone)) <= 100)) AND (((kind)::text <> 'rescheduled'::text) OR (previous_scheduled_date IS NOT NULL)))`],
 ['bookings_notification_revision_check',`(notification_revision >= 0)`],
];
for(const[name,expr]of deparserFixtures)check(()=>assert.equal(canonicalNotificationExpression(expr),profile.constraints.find(c=>c.name===name).expression,name));
const defaultTrim=canonicalNotificationExpression('length(trim(timezone)) > 0');
for(const expr of ['length(TRIM(BOTH FROM timezone)) > 0','length(TRIM( BOTH  FROM  (timezone)::text)) > 0','length(btrim(timezone)) > 0'])check(()=>assert.equal(canonicalNotificationExpression(expr),defaultTrim));
for(const expr of ["length(TRIM(BOTH 'x' FROM timezone)) > 0",'length(TRIM(LEADING FROM timezone)) > 0','length(TRIM(TRAILING FROM timezone)) > 0',"length(btrim(timezone, 'x')) > 0",'length(ltrim(timezone)) > 0','length(rtrim(timezone)) > 0'])check(()=>assert.notEqual(canonicalNotificationExpression(expr),defaultTrim,expr));
check(()=>assert.match(canonicalCatalogExpression('catalog_expression'),/TRIM\\\(\[\[:space:\]\]\*BOTH\[\[:space:\]\]\+FROM\[\[:space:\]\]\+/));
const original=profile.constraints.find(c=>c.name==='services_reminder_settings_check').expression;
check(()=>assert.notEqual(canonicalNotificationExpression(`"services"."reminder_method" IN ('email','sms','whatsapp') AND "services"."reminder_hours" BETWEEN 1 AND 169`),original));
check(()=>assert.equal(canonicalNotificationExpression(`((kind)::text = 'reminder'::text)`),profile.indexes.find(i=>i.name==='notification_reminder_identity').predicate));
check(()=>assert.equal(canonicalNotificationExpression(`(phone IS NOT NULL)`),profile.indexes.find(i=>i.name==='communication_preferences_phone_idx').predicate));
const inert=spawnSync(process.execPath,['--input-type=module','-e',`
 import fs from 'node:fs';import net from 'node:net';import {syncBuiltinESMExports} from 'node:module';
 const original=fs.readFileSync;fs.readFileSync=function(file,...args){if(String(file).includes('.env'))throw Error('PRIVATE_READ');return original.call(this,file,...args);};
 net.Socket.prototype.connect=function(){throw Error('NETWORK_ACCESS');};syncBuiltinESMExports();
 await import('./migrations/notifications/runtime-contract.mjs');await import('./migrations/billing/application-readiness.mjs');process.stdout.write('inert');
`],{encoding:'utf8',windowsHide:true,shell:false});
check(()=>assert.equal(inert.status,0,inert.stderr));check(()=>assert.equal(inert.stdout,'inert'));
const runtimeSource=await readFile(new URL('./runtime-contract.mjs',import.meta.url),'utf8');
check(()=>assert.doesNotMatch(runtimeSource,/drizzle-kit|shared\/schema|dotenv|server\/db|node:fs|process\.env/));
console.log(JSON.stringify({stage:'notifications-current-app-readiness-offline',status:'passed',checks,privateFileAccess:false,databaseAccess:false,sqlExecuted:false,appStarted:false,legacyProfileSupported:false}));
