// Real PostgreSQL behavior on connection-local temporary tables only.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import "dotenv/config";
import { pool } from "../server/db.ts";
import { storage } from "../server/storage.ts";
import { locationStore, registerLocation, resolveServiceLocation, addressKey } from "../server/registeredLocations.ts";

pool.options.max = 1;
pool.options.idleTimeoutMillis = 0;
try {
  const security = (await pool.query(`SELECT relrowsecurity AS rls,
    has_table_privilege('anon','public.geocoding_cache','SELECT,INSERT,UPDATE,DELETE') AS anon_access,
    has_table_privilege('authenticated','public.geocoding_cache','SELECT,INSERT,UPDATE,DELETE') AS browser_access
    FROM pg_class WHERE oid = 'public.geocoding_cache'::regclass`)).rows[0];
  assert.equal(security.rls, true); assert.equal(security.anon_access, false); assert.equal(security.browser_access, false);
  const job = (await pool.query("SELECT active,schedule,command FROM cron.job WHERE jobname = 'fitsmytime-geocoding-cleanup'")).rows;
  assert.equal(job.length, 1); assert.equal(job[0].active, true); assert.equal(job[0].schedule, "17 * * * *");
  assert.equal(job[0].command, "SELECT public.purge_expired_geocoding()");
  for (const table of ["users", "companies", "employees", "services", "bookings", "service_reviews", "geocoding_cache"]) {
    await pool.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES)`);
  }
  await pool.query("CREATE TEMP SEQUENCE service_fixture_ids START 100; ALTER TABLE pg_temp.services ALTER COLUMN id SET DEFAULT nextval('pg_temp.service_fixture_ids')");
  await pool.query("INSERT INTO pg_temp.users(id) VALUES ('location-owner'),('other-owner')");
  await pool.query("INSERT INTO pg_temp.companies(id,name,owner_id,provider_id) VALUES(1,'Fixture company','location-owner','location-owner')");
  const address = "Brīvības iela 10, Rīga, Latvia";
  const owner = { providerId: "location-owner" };
  const base = { providerId: owner.providerId, name: "Fixture service", category: "education", serviceType: "one_to_one", price: "10", duration: 30, address, latitude: 56.95, longitude: 24.1 };
  const manual = await storage.createService({ ...base, locationSource: "manual" });
  assert.equal((await registerLocation(address, owner, locationStore, () => { throw new Error("Manual result should be reused"); })).locationSource, "manual");
  assert.equal(await locationStore.manual(address, { providerId: "other-owner" }), undefined, "Do not reuse another provider's manual data");
  assert.equal(await locationStore.manual(address, { ...owner, companyId: 1 }), undefined, "Company and personal locations remain separate");
  await storage.updateService(manual.id, { locationSource: "legacy" });
  assert.equal(await locationStore.manual(address, owner), undefined, "Unverified legacy records must not seed reuse");
  let calls = 0;
  const lookup = async () => { calls++; return { latitude: 56.951234, longitude: 24.123456, placeId: "fixture-place" }; };
  const verified = await registerLocation(address, owner, locationStore, lookup);
  assert.equal(calls, 1);
  const cached = await registerLocation(address.toUpperCase(), { providerId: "other-owner" }, locationStore, lookup);
  assert.equal(cached.reused, true); assert.equal(calls, 1);
  assert.equal(cached.locationExpiresAt.getTime(), verified.locationExpiresAt.getTime());
  const input = { ...base, latitude: verified.latitude, longitude: verified.longitude };
  const persisted = await locationStore.get(verified.locationKey);
  assert.ok(persisted, "Verified location must persist in the cache");
  assert.equal(persisted.addressKey, addressKey(address));
  assert.ok(persisted.expiresAt > new Date(), "Cache lifetime must be retained by PostgreSQL");
  assert.ok(Math.abs(persisted.latitude - input.latitude) <= 0.00001, "Latitude round-trip precision must be supported");
  assert.ok(Math.abs(persisted.longitude - input.longitude) <= 0.00001, "Longitude round-trip precision must be supported");
  const metadata = await resolveServiceLocation(input, verified);
  const google = await storage.createService({ ...input, ...metadata });
  const copy = await storage.copyService(google.id, owner.providerId);
  assert.equal(copy.locationExpiresAt.getTime(), google.locationExpiresAt.getTime());
  assert.equal(copy.locationSource, "google");
  await pool.query("UPDATE pg_temp.services SET location_expires_at = now() - interval '1 second' WHERE location_source = 'google'");
  await pool.query("UPDATE pg_temp.geocoding_cache SET expires_at = now() - interval '1 second'");
  assert.equal((await storage.getServiceById(google.id)).latitude, null);
  assert.equal((await storage.getServicesByProvider(owner.providerId)).find(row => row.id === google.id).latitude, null);
  assert.equal((await storage.searchServices({})).find(row => row.id === google.id).latitude, null);
  assert.ok(!(await storage.searchServices({ latitude: 56.95, longitude: 24.1, radius: 100 })).some(row => row.id === google.id), "Expired locations cannot participate in distance filtering");
  const expiredCopy = await storage.copyService(google.id, owner.providerId);
  assert.equal(expiredCopy.latitude, null); assert.equal(expiredCopy.longitude, null);
  await pool.query("UPDATE pg_temp.services SET location_address_source = 'google' WHERE id = $1", [copy.id]);
  assert.equal((await storage.getServiceById(copy.id)).address, null);
  // Execute the exact migration cleanup body against temp tables, never public data.
  const migration = await readFile(new URL("../migrations/0004_registered_locations.sql", import.meta.url), "utf8");
  const body = migration.match(/LANGUAGE sql SET search_path = pg_catalog AS \$\$([\s\S]*?)\$\$/)[1].replaceAll("public.", "pg_temp.");
  await pool.query(body);
  const purged = (await pool.query("SELECT latitude,longitude,address FROM pg_temp.services WHERE id = $1", [google.id])).rows[0];
  assert.equal(purged.latitude, null); assert.equal(purged.longitude, null); assert.equal(purged.address, address, "User-entered address survives coordinate expiry");
  assert.equal((await pool.query("SELECT address FROM pg_temp.services WHERE id = $1", [copy.id])).rows[0].address, null, "Legacy Google-formatted addresses are not retained after expiry");
  const retained = (await pool.query("SELECT latitude,longitude,place_id FROM pg_temp.geocoding_cache WHERE address_key = $1", [addressKey(address)])).rows[0];
  assert.deepEqual(retained, { latitude: null, longitude: null, place_id: "fixture-place" });
  await registerLocation(address, owner, locationStore, lookup); assert.equal(calls, 2, "Refresh only on an explicit verification after expiry");
  console.log("Passed: PostgreSQL cache persistence, RLS, hourly job, workspace reuse boundaries, saved/copy expiry, search filtering, physical cleanup, preserved user addresses/Place IDs, and explicit refresh. Customer data unchanged.");
} catch (error) {
  console.error("Geocoding database test failed:", error.code || error.name, error instanceof assert.AssertionError ? error.message : "");
  process.exitCode = 1;
} finally { await pool.end(); }
