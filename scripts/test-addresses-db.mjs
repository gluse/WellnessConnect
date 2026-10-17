// Exercise the migration and real storage using temporary tables and sequences.
// No public rows, sequences, Google requests or cleanup functions are changed.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import "dotenv/config";
import { pool } from "../server/db.ts";
import { storage } from "../server/storage.ts";
import { addressStore } from "../server/addresses.ts";
import { locationStore } from "../server/registeredLocations.ts";
import { setupStorefrontFixtures } from "./fixtures/storefronts.mjs";

let connection, release;
try {
  connection = await pool.connect();
  release = connection.release.bind(connection);
  pool.query = connection.query.bind(connection);
  pool.connect = async () => connection;
  connection.release = () => {};
  for (const table of ["users", "companies", "employees", "services", "bookings", "service_reviews", "geocoding_cache"]) {
    await pool.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES)`);
  }
  await setupStorefrontFixtures(pool.query.bind(pool));
  await pool.query(`ALTER TABLE pg_temp.services DROP COLUMN IF EXISTS address_id;
    ALTER TABLE pg_temp.services ADD COLUMN IF NOT EXISTS address text,
      ADD COLUMN IF NOT EXISTS latitude double precision, ADD COLUMN IF NOT EXISTS longitude double precision,
      ADD COLUMN IF NOT EXISTS location_source varchar NOT NULL DEFAULT 'legacy',
      ADD COLUMN IF NOT EXISTS location_key varchar, ADD COLUMN IF NOT EXISTS location_place_id text,
      ADD COLUMN IF NOT EXISTS location_expires_at timestamptz,
      ADD COLUMN IF NOT EXISTS location_address_source varchar NOT NULL DEFAULT 'user';
    CREATE TEMP SEQUENCE service_fixture_ids START 100;
    ALTER TABLE pg_temp.services ALTER COLUMN id SET DEFAULT nextval('pg_temp.service_fixture_ids');
    INSERT INTO pg_temp.users(id) VALUES('address-owner'),('other-owner');
    INSERT INTO pg_temp.companies(id,name,provider_id,owner_id) VALUES(1,'Fixture','address-owner','address-owner');
    INSERT INTO pg_temp.services(id,provider_id,name,category,service_type,price,duration,address,latitude,longitude,location_source)
      VALUES(1,'address-owner','First','education','one_to_one',10,30,'Street 10, Riga, Latvia',56.95,24.1,'manual'),
      (2,'address-owner','Second','education','one_to_one',10,30,'Street 10, Riga, Latvia',56.95,24.1,'manual'),
      (3,'other-owner','Other','education','one_to_one',10,30,'Street 10, Riga, Latvia',56.95,24.1,'manual'),
      (4,'address-owner','Company','education','one_to_one',10,30,'Street 10, Riga, Latvia',56.95,24.1,'manual'),
      (5,'address-owner','Verified','education','one_to_one',10,30,'Verified 10, Riga, Latvia',56.95,24.1,'google'),
      (6,'address-owner','Expired','education','one_to_one',10,30,'Expired 10, Riga, Latvia',56.95,24.1,'google');
    UPDATE pg_temp.services SET company_id=1 WHERE id=4;
    UPDATE pg_temp.services SET location_expires_at=now()+interval '1 hour',location_place_id='original-place' WHERE id=5;
    UPDATE pg_temp.services SET location_expires_at=now()-interval '1 hour' WHERE id=6;`);
  const originalExpiry = (await pool.query("SELECT location_expires_at FROM pg_temp.services WHERE id=5")).rows[0].location_expires_at;
  const migration = (await readFile(new URL("../migrations/0008_account_addresses.sql", import.meta.url), "utf8"))
    .replaceAll("public.", "pg_temp.")
    .replace("table_schema = 'public'", "table_schema = (SELECT nspname FROM pg_namespace WHERE oid = pg_my_temp_schema())");
  await pool.query(migration);
  await pool.query(migration);
  const ids = (await pool.query("SELECT address_id FROM pg_temp.services ORDER BY id")).rows.map(row => row.address_id);
  assert.equal(ids[0], ids[1], "Identical locations in one workspace share an address");
  assert.notEqual(ids[0], ids[2]); assert.notEqual(ids[0], ids[3]);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM pg_temp.addresses")).rows[0].n, 5, "Rerunning preserves saved addresses");
  const migratedGoogle = (await pool.query("SELECT * FROM pg_temp.addresses WHERE id=$1", [ids[4]])).rows[0];
  assert.equal(migratedGoogle.location_expires_at.getTime(), originalExpiry.getTime());
  assert.equal(migratedGoogle.location_place_id, "original-place");
  assert.equal((await pool.query("SELECT latitude FROM pg_temp.addresses WHERE id=$1", [ids[5]])).rows[0].latitude, null);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema=(SELECT nspname FROM pg_namespace WHERE oid=pg_my_temp_schema()) AND table_name='services' AND column_name='address'")).rows[0].n, 0);
  const owner = { providerId: "address-owner" };
  assert.equal((await addressStore.list(owner)).length, 3);
  await assert.rejects(addressStore.get(ids[0], { providerId: "other-owner" }), error => error.status === 403);
  assert.equal((await addressStore.list({ ...owner, companyId: 1 })).length, 1);
  assert.ok(await locationStore.manual("Street 10, Riga, Latvia", owner));
  const first = await storage.getServiceById(1);
  assert.equal(first.address, "Street 10, Riga, Latvia");
  const copy = await storage.copyService(1, owner.providerId);
  assert.equal(copy.addressId, first.addressId); assert.equal(copy.latitude, 56.95);
  const address = await addressStore.get(first.addressId, owner);
  await addressStore.save({ ...address, address: "Street 20, Riga, Latvia", latitude: 57 }, owner, address.id);
  assert.equal((await storage.getServiceById(2)).latitude, 57);
  assert.equal((await storage.getServiceById(copy.id)).address, "Street 20, Riga, Latvia");
  await pool.query("INSERT INTO pg_temp.bookings(id,service_id,seeker_id,provider_id,scheduled_date,total_amount,advance_amount) VALUES(1,1,'other-owner','address-owner','2099-01-01',10,0)");
  assert.equal((await storage.getBookingsBySeeker("other-owner"))[0].service.latitude, 57);
  assert.equal((await storage.getBookingsByProvider(owner.providerId))[0].service.address, "Street 20, Riga, Latvia");
  assert.equal((await storage.getBookingById(1)).service.addressId, address.id);
  await assert.rejects(addressStore.remove(address.id, owner), error => (error.cause ?? error).code === "23503");
  const expiresAt = new Date(Date.now() + 60_000);
  const google = await addressStore.save({ ...address, address: "Google fixture, Riga, Latvia", locationSource: "google", locationExpiresAt: expiresAt, locationPlaceId: "place-fixture" }, owner);
  const googleService = await storage.createService({ providerId: owner.providerId, name: "Google service", category: "education", serviceType: "one_to_one", price: "10", duration: 30, addressId: google.id });
  const googleCopy = await storage.copyService(googleService.id, owner.providerId);
  assert.equal(googleCopy.locationExpiresAt.getTime(), expiresAt.getTime());
  await pool.query("UPDATE pg_temp.addresses SET location_expires_at=now()-interval '1 second' WHERE id=$1", [google.id]);
  assert.equal((await storage.getServiceById(googleService.id)).latitude, null);
  assert.equal((await storage.getServicesByProvider(owner.providerId)).find(row => row.id === googleCopy.id).latitude, null);
  assert.equal((await storage.searchServices({})).find(row => row.id === googleService.id).latitude, null);
  const cleanup = migration.match(/LANGUAGE sql SET search_path = pg_catalog AS \$\$([\s\S]*?)\$\$/)[1];
  await pool.query(cleanup);
  const purged = (await pool.query("SELECT latitude,longitude,address FROM pg_temp.addresses WHERE id=$1", [google.id])).rows[0];
  assert.deepEqual(purged, { latitude: null, longitude: null, address: google.address });
  await pool.query("UPDATE pg_temp.addresses SET location_address_source='google' WHERE id=$1", [google.id]);
  await pool.query(cleanup);
  assert.equal((await addressStore.get(google.id, owner)).address, null);
  const unused = await addressStore.save({ ...address, address: "Unused address, Riga, Latvia" }, owner);
  await addressStore.remove(unused.id, owner);
  console.log("Passed: migration/backfill and rerun, workspace boundaries, shared service/copy locations, address edits, deletion protection, and expiry cleanup. Public data unchanged.");
} catch (error) {
  console.error("Address database test failed:", error.code || error.cause?.code || error.name, error.constraint || error.cause?.constraint || "", error instanceof assert.AssertionError ? error.message : "");
  process.exitCode = 1;
} finally { release?.(); await pool.end(); }
