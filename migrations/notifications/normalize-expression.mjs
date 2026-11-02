// PostgreSQL 17 deparses IN/BETWEEN and varchar casts differently from Drizzle.
// Canonicalize only the known notification expression grammar, not arbitrary SQL.
export function canonicalNotificationExpression(value) {
  if (value == null) return null;
  return value
    // PG17 ruleutils.c F_BTRIM_TEXT emits TRIM(BOTH FROM expr). Match only
    // the omitted-character-set form; explicit characters/directions differ.
    .replace(/\bTRIM\(\s*BOTH\s+FROM\s+/gi, "trim(")
    .replace(/("[^"]+"\."[^"]+"|length\(trim\("[^"]+"\."[^"]+"\)\)) BETWEEN (\d+) AND (\d+)/g, (_all, column, low, high) => `${column} >= ${low} AND ${column} <= ${high}`)
    .replace(/("[^"]+"\."[^"]+") IN \(([^)]+)\)/g, (_all, column, values) => `${column} = ANY(ARRAY[${values}])`)
    .replace(/"[a-z_]+"\./g, "")
    .replace(/::(?:character varying|text)(?:\[\])?/g, "")
    .replace(/\bbtrim\(/g, "trim(")
    .replace(/[\s()\"]/g, "").toLowerCase();
}

export function canonicalCatalogExpression(expression) {
  const defaultTrim=`regexp_replace(${expression}, '\\mTRIM\\([[:space:]]*BOTH[[:space:]]+FROM[[:space:]]+', 'trim(', 'gi')`;
  return `lower(regexp_replace(replace(regexp_replace(regexp_replace(${defaultTrim}, '"[a-z_]+"\\.', '', 'g'), '::(character varying|text)(\\[\\])?', '', 'g'), 'btrim(', 'trim('), '[[:space:]()"]', '', 'g'))`;
}
