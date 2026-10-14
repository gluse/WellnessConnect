// Live authorization tests. No emails are sent; all fixtures use temporary accounts.
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
const origin = new URL(process.env.APP_URL || "http://localhost:5000").origin;
const base = process.env.TEST_APP_URL || origin;
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10_000 });
const identities = [];
const files = [];
const bucket = process.env.SUPABASE_STORAGE_BUCKET || "service-images";
async function request(path, cookie, method = "GET", body) {
  return fetch(base + path, { method, redirect: "manual", headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { "Content-Type": "application/json" } : {}), Origin: origin }, body: body ? JSON.stringify(body) : undefined });
}
async function identity(companyName) {
  const email = `team-test-${randomUUID()}@example.com`;
  const password = `Aa1!${randomBytes(32).toString("hex")}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: companyName ? { requested_company_name: companyName } : {} });
  assert.equal(error, null);
  const user = { id: data.user.id, email, password };
  identities.push(user);
  const login = await request("/api/auth/login", null, "POST", { email, password });
  assert.equal(login.status, 200);
  user.cookie = login.headers.getSetCookie().find(value => value.startsWith("wellness.sid=")).split(";")[0];
  return user;
}
async function json(path, cookie) { const response = await request(path, cookie); assert.equal(response.status, 200, path); return response.json(); }
async function invite(owner, user, role, employeeId) {
  const response = await request("/api/company/invitations", owner.cookie, "POST", { email: user.email, role, employeeId, sendEmail: false });
  assert.equal(response.status, 201);
  const data = await response.json();
  assert.equal(data.emailSent, false);
  const token = new URL(data.invitationUrl).searchParams.get("token");
  const preview = await json(`/api/company/invitation?token=${token}`);
  assert.equal(preview.id, data.id);
  return { ...data, token };
}
try {
  const companyName = `Temporary company ${randomUUID()}`;
  const owner = await identity(companyName);
  const outsider = await identity(`Other company ${randomUUID()}`);
  const provider = await identity();
  const viewer = await identity();
  const manager = await identity();
  const ownerProfile = await json("/api/auth/user", owner.cookie);
  assert.equal(ownerProfile.firstName, null, "Company accounts must work without personal names");
  const ctx = await json("/api/company/context", owner.cookie);
  const companyId = ctx.company.id;
  assert.equal(ctx.company.name, companyName);
  assert.equal(ctx.membership.role, "owner", "Verified company signup must create an owner membership");
  const employee = async name => {
    const response = await request("/api/provider/employees", owner.cookie, "POST", { name, showName: false });
    assert.equal(response.status, 201); return response.json();
  };
  const therapist = await employee("Massage therapist");
  const stylist = await employee("Hair stylist");
  const disposable = await employee("Unused employee");
  const service = async (name, employeeId, isActive = true, imageUrl = null) => (await pool.query("INSERT INTO services (provider_id,company_id,employee_id,name,category,service_type,price,duration,is_active,image_url) VALUES ($1,$2,$3,$4,'health_wellness','one_to_one',20,30,$5,$6) RETURNING id", [owner.id, companyId, employeeId, name, isActive, imageUrl])).rows[0].id;
  const massageId = await service("Test massage", therapist.id);
  const hairId = await service("Test haircut", stylist.id);
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jKZkAAAAASUVORK5CYII=", "base64");
  const objectKey = `${owner.id}/${randomUUID()}.png`;
  files.push(objectKey);
  const uploaded = await admin.storage.from(bucket).upload(objectKey, png, { contentType: "image/png", upsert: false });
  assert.equal(uploaded.error, null);
  const draftId = await service("Private draft", therapist.id, false, `/objects/${objectKey}`);
  const bookings = [];
  for (const [serviceId, employeeId, time] of [[massageId, therapist.id, "2030-03-10T10:00:00Z"], [hairId, stylist.id, "2030-03-10T10:00:00Z"]]) {
    bookings.push((await pool.query("INSERT INTO bookings (provider_id,company_id,employee_id,service_id,seeker_id,scheduled_date,booking_duration,total_amount,advance_amount,status) VALUES ($1,$2,$3,$4,$5,$6,30,20,0,'pending') RETURNING id", [owner.id, companyId, employeeId, serviceId, outsider.id, time])).rows[0].id);
  }
  assert.equal((await request("/api/company/invitations", owner.cookie, "POST", { email: viewer.email, role: "owner", sendEmail: false })).status, 400, "Invitations cannot grant ownership");
  assert.equal((await request("/api/company/invitations", owner.cookie, "POST", { email: viewer.email, role: "viewer", sendEmail: false })).status, 400, "Read-only roles require an employee scope");
  const providerInvite = await invite(owner, provider, "provider", therapist.id);
  assert.equal((await request("/api/company/invitations/accept", outsider.cookie, "POST", { id: providerInvite.id })).status, 403, "Invitation must match the verified email");
  assert.equal((await request("/api/company/invitations/accept", provider.cookie, "POST", { id: providerInvite.id, role: "owner", companyId: 999 })).status, 200);
  assert.equal((await request("/api/company/invitations/accept", provider.cookie, "POST", { id: providerInvite.id })).status, 410, "Invitations are single-use");
  assert.equal((await json("/api/company/context", provider.cookie)).membership.role, "provider", "Ignore role overrides on acceptance");
  const viewerInvite = await invite(owner, viewer, "viewer", stylist.id);
  assert.equal((await request("/api/company/invitations/accept", viewer.cookie, "POST", { id: viewerInvite.id })).status, 200);
  const managerInvite = await invite(owner, manager, "admin", null);
  assert.equal((await request("/api/company/invitations/accept", manager.cookie, "POST", { id: managerInvite.id })).status, 200);
  assert.equal((await json("/api/company/context", manager.cookie)).permissions.manageServices, true);
  assert.deepEqual((await json("/api/bookings/provider", provider.cookie)).map(row => row.id), [bookings[0]], "Providers see only their reservations");
  assert.deepEqual((await json("/api/bookings/provider", viewer.cookie)).map(row => row.id), [bookings[1]], "Viewers see only their reservations");
  assert.equal((await json("/api/bookings/provider", manager.cookie)).length, 2);
  assert.equal((await json("/api/provider/employees", provider.cookie)).length, 1, "Providers cannot read private coworker profiles");
  assert.ok((await json("/api/services/provider", viewer.cookie)).every(row => row.employeeId === stylist.id));
  assert.equal((await request("/api/company/team", provider.cookie)).status, 403);
  assert.equal((await request(`/api/bookings/${bookings[1]}/status`, provider.cookie, "PATCH", { status: "confirmed" })).status, 403);
  assert.equal((await request(`/api/bookings/${bookings[1]}/status`, viewer.cookie, "PATCH", { status: "confirmed" })).status, 403);
  assert.equal((await request(`/api/bookings/${bookings[0]}/status`, provider.cookie, "PATCH", { status: "confirmed" })).status, 200);
  assert.equal((await request("/api/availability/weekly", owner.cookie, "PUT", { serviceId: null, timezone: "UTC", days: Array.from({ length: 7 }, (_, day) => ({ day, intervals: [{ startTime: "09:00", endTime: "17:00" }] })) })).status, 200);
  assert.equal((await request(`/api/bookings/${bookings[0]}/available-times?date=2030-03-10&timezone=UTC`, provider.cookie)).status, 200);
  assert.equal((await request(`/api/bookings/${bookings[0]}/available-times?date=2030-03-10&timezone=UTC`, viewer.cookie)).status, 403, "Read-only users cannot access rescheduling controls");
  assert.equal((await request(`/api/bookings/${bookings[0]}/reschedule`, provider.cookie, "PATCH", { scheduledDate: "2030-03-10T11:00:00Z" })).status, 200);
  assert.equal((await request(`/api/bookings/${bookings[1]}/reschedule`, viewer.cookie, "PATCH", { scheduledDate: "2030-03-10T11:00:00Z" })).status, 403);
  assert.equal((await request(`/api/bookings/${bookings[0]}/status`, provider.cookie, "PATCH", { status: "cancelled" })).status, 200);
  assert.equal((await request(`/api/bookings/${bookings[0]}/status`, provider.cookie, "PATCH", { status: "confirmed" })).status, 409, "Closed reservations cannot be reactivated into occupied time slots");
  for (const member of [provider, viewer]) {
    assert.equal((await request(`/api/services/${massageId}`, member.cookie, "PATCH", { name: "Unauthorized edit" })).status, 403);
    assert.equal((await request(`/api/services/${massageId}/copy`, member.cookie, "POST")).status, 403);
    assert.equal((await request("/api/availability", member.cookie, "POST", { scheduleType: "specific", specificDate: "2030-03-10", startTime: "09:00", endTime: "16:00" })).status, 403);
    assert.equal((await request("/api/provider/profile", member.cookie, "PATCH", { providerType: "company", companyName: "Unauthorized rename" })).status, 403);
    assert.equal((await request("/api/company/invitations", member.cookie, "POST", { email: "not-sent@example.com", role: "admin", sendEmail: false })).status, 403);
  }
  assert.equal((await request(`/api/services/${draftId}`, manager.cookie, "PATCH", { name: "Admin draft edit", imageUrl: `/objects/${objectKey}` })).status, 200, "Admins can reuse a company image uploaded by another manager");
  assert.equal((await request(`/objects/${objectKey}`, manager.cookie)).status, 200);
  assert.equal((await request(`/objects/${objectKey}`, provider.cookie)).status, 200, "Assigned employee can read their draft image");
  assert.equal((await request(`/objects/${objectKey}`, viewer.cookie)).status, 403);
  assert.equal((await request(`/objects/${objectKey}`, outsider.cookie)).status, 403);
  const copied = await request(`/api/services/${massageId}/copy`, manager.cookie, "POST");
  assert.equal(copied.status, 201);
  assert.equal((await copied.json()).companyId, companyId);
  assert.equal((await request(`/api/services/${massageId}`, outsider.cookie, "PATCH", { name: "Other-company edit" })).status, 403);
  assert.equal((await request("/api/company/context", outsider.cookie, "POST", { companyId })).status, 403);
  assert.equal((await request("/api/company/context", viewer.cookie, "POST", { companyId: null })).status, 200);
  assert.equal((await request(`/api/bookings/${bookings[1]}/status`, viewer.cookie, "PATCH", { status: "confirmed" })).status, 403, "Personal workspace cannot bypass team permissions");
  assert.equal((await request("/api/company/context", viewer.cookie, "POST", { companyId })).status, 200);
  const personalId = (await pool.query("INSERT INTO services (provider_id,name,category,service_type,price,duration,is_active) VALUES ($1,'Separate personal offer','health_wellness','one_to_one',1,30,false) RETURNING id", [owner.id])).rows[0].id;
  const ownerLogin = await request("/api/auth/login", null, "POST", { email: owner.email, password: owner.password });
  assert.equal(ownerLogin.status, 200);
  owner.cookie = ownerLogin.headers.getSetCookie().find(value => value.startsWith("wellness.sid=")).split(";")[0];
  assert.equal((await pool.query("SELECT company_id FROM services WHERE id=$1", [personalId])).rows[0].company_id, null, "Logging in must not move personal offers into an existing company");
  assert.equal((await request("/api/company/context", owner.cookie, "POST", { companyId: null })).status, 200);
  assert.deepEqual((await json("/api/services/provider", owner.cookie)).map(row => row.id), [personalId]);
  assert.equal((await request("/api/company/context", owner.cookie, "POST", { companyId })).status, 200);
  assert.equal((await request(`/api/company/members/${viewer.id}`, owner.cookie, "PATCH", { role: "provider", employeeId: stylist.id })).status, 200);
  assert.equal((await request(`/api/bookings/${bookings[1]}/status`, viewer.cookie, "PATCH", { status: "confirmed" })).status, 200, "Permission changes apply to the existing session immediately");
  assert.equal((await request(`/api/company/members/${viewer.id}`, owner.cookie, "DELETE")).status, 200);
  assert.equal((await request(`/api/bookings/${bookings[1]}/status`, viewer.cookie, "PATCH", { status: "cancelled" })).status, 403, "Removed members lose access immediately");
  assert.equal((await request(`/api/company/members/${owner.id}`, manager.cookie, "DELETE")).status, 409, "Protect the last owner");
  assert.equal((await request("/api/company/transfer", manager.cookie, "POST", { userId: provider.id })).status, 403);

  const revoked = await invite(owner, viewer, "viewer", disposable.id);
  assert.equal((await request(`/api/company/invitations/${revoked.id}`, manager.cookie, "DELETE")).status, 200);
  assert.equal((await request(`/api/company/invitation?token=${revoked.token}`)).status, 410);
  assert.equal((await request("/api/company/invitations/accept", viewer.cookie, "POST", { id: revoked.id })).status, 410);
  const expired = await invite(owner, viewer, "viewer", disposable.id);
  await pool.query("UPDATE company_invitations SET expires_at='2020-01-01' WHERE id=$1", [expired.id]);
  assert.equal((await request("/api/company/invitations/accept", viewer.cookie, "POST", { id: expired.id })).status, 410);

  // Exercise Supabase's invitation sign-in without sending any email.
  const newEmail = `team-test-${randomUUID()}@example.com`;
  const linkInvite = await invite(owner, { email: newEmail }, "viewer", disposable.id);
  const generated = await admin.auth.admin.generateLink({ type: "invite", email: newEmail, options: { redirectTo: `${origin}/api/callback` } });
  assert.equal(generated.error, null);
  identities.push({ id: generated.data.user.id, email: newEmail });
  const callback = await request("/api/callback");
  assert.equal(callback.status, 302);
  assert.equal(callback.headers.get("location"), "/invite");
  const verified = await fetch(generated.data.properties.action_link, { redirect: "manual" });
  const location = verified.headers.get("location");
  assert.ok(location?.includes("refresh_token="), "Invitation verification must return an implicit session");
  const fragment = new URLSearchParams(new URL(location).hash.slice(1));
  const signedIn = await request("/api/auth/invite-session", null, "POST", { refreshToken: fragment.get("refresh_token") });
  assert.equal(signedIn.status, 200);
  let inviteCookie = signedIn.headers.getSetCookie().find(value => value.startsWith("wellness.sid=")).split(";")[0];
  assert.equal((await json("/api/auth/invite-status", inviteCookie)).needsPassword, true, "Password setup must survive a page reload");
  assert.equal((await request("/api/company/invitations/accept", inviteCookie, "POST", { id: linkInvite.id })).status, 403, "Complete password setup before joining");
  // Lose the original session BEFORE a password exists, then recover using
  // a fresh verified email link. generateLink never delivers a real email.
  assert.equal((await request("/api/logout", inviteCookie, "POST")).status, 200);
  assert.equal((await request("/api/auth/invite-password", inviteCookie, "POST", { password: "Aa1!fixture-password" })).status, 401);
  const recovered = await admin.auth.admin.generateLink({ type: "magiclink", email: newEmail, options: { redirectTo: `${origin}/api/callback` } });
  assert.equal(recovered.error, null);
  const recoveryVerified = await fetch(recovered.data.properties.action_link, { redirect: "manual" });
  const recoveryLocation = recoveryVerified.headers.get("location");
  assert.ok(recoveryLocation?.includes("refresh_token="), "Fresh email proof must return a session");
  const recoveryFragment = new URLSearchParams(new URL(recoveryLocation).hash.slice(1));
  const recoverySession = await request("/api/auth/invite-session", null, "POST", { refreshToken: recoveryFragment.get("refresh_token") });
  assert.equal(recoverySession.status, 200);
  inviteCookie = recoverySession.headers.getSetCookie().find(value => value.startsWith("wellness.sid=")).split(";")[0];
  assert.equal((await json("/api/auth/invite-status", inviteCookie)).needsPassword, true);
  assert.equal((await request("/api/auth/invite-recovery", null, "POST", { email: `unknown-${randomUUID()}@example.com`, returnTo: "/invite" })).status, 200, "Unknown email recovery does not reveal account existence");
  assert.equal((await request("/api/auth/invite-recovery", null, "POST", { email: newEmail, returnTo: "https://example.com" })).status, 400, "Recovery cannot redirect outside the invitation page");
  const passwordSaved = await request("/api/auth/invite-password", inviteCookie, "POST", { password: `Aa1!${randomBytes(24).toString("hex")}` });
  assert.equal(passwordSaved.status, 200);
  inviteCookie = passwordSaved.headers.getSetCookie().find(value => value.startsWith("wellness.sid=")).split(";")[0];
  assert.equal((await request("/api/auth/user", inviteCookie)).status, 200, "Password setup must establish a fresh valid session");
  assert.equal((await request("/api/company/invitations/accept", inviteCookie, "POST", { id: linkInvite.id })).status, 200);
  assert.equal((await request("/api/auth/invite-password", inviteCookie, "POST", { password: "Aa1!another-password" })).status, 403, "Invitation password setup is one-time");
  assert.equal((await request("/api/company/transfer", owner.cookie, "POST", { userId: manager.id })).status, 200);
  assert.equal((await json("/api/company/context", owner.cookie)).membership.role, "admin");
  assert.equal((await json("/api/company/context", manager.cookie)).membership.role, "owner");
  assert.equal((await request("/api/company/active", owner.cookie, "PATCH", { isActive: false })).status, 403);
  assert.equal((await request("/api/company/active", manager.cookie, "PATCH", { isActive: false })).status, 200);
  assert.equal((await request(`/api/services/${massageId}`)).status, 404, "Closed company offers are hidden");
  assert.ok((await json("/api/bookings/provider", manager.cookie)).length >= 2, "Closing preserves reservation history");
  assert.equal((await request("/api/company/active", manager.cookie, "PATCH", { isActive: true })).status, 200);
  assert.equal((await request(`/api/services/${massageId}`)).status, 200);
  console.log("Passed: company signup, invitations, verified email binding, role isolation, private images, rescheduling, revocation, ownership transfer, and retained history.");
} finally {
  if (files.length) { const { error } = await admin.storage.from(bucket).remove(files); if (error) throw new Error("Temporary image cleanup failed"); }
  const ids = identities.map(user => user.id);
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
    for (const id of ids) { const { error } = await admin.auth.admin.deleteUser(id); if (error) throw new Error("Temporary identity cleanup failed"); }
  }
  await pool.end(); console.log("Removed all temporary team test records.");
}
