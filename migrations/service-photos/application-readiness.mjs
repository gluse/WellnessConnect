// Read-only metadata guard. No configuration, connection or query on import.
import profile from './schema-contract.json' with { type: 'json' };
export const canonicalPhotoExpression = value => value.replace(/"services"\./g, '').replace(/::text(?:\[\])?/gi, '').replace(/\bpg_catalog\./g, '').replace(/[\s()\"]/g, '').toLowerCase();
const expression = value => `lower(regexp_replace(regexp_replace(regexp_replace(${value}, '"services"\\.', '', 'g'), '::text(\\[\\])?', '', 'gi'), '[[:space:]()"]', '', 'g'))`;
export const SERVICE_PHOTO_READINESS_SQL = `WITH expected_constraints AS (
 SELECT * FROM jsonb_to_recordset($1::jsonb) AS e(name text, expression text)
)
SELECT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
 WHERE a.attrelid='public.services'::regclass AND a.attname='image_urls' AND NOT a.attisdropped AND a.attnotnull
 AND pg_catalog.format_type(a.atttypid,a.atttypmod)='text[]'
 AND pg_catalog.pg_get_expr(d.adbin,d.adrelid) IN ('ARRAY[]::text[]', '''{}''::text[]')) AS service_photo_column,
 NOT EXISTS(SELECT 1 FROM expected_constraints e WHERE NOT EXISTS(
 SELECT 1 FROM pg_catalog.pg_constraint c WHERE c.conrelid='public.services'::regclass AND c.conname=e.name
 AND c.contype='c' AND c.convalidated AND NOT c.connoinherit
 AND ${expression('pg_catalog.pg_get_expr(c.conbin,c.conrelid)')}=e.expression)) AS service_photo_constraints`;
export const SERVICE_PHOTO_READINESS_KEYS = Object.freeze(['service_photo_column', 'service_photo_constraints']);
export const servicePhotoReadinessArguments = () => [JSON.stringify(profile.constraints.map(check => ({ name: check.name, expression: canonicalPhotoExpression(check.expression) })))];
export class ServicePhotoDatabaseReadinessError extends Error {
 code = 'SERVICE_PHOTO_DB_NOT_READY';
 constructor(checks) { super('SERVICE_PHOTO_DB_NOT_READY'); this.checks = checks; }
}
export function assertServicePhotoReadiness(rows) {
 const shape = Array.isArray(rows) && rows.length===1 && rows[0] && typeof rows[0]==='object' && Object.keys(rows[0]).length===SERVICE_PHOTO_READINESS_KEYS.length;
 if(!shape || SERVICE_PHOTO_READINESS_KEYS.some(key => rows[0][key]!==true)) throw new ServicePhotoDatabaseReadinessError(shape ? SERVICE_PHOTO_READINESS_KEYS.filter(key => rows[0][key]!==true) : ['readiness_result_shape']);
}
export async function verifyServicePhotoDatabaseReadiness(query) {
 let rows;
 try { ({ rows } = await query(SERVICE_PHOTO_READINESS_SQL, servicePhotoReadinessArguments())); }
 catch { throw new ServicePhotoDatabaseReadinessError(['metadata_query']); }
 assertServicePhotoReadiness(rows);
}
