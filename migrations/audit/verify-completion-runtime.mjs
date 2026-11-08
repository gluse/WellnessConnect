// Uses existing restricted app/capture/worker/reader logins only. No role grants,
// setup credentials, schema changes, repeated business fixtures or backup.
import { privatePreflight, privateRead, readSettings, client, connect, connection, trustedCA, requireThat, emit, safeCode } from './runtime-support.mjs';
import { createCaptureRuntime, createWorkerRuntime } from '../../server/audit/runtime.ts';
import { createAuditWorker } from '../../server/audit/worker.ts';
import { createAuditViewerStore } from '../../server/audit/viewer-runtime.ts';
import { parseAuditViewerFilters, buildAuditViewerQuery } from '../../server/audit/viewer.ts';
import { createAuditContext } from '../../server/audit/context.ts';
import { createAuditEvent } from '../../server/audit/events.ts';
import { canonicalAuditJson } from '../../server/audit/canonical.ts';

const CATEGORY = 'audit-completion-check-0008';
const RUN_ID = '00000008-0000-4000-8000-000000000009';
const EVENT_ID = '00000008-0000-4000-8000-000000000008';
const select = (text, names) => readSettings(text.split(/\r?\n/).filter(line => names.some(name => new RegExp('^\\s*(?:export\\s+)?' + name + '\\s*=').test(line))).join('\n'));
let worker, reader, capture, appClient, stage = 'private-configuration';
try {
  const mode = process.argv[2]; requireThat(['inspect', 'deliver-existing', 'verify-capture'].includes(mode), 'MODE_REJECTED');
  const sid = privatePreflight();
  const app = select(privateRead('.env', sid), ['DATABASE_URL','AUDIT_ENABLED','AUDIT_ENVIRONMENT','AUDIT_AUTH_EVENTS_ENABLED','AUDIT_PRODUCER_CONTRACT','AUDIT_CAPTURE_DATABASE_URL','AUDIT_READER_DATABASE_URL']);
  const workerEnvironment = select(privateRead('.env.audit-worker.local', sid), ['AUDIT_ENVIRONMENT','AUDIT_WORKER_ENABLED','AUDIT_SOURCE_DATABASE_URL','AUDIT_DATABASE_URL']);
  stage = 'restricted-worker-readiness'; worker = await createWorkerRuntime(workerEnvironment);
  reader = createAuditViewerStore(() => app);
  const signal = new AbortController().signal;
  const from = new Date(Date.now() - 86400_000).toISOString();
  const businessQuery = () => buildAuditViewerQuery(parseAuditViewerFilters({ from, targetType:'database_record', targetId:'categories:' + CATEGORY, limit:25 }));
  const viewerQuery = () => buildAuditViewerQuery(parseAuditViewerFilters({ from, operationId:RUN_ID, limit:25 }));
  const inspect = async () => {
    const health = await worker.ports.health(signal), business = await reader.query(businessQuery()), viewer = await reader.query(viewerQuery());
    emit('completion-runtime-state', { health, syntheticBusinessRecords:business.length, syntheticViewerRecords:viewer.length, permissionChanges:false });
    return { health, business, viewer };
  };
  const deliver = async () => {
    const before = await worker.ports.health(signal);
    requireThat(before.pending <= 25 && before.leased === 0 && before.quarantined === 0 && before.expired === 0, 'BACKLOG_REQUIRES_REVIEW');
    const runner = createAuditWorker(worker.ports, { batchSize:25, timeoutMs:5000, pollMs:100 });
    await runner.step(signal);
    const metrics = runner.snapshot(), health = await runner.health(signal);
    emit('completion-bounded-delivery', { metrics, health, existingRestrictedRolesOnly:true });
    requireThat(metrics.sourceFailures === 0 && metrics.destinationFailures === 0 && metrics.quarantined === 0 && metrics.captureGaps === 0 && health.pending === 0 && health.leased === 0, 'DELIVERY_STOPPED_RECONCILE');
  };
  if (mode === 'inspect') { stage='bounded-reader-inspection'; await inspect(); }
  if (mode === 'deliver-existing') { stage='existing-outbox-delivery'; await deliver(); stage='delivered-synthetic-evidence'; const state=await inspect(); requireThat(state.business.length===3, 'SYNTHETIC_BUSINESS_EVIDENCE_MISMATCH'); }
  if (mode === 'verify-capture') {
    stage='reconcile-prior-synthetic-run'; const state=await inspect();
    requireThat(state.health.pending===0&&state.health.leased===0&&state.health.quarantined===0&&state.business.length===3&&state.viewer.length===0, 'SYNTHETIC_RUN_REQUIRES_REVIEW');
    requireThat(new Set(state.business.map(row=>row.envelope.eventName)).size===3&&state.business.every(row=>row.envelope.changes.every(change=>change.redacted===true&&!('before'in change)&&!('after'in change))), 'BUSINESS_REDACTION_REJECTED');
    const source = connection(app.DATABASE_URL,'source','fmt_app_dev');
    appClient=await client(app.DATABASE_URL,'source',trustedCA(source),'fmt_app_dev');await connect(appClient);
    requireThat((await appClient.query('SELECT NOT EXISTS(SELECT 1 FROM public.categories WHERE key=$1) AS absent',[CATEGORY])).rows[0]?.absent===true,'SYNTHETIC_CATEGORY_REMAINED');
    const event=createAuditEvent(createAuditContext({actor:{kind:'user',userId:RUN_ID,effectiveRole:'support'},scope:{kind:'global'},target:{type:'request'},source:{application:'fitsmytime',environment:'development',component:'audit'},requestId:RUN_ID,operationId:RUN_ID}),{eventName:'audit.records_viewed.v1',outcome:'succeeded',changes:[]},{now:()=>new Date(),newId:()=>EVENT_ID});
    stage='restricted-capture';capture=await createCaptureRuntime(app);await capture.capture(event);
    stage='same-event-idempotence';await capture.capture(event);
    stage='captured-event-delivery';await deliver();
    stage='reader-hash-verification';const result=await reader.query(viewerQuery());
    requireThat(result.length===1&&result[0].event_id===EVENT_ID&&canonicalAuditJson(result[0].envelope)===event.canonicalJson,'VIEWER_HASH_MISMATCH');
    emit('completion-runtime-verified',{passed:true,syntheticBusinessRecords:3,syntheticViewerRecords:1,hashPreserved:true,idempotentCapture:true,sourceFixtureAbsent:true,businessMutationsRepeated:false,permissionChanges:false,backupTaken:false,syntheticRunId:RUN_ID});
  }
} catch(error) { emit('completion-runtime-stopped',{stage,code:safeCode(error),errorClass:error?.name,automaticRetry:false});process.exitCode=1; }
finally { if(appClient)await appClient.end();if(capture)await capture.close();if(reader)await reader.close();if(worker)await worker.close(); }
