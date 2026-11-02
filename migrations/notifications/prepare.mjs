// Explicit LOCAL FILE generation only. Never executes SQL or reads credentials.
import { writeFile } from "node:fs/promises";
import * as schema from "../../shared/schema.ts";
import { notificationDDL, notificationRuntimeContract, PRIVATE_TABLES } from "./contract.mjs";

const preamble = `-- TASK-032 prepared expansion only. No SQL has been applied.
BEGIN;
SET TRANSACTION READ WRITE;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL idle_in_transaction_session_timeout='60s';
SET LOCAL search_path=pg_catalog,pg_temp;
DO $notifications$ BEGIN
 IF current_user<>session_user OR current_user<>'postgres' OR current_setting('server_version_num')::integer/10000<>17
 OR (SELECT count(*) FROM pg_catalog.pg_roles WHERE rolname IN ('fm_app_runtime','fmt_app_dev','fmt_audit_capture_dev','fmt_audit_worker_dev','anon','authenticated','service_role'))<>7
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relname=ANY(ARRAY[${PRIVATE_TABLES.map(name => `'${name}'`).join(",")}]::text[]))
 THEN RAISE EXCEPTION 'Notifications expansion preconditions failed; inspect target and do not retry blindly'; END IF;
END $notifications$;
-- BEGIN GENERATED NOTIFICATIONS DDL
`;
const postamble = `
-- END GENERATED NOTIFICATIONS DDL
${PRIVATE_TABLES.map(name => `REVOKE ALL ON TABLE public.${name} FROM PUBLIC, anon, authenticated, service_role, fm_app_runtime, fmt_app_dev, fmt_audit_capture_dev, fmt_audit_worker_dev;`).join("\n")}
SELECT true AS notifications_expansion_created;
COMMIT;
`;
await writeFile(new URL("./0014_notifications.sql", import.meta.url), preamble + await notificationDDL(schema) + postamble);
await writeFile(new URL("./runtime-contract.json", import.meta.url), JSON.stringify(notificationRuntimeContract(schema), null, 2) + "\n");
console.log("Prepared additive notifications SQL file only. No database or service accessed.");
