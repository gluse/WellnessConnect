import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";

const languages = ["en", "lv", "ru"], engine = process.env.FORMS_BROWSER || "chrome";
const resources = Object.fromEntries(await Promise.all(languages.map(async lang => [lang, { translation: JSON.parse(await readFile(`client/public/locales/${lang}/translation.json`, "utf8")) }])));
const fixture = await browserFixture({ entry: "scripts/fixtures/mobile-navigation.tsx", resources });
const { visit, until, evaluate, viewport } = fixture;
const paths = ["/my-services", "/my-services/", "/my-services/appointments", "/my-services/upcoming-appointments", "/my-services/past-appointments", "/my-services/services", "/my-services/services/new", "/my-services/services/7/edit", "/my-services/availability", "/my-services/reports", "/my-services/settings", "/my-services/settings/pricing", "/my-services/settings/addresses", "/my-services/unknown/nested"];
const checks = [], cases = [];
let sequence = 0;
const open = async (path, query = "") => { await visit(`${path}?case=${++sequence}&${query}`); };
const rolePage = () => until(() => location.pathname === "/account" && location.hash === "#role" && document.getElementById("account-role")?.getClientRects().length, "non-provider redirected to Role tab");
const providerVisible = () => evaluate(() => !!document.querySelector('[data-appointment-area="provider"]'));
const featureReads = () => evaluate(() => window.phase2Fixture.reads.filter(path => /^\/api\/(bookings\/provider|services\/provider|services\/\d+|provider\/employees|availability\/provider|workspace\/pricing-settings|addresses|reports)(?:\?|$|\/)/.test(path)));
try {
  for (const lang of languages) for (const path of paths) {
    await viewport(lang === "lv" ? 1280 : 320, 900); await open(path, `role=seeker&lang=${lang}`); await rolePage();
    assert.equal(await providerVisible(), false); assert.deepEqual(await featureReads(), [], "denied routes do not mount or fetch provider features");
    assert.deepEqual(await evaluate(() => window.phase2Fixture.writes), []);
    assert.deepEqual(await evaluate(() => window.phase2Fixture.unexpected), []);
    cases.push({ lang, path, outcome: "account-role" });
  }
  checks.push("en/lv/ru: every My Services entry and descendant redirects non-providers before mounting or fetching provider features");
  for (const role of ["", "unknown", "PROVIDER"]) { await open("/my-services/appointments", `role=${role}`); await rolePage(); assert.deepEqual(await featureReads(), []); }
  await open("/search", "role=provider"); await until(() => !!document.querySelector("main"));
  await evaluate(() => { window.phase2Fixture.setRole(null); history.pushState(null, "", "/my-services/appointments"); });
  await rolePage(); assert.deepEqual(await featureReads(), []);
  checks.push("empty, missing, unknown and case-mismatched roles fail closed");

  for (const path of ["/my-services", "/my-services/appointments", "/my-services/settings/addresses"]) {
    await open(path, "guest=1"); await until(() => location.pathname === "/login");
    assert.equal(await evaluate(() => new URLSearchParams(location.search).get("returnTo")), path);
    assert.deepEqual(await featureReads(), []);
  }
  checks.push("signed-out deep links preserve the existing login return destination");

  await open("/my-services/appointments", "role=provider&auth=pending");
  await until(() => !!window.phase2Fixture.releaseAuth, "authentication pending");
  assert.equal(await providerVisible(), false); assert.deepEqual(await featureReads(), []);
  assert.equal(await evaluate(() => location.pathname), "/my-services/appointments");
  await evaluate(() => { window.phase2Fixture.authResult = "success"; window.phase2Fixture.releaseAuth(); });
  await until(() => !!document.querySelector('[data-testid="appointment-calendar"]'), "provider is admitted after authentication");
  await evaluate(() => window.phase2Fixture.setRole("seeker")); await rolePage();
  assert.equal(await providerVisible(), false);
  checks.push("authentication loading cannot flash provider content; successful provider resolution opens it and live role loss removes it");

  await open("/my-services/appointments", "role=provider&auth=pending");
  await until(() => !!window.phase2Fixture.releaseAuth);
  await evaluate(() => { window.phase2Fixture.setRole("seeker"); window.phase2Fixture.authResult = "success"; window.phase2Fixture.releaseAuth(); });
  await rolePage(); assert.deepEqual(await featureReads(), []);
  await open("/my-services/appointments", "role=provider&auth=error"); await until(() => location.pathname === "/login");
  assert.deepEqual(await featureReads(), []);
  await open("/my-services/appointments", "role=provider"); await until(() => !!document.querySelector('[data-testid="appointment-calendar"]'));
  await evaluate(() => { void window.phase2Fixture.failAuth(); }); await until(() => location.pathname === "/login");
  assert.equal(await providerVisible(), false);
  checks.push("resolved non-provider, auth failures and failed revalidation of a cached provider all deny the route");

  for (const lang of languages) {
    await open("/my-services/appointments", `role=provider&lang=${lang}`); await until(() => !!document.querySelector('[data-testid="appointment-calendar"]'));
    await evaluate(() => window.phase2Fixture.signOut()); await until(() => location.pathname === "/login");
    assert.equal(await providerVisible(), false);
  }
  checks.push("en/lv/ru provider access remains functional and logout redirects away from mounted provider content");
  assert.deepEqual(await evaluate(() => window.phase2Fixture.unexpected), []);
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []);
  await writeFile(`docs/provider-route-guard-${engine}-evidence.json`, JSON.stringify({ date: "2026-11-08", browser: await fixture.api("Browser.getVersion"), languages, checks, cases,
    deferred: ["ar/RTL", "zh", "fr", "de", "hi", "ja", "pt", "es"], limits: "Actual App using synthetic in-memory fetch mocks; no live auth/session/database/service operations. Frontend route guard; server endpoint authorization is unchanged." }, null, 2) + "\n");
  console.log(`PASS: ${engine} provider route guard, ${checks.length} behavior groups and ${cases.length} en/lv/ru denied-route cases.`);
} finally { await fixture.close(); }
