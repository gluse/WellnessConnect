// Explicit one-time conversion only after the owner confirms the original lookup date.
import "dotenv/config";
import { createHash } from "node:crypto";
import pg from "pg";
import { normalizeAddress, validCoordinates } from "../shared/locations.ts";

const stamp = process.argv[process.argv.indexOf("--verified-at") + 1];
const verifiedAt = new Date(stamp);
const expiresAt = new Date(verifiedAt.getTime() + 29 * 24 * 60 * 60 * 1000);
if (!process.argv.includes("--verified-at") || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(stamp) || !Number.isFinite(verifiedAt.getTime()) || verifiedAt > new Date() || expiresAt <= new Date()) {
  throw new Error("Supply --verified-at with the confirmed original UTC/offset timestamp, within the last 29 days. For a date range use its earliest instant.");
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10_000 });
let connection;
try {
  connection = await pool.connect();
  await connection.query("BEGIN");
  const { rows } = await connection.query("SELECT id,address,latitude,longitude FROM public.services WHERE location_source = 'legacy' AND latitude IS NOT NULL AND longitude IS NOT NULL FOR UPDATE");
  const grouped = new Map();
  for (const row of rows) {
    if (!row.address || !validCoordinates(row.latitude, row.longitude)) continue;
    const key = createHash("sha256").update(normalizeAddress(row.address)).digest("hex");
    await connection.query("UPDATE public.services SET location_source = 'google', location_key = $2, location_expires_at = $3, location_address_source = 'google' WHERE id = $1", [row.id, key, expiresAt]);
    const group = grouped.get(key) || [];
    group.push(row); grouped.set(key, group);
  }
  let cached = 0;
  for (const [key, group] of grouped) {
    const first = group[0];
    // Never choose arbitrarily when the old data disagrees about the same address.
    if (!group.every(row => row.latitude === first.latitude && row.longitude === first.longitude)) continue;
    const result = await connection.query(`INSERT INTO public.geocoding_cache(address_key,latitude,longitude,place_id,expires_at)
      VALUES ($1,$2,$3,NULL,$4) ON CONFLICT(address_key) DO NOTHING`, [key, first.latitude, first.longitude, expiresAt]);
    cached += result.rowCount;
  }
  await connection.query("COMMIT");
  console.log(`Marked ${[...grouped.values()].reduce((count, group) => count + group.length, 0)} existing locations verified; prepared ${cached} reusable results. Expires ${expiresAt.toISOString()}. No Google requests made.`);
} catch (error) {
  if (connection) await connection.query("ROLLBACK");
  console.error("Location verification backfill failed:", error.code || error.name);
  process.exitCode = 1;
} finally { connection?.release(); await pool.end(); }
