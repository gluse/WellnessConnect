// Connection-local fixtures exercise the real store, routes, SQL and image checks.
import assert from "node:assert/strict";
import "dotenv/config";
import { pool } from "../server/db.ts";
import { storefrontStore } from "../server/storefronts.ts";
import { storage } from "../server/storage.ts";
import { canReadImage } from "../server/imageStorage.ts";
import { workspaceContext } from "../server/companyAccess.ts";
import { loadDirectorySubscriptions } from "../server/admin-directory.ts";
import { setupStorefrontFixtures } from "./fixtures/storefronts.mjs";

pool.options.max = 1;
pool.options.idleTimeoutMillis = 0;
let release;
try {
  const client = await pool.connect(); release = client.release.bind(client);
  pool.query = client.query.bind(client); pool.connect = async () => client; client.release = () => {};
  for (const table of ["users", "companies", "company_memberships", "employees", "services", "bookings", "service_reviews"]) {
    await pool.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES)`);
  }
  await setupStorefrontFixtures(pool.query.bind(pool));
  await setupStorefrontFixtures(pool.query.bind(pool));
  for (const table of ["provider_subscriptions", "storefronts"]) {
    const row = (await pool.query(`SELECT relrowsecurity AS rls,
      has_table_privilege('anon', $1, 'SELECT,INSERT,UPDATE,DELETE') AS anon_access,
      has_table_privilege('authenticated', $1, 'SELECT,INSERT,UPDATE,DELETE') AS browser_access
      FROM pg_class WHERE oid = $1::regclass`, [`pg_temp.${table}`])).rows[0];
    assert.equal(row.rls, true); assert.equal(row.anon_access, false); assert.equal(row.browser_access, false);
  }
  await pool.query("INSERT INTO pg_temp.users(id,first_name,email) VALUES('owner','Private owner','owner@example.test'),('manager','Manager','manager@example.test'),('other','Other','other@example.test'),('viewer','Viewer','viewer@example.test')");
  await pool.query("INSERT INTO pg_temp.companies(id,name,owner_id,provider_id) VALUES(7,'Riga studio','owner','owner'),(8,'Other studio','other','other')");
  await pool.query("INSERT INTO pg_temp.company_memberships(company_id,user_id,role) VALUES(7,'owner','owner'),(7,'manager','admin'),(7,'viewer','viewer')");
  const options = (kind, search = "", page = 1) => storefrontStore.adminOptions({ kind, search, page });
  assert.deepEqual((await options("company", "RIGA")).items.map(item => item.target), [{ kind: "company", id: 7 }]);
  assert.deepEqual((await options("company", "owner@example.test")).items.map(item => item.target.id), [7]);
  assert.deepEqual((await options("company", "Private owner")).items.map(item => item.target.id), [7]);
  assert.deepEqual((await options("user", "MANAGER@EXAMPLE.TEST")).items.map(item => item.target), [{ kind: "user", id: "manager" }]);
  assert.deepEqual((await options("user", "Private owner")).items.map(item => item.target.id), ["owner"]);
  assert.equal((await options("company", "does not exist")).items.length, 0);
  assert.equal((await options("company", "' OR 1=1--")).items.length, 0, "Search is a bound literal");
  await pool.query("INSERT INTO pg_temp.users(id,first_name,email) SELECT 'picker-' || lpad(n::text,3,'0'), 'Picker ' || lpad(n::text,3,'0'), 'picker' || n || '@example.test' FROM generate_series(1,25) AS n");
  const firstOptions = await options("user", "Picker"), secondOptions = await options("user", "Picker", 2);
  assert.equal(firstOptions.items.length, 20); assert.equal(firstOptions.hasMore, true);
  assert.equal(secondOptions.items.length, 5); assert.equal(secondOptions.hasMore, false);
  assert.equal(new Set([...firstOptions.items, ...secondOptions.items].map(item => item.target.id)).size, 25);
  assert.deepEqual((await options("user", "Picker 025")).items.map(item => item.name), ["Picker 025"], "Search applies before pagination");
  await pool.query("INSERT INTO pg_temp.users(id,first_name) VALUES('literal-percent','100% provider')");
  assert.deepEqual((await options("user", "%")).items.map(item => item.target.id), ["literal-percent"], "Percent searches literally instead of matching the whole directory");
  await pool.query(`INSERT INTO pg_temp.services(id,provider_id,company_id,name,category,service_type,price,duration,is_active) VALUES
    (1,'owner',7,'Massage','health_wellness','one_to_one',30,45,true),
    (2,'manager',7,'Yoga','health_wellness','group',15,60,true),
    (3,'owner',7,'Draft service','health_wellness','one_to_one',20,30,false),
    (4,'owner',null,'Personal lesson','education','one_to_one',10,30,true),
    (5,'other',8,'Other company service','education','one_to_one',10,30,true)`);
  const company = { kind: "company", id: 7 }, personal = { kind: "user", id: "owner" }, other = { kind: "company", id: 8 };
  const image = "/objects/owner/11111111-1111-4111-8111-111111111111.png";
  const draft = { slug: "riga-studio", name: "Riga studio", description: "Wellness in Riga", logoUrl: image, coverUrl: null, isPublished: false };
  assert.equal((await storefrontStore.settings(company)).hasPro, false);
  await assert.rejects(storefrontStore.save(company, draft), error => error.status === 403);
  const grant = async target => storefrontStore.adminUpdate({ target, plan: "pro", proUntil: new Date(Date.now() + 86400_000).toISOString() }, "support");
  await grant(company);
  assert.deepEqual(await loadDirectorySubscriptions([], []), new Map());
  const directoryPlans = await loadDirectorySubscriptions(["owner"], [7]);
  assert.equal(directoryPlans.get("company:7").enabled, true);
  assert.equal(directoryPlans.has("user:owner"), false, "A company plan is separate from the owner's personal plan");
  assert.deepEqual(Object.keys(directoryPlans.get("company:7")).sort(), ["enabled", "proUntil"], "Directory summaries exclude subscription administration metadata");
  assert.deepEqual(await loadDirectorySubscriptions(["other"], []), new Map(), "Directory subscription reads are limited to requested users and companies");
  assert.equal((await storefrontStore.settings(company)).hasPro, true);
  assert.equal((await storefrontStore.settings(personal)).hasPro, false, "A company plan never grants personal Pro");
  const saved = await storefrontStore.save(company, draft);
  await assert.rejects(storefrontStore.publicPage(draft.slug), error => error.status === 404);
  assert.equal(await canReadImage(image), false, "Draft branding is private");
  const manager = await workspaceContext("manager", 7), viewer = await workspaceContext("viewer", 7);
  assert.equal(await canReadImage(image, "manager", manager), true);
  assert.equal(await canReadImage(image, "viewer", viewer), false);
  await storefrontStore.save(company, { ...draft, isPublished: true });
  assert.equal(await canReadImage(image), true);
  assert.deepEqual((await storefrontStore.publicPage(draft.slug)).source, { companyId: 7 });
  const catalog = await storage.searchServices({ companyId: 7 });
  assert.deepEqual(catalog.map(service => service.id).sort(), [1,2]);
  assert.ok(catalog.every(service => service.storefrontSlug === draft.slug && service.provider.firstName === null && service.provider.email === null));
  assert.equal((await storage.getServiceById(1)).storefrontSlug, draft.slug);
  assert.equal((await storage.getServiceById(4)).storefrontSlug, null);
  assert.equal((await storage.getServiceById(5)).storefrontSlug, null);
  await grant(other);
  await assert.rejects(storefrontStore.save(other, draft), error => (error.cause ?? error).code === "23505");
  await assert.rejects(storefrontStore.save(company, { ...draft, slug: "changed-address" }), error => error.status === 409);
  await pool.query("UPDATE pg_temp.provider_subscriptions SET pro_until=now() - interval '1 second' WHERE company_id=7");
  assert.equal((await storefrontStore.settings(company)).hasPro, false);
  assert.equal((await loadDirectorySubscriptions([], [7])).get("company:7").enabled, false, "Directory status respects expiry");
  await assert.rejects(storefrontStore.save(company, draft), error => error.status === 403);
  await assert.rejects(storefrontStore.publicPage(draft.slug), error => error.status === 404);
  assert.equal((await storage.getServiceById(1)).storefrontSlug, null);
  assert.equal(await canReadImage(image), false);
  assert.equal((await storefrontStore.settings(company)).storefront.id, saved.id, "Expiry preserves content");
  await grant(company);
  assert.equal((await storefrontStore.publicPage(draft.slug)).name, draft.name, "Renewal restores published content");
  await storefrontStore.adminUpdate({ target: company, plan: "free", proUntil: null }, "support");
  assert.deepEqual((await loadDirectorySubscriptions([], [7])).get("company:7"), { enabled: false, proUntil: null }, "Directory status respects revocation");
  await assert.rejects(storefrontStore.publicPage(draft.slug), error => error.status === 404);
  await grant(company);
  await pool.query("UPDATE pg_temp.companies SET is_active=false WHERE id=7");
  assert.equal((await options("company", "Riga")).items[0].isActive, false, "Closed company results are identified");
  await assert.rejects(storefrontStore.publicPage(draft.slug), error => error.status === 404);
  assert.equal(await canReadImage(image), false);
  await pool.query("UPDATE pg_temp.companies SET is_active=true,owner_id='manager' WHERE id=7");
  assert.equal((await storefrontStore.publicPage(draft.slug)).name, draft.name, "Ownership changes retain company subscription");
  await grant(personal);
  assert.equal((await loadDirectorySubscriptions(["owner"], [])).get("user:owner").enabled, true);
  await storefrontStore.save(personal, { ...draft, slug: "personal-provider", name: "Personal provider", logoUrl: null, isPublished: true });
  assert.deepEqual((await storefrontStore.publicPage("personal-provider")).source, { providerId: "owner" });
  assert.deepEqual((await storage.searchServices({ providerId: "owner" })).map(service => service.id), [4]);
  await setupStorefrontFixtures(pool.query.bind(pool));
  assert.equal((await storefrontStore.settings(company)).storefront.name, draft.name, "Migration reruns preserve edits and Pro access");
  await assert.rejects(pool.query("INSERT INTO pg_temp.provider_subscriptions(user_id,company_id,updated_by) VALUES('other',8,'support')"), error => error.code === "23514");
  await assert.rejects(pool.query("INSERT INTO pg_temp.provider_subscriptions(updated_by) VALUES('support')"), error => error.code === "23514");
  await assert.rejects(pool.query("UPDATE pg_temp.provider_subscriptions SET plan='unknown' WHERE company_id=7"), error => error.code === "23514");
  await assert.rejects(pool.query("UPDATE pg_temp.provider_subscriptions SET pro_until=null WHERE company_id=7"), error => error.code === "23514");
  console.log("Passed: migration/idempotency, RLS/browser grants, real catalog scoping, Pro enforcement/expiry/renewal/revocation, slug conflicts, draft and expired branding, manager/viewer access, closed companies, ownership transfer, individual/company separation, and database constraints. Public data unchanged.");
} finally { release?.(); await pool.end(); }
