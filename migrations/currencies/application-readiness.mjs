// Injected read-only metadata guard. Importing this module opens no connection.
import contract from './schema-contract.json' with { type: 'json' };

// Canonicalize this narrow generated CHECK grammar; not an arbitrary SQL parser.
export function canonicalCurrencyExpression(value) {
  return value.replace(/"(?:addresses|services|bookings)"\./g, '')
    .replace(/::(?:character varying|text|numeric)(?:\[\])?/gi, '')
    .replace(/("[a-z_]+"|[a-z_]+) IN \(([^()]+)\)/g, (_all, column, values) => `${column} = ANY(ARRAY[${values}])`)
    .replace(/[\s()\"]/g, '').toLowerCase();
}
const catalogExpression = expression => `lower(regexp_replace(regexp_replace(regexp_replace(${expression}, '"(addresses|services|bookings)"\\.', '', 'g'), '::(character varying|text|numeric)(\\[\\])?', '', 'gi'), '[[:space:]()"]', '', 'g'))`;
export const CURRENCY_READINESS_SQL = `WITH expected_columns AS (
  SELECT * FROM jsonb_to_recordset($1::jsonb) AS e("table" text, name text, type text, "notNull" boolean, "hasDefault" boolean)
), expected_constraints AS (
  SELECT * FROM jsonb_to_recordset($2::jsonb) AS e("table" text, name text, expression text)
)
SELECT NOT EXISTS (SELECT 1 FROM expected_columns e WHERE NOT EXISTS (
  SELECT 1 FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
  WHERE c.relnamespace = 'public'::regnamespace AND c.relname = e."table" AND c.relkind = 'r'
    AND a.attname = e.name AND a.attnum > 0 AND NOT a.attisdropped
    AND pg_catalog.format_type(a.atttypid, a.atttypmod) = e.type
    AND a.attnotnull = e."notNull" AND a.atthasdef = e."hasDefault"
)) AS currency_columns,
NOT EXISTS (SELECT 1 FROM expected_constraints e WHERE NOT EXISTS (
  SELECT 1 FROM pg_catalog.pg_constraint con JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
  WHERE c.relnamespace = 'public'::regnamespace AND c.relname = e."table"
    AND con.conname = e.name AND con.contype = 'c' AND con.convalidated AND NOT con.connoinherit
    AND ${catalogExpression('pg_catalog.pg_get_expr(con.conbin, con.conrelid)')} = e.expression
)) AS currency_constraints`;
export const CURRENCY_READINESS_KEYS = Object.freeze(['currency_columns', 'currency_constraints']);
export function currencyReadinessArguments() {
  return [JSON.stringify(contract.columns.map(column => ({ ...column, type: column.type.replace(/^varchar/, 'character varying') }))),
    JSON.stringify(contract.constraints.map(check => ({ ...check, expression: canonicalCurrencyExpression(check.expression) })))];
}
export class CurrencyDatabaseReadinessError extends Error {
  code = 'CURRENCY_DB_NOT_READY';
  constructor(checks) { super('CURRENCY_DB_NOT_READY'); this.checks = checks; }
}
export function assertCurrencyReadiness(rows) {
  const shaped = Array.isArray(rows) && rows.length === 1 && rows[0] && typeof rows[0] === 'object'
    && Object.keys(rows[0]).length === CURRENCY_READINESS_KEYS.length;
  if (!shaped || CURRENCY_READINESS_KEYS.some(key => rows[0][key] !== true)) {
    throw new CurrencyDatabaseReadinessError(shaped ? CURRENCY_READINESS_KEYS.filter(key => rows[0][key] !== true) : ['readiness_result_shape']);
  }
}
export async function verifyCurrencyDatabaseReadiness(query) {
  let rows;
  try { ({ rows } = await query(CURRENCY_READINESS_SQL, currencyReadinessArguments())); }
  catch { throw new CurrencyDatabaseReadinessError(['metadata_query']); }
  assertCurrencyReadiness(rows);
}
