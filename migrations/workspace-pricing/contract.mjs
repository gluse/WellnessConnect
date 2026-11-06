// Offline schema metadata and SQL generation only. No private settings/connections.
import { createRequire } from 'node:module';
import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core';
import { canonicalCurrencyExpression } from '../currencies/application-readiness.mjs';
const { generateDrizzleJson, generateMigration } = createRequire(import.meta.url)('drizzle-kit/api');
const dialect = new PgDialect();
export const PRICING_TABLE = 'workspace_pricing_settings';
export const PRICING_RUNTIME_RIGHTS = Object.freeze({ name: PRICING_TABLE, rights: Object.freeze(['SELECT', 'INSERT', 'UPDATE']) });
export function pricingSnapshots(schema) {
  const current = generateDrizzleJson(schema);
  for (const table of Object.values(current.tables)) table.schema = 'public';
  const previous = structuredClone(current);
  delete previous.tables['public.' + PRICING_TABLE];
  delete previous.tables['public.addresses'].columns.pricing_currency;
  delete previous.tables['public.addresses'].checkConstraints.addresses_pricing_currency_check;
  return { previous, current };
}
export async function pricingDDL(schema) { const { previous, current } = pricingSnapshots(schema); return (await generateMigration(previous, current)).join('\n'); }
export function pricingSchemaContract(schema) {
  const { current } = pricingSnapshots(schema), table = current.tables['public.' + PRICING_TABLE];
  const columns = [], constraints = [], indexes = [], foreignKeys = [];
  for (const key of ['workspacePricingSettings', 'addresses']) {
    const metadata = getTableConfig(schema[key]);
    for (const column of metadata.columns.filter(column => key !== 'addresses' || column.name === 'pricing_currency')) {
      columns.push({ table: metadata.name, name: column.name, type: column.getSQLType().replace(/^varchar/, 'character varying'), notNull: column.notNull,
        default: column.default === undefined ? null : typeof column.default === 'number' ? String(column.default) : dialect.sqlToQuery(column.default).sql });
    }
    for (const check of metadata.checks.filter(check => key !== 'addresses' || check.name === 'addresses_pricing_currency_check')) {
      const query = dialect.sqlToQuery(check.value); if (query.params.length) throw new Error('Parameterized metadata check');
      const expression = query.sql.replaceAll(`"${metadata.name}".`, '');
      constraints.push({ table: metadata.name, name: check.name, expression, canonical: canonicalCurrencyExpression(expression) });
    }
  }
  indexes.push({ name: PRICING_TABLE + '_pkey', columns: ['id'], unique: true, primary: true });
  for (const index of Object.values(table.indexes)) indexes.push({ name: index.name, columns: index.columns.map(column => column.expression), unique: index.isUnique, primary: false });
  for (const fk of Object.values(table.foreignKeys)) foreignKeys.push({ name: fk.name, columns: fk.columnsFrom, referenceTable: fk.tableTo, referenceColumns: fk.columnsTo, onDelete: fk.onDelete });
  return { version: 'workspace-pricing-v1', table: PRICING_TABLE, columns, constraints, indexes, foreignKeys, runtimeRights: PRICING_RUNTIME_RIGHTS };
}
export function pricingRuntimeContract(schema) {
  const profile = pricingSchemaContract(schema);
  return { version: profile.version, tables: [PRICING_TABLE], columns: profile.columns,
    constraints: [
      ...profile.constraints.map(check => ({ table: check.table, name: check.name, type: 'c', expression: check.canonical })),
      { table: PRICING_TABLE, name: PRICING_TABLE + '_pkey', type: 'p', columns: ['id'] },
      ...profile.foreignKeys.map(fk => ({ table: PRICING_TABLE, name: fk.name, type: 'f', columns: fk.columns, referenceTable: fk.referenceTable, referenceColumns: fk.referenceColumns, onDelete: fk.onDelete === 'cascade' ? 'c' : 'a' })),
    ], indexes: profile.indexes.map(index => ({ table: PRICING_TABLE, name: index.name, unique: index.unique, columns: index.columns, predicate: null })) };
}
export async function pricingMigration(schema) {
  return `-- TASK-044 workspace pricing expansion. PREPARED ONLY, NOT APPLIED.
-- Separate exact-target/recovery authorization required. Stop on first failure.
BEGIN;
SET TRANSACTION READ WRITE;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL idle_in_transaction_session_timeout='60s';
SET LOCAL search_path=pg_catalog,pg_temp;
DO $pricing$ BEGIN
 IF current_user<>session_user OR current_user<>'postgres'
 OR current_setting('server_version_num')::integer/10000<>17
 OR (SELECT count(*) FROM pg_catalog.pg_class WHERE relnamespace='public'::regnamespace AND relkind IN('r','p'))<>40
 OR to_regclass('public.workspace_pricing_settings') IS NOT NULL
 OR EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='addresses' AND column_name='pricing_currency')
 OR (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name IN('services','bookings') AND column_name='currency' AND is_nullable='NO' AND column_default IS NULL)<>2
 OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='fm_app_runtime' AND NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication)
 OR to_regprocedure('pg_catalog.gen_random_uuid()') IS NULL
 THEN RAISE EXCEPTION 'Workspace pricing preconditions failed; inspect and do not retry blindly'; END IF;
END $pricing$;
-- Stop old workspace/address writers through cutover. This transaction also
-- blocks concurrent user/company creation while seeding the existing workspaces.
LOCK TABLE public.users, public.companies IN SHARE MODE;
LOCK TABLE public.addresses IN ACCESS EXCLUSIVE MODE;
-- BEGIN GENERATED WORKSPACE PRICING DDL
${await pricingDDL(schema)}
-- END GENERATED WORKSPACE PRICING DDL
REVOKE ALL ON TABLE public.workspace_pricing_settings FROM PUBLIC, anon, authenticated, service_role, fm_app_runtime, fmt_app_dev, fmt_audit_capture_dev, fmt_audit_worker_dev;
GRANT SELECT,INSERT,UPDATE ON TABLE public.workspace_pricing_settings TO fm_app_runtime;
CREATE POLICY fmt_workspace_pricing_server ON public.workspace_pricing_settings FOR ALL TO fm_app_runtime USING(true) WITH CHECK(true);
-- Existing workspace defaults only: no service/booking currency or amount UPDATE.
INSERT INTO public.workspace_pricing_settings(id,user_id,default_currency,revision)
 SELECT gen_random_uuid(),id,'EUR',1 FROM public.users;
INSERT INTO public.workspace_pricing_settings(id,company_id,default_currency,revision)
 SELECT gen_random_uuid(),id,'EUR',1 FROM public.companies;
SELECT (SELECT count(*) FROM public.workspace_pricing_settings WHERE user_id IS NOT NULL) AS personal_defaults_initialized,
 (SELECT count(*) FROM public.workspace_pricing_settings WHERE company_id IS NOT NULL) AS company_defaults_initialized;
COMMIT;
`;
}
