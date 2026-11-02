// Offline checks only. No database, configuration, contacts or services.
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import * as schema from "../../shared/schema.ts";
import {appointmentDDL,appointmentRuntimeContract,appointmentSnapshots,APPOINTMENT_PRIVATE_TABLES} from "./contract.mjs";
import {APPOINTMENT_RUNTIME_TABLES,APPOINTMENT_RUNTIME_RIGHTS,APPOINTMENT_RUNTIME_CONTRACT_JSON,APPOINTMENT_READINESS_CTES,APPOINTMENT_READINESS_SELECT} from "./runtime-contract.mjs";
import {canonicalNotificationExpression} from "../notifications/normalize-expression.mjs";
import {BILLING_APPLICATION_READINESS_KEYS,BILLING_APPLICATION_READINESS_SQL,billingApplicationReadinessArguments,assertBillingApplicationReadiness} from "../billing/application-readiness.mjs";
let checks=0; const check=fn=>{fn();checks++;};
const ddl=await readFile(new URL("./0016_appointments.sql",import.meta.url),"utf8");
const runtime=await readFile(new URL("./0017_appointments_runtime.sql",import.meta.url),"utf8");
const expectedDDL=await appointmentDDL(schema);
const generated=ddl.split("-- BEGIN GENERATED APPOINTMENTS DDL\n")[1]?.split("\n-- END GENERATED APPOINTMENTS DDL")[0];
check(()=>assert.ok(generated,"reviewable DDL markers"));
check(()=>assert.equal(generated.replaceAll("\r",""),(expectedDDL).replaceAll("\r","")));

check(()=>assert.doesNotMatch(generated,/(?:^|;)\s*(?:DROP|TRUNCATE|INSERT|DELETE)\b/im));
check(()=>assert.deepEqual([...generated.matchAll(/CREATE TABLE "public"\."([^"]+)"/g)].map(m=>m[1]).sort(),[...APPOINTMENT_PRIVATE_TABLES].sort()));
const {previous,current}=appointmentSnapshots(schema);
for(const name of Object.keys(previous.tables)) {
 const compared=structuredClone(current.tables[name]);
 if(name==='public.bookings') { delete compared.columns.closed_at;delete compared.checkConstraints.bookings_closed_at_check;delete compared.indexes.bookings_message_retention_idx; }
 check(()=>assert.deepEqual(compared,previous.tables[name],"only reviewed closed_at extension changes an existing table "+name));
}
const profile=appointmentRuntimeContract(schema);
const manifestText=await readFile(new URL('./runtime-contract.json',import.meta.url),'utf8');
check(()=>assert.deepEqual(JSON.parse(manifestText),profile));
check(()=>assert.equal(APPOINTMENT_RUNTIME_CONTRACT_JSON,JSON.stringify(profile)));
check(()=>assert.deepEqual(APPOINTMENT_RUNTIME_TABLES,APPOINTMENT_PRIVATE_TABLES));
check(()=>assert.equal(profile.columns.length,25));
check(()=>assert.equal(profile.constraints.filter(c=>c.type==="f").length,5));
check(()=>assert.equal(profile.constraints.filter(c=>c.type==="c").length,4));
check(()=>assert.equal(profile.indexes.length,10));
for(const table of APPOINTMENT_PRIVATE_TABLES) {
 check(()=>assert.equal(current.tables["public."+table].isRLSEnabled,true));
 check(()=>assert.ok(ddl.includes(`REVOKE ALL ON TABLE public.${table} FROM PUBLIC, anon, authenticated, service_role, fm_app_runtime, fmt_app_dev, fmt_audit_capture_dev, fmt_audit_worker_dev;`)));
 check(()=>assert.ok(runtime.includes(`GRANT SELECT,INSERT,UPDATE,DELETE ON public.${table} TO fm_app_runtime;`)));
 check(()=>assert.ok(runtime.includes(`CREATE POLICY fmt_appointment_server ON public.${table} FOR ALL TO fm_app_runtime USING(true) WITH CHECK(true);`)));
 check(()=>assert.deepEqual(APPOINTMENT_RUNTIME_RIGHTS.find(row=>row.name===table).rights,["SELECT","INSERT","UPDATE","DELETE"]));
}
check(()=>assert.doesNotMatch(runtime,/TO\s+(?:PUBLIC|anon|authenticated|service_role)\b/i));
check(()=>assert.match(ddl,/Unexpected appointments default privileges/));
check(()=>assert.match(runtime,/a\.grantee<>c\.relowner/));
check(()=>assert.match(runtime,/do not retry blindly/));
check(()=>assert.match(APPOINTMENT_READINESS_CTES,/\$4::jsonb/));
for(const token of ["convalidated","indisready","indisvalid","a.grantee<>c.relowner","pg_catalog.pg_attribute att","polwithcheck","fmt_appointment_server"])
 check(()=>assert.ok(APPOINTMENT_READINESS_SELECT.includes(token),token));
for(const key of ["columns","constraints","indexes","private_acl","policies","schema_access"])
 check(()=>assert.ok(APPOINTMENT_READINESS_SELECT.includes("AS appointment_"+key)));
const idx=name=>profile.indexes.find(row=>row.name===name), col=(table,name)=>profile.columns.find(row=>row.table===table&&row.name===name);
check(()=>assert.deepEqual(idx("booking_message_history_idx").columns,["booking_id","created_at","id"]));
check(()=>assert.deepEqual(idx("booking_reschedule_history_idx").columns,["booking_id","created_at","id"]));
check(()=>assert.deepEqual(idx("booking_message_request_identity").columns,["author_id","client_request_id","booking_id"]));
check(()=>assert.equal(idx("booking_message_request_identity").unique,true));
check(()=>assert.deepEqual(idx("booking_reschedule_request_identity").columns,["requested_by_id","client_request_id","booking_id"]));
check(()=>assert.equal(idx("booking_reschedule_request_identity").unique,true));
check(()=>assert.equal(idx("booking_reschedule_pending_identity").unique,true));
check(()=>assert.match(idx("booking_reschedule_pending_identity").predicate,/state='pending'/));
for(const table of APPOINTMENT_PRIVATE_TABLES)
 for(const name of ["id","booking_id","client_request_id","created_at"])check(()=>assert.equal(col(table,name).notNull,true));
for(const fk of profile.constraints.filter(row=>row.type==="f")) {
 check(()=>assert.equal(fk.onDelete,fk.referenceTable==="bookings"?"c":"a"));
 check(()=>assert.deepEqual(fk.referenceColumns,["id"]));
}
const shape=name=>profile.constraints.find(row=>row.name===name).expression;
check(()=>assert.match(shape("booking_message_shape"),/4000/));
check(()=>assert.match(shape("booking_message_shape"),/broadcast_idisnullorauthor_role='provider'/));
check(()=>assert.match(shape("booking_reschedule_shape"),/base_revision>=0/));
check(()=>assert.match(shape("booking_reschedule_shape"),/2000/));
check(()=>assert.match(shape("booking_reschedule_shape"),/original_scheduled_date<>proposed_scheduled_date/));
check(()=>assert.match(shape("booking_reschedule_response_shape"),/responded_atisnotnullandresponded_by_idisnotnull/));
// Known PostgreSQL17 deparser spellings; static fixtures, not live catalog evidence.
const responseDeparser=`(((state)::text <> 'pending'::text) OR ((responded_at IS NULL) AND (responded_by_id IS NULL))) AND ((((state)::text <> 'accepted'::text) AND ((state)::text <> 'declined'::text)) OR ((responded_at IS NOT NULL) AND (responded_by_id IS NOT NULL))) AND ((responded_at IS NULL) OR (responded_at >= created_at))`;
check(()=>assert.equal(canonicalNotificationExpression(responseDeparser),shape("booking_reschedule_response_shape")));
const messageDeparser=`(((author_role)::text = ANY ((ARRAY['provider'::character varying,'customer'::character varying])::text[])) AND ((length(TRIM(BOTH FROM body)) >= 1) AND (length(TRIM(BOTH FROM body)) <= 4000)) AND (length(body) <= 4000) AND ((broadcast_id IS NULL) OR ((author_role)::text = 'provider'::text)))`;
check(()=>assert.equal(canonicalNotificationExpression(messageDeparser),shape("booking_message_shape")));
check(()=>assert.doesNotMatch(Object.keys(current.tables["public.booking_messages"].columns).join(","),/phone|email|credential|token|attachment|read_at|recipient_list/));
check(()=>assert.equal(current.tables["public.booking_messages"].columns.body.type,"text"));
check(()=>assert.equal(current.tables["public.booking_reschedule_requests"].columns.proposed_scheduled_date.type,"timestamp with time zone"));
check(()=>assert.equal(col('bookings','closed_at').notNull,false));
check(()=>assert.equal(col('bookings','closed_at').type,'timestamp with time zone'));
check(()=>assert.equal('closedAt' in schema.insertBookingSchema.shape,false,'terminal timestamp is server-owned'));
check(()=>assert.deepEqual(idx('bookings_message_retention_idx').columns,['closed_at','id']));
check(()=>assert.match(idx('bookings_message_retention_idx').predicate,/closed_atisnotnullandstatus=anyarray/));
check(()=>assert.match(ddl,/UPDATE public\.bookings SET closed_at=statement_timestamp\(\)/));
check(()=>assert.match(ddl,/WHERE status IN \('cancelled','completed'\) AND closed_at IS NULL/));
check(()=>assert.equal(profile.tables.every(table=>!Object.keys(current.tables["public."+table].columns).includes("expires_at")),true,"no unapproved expiry or automatic cancellation"));
const runtimeSource=await readFile(new URL("./runtime-contract.mjs",import.meta.url),"utf8");
check(()=>assert.doesNotMatch(runtimeSource,/dotenv|process\.env|from ['"].*(?:db|schema\.ts)|fetch\(/));
const integratedArgs=billingApplicationReadinessArguments();
check(()=>assert.equal(integratedArgs.length,4));
check(()=>assert.equal(integratedArgs[3],APPOINTMENT_RUNTIME_CONTRACT_JSON));
const integratedRights=JSON.parse(integratedArgs[0]);
check(()=>assert.equal(integratedRights.length,35));
check(()=>assert.equal(new Set(integratedRights.map(row=>row.name)).size,35));
for(const row of APPOINTMENT_RUNTIME_RIGHTS)check(()=>assert.deepEqual(integratedRights.find(right=>right.name===row.name),row));
for(const key of ['appointment_columns','appointment_constraints','appointment_indexes','appointment_private_acl','appointment_policies','appointment_schema_access']) {
 check(()=>assert.ok(BILLING_APPLICATION_READINESS_KEYS.includes(key)));
 check(()=>assert.ok(BILLING_APPLICATION_READINESS_SQL.includes(' AS '+key)));
 const result=Object.fromEntries(BILLING_APPLICATION_READINESS_KEYS.map(name=>[name,name!==key]));
 check(()=>assert.throws(()=>assertBillingApplicationReadiness([result]),error=>error.code==='BILLING_DB_NOT_READY'&&JSON.stringify(error.checks)===JSON.stringify([key])));
}
console.log(`Passed ${checks} offline appointments ORM/SQL parity, private runtime ACL/readiness, history/idempotency/request constraints and additive migration checks. No database or service accessed.`);

