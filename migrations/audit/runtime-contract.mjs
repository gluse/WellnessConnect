// Closed development rehearsal contract. Contains no credentials or I/O.
import assert from 'node:assert/strict';
export const RUN_ID = 'a0140000-0000-4000-8000-000000000001';
export const EVENT_IDS = Object.freeze([
 'a0140001-0000-4000-8000-000000000001','a0140001-0000-4000-8000-000000000002',
 'a0140001-0000-4000-8000-000000000003','a0140001-0000-4000-8000-000000000004',
 'a0140001-0000-4000-8000-000000000005','a0140001-0000-4000-8000-000000000006',
 'a0140001-0000-4000-8000-000000000007','a0140001-0000-4000-8000-000000000008',
 'a0140001-0000-4000-8000-000000000009','a0140001-0000-4000-8000-00000000000a',
 'a0140001-0000-4000-8000-00000000000b','a0140001-0000-4000-8000-00000000000c']);
export const TARGETS = Object.freeze({source:'hbkooiknruimukkhshrk',destination:'ynygqodmtgjrngiudalw'});
export const ROLES = Object.freeze({app:'fmt_app_dev',capture:'fmt_audit_capture_dev',worker:'fmt_audit_worker_dev',writer:'fmt_audit_writer_dev',test:'fmt_audit_test_dev'});
export const APP_TABLES = Object.freeze(['sessions','users','companies','company_memberships','company_invitations',
 'provider_subscriptions','storefronts','employees','categories','addresses','services','geocoding_cache',
 'bookings','service_reviews','service_embeddings','availability']);
export const DELETE_TABLES = Object.freeze(['sessions','employees','categories','addresses','services',
 'service_reviews','service_embeddings','company_memberships']);
export const APP_SEQUENCES = Object.freeze(['companies_id_seq','provider_subscriptions_id_seq','storefronts_id_seq',
 'employees_id_seq','addresses_id_seq','services_id_seq','bookings_id_seq','service_reviews_id_seq',
 'service_embeddings_id_seq','availability_id_seq']);
export const SCENARIOS = Object.freeze(['rollback-visibility','abort-on-enqueue-error','concurrent-a','concurrent-b',
 'claim-crash','commit-before-ack','conflict','transport-outage','reserved-9','reserved-10','reserved-11','reserved-12']);
export function assertCohort(rows) {
  assert(Array.isArray(rows));
  for (const row of rows) assert(EVENT_IDS.includes(row.event_id), 'NON_COHORT_QUEUE');
}
export function fixtureEnvelope(index, occurredAt = new Date().toISOString(), reasonCode='UNAUTHENTICATED') {
  assert(Number.isInteger(index) && index>=0 && index<EVENT_IDS.length);
  return {eventId:EVENT_IDS[index],schemaVersion:1,catalogVersion:1,occurredAt,
    eventName:'security.action_denied.v1',outcome:'denied',reasonCode,changes:[],retentionClass:'S',
    actor:{kind:'anonymous'},scope:{kind:'unknown'},target:{type:'request'},
    requestId:EVENT_IDS[index],operationId:RUN_ID,
    source:{application:'fitsmytime',environment:'development',component:'authorization'}};
}
