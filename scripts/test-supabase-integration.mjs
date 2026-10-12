// Explicit live test: creates two temporary identities and removes all test data.
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const origin = new URL(process.env.APP_URL || "http://localhost:5000").origin;
const base = process.env.TEST_APP_URL || origin;
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10_000 });
const bucket = process.env.SUPABASE_STORAGE_BUCKET || "service-images";
const identities = [];
const files = [];
async function request(path, { method = "GET", cookie, body, requestOrigin = origin } = {}) {
  const response = await fetch(base + path, {
    method, redirect: "manual",
    headers: { ...(cookie ? { cookie } : {}), ...(body ? { "Content-Type": "application/json" } : {}), ...(method !== "GET" ? { Origin: requestOrigin } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return response;
}
async function login(identity) {
  const response = await request("/api/auth/login", { method: "POST", body: { email: identity.email, password: identity.password } });
  assert.equal(response.status, 200, "Password login must succeed");
  const setCookie = response.headers.getSetCookie().find(value => value.startsWith("wellness.sid="));
  assert.ok(setCookie?.includes("HttpOnly") && setCookie?.includes("SameSite=Lax"), "Session must use a protected cookie");
  return setCookie.split(";")[0];
}

try {
  assert.equal((await request("/api/auth/user")).status, 401);
  assert.equal((await request("/api/auth/login", { method: "POST", body: { email: "nobody@example.com", password: "invalid-password" }, requestOrigin: "https://untrusted.example" })).status, 403, "Reject cross-origin session changes");
  for (let index = 0; index < 2; index++) {
    const email = `wellness-test-${randomUUID()}@example.com`;
    const password = randomBytes(32).toString("hex");
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    assert.equal(error, null, "Temporary identity creation must succeed");
    identities.push({ id: data.user.id, email, password });
  }
  const [owner, other] = identities;
  assert.equal((await request("/api/auth/login", { method: "POST", body: { email: owner.email, password: "wrong-password" } })).status, 401);
  const ownerCookie = await login(owner);
  const otherCookie = await login(other);
  assert.equal((await (await request("/api/auth/user", { cookie: ownerCookie })).json()).id, owner.id);
  assert.equal((await (await request("/api/auth/user", { cookie: otherCookie })).json()).id, other.id, "Sessions must not leak between users");

  await pool.query("UPDATE sessions SET sess=jsonb_set(sess, '{auth,expiresAt}', '0'::jsonb) WHERE sess->'auth'->>'userId'=$1", [owner.id]);
  assert.equal((await request("/api/auth/user", { cookie: ownerCookie })).status, 200, "Expired access tokens must refresh");
  assert.equal((await request("/api/objects/upload", { method: "POST", body: { contentType: "image/png", size: 20 } })).status, 401);
  assert.equal((await request("/api/objects/upload", { method: "POST", cookie: ownerCookie, body: { contentType: "image/svg+xml", size: 20 } })).status, 400);
  assert.equal((await request("/api/objects/upload", { method: "POST", cookie: ownerCookie, body: { contentType: "image/png", size: 11 * 1024 * 1024 } })).status, 400);

  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jKZkAAAAASUVORK5CYII=", "base64");
  const sign = await request("/api/objects/upload", { method: "POST", cookie: ownerCookie, body: { contentType: "image/png", size: png.length } });
  assert.equal(sign.status, 200);
  const signed = await sign.json();
  files.push(signed.objectPath.slice("/objects/".length));
  const form = new FormData();
  form.append("cacheControl", "3600");
  form.append("", new Blob([png], { type: "image/png" }), "test.png");
  const uploaded = await fetch(signed.signedUrl, { method: "PUT", headers: { "x-upsert": "false" }, body: form });
  assert.equal(uploaded.status, 200, "Signed upload must succeed without exposing backend keys");
  assert.equal((await request("/api/service-images", { method: "PUT", cookie: ownerCookie, body: { objectPath: signed.objectPath } })).status, 200);
  assert.equal((await request("/api/service-images", { method: "PUT", cookie: otherCookie, body: { objectPath: signed.objectPath } })).status, 403, "Reject claiming another user's image");
  assert.equal((await request(signed.objectPath, { cookie: otherCookie })).status, 403, "Unpublished images must stay private");
  const read = await request(signed.objectPath, { cookie: ownerCookie });
  assert.equal(read.status, 200);
  assert.deepEqual(Buffer.from(await read.arrayBuffer()), png);
  const inserted = await pool.query("INSERT INTO services (provider_id,name,category,service_type,price,duration,image_url) VALUES ($1,$2,'health_wellness','one_to_one',1,30,$3) RETURNING id", [owner.id, "Temporary storage integration test", signed.objectPath]);
  assert.equal((await request(signed.objectPath, { cookie: otherCookie })).status, 200, "Published images must be visible to service seekers");
  assert.equal((await request(`/api/services/${inserted.rows[0].id}`, { method: "PATCH", cookie: otherCookie, body: { imageUrl: signed.objectPath } })).status, 403, "Reject modifying another provider's service");
  const sourceId = inserted.rows[0].id;
  await pool.query("UPDATE services SET description='Copy test details',address='Test address',latitude=0,longitude=0,max_capacity=8,age_groups='[\"adults\"]',advance_payment_percent=0,external_url='https://example.com',created_at='2020-01-01',updated_at='2020-01-01' WHERE id=$1", [sourceId]);
  await pool.query("INSERT INTO availability (provider_id,service_id,schedule_type,specific_date,start_time,end_time) VALUES ($1,$2,'specific',NOW(),'09:00','10:00')", [owner.id, sourceId]);
  await pool.query("INSERT INTO bookings (service_id,seeker_id,provider_id,scheduled_date,total_amount,advance_amount) VALUES ($1,$2,$3,NOW(),1,0)", [sourceId, other.id, owner.id]);
  await pool.query("INSERT INTO service_embeddings (service_id,embedding,text_content) VALUES ($1,'[0.1,0.2]','Copy test details')", [sourceId]);
  assert.equal((await request(`/api/services/${sourceId}/copy`, { method: "POST" })).status, 401);
  assert.equal((await request(`/api/services/${sourceId}/copy`, { method: "POST", cookie: otherCookie })).status, 404, "Reject copying another provider's service");
  assert.equal((await request("/api/services/not-an-id/copy", { method: "POST", cookie: ownerCookie })).status, 400);
  const copyResponse = await request(`/api/services/${sourceId}/copy`, { method: "POST", cookie: ownerCookie, body: { providerId: other.id, isActive: true } });
  assert.equal(copyResponse.status, 201);
  const copy = await copyResponse.json();
  const original = (await pool.query("SELECT * FROM services WHERE id=$1", [sourceId])).rows[0];
  assert.notEqual(copy.id, sourceId);
  assert.equal(copy.name, original.name + " (copy)");
  assert.equal(copy.providerId, owner.id);
  assert.equal(copy.isActive, false);
  assert.equal(copy.imageUrl, signed.objectPath);
  assert.equal(copy.description, original.description);
  assert.equal(copy.price, original.price);
  assert.equal(copy.duration, original.duration);
  assert.equal(copy.maxCapacity, 8);
  assert.equal(copy.advancePaymentPercent, 0);
  assert.equal(copy.latitude, 0);
  assert.equal(copy.longitude, 0);
  assert.deepEqual(copy.ageGroups, ["adults"]);
  assert.equal(copy.externalUrl, original.external_url);
  assert.notEqual(copy.createdAt, original.created_at.toISOString());
  for (const table of ["bookings", "availability", "service_embeddings"]) {
    const count = (await pool.query(`SELECT count(*)::int AS count FROM ${table} WHERE service_id=$1`, [copy.id])).rows[0].count;
    assert.equal(count, 0, `Copy must not inherit ${table}`);
  }
  assert.equal((await request(`/api/services/${copy.id}`)).status, 404, "Unpublished copies must not appear in public details");
  assert.equal((await request("/api/bookings", { method: "POST", cookie: otherCookie, body: { serviceId: copy.id, providerId: owner.id, scheduledDate: new Date().toISOString(), totalAmount: "1", advanceAmount: "0" } })).status, 404, "Unpublished copies must not accept bookings");
  const hiddenSearch = await (await request("/api/services/search")).json();
  assert.ok(!hiddenSearch.some(service => service.id === copy.id));
  const edited = await request(`/api/services/${copy.id}`, { method: "PATCH", cookie: ownerCookie, body: { name: "Edited temporary copy", price: "12.00", isActive: true } });
  assert.equal(edited.status, 200, "Owner must be able to edit and publish the copy");
  const unchanged = (await pool.query("SELECT name,price,is_active FROM services WHERE id=$1", [sourceId])).rows[0];
  assert.equal(unchanged.name, original.name);
  assert.equal(unchanged.price, original.price);
  assert.equal(unchanged.is_active, true);
  const publishedSearch = await (await request("/api/services/search")).json();
  assert.ok(publishedSearch.some(service => service.id === copy.id));
  await pool.query("UPDATE services SET is_active=false WHERE id=$1", [copy.id]);
  await pool.query("UPDATE services SET is_active=false WHERE id=$1", [inserted.rows[0].id]);
  assert.equal((await request(signed.objectPath, { cookie: otherCookie })).status, 403, "Unpublished services must stop exposing their images");

  assert.equal((await request("/api/logout", { method: "POST", cookie: ownerCookie })).status, 200);
  assert.equal((await request("/api/auth/user", { cookie: ownerCookie })).status, 401, "Logout must invalidate the session");
  console.log("Passed: Auth/Storage checks plus service copying, owner-only access, independent edits, draft visibility, and publication.");
} finally {
  if (files.length) {
    const { error } = await admin.storage.from(bucket).remove(files);
    if (error) throw new Error("Temporary image cleanup failed");
  }
  const ids = identities.map(identity => identity.id);
  if (ids.length) {
    await pool.query("DELETE FROM bookings WHERE provider_id=ANY($1::text[])", [ids]);
    await pool.query("DELETE FROM availability WHERE provider_id=ANY($1::text[])", [ids]);
    await pool.query("DELETE FROM service_embeddings WHERE service_id IN (SELECT id FROM services WHERE provider_id=ANY($1::text[]))", [ids]);
    await pool.query("DELETE FROM services WHERE provider_id=ANY($1::text[])", [ids]);
    await pool.query("DELETE FROM sessions WHERE sess->'auth'->>'userId'=ANY($1::text[])", [ids]);
    await pool.query("DELETE FROM users WHERE id=ANY($1::text[])", [ids]);
    for (const id of ids) {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw new Error("Temporary identity cleanup failed");
    }
  }
  await pool.end();
  console.log("Removed temporary users, sessions, service, and image.");
}
