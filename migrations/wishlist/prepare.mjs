// LOCAL FILE PREPARATION ONLY. No env files, credentials, connections or SQL runs.
import {writeFile} from 'node:fs/promises';
import * as schema from '../../shared/schema.ts';
import {wishlistDDL,wishlistRuntimeContract,WISHLIST_PRIVATE_TABLES} from './contract.mjs';
const names=WISHLIST_PRIVATE_TABLES.map(name=>`'${name}'`).join(',');
const limits=`SET TRANSACTION READ WRITE;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL idle_in_transaction_session_timeout='60s';
SET LOCAL search_path=pg_catalog,pg_temp;`;
const roleGate=`current_user<>session_user OR current_user<>'postgres'
 OR current_setting('server_version_num')::integer/10000<>17
 OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='fm_app_runtime'
  AND NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication)`;
const preamble=`-- TASK-042 wishlist/activity/message-read expansion. PREPARED, NOT APPLIED.
-- Exact-target execution needs separate DB authorization. Stop on first failure.
BEGIN;
${limits}
DO $wishlist$ BEGIN
 IF ${roleGate}
 OR (SELECT count(*) FROM pg_catalog.pg_class WHERE relnamespace='public'::regnamespace AND relkind IN('r','p'))<>35
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_class WHERE relnamespace='public'::regnamespace AND relname IN (${names}))
 THEN RAISE EXCEPTION 'Wishlist expansion preconditions failed; inspect target and do not retry blindly'; END IF;
END $wishlist$;
-- BEGIN GENERATED WISHLIST DDL
`;
const revoke=WISHLIST_PRIVATE_TABLES.map(name=>`REVOKE ALL ON TABLE public.${name} FROM PUBLIC, anon, authenticated, service_role, fm_app_runtime, fmt_app_dev, fmt_audit_capture_dev, fmt_audit_worker_dev;`).join('\n');
const postamble=`
-- END GENERATED WISHLIST DDL
${revoke}
DO $privacy$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_class c,
  LATERAL pg_catalog.aclexplode(coalesce(c.relacl,pg_catalog.acldefault('r',c.relowner))) a
  WHERE c.relnamespace='public'::regnamespace AND c.relname IN (${names}) AND a.grantee<>c.relowner)
 THEN RAISE EXCEPTION 'Unexpected wishlist default privileges; inspect before retry'; END IF;
END $privacy$;
SELECT true AS wishlist_expansion_created;
COMMIT;
`;
const runtime=`-- TASK-042 runtime activation. PREPARED, NOT APPLIED; separate authorization.
-- App server authorization enforces account/booking/workspace boundaries.
BEGIN;
${limits}
DO $wishlist$ BEGIN
 IF ${roleGate}
 OR (SELECT count(*) FROM pg_catalog.pg_class WHERE relnamespace='public'::regnamespace AND relkind IN('r','p'))<>40
 OR (SELECT count(*) FROM pg_catalog.pg_class WHERE relnamespace='public'::regnamespace AND relname IN (${names})
  AND relkind='r' AND relrowsecurity AND NOT relforcerowsecurity AND relowner='postgres'::regrole)<>5
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_policy p JOIN pg_catalog.pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='public'::regnamespace AND c.relname IN (${names}))
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_class c,
  LATERAL pg_catalog.aclexplode(coalesce(c.relacl,pg_catalog.acldefault('r',c.relowner))) a
  WHERE c.relnamespace='public'::regnamespace AND c.relname IN (${names}) AND a.grantee<>c.relowner)
 THEN RAISE EXCEPTION 'Wishlist runtime preconditions failed; inspect target and do not retry blindly'; END IF;
END $wishlist$;
${WISHLIST_PRIVATE_TABLES.map(name=>`GRANT SELECT,INSERT,UPDATE,DELETE ON public.${name} TO fm_app_runtime;
CREATE POLICY fmt_wishlist_server ON public.${name} FOR ALL TO fm_app_runtime USING(true) WITH CHECK(true);`).join('\n')}
SELECT true AS wishlist_runtime_created;
COMMIT;
`;
await writeFile(new URL('./0018_wishlist.sql',import.meta.url),preamble+await wishlistDDL(schema)+postamble);
await writeFile(new URL('./0019_wishlist_runtime.sql',import.meta.url),runtime);
await writeFile(new URL('./runtime-contract.json',import.meta.url),JSON.stringify(wishlistRuntimeContract(schema),null,2)+'\n');
console.log('Prepared TASK-042 SQL and metadata files only; no database or services accessed.');
