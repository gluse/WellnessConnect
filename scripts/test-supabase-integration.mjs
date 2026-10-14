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
    const password = `Aa1!${randomBytes(32).toString("hex")}`;
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

  // Companies retain the administrator's ownership while employees have separate booking resources.
  await pool.query("UPDATE bookings SET scheduled_date='2020-01-01' WHERE provider_id=$1", [owner.id]);
  assert.equal((await request("/api/provider/profile", { method: "PATCH", body: { providerType: "company", companyName: "Test salon" } })).status, 401);
  assert.equal((await request("/api/provider/profile", { method: "PATCH", cookie: ownerCookie, body: { providerType: "company", companyName: " " } })).status, 400);
  assert.equal((await request("/api/provider/employees", { method: "POST", cookie: ownerCookie, body: { name: "Staff" } })).status, 400, "Individual providers must set up a company first");
  const companyName = `Test salon ${randomUUID()}`;
  await pool.query("UPDATE users SET first_name='Private administrator',last_name='Hidden name' WHERE id=$1", [owner.id]);
  assert.equal((await request("/api/provider/profile", { method: "PATCH", cookie: ownerCookie, body: { providerType: "company", companyName } })).status, 200);
  assert.equal((await request("/api/provider/profile", { method: "PATCH", cookie: otherCookie, body: { providerType: "company", companyName: "Other salon" } })).status, 200);
  const addEmployee = async (cookie, name, showName) => {
    const response = await request("/api/provider/employees", { method: "POST", cookie, body: { name, showName, providerId: other.id } });
    assert.equal(response.status, 201);
    return response.json();
  };
  const massage = await addEmployee(ownerCookie, "Private massage therapist", false);
  const hair = await addEmployee(ownerCookie, "Public hair stylist", true);
  const foreign = await addEmployee(otherCookie, "Other company's staff", false);
  assert.equal(massage.providerId, owner.id, "Employee owner must come from the session");
  assert.equal((await request(`/api/provider/employees/${massage.id}`, { method: "PATCH", cookie: otherCookie, body: { name: "Stolen employee", showName: true } })).status, 404);
  assert.equal((await request(`/api/provider/employees/${massage.id}`, { method: "DELETE", cookie: otherCookie })).status, 404);
  assert.deepEqual((await (await request("/api/provider/employees", { cookie: ownerCookie })).json()).map(employee => employee.id).sort(), [massage.id, hair.id].sort());
  assert.equal((await request(`/api/services/${sourceId}`, { method: "PATCH", cookie: ownerCookie, body: { employeeId: foreign.id } })).status, 400, "Reject foreign employee assignments");
  assert.equal((await request("/api/services", { method: "POST", cookie: ownerCookie, body: { name: "Invalid staff assignment", category: "health_wellness", serviceType: "one_to_one", price: "1", duration: 30, employeeId: foreign.id } })).status, 400);
  assert.equal((await request(`/api/services/${sourceId}`, { method: "PATCH", cookie: ownerCookie, body: { employeeId: massage.id, isActive: true } })).status, 200);
  assert.equal((await request(`/api/services/${copy.id}`, { method: "PATCH", cookie: ownerCookie, body: { employeeId: massage.id, isActive: true } })).status, 200);
  const ownerCompanyId = (await (await request("/api/company/context", { cookie: ownerCookie })).json()).company.id;
  const hairId = (await pool.query("INSERT INTO services (provider_id,employee_id,company_id,name,category,service_type,price,duration) VALUES ($1,$2,$3,'Temporary haircut','health_wellness','one_to_one',1,30) RETURNING id", [owner.id, hair.id, ownerCompanyId])).rows[0].id;
  const companySearch = await (await request(`/api/services/search?searchQuery=${encodeURIComponent(companyName)}`)).json();
  assert.equal(companySearch.length, 3, "Customers must be able to find offers by company name");
  const privateListing = companySearch.find(service => service.id === sourceId);
  assert.equal(privateListing.provider.companyName, companyName);
  assert.equal(privateListing.provider.firstName, null, "Do not expose the administrator's personal name");
  assert.equal(privateListing.provider.lastName, null);
  assert.equal(privateListing.provider.email, null);
  assert.equal(privateListing.employee.name, null, "Hide private employee names in API responses too");
  assert.equal(companySearch.find(service => service.id === hairId).employee.name, hair.name);
  assert.equal((await request(`/api/provider/employees/${massage.id}`, { method: "DELETE", cookie: ownerCookie })).status, 409, "Keep employees linked to services");
  assert.equal((await request("/api/provider/profile", { method: "PATCH", cookie: ownerCookie, body: { providerType: "individual" } })).status, 409, "Avoid hiding a company with staff assignments");
  await request(`/api/provider/employees/${massage.id}`, { method: "PATCH", cookie: ownerCookie, body: { name: massage.name, showName: true } });
  assert.equal((await (await request(`/api/services/${sourceId}`)).json()).employee.name, massage.name, "Employee name visibility must update on existing offers");
  await request(`/api/provider/employees/${massage.id}`, { method: "PATCH", cookie: ownerCookie, body: { name: massage.name, showName: false } });
  const staffCopyResponse = await request(`/api/services/${sourceId}/copy`, { method: "POST", cookie: ownerCookie });
  assert.equal(staffCopyResponse.status, 201);
  const staffCopy = await staffCopyResponse.json();
  assert.equal(staffCopy.employeeId, massage.id, "Copy must retain the employee assignment");
  assert.equal(staffCopy.isActive, false);

  const dateString = "2030-01-14";
  const appointment = new Date(dateString);
  appointment.setUTCHours(10, 0, 0, 0);
  assert.equal((await request("/api/availability", { method: "POST", cookie: ownerCookie, body: { serviceId: sourceId, scheduleType: "specific", specificDate: dateString, startTime: "09:00", endTime: "16:00", timezone: "UTC" } })).status, 200);
  const scheduledOffers = await (await request(`/api/services/search?searchQuery=${encodeURIComponent(companyName)}&availableOnly=true&date=${dateString}`)).json();
  assert.deepEqual(scheduledOffers.map(service => service.id), [sourceId], "A service-specific schedule must not make all company offers appear available");
  assert.equal((await request("/api/availability", { method: "POST", cookie: ownerCookie, body: { serviceId: null, scheduleType: "specific", specificDate: dateString, startTime: "09:00", endTime: "16:00", timezone: "UTC" } })).status, 200);
  const book = (serviceId, scheduledDate = appointment.toISOString()) => request("/api/bookings", { method: "POST", cookie: otherCookie, body: {
    serviceId, providerId: other.id, employeeId: foreign.id, scheduledDate, bookingDuration: 1, totalAmount: "1", advanceAmount: "0",
  } });
  const massageBooking = await book(sourceId);
  assert.equal(massageBooking.status, 200);
  const booking = await massageBooking.json();
  assert.equal(booking.providerId, owner.id, "Booking owner must come from the service");
  assert.equal(booking.employeeId, massage.id, "Ignore forged booking employee IDs");
  assert.equal(booking.bookingDuration, 30, "Use the service duration");
  assert.equal((await book(copy.id)).status, 409, "Two offers for the same employee must share conflicts");
  const massageSlots = await (await request(`/api/availability/slots/${copy.id}?date=${dateString}`)).json();
  const hairSlots = await (await request(`/api/availability/slots/${hairId}?date=${dateString}`)).json();
  assert.ok(!massageSlots.slots.some(slot => slot.startTime === "10:00"), "Hide slots occupied by another offer for the same employee");
  assert.ok(hairSlots.slots.some(slot => slot.startTime === "10:00"), "Another employee must remain available");
  assert.equal((await book(hairId)).status, 200, "Different employees can accept simultaneous bookings");
  assert.equal((await request(`/api/services/${sourceId}`, { method: "PATCH", cookie: ownerCookie, body: { employeeId: hair.id } })).status, 409, "Protect employee assignments with upcoming bookings");
  const noon = new Date(appointment);
  noon.setUTCHours(12, 0, 0, 0);
  const simultaneous = await Promise.all([book(sourceId, noon.toISOString()), book(copy.id, noon.toISOString())]);
  assert.deepEqual(simultaneous.map(response => response.status).sort(), [200, 409], "Concurrent bookings for one employee must not double-book");
  await request(`/api/bookings/${booking.id}/status`, { method: "PATCH", cookie: ownerCookie, body: { status: "cancelled" } });
  assert.equal((await book(copy.id)).status, 200, "Cancelled appointments must release the employee");
  const seekerBookings = await (await request("/api/bookings/seeker", { cookie: otherCookie })).json();
  assert.equal(seekerBookings.find(row => row.id === booking.id).provider.companyName, companyName);
  assert.equal(seekerBookings.find(row => row.id === booking.id).employee.name, null);
  const weekly = { serviceId: null, timezone: "Europe/Riga", days: Array.from({ length: 7 }, (_, day) => ({ day, intervals: day === 1 ? [{ startTime: "09:00", endTime: "12:00" }, { startTime: "13:00", endTime: "17:00" }] : [] })) };
  assert.equal((await request("/api/availability/weekly", { method: "PUT", cookie: ownerCookie, body: weekly })).status, 200);
  assert.equal((await request("/api/availability/weekly", { method: "PUT", cookie: ownerCookie, body: { ...weekly, timezone: "Invalid/Zone" } })).status, 400);
  const slotDate = "2030-01-21";
  const rigaSlots = await (await request(`/api/availability/slots/${sourceId}?date=${slotDate}&timezone=Europe%2FRiga`)).json();
  assert.equal(rigaSlots.slots[0].startTime, "09:00");
  assert.equal(rigaSlots.slots[0].startsAt, "2030-01-21T07:00:00.000Z", "Interpret working hours in the saved timezone");
  assert.ok(!rigaSlots.slots.some(slot => slot.startTime === "12:00"), "Exclude breaks between working ranges");
  const month = await (await request(`/api/availability/month/${sourceId}?month=2030-01&timezone=Europe%2FRiga`)).json();
  assert.equal(month.days.find(day => day.date === slotDate).availableSlots, rigaSlots.slots.length);
  assert.equal(month.days.find(day => day.date === "2030-01-22").availableSlots, 0);
  assert.equal((await book(sourceId, "2030-01-21T05:00:00Z")).status, 409, "Reject bookings outside working hours");
  assert.equal((await book(sourceId, rigaSlots.slots[0].startsAt)).status, 200);
  const offDay = { serviceId: null, timezone: "Europe/Riga", date: slotDate, intervals: [] };
  assert.equal((await request("/api/availability/override", { method: "PUT", cookie: ownerCookie, body: offDay })).status, 200);
  assert.equal((await (await request(`/api/availability/slots/${sourceId}?date=${slotDate}&timezone=Europe%2FRiga`)).json()).slots.length, 0, "A day off replaces weekly availability");
  assert.equal((await request(`/api/availability/override?serviceId=all&date=${slotDate}`, { method: "DELETE", cookie: ownerCookie })).status, 200);
  assert.ok((await (await request(`/api/availability/slots/${sourceId}?date=${slotDate}&timezone=Europe%2FRiga`)).json()).slots.length > 0, "Removing an exception restores weekly hours");
  const customWeek = { ...weekly, serviceId: copy.id, days: weekly.days.map(item => ({ ...item, intervals: item.day === 2 ? [{ startTime: "10:00", endTime: "11:00" }] : [] })) };
  assert.equal((await request("/api/availability/weekly", { method: "PUT", cookie: otherCookie, body: customWeek })).status, 403, "Reject changes to another company's hours");
  assert.equal((await request("/api/availability/weekly", { method: "PUT", cookie: ownerCookie, body: customWeek })).status, 200);
  assert.equal((await (await request(`/api/availability/slots/${copy.id}?date=${slotDate}&timezone=Europe%2FRiga`)).json()).slots.length, 0, "A custom service week replaces general hours");
  assert.equal((await request("/api/availability/weekly", { method: "PUT", cookie: ownerCookie, body: { ...customWeek, inherit: true } })).status, 200);
  assert.ok((await (await request(`/api/availability/slots/${copy.id}?date=${slotDate}&timezone=Europe%2FRiga`)).json()).slots.length > 0);
  const refreshedCookie = await login(owner);
  assert.equal((await (await request("/api/auth/user", { cookie: refreshedCookie })).json()).companyName, companyName, "Logging in again must preserve the company profile");

  assert.equal((await request("/api/logout", { method: "POST", cookie: ownerCookie })).status, 200);
  assert.equal((await request("/api/auth/user", { cookie: ownerCookie })).status, 401, "Logout must invalidate the session");
  console.log("Passed: Auth/Storage, copying/publication, company search, optional names, employee ownership, independent schedules, and concurrent booking protection.");
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
    await pool.query("DELETE FROM company_invitations WHERE company_id IN (SELECT id FROM companies WHERE provider_id=ANY($1::text[]))", [ids]);
    await pool.query("DELETE FROM company_memberships WHERE company_id IN (SELECT id FROM companies WHERE provider_id=ANY($1::text[]))", [ids]);
    await pool.query("DELETE FROM employees WHERE provider_id=ANY($1::text[])", [ids]);
    await pool.query("DELETE FROM companies WHERE provider_id=ANY($1::text[])", [ids]);
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
