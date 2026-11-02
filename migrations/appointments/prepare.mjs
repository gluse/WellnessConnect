// Local file generation only: no credentials, network or SQL execution.
import {writeFile} from "node:fs/promises";
import * as schema from "../../shared/schema.ts";
import {appointmentDDL,appointmentRuntimeContract,APPOINTMENT_PRIVATE_TABLES} from "./contract.mjs";
const tableSql=APPOINTMENT_PRIVATE_TABLES.map(name=>`'${name}'`).join(",");
const preamble=`-- Group appointments expansion. PREPARED ONLY; never applied by this script.
-- Apply separately with a reviewed postgres PG17 connection, stop on any error.
BEGIN;
SET TRANSACTION READ WRITE;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL idle_in_transaction_session_timeout='60s';
SET LOCAL search_path=pg_catalog,pg_temp;
DO $appointments$ BEGIN
 IF current_user<>session_user OR current_user<>'postgres'
 OR current_setting('server_version_num')::integer/10000<>17
 OR (SELECT count(*) FROM pg_catalog.pg_roles WHERE rolname IN
 ('fm_app_runtime','fmt_app_dev','fmt_audit_capture_dev','fmt_audit_worker_dev','anon','authenticated','service_role'))<>7
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relname=ANY(ARRAY[${tableSql}]::text[]))
 THEN RAISE EXCEPTION 'Appointments expansion preconditions failed; inspect target and do not retry blindly'; END IF;
END $appointments$;
-- BEGIN GENERATED APPOINTMENTS DDL
`;
const postamble=`
-- END GENERATED APPOINTMENTS DDL
-- Existing closed reservations predate message history. Anchor them at migration
-- time conservatively, never guess a closure instant from timezone-less legacy
-- updated_at or allow an early content purge. New terminal transitions snapshot
-- the actual closure time in application code; later payment updates preserve it.
UPDATE public.bookings SET closed_at=statement_timestamp()
WHERE status IN ('cancelled','completed') AND closed_at IS NULL;
${APPOINTMENT_PRIVATE_TABLES.map(name=>`REVOKE ALL ON TABLE public.${name} FROM PUBLIC, anon, authenticated, service_role, fm_app_runtime, fmt_app_dev, fmt_audit_capture_dev, fmt_audit_worker_dev;`).join("\n")}
DO $privacy$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_class c,
  LATERAL pg_catalog.aclexplode(coalesce(c.relacl,pg_catalog.acldefault('r',c.relowner))) a
  WHERE c.relnamespace='public'::regnamespace AND c.relname IN (${tableSql}) AND a.grantee<>c.relowner)
 THEN RAISE EXCEPTION 'Unexpected appointments default privileges; inspect target before retry'; END IF;
END $privacy$;
SELECT true AS appointments_expansion_created;
COMMIT;
`;
await writeFile(new URL("./0016_appointments.sql",import.meta.url),preamble+await appointmentDDL(schema)+postamble);
await writeFile(new URL("./runtime-contract.json",import.meta.url),JSON.stringify(appointmentRuntimeContract(schema),null,2)+"\n");
console.log("Prepared appointments SQL/manifest files only. No database or service accessed.");

