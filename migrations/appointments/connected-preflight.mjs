// Exact user-approved SOURCE only; bounded read-only inspection, no retry.
// No app startup, audit connection, data export, migration, grants or purge.
import {parse} from 'dotenv';
import {privatePreflight,privateRead,connection,trustedCA,client,connect,requireThat,safeCode} from '../audit/runtime-support.mjs';
const emit=data=>process.stdout.write(JSON.stringify(data)+'\n');
let stage='private_source_config';
try {
 const sid=privatePreflight();
 const input=privateRead('.env.audit-setup.local',sid);
 const names=[...input.matchAll(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/gm)].map(match=>match[1]);
 requireThat(new Set(names).size===names.length,'DUPLICATE_ENV_KEY');
 const value=parse(input).AUDIT_SETUP_SOURCE_DATABASE_URL;
 const configured=connection(value,'source','postgres'),ca=trustedCA(configured);
 emit({stage,passed:true,target:'hbkooiknruimukkhshrk',sourceOnly:true,ownerCredentialPresent:true});
 stage='source_readonly_preflight';
 const x=await client(value,'source',ca,'postgres');
 try {
  await connect(x);
  await x.query('BEGIN TRANSACTION READ ONLY');
  const identity=(await x.query(`SELECT current_user=session_user AND current_user='postgres' AS expected_principal,
   current_setting('server_version_num')::integer/10000=17 AS expected_version,
   current_database()='postgres' AS expected_database,current_setting('transaction_read_only')='on' AS read_only,
   (SELECT count(*)::integer FROM pg_catalog.pg_class WHERE relnamespace='public'::regnamespace AND relkind IN('r','p')) AS public_table_count,
   to_regclass('public.booking_messages') IS NULL AND to_regclass('public.booking_reschedule_requests') IS NULL AS new_tables_absent,
   NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='public.bookings'::regclass AND attname='closed_at' AND NOT attisdropped) AS new_column_absent,
   (SELECT count(*)::integer FROM pg_catalog.pg_roles WHERE rolname IN ('fm_app_runtime','fmt_app_dev','fmt_audit_capture_dev','fmt_audit_worker_dev','anon','authenticated','service_role'))=7 AS expected_roles,
   current_setting('archive_mode') AS archive_mode,
   (SELECT count(*)::integer FROM pg_catalog.pg_proc WHERE pronamespace='pg_catalog'::regnamespace AND proname='pg_backup_start') AS backup_function_present,
   (SELECT count(*)::integer FROM public.bookings WHERE status IN ('completed','cancelled')) AS backfill_rows,
   (SELECT count(*)::integer FROM pg_catalog.pg_stat_activity WHERE backend_type='client backend' AND pid<>pg_backend_pid() AND datname=current_database()) AS other_client_connections`)).rows;
  requireThat(identity.length===1,'PREFLIGHT_SHAPE');const row=identity[0];
  emit({stage,passed:true,tlsVerified:true,checks:row,backupAssurance:false,backupMetadataIsNotRestoreProof:true});
  requireThat(row.expected_principal&&row.expected_version&&row.expected_database&&row.read_only&&row.new_tables_absent&&row.new_column_absent&&row.expected_roles&&row.public_table_count===33,'SOURCE_BASELINE_MISMATCH');
  await x.query('COMMIT');
  emit({stage:'readonly_complete',passed:true,writes:false,migrations:false,backupCreated:false,retry:false});
 }finally{await x.end().catch(()=>{});}
}catch(error){emit({stage,passed:false,safeCode:safeCode(error),retry:false});process.exitCode=1;}
