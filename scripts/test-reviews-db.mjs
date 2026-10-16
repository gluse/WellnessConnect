// Uses connection-local temporary copies of application tables. No customer data is changed.
import assert from "node:assert/strict";
import "dotenv/config";
import { storage } from "../server/storage.ts";
import { pool } from "../server/db.ts";
import { ReviewError } from "../shared/reviews.ts";
import { sortServices } from "../client/src/lib/service-sort.ts";

pool.options.max = 1; // Temporary tables must stay on the same connection, including transactions.
pool.options.idleTimeoutMillis = 0;
try {
  const security = await pool.query(`SELECT relrowsecurity AS rls,
    has_table_privilege('anon', 'public.service_reviews', 'SELECT,INSERT,UPDATE,DELETE') AS anon_access,
    has_table_privilege('authenticated', 'public.service_reviews', 'SELECT,INSERT,UPDATE,DELETE') AS browser_access
    FROM pg_class WHERE oid = 'public.service_reviews'::regclass`);
  assert.equal(security.rows[0].rls, true);
  assert.equal(security.rows[0].anon_access, false);
  assert.equal(security.rows[0].browser_access, false);
  for (const table of ["users", "companies", "employees", "services", "bookings", "service_reviews"]) {
    await pool.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES)`);
  }
  // Avoid using the real reviews sequence through a copied default.
  await pool.query("CREATE TEMP SEQUENCE review_fixture_ids; ALTER TABLE pg_temp.service_reviews ALTER COLUMN id SET DEFAULT nextval('pg_temp.review_fixture_ids')");
  await pool.query("INSERT INTO pg_temp.users(id,first_name) VALUES ('review-customer','Customer'),('review-provider','Provider'),('other-customer','Other')");
  await pool.query(`INSERT INTO pg_temp.services(id,provider_id,name,category,service_type,price,duration) VALUES
    (1,'review-provider','Reviewed service','education','one_to_one',10,30),
    (2,'review-provider','Highly rated service','education','one_to_one',20,30),
    (3,'review-provider','Unrated service','education','one_to_one',30,30)`);
  await pool.query(`INSERT INTO pg_temp.bookings(id,service_id,seeker_id,provider_id,scheduled_date,status,total_amount,advance_amount) VALUES
    (1,1,'review-customer','review-provider',now() - interval '1 day','completed',10,0),
    (2,1,'review-customer','review-provider',now() - interval '1 day','completed',10,0),
    (3,2,'review-customer','review-provider',now() - interval '1 day','completed',20,0),
    (4,1,'review-customer','review-provider',now(),'pending',10,0),
    (5,1,'review-customer','review-provider',now(),'confirmed',10,0),
    (6,1,'review-customer','review-provider',now(),'cancelled',10,0),
    (7,1,'other-customer','review-provider',now(),'completed',10,0),
    (8,1,'review-customer','review-provider',now(),'completed',10,0)`);
  const reject = (id, user, status) => assert.rejects(storage.createReview(id, user, { rating: 5, comment: "" }), error => error instanceof ReviewError && error.status === status);
  await reject(1, "other-customer", 404);
  await reject(1, "review-provider", 404);
  await reject(999, "review-customer", 404);
  for (const id of [4, 5, 6]) await reject(id, "review-customer", 409);
  await assert.rejects(storage.createReview(1, "review-customer", { rating: 2, comment: "  " }));
  const first = await storage.createReview(1, "review-customer", { rating: 1, comment: "  Too rushed.  " });
  assert.equal(first.comment, "Too rushed.");
  await storage.createReview(2, "review-customer", { rating: 3, comment: "" });
  await storage.createReview(3, "review-customer", { rating: 5, comment: "" });
  await reject(1, "review-customer", 409);
  const service = await storage.getServiceById(1);
  assert.equal(service.rating, 2);
  assert.equal(service.reviewCount, 2);
  const found = await storage.searchServices({});
  assert.equal(found.find(row => row.id === 1).rating, 2);
  assert.equal(found.find(row => row.id === 3).rating, null);
  assert.equal(found.find(row => row.id === 3).reviewCount, 0);
  assert.deepEqual(sortServices(found, "rating-desc", null).map(row => row.id), [2, 1, 3]);
  assert.deepEqual(sortServices(found, "rating-asc", null).map(row => row.id), [1, 2, 3]);
  for (const user of ["other-customer", "review-provider"]) {
    await assert.rejects(storage.updateReview(1, user, { rating: 5, comment: "" }), error => error instanceof ReviewError && error.status === 404);
    await assert.rejects(storage.deleteReview(1, user), error => error instanceof ReviewError && error.status === 404);
  }
  await assert.rejects(storage.updateReview(1, "review-customer", { rating: 2, comment: " " }));
  const edited = await storage.updateReview(1, "review-customer", { rating: 2, comment: "  Updated feedback  " });
  assert.equal(edited.id, first.id);
  assert.equal(edited.comment, "Updated feedback");
  assert.equal(edited.createdAt.getTime(), first.createdAt.getTime(), "Editing preserves the original review date");
  assert.equal((await storage.getServiceById(1)).rating, 2.5);
  await storage.updateReview(1, "review-customer", { rating: 5, comment: "" });
  assert.equal((await storage.getServiceById(1)).rating, 4);
  assert.equal((await storage.getServiceById(1)).reviewCount, 2);
  await storage.deleteReview(1, "review-customer");
  assert.equal((await storage.getServiceById(1)).rating, 3);
  assert.equal((await storage.getServiceById(1)).reviewCount, 1);
  assert.equal((await storage.getBookingsBySeeker("review-customer")).find(row => row.id === 1).review, null);
  assert.ok(!(await storage.getServiceReviews(1, 1)).reviews.some(row => row.id === first.id));
  await assert.rejects(storage.updateReview(1, "review-customer", { rating: 5, comment: "" }), error => error.status === 404);
  await assert.rejects(storage.deleteReview(1, "review-customer"), error => error.status === 404);
  await storage.createReview(1, "review-customer", { rating: 1, comment: "Too rushed." });
  const sole = (await storage.getBookingsBySeeker("review-customer")).find(row => row.id === 3).review;
  await storage.deleteReview(3, "review-customer");
  assert.equal((await storage.getServiceById(2)).rating, null);
  assert.equal((await storage.getServiceById(2)).reviewCount, 0);
  assert.equal((await storage.getServiceReviews(2, 1)).reviews.length, 0);
  await storage.createReview(3, "review-customer", { rating: sole.rating, comment: sole.comment });
  const ownBookings = await storage.getBookingsBySeeker("review-customer");
  assert.equal(ownBookings.find(row => row.id === 1).review.comment, "Too rushed.");
  assert.ok(!ownBookings.some(row => row.id === 7));
  assert.equal(ownBookings.find(row => row.id === 4).review, null);
  const publicReviews = await storage.getServiceReviews(1, 1);
  assert.equal(publicReviews.reviews.length, 2);
  assert.equal(publicReviews.reviews[0].reviewerName, "Customer");
  assert.equal(publicReviews.reviews[0].createdAt, new Date(publicReviews.reviews[0].createdAt).toISOString());
  assert.deepEqual(Object.keys(publicReviews.reviews[0]).sort(), ["comment", "createdAt", "id", "rating", "reviewerName"]);
  assert.equal(publicReviews.hasMore, false);
  assert.equal((await storage.getServiceReviews(3, 1)).reviews.length, 0);
  assert.equal(await storage.getServiceReviews(999, 1), undefined);
  await pool.query("UPDATE pg_temp.services SET is_active=false WHERE id=3");
  assert.equal(await storage.getServiceReviews(3, 1), undefined);
  // Check stable paging for reviews sharing the same timestamp, including unnamed customers.
  await pool.query("UPDATE pg_temp.users SET first_name=NULL,last_name=NULL WHERE id='other-customer'");
  await storage.createReview(7, "other-customer", { rating: 4, comment: "Anonymous name fallback" });
  await pool.query(`INSERT INTO pg_temp.bookings(id,service_id,seeker_id,provider_id,scheduled_date,status,total_amount,advance_amount)
    SELECT value,1,'review-customer','review-provider',now(),'completed',10,0 FROM generate_series(100,120) AS value`);
  await pool.query(`INSERT INTO pg_temp.service_reviews(booking_id,rating,comment,created_at)
    SELECT id,5,'More feedback','2020-01-01'::timestamp FROM pg_temp.bookings WHERE id BETWEEN 100 AND 120`);
  const firstPage = await storage.getServiceReviews(1, 1), secondPage = await storage.getServiceReviews(1, 2);
  assert.equal(firstPage.reviews.length, 20);
  assert.equal(firstPage.hasMore, true);
  assert.equal(secondPage.reviews.length, 4);
  assert.equal(secondPage.hasMore, false);
  assert.equal(new Set([...firstPage.reviews, ...secondPage.reviews].map(row => row.id)).size, 24);
  assert.ok(firstPage.reviews.some(row => row.reviewerName === null));
  await pool.query("INSERT INTO pg_temp.companies(id,name,owner_id,provider_id,is_active) VALUES(9,'Closed company','review-provider','review-provider',false)");
  await pool.query("UPDATE pg_temp.services SET company_id=9 WHERE id=2");
  assert.equal(await storage.getServiceReviews(2, 1), undefined, "Closed company reviews are not publicly searchable");
  // Catalog scope follows a company identity across staff, and keeps personal listings separate.
  await pool.query("INSERT INTO pg_temp.users(id,first_name) VALUES('catalog-other-owner','Provider')");
  await pool.query(`INSERT INTO pg_temp.companies(id,name,owner_id,provider_id,is_active) VALUES
    (10,'Same Company','other-customer','other-customer',true),
    (11,'Same Company','catalog-other-owner','catalog-other-owner',true)`);
  await pool.query(`INSERT INTO pg_temp.services(id,provider_id,company_id,name,category,service_type,price,duration,is_active) VALUES
    (10,'review-provider',10,'Company offer','education','one_to_one',10,30,true),
    (11,'other-customer',10,'Team offer','health_wellness','one_to_one',10,30,true),
    (12,'review-provider',10,'Unpublished offer','education','one_to_one',10,30,false),
    (13,'review-provider',11,'Other company offer','education','one_to_one',10,30,true)`);
  const catalog = await storage.searchServices({ companyId: 10 });
  assert.deepEqual(catalog.map(row => row.id).sort((a, b) => a - b), [10, 11]);
  assert.ok(catalog.every(row => row.provider.companyName === 'Same Company' && row.provider.firstName === null && row.provider.email === null));
  assert.deepEqual((await storage.searchServices({ providerId: 'review-provider' })).map(row => row.id), [1]);
  assert.deepEqual((await storage.searchServices({ providerId: 'other-customer' })).map(row => row.id), []);
  assert.deepEqual((await storage.searchServices({ companyId: 11 })).map(row => row.id), [13]);
  assert.deepEqual(await storage.searchServices({ companyId: 9 }), []);
  assert.deepEqual(await storage.searchServices({ companyId: 999 }), []);
  assert.deepEqual(await storage.searchServices({ providerId: 'unknown-provider' }), []);
  // Pool.query evicts its connection after SQL errors, which would discard the fixtures.
  // Keep an explicit client while deliberately testing invalid SQL.
  const checks = await pool.connect();
  try {
    for (const [rating, comment] of [[0, "Comment"], [6, "Comment"], [2, " "], [5, "x".repeat(2001)]]) {
      await assert.rejects(checks.query("INSERT INTO pg_temp.service_reviews(booking_id,rating,comment) VALUES(8,$1,$2)", [rating, comment]), error => error.code === "23514");
    }
    await assert.rejects(checks.query("INSERT INTO pg_temp.service_reviews(booking_id,rating) VALUES(1,5)"), error => error.code === "23505");
  } finally { checks.release(); }
  const simultaneous = await Promise.allSettled([1, 2].map(() => storage.createReview(8, "review-customer", { rating: 4, comment: "" })));
  assert.equal(simultaneous.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(simultaneous.find(result => result.status === "rejected").reason.status, 409);
  console.log("Passed: PostgreSQL review constraints, authorization, completed status, duplicate requests, stored comments, average/count aggregation, rating sorting, public review names/paging/visibility, private booking responses, and browser access restrictions. Only temporary test tables were used.");
} catch (error) {
  console.error("Review database checks failed:", error instanceof assert.AssertionError ? error.message : error.code || error.name);
  process.exitCode = 1;
} finally {
  await pool.end(); // Drops all temporary tables and their test data.
}
