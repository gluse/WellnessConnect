// Closed development rehearsal contract. Contains no credentials or I/O.
import assert from 'node:assert/strict';
export const RUN_ID = 'a0140000-0000-4000-8000-000000000001';
export const EVENT_IDS = Object.freeze(Array.from({length:12}, (_,i) =>
  `a0140001-0000-4000-8000-${(i+1).toString(16).padStart(12,'0')}`));
export const TARGETS = Object.freeze({source:'hbkooiknruimukkhshrk',destination:'ynygqodmtgjrngiudalw'});
export const ROLES = Object.freeze({app:'fmt_app_dev',capture:'fmt_audit_capture_dev',worker:'fmt_audit_worker_dev',writer:'fmt_audit_writer_dev',test:'fmt_audit_test_dev'});
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
