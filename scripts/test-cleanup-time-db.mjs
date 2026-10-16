// Actual PostgreSQL storage on connection-local fixtures; public data is unchanged.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import "dotenv/config";
import { pool } from "../server/db.ts";
import { storage, BookingConflictError } from "../server/storage.ts";

pool.options.max = 1;
pool.options.idleTimeoutMillis = 0;
let release;
try {
  // Keep a leased connection: Pool.query discards its client after an expected
  // constraint error, which would otherwise discard all temporary fixtures.
  const client = await pool.connect();
  release = client.release.bind(client);
  pool.query = client.query.bind(client);
  pool.connect = async () => client;
  client.release = () => {};
  for (const table of ["users", "companies", "employees", "services", "bookings", "availability", "service_reviews", "service_embeddings"]) {
    await pool.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES)`);
  }
  // Exercise upgrading the old schema as well as rerunning the migration.
  await pool.query("ALTER TABLE pg_temp.services DROP COLUMN IF EXISTS cleanup_time; ALTER TABLE pg_temp.bookings DROP COLUMN IF EXISTS booking_cleanup_time");
  await pool.query("INSERT INTO pg_temp.users(id) VALUES('provider'),('customer')");
  await pool.query("INSERT INTO pg_temp.services(id,provider_id,name,category,service_type,price,duration) VALUES(1,'provider','Fixture','education','one_to_one',30,30)");
  await pool.query("INSERT INTO pg_temp.bookings(id,provider_id,seeker_id,service_id,scheduled_date,booking_duration,status,total_amount,advance_amount) VALUES(1,'provider','customer',1,'2099-06-03 09:00',30,'confirmed',30,0)");
  const migration = (await readFile(new URL("../migrations/0006_service_cleanup_time.sql", import.meta.url), "utf8")).replaceAll("public.", "pg_temp.");
  await pool.query(migration); await pool.query(migration);
  assert.equal((await pool.query("SELECT cleanup_time FROM pg_temp.services WHERE id=1")).rows[0].cleanup_time, 0);
  assert.equal((await pool.query("SELECT booking_cleanup_time FROM pg_temp.bookings WHERE id=1")).rows[0].booking_cleanup_time, 0);
  for (const [table, column] of [["services", "cleanup_time"], ["bookings", "booking_cleanup_time"]]) {
    for (const value of [-1, 1441]) await assert.rejects(pool.query(`UPDATE pg_temp.${table} SET ${column}=$1 WHERE id=1`, [value]), error => error.code === "23514");
  }
  // Defaults must never advance the real application's serial sequences.
  for (const table of ["services", "bookings", "availability"]) {
    await pool.query(`CREATE TEMP SEQUENCE ${table}_fixture_ids START 100; ALTER TABLE pg_temp.${table} ALTER COLUMN id SET DEFAULT nextval('pg_temp.${table}_fixture_ids')`);
  }
  await pool.query("INSERT INTO pg_temp.employees(id,provider_id,name) VALUES(1,'provider','First employee'),(2,'provider','Second employee')");
  await pool.query("UPDATE pg_temp.services SET cleanup_time=15,employee_id=1 WHERE id=1");
  const source = await storage.getServiceById(1);
  const copy = await storage.copyService(1, "provider");
  assert.equal(copy.cleanupTime, 15); assert.equal(copy.isActive, false);
  const other = await storage.createService({ providerId: "provider", employeeId: 1, name: "Another service", category: "education", serviceType: "one_to_one", price: "20", duration: 30, cleanupTime: 0 });
  const independent = await storage.createService({ ...other, id: undefined, employeeId: 2 });
  await storage.createAvailability({ providerId: "provider", scheduleType: "recurring", daysOfWeek: [0,1,2,3,4,5,6], startTime: "09:00", endTime: "12:00", timezone: "UTC", breaks: [] });
  const at = (time, date = "2099-06-04") => new Date(`${date}T${time}:00Z`);
  const input = (svc, time, date) => ({ serviceId: svc.id, providerId: "provider", seekerId: "customer", employeeId: svc.employeeId, scheduledDate: at(time, date), bookingDuration: 1, bookingCleanupTime: 0, status: "confirmed", totalAmount: "30", advanceAmount: "0" });
  const conflict = promise => assert.rejects(promise, error => error instanceof BookingConflictError);
  const first = await storage.createBooking(input(source, "09:00"));
  assert.equal(first.bookingDuration, 30); assert.equal(first.bookingCleanupTime, 15, "Read server-owned values inside the transaction");
  await conflict(storage.createBooking(input(other, "09:30")));
  const second = await storage.createBooking(input(other, "09:45"));
  await storage.createBooking(input(independent, "09:30"));
  assert.deepEqual((await storage.getBookingsForResourceRange(source, at("09:30"), at("09:45"))).map(row => row.id), [first.id], "Range fetch includes preceding cleanup but excludes other employees and exact next boundary");
  await storage.updateService(1, { cleanupTime: 120, duration: 60 });
  assert.equal((await storage.getBookingById(first.id)).bookingCleanupTime, 15);
  await pool.query(migration);
  assert.equal((await storage.getServiceById(1)).cleanupTime, 120, "Rerunning migration preserves provider settings");
  const moved = await storage.rescheduleBooking(first.id, at("11:15"));
  assert.equal(moved.bookingCleanupTime, 15); assert.equal(moved.bookingDuration, 30);
  await conflict(storage.rescheduleBooking(first.id, at("11:30")));
  await conflict(storage.rescheduleBooking(second.id, at("11:45")));
  await storage.rescheduleBooking(second.id, at("10:30"));
  await conflict(storage.rescheduleBooking(first.id, at("09:55")));
  await conflict(storage.rescheduleBooking(first.id, at("10:00"))); // Its cleanup would overlap 10:30.
  await storage.rescheduleBooking(first.id, at("09:45")); // Cleanup ends at exactly 10:30.
  await storage.updateBookingStatus(first.id, "cancelled");
  await storage.createBooking(input(other, "10:00"));
  // Candidate cleanup must also respect closing time and schedule breaks.
  await storage.updateService(1, { duration: 30, cleanupTime: 15 });
  await conflict(storage.createBooking(input(source, "11:30", "2099-06-05")));
  await storage.createAvailability({ providerId: "provider", scheduleType: "specific", specificDate: at("00:00", "2099-06-06"), startTime: "09:00", endTime: "12:00", timezone: "UTC", breaks: [{ startTime: "10:00", endTime: "10:30" }] });
  await conflict(storage.createBooking(input(source, "09:30", "2099-06-06")));
  await storage.createBooking(input(source, "09:15", "2099-06-06"));
  // Midnight-crossing historical intervals must still be returned by the range query.
  await pool.query("INSERT INTO pg_temp.bookings(service_id,provider_id,seeker_id,employee_id,scheduled_date,booking_duration,booking_cleanup_time,status,total_amount,advance_amount) VALUES(1,'provider','customer',1,'2099-06-06 23:30',30,30,'confirmed',30,0)");
  const overnight = await storage.getBookingsForResourceRange(source, at("00:00", "2099-06-07"), at("00:30", "2099-06-07"));
  assert.equal(overnight.length, 1);
  console.log("Passed: PostgreSQL migration/idempotency, legacy defaults, constraints, copies, trusted booking snapshots, cross-service conflicts, employee isolation, range boundaries, rescheduling, cancellation, breaks, closing time, and midnight carryover. Public data unchanged.");
} finally { release?.(); await pool.end(); }
