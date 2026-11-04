import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { browserFixture, measureFormContrast } from "./fixtures/browser-harness.mjs";
import { languages, deferredLanguages, evidencePrefix } from "./fixtures/forms-verification-scope.mjs";
const verificationDate = "2026-10-28";
const root = path.resolve(import.meta.dirname, ".."), resources = {}, prefix = evidencePrefix("phase3") + "-team-redesign";
for (const language of languages) resources[language] = { translation: JSON.parse(await readFile(path.join(root, "client/public/locales", language, "translation.json"), "utf8")) };
const messages = resources.en.translation.operationsForm, keys = Object.keys(messages);
for (const language of languages) {
  const translated = resources[language].translation.operationsForm;
  assert.deepEqual(Object.keys(translated).sort(), [...keys].sort());
  for (const key of keys) { assert.ok(typeof translated[key] === "string" && translated[key].trim(), language + ":" + key); assert.deepEqual(translated[key].match(/{{\w+}}/g)?.sort(), messages[key].match(/{{\w+}}/g)?.sort(), language + ":" + key); }
}
for (const file of ["availability-editor.tsx", "company-team.tsx", "admin-categories.tsx", "admin-user-filters.tsx", "admin-subscriptions.tsx", "provider/storefront-editor.tsx"]) {
  const source = await readFile(path.join(root, "client/src/components", file), "utf8");
  for (const [, key] of source.matchAll(/operationsForm\.(\w+)/g)) if (key !== "role_") assert.ok(messages[key], "Missing message: " + key);
}
const fixture = await browserFixture({ entry: "scripts/fixtures/forms-phase3.tsx", resources });
const { api, evaluate, until, settle, click, button, set, visit, viewport, key, screenshot } = fixture;
const checks = [], matrix = [], contrast = [], screenshots = [];
const config = options => evaluate(options => { Object.assign(window.phase3Fixture, options); }, options);
const writes = () => evaluate(() => window.phase3Fixture.writes);
const value = id => evaluate(id => document.getElementById(id)?.value, id);
const status = () => until(() => [...document.querySelectorAll('[role="status"]')].some(node => node.textContent === "Changes saved."), "saved feedback");
async function open(mode, extra = "") {
  await visit("/?mode=" + mode + extra);
  if (extra.includes("denied") && mode !== "team") await until(() => !!document.querySelector('[role="alert"]'), "denied form"); else await until(() => !!document.querySelector('.phase3-form'), "operational form");
  if (mode === "team" && !extra.includes("denied")) {
    await until(() => !!document.getElementById("team-roster") || !!document.querySelector('[role="alert"]'), "team ready");
    if (!extra.includes("loadError")) { await click("#team-invite"); await settle(); }
  }
  if (mode === "categories") await until(() => !!document.getElementById("category-key"), "categories ready");
}
async function timeIds() { await evaluate(() => { document.querySelectorAll('[data-time-input]').forEach((input, index) => { input.id = "fixture-time-" + index; }); }); }
async function reflow() { assert.ok(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "page reflow"); }
async function capture(name) { const file = "docs/" + prefix + "-" + name + ".png"; await screenshot(file); screenshots.push(file); }
try {
  await viewport(1280);
  await open("availability"); await timeIds();
  await set("fixture-time-0", "18:00"); await button(messages.saveWeek);
  await until(() => !!document.querySelector('[aria-invalid="true"]'), "range validation"); assert.equal((await writes()).length, 0);
  assert.ok(await evaluate(() => document.activeElement?.getAttribute("role") === "alert"), "validation focus");
  await set("fixture-time-0", "08:00"); await set("availability-timezone", "invalid/zone"); await button(messages.saveWeek);
  assert.equal((await writes()).length, 0); assert.ok(await evaluate(() => document.getElementById("availability-timezone").getAttribute("aria-describedby") === "availability-zone-error"));
  await set("availability-timezone", "UTC"); await set("availability-exception-date", "2030-02-01");
  await evaluate(() => window.phase3Fixture.refresh()); assert.equal(await value("fixture-time-0"), "08:00"); assert.equal(await value("availability-exception-date"), "2030-02-01");
  await set("availability-service", "7"); await until(() => !!document.querySelector('[role="alertdialog"]'), "scope discard dialog");
  assert.equal(await value("availability-service"), "all"); await button(messages.keepEditing); await until(() => !document.querySelector('[role="alertdialog"]'), "keep editing");
  assert.equal(await value("fixture-time-0"), "08:00"); assert.equal(await value("availability-exception-date"), "2030-02-01");
  await config({ result: "error" }); await button(messages.saveWeek); await until(() => document.body.innerText.includes("Unable to save this change."), "weekly failure");
  assert.equal(await value("fixture-time-0"), "08:00"); assert.equal(await value("availability-exception-date"), "2030-02-01");
  await config({ result: "pending" }); await button(messages.saveWeek); await until(() => !!window.phase3Fixture.resolve, "pending weekly");
  const before = (await writes()).length; await evaluate(() => { [...document.querySelectorAll("button")].find(node => node.textContent === "Saving…")?.click(); }); assert.equal((await writes()).length, before);
  assert.ok(await evaluate(() => document.getElementById("availability-service").matches(":disabled"))); await config({ result: "success" }); await evaluate(() => window.phase3Fixture.resolve()); await status();
  assert.equal(await value("availability-exception-date"), "2030-02-01", "weekly save preserves independent exception draft");
  const weekly = (await writes()).findLast(write => write.path === "/api/availability/weekly"); assert.equal(weekly.body.days.length, 7); assert.deepEqual(weekly.body.days[1], { day: 1, intervals: [{ startTime: "08:00", endTime: "17:00" }] });
  checks.push("availability linked range/timezone validation, refresh retention, scope keep, rejected save retention, pending duplicate protection and independent weekly payload");
  await button(messages.saveException); await until(() => document.getElementById("availability-exception-date").value === "", "exception saved");
  assert.deepEqual((await writes()).at(-1).body, { serviceId: null, timezone: "UTC", date: "2030-02-01", intervals: [] });
  await set("availability-service", "7"); await timeIds(); assert.equal(await value("fixture-time-0"), "10:00");
  await set("fixture-time-0", "11:00"); await set("availability-service", "8"); await button(messages.discard); await until(() => !document.querySelector('[role="alertdialog"]'), "scope discarded"); await timeIds();
  assert.equal(await value("availability-service"), "8"); assert.equal(await value("fixture-time-0"), "08:00");
  await set("availability-service", "7"); await button(messages.useGeneral); await status(); await timeIds(); assert.equal(await value("fixture-time-0"), "08:00"); assert.equal((await writes()).at(-1).body.inherit, true);
  checks.push("availability exception save and scope discard/inherited week preserve API semantics");

  await open("team"); assert.ok(await evaluate(() => [...document.querySelectorAll("button")].find(node => node.textContent === "Create invitation").disabled));
  await set("team-email", "new@example.test"); await set("team-employee", "11"); await config({ result: "error" }); await button(messages.createInvitation);
  await until(() => document.body.innerText.includes("Unable to save this change."), "invitation failed"); assert.equal(await value("team-email"), "new@example.test"); assert.ok(!await evaluate(() => !!document.querySelector("img")));
  await config({ result: "pending" }); await button(messages.createInvitation); await until(() => !!window.phase3Fixture.resolve, "invite pending"); const invited = (await writes()).length;
  await evaluate(() => document.querySelector("form").requestSubmit()); assert.equal((await writes()).length, invited); await config({ result: "success" }); await evaluate(() => window.phase3Fixture.resolve()); await until(() => !!document.getElementById("invitation-link"), "invitation link");
  assert.deepEqual((await writes()).at(-1).body, { email: "new@example.test", role: "provider", employeeId: 11, sendEmail: true });
  assert.ok(!await evaluate(() => !!document.getElementById("team-email")), "success replaces invite form with link receipt");
  await button(resources.en.translation.teamManagement.done); await settle(); await click("#edit-member-member"); await settle();
  await set("member-role-member", "admin"); await config({ result: "error" }); await button(messages.saveAccess); await until(() => !!document.querySelector('[role="dialog"] [role="alert"]'), "member operation error"); assert.equal(await value("member-role-member"), "admin");
  await config({ result: "success" }); await button(messages.saveAccess); await until(() => !document.querySelector('[role="dialog"][data-state="open"]'), "member saved"); await settle();
  assert.ok(await evaluate(() => document.getElementById("team-row-member-member").textContent.includes("Administrator")));
  await click("summary"); await set("team-new-owner", "member"); await button(messages.transfer); await status(); assert.deepEqual((await writes()).at(-1).body, { userId: "member" }); assert.ok(await evaluate(() => window.phase3Fixture.confirmations.at(-1).includes("member@example.test")));
  await click("#edit-member-member"); await settle();
  await config({ confirm: false }); const count = (await writes()).length; await button(messages.removeAccess); assert.equal((await writes()).length, count);
  await config({ confirm: true }); await button(messages.removeAccess); await until(() => !document.getElementById("team-row-member-member"), "member removed"); await settle(); assert.ok(await evaluate(() => document.body.innerText.includes("Changes saved.")));
  await button(messages.closeCompany); await status(); assert.equal((await writes()).at(-1).path, "/api/company/active"); assert.deepEqual((await writes()).at(-1).body, { isActive: false });
  checks.push("team employee explanation, invitation error/pending/success, exact payload, member field retention, named removal cancellation, owner controls and durable removed-member receipt");
  await open("team", "&denied=1&viewer=1"); assert.ok(!await evaluate(() => !!document.querySelector("form"))); assert.deepEqual(await writes(), []);
  checks.push("team permission-denied view excludes management and owner operations");
  await open("availability", "&denied=1"); assert.equal((await writes()).length, 0); assert.ok(!await evaluate(() => !!document.getElementById("availability-service")));
  await visit("/?mode=availability&loadError=1"); await until(() => !!document.querySelector('[role="alert"]'), "availability load error"); assert.ok(!await evaluate(() => !!document.getElementById("availability-service")));
  await open("team", "&loadError=1"); assert.ok(await evaluate(() => document.body.innerText.includes("Unable to load the team.")));
  checks.push("availability denied/load error and team load error do not expose a schedule editor or stale member list");

  await open("filters"); await set("admin-user-search", " Synthetic "); assert.equal(await evaluate(() => window.phase3Fixture.applied.length), 0);
  assert.equal(await evaluate(() => document.querySelector("details").open), false); await click("summary"); await set("admin-registered-from", "2030-02-01"); await set("admin-registered-to", "2030-01-01"); await button(messages.apply);
  await until(() => !!document.querySelector('[role="alert"]'), "filter validation"); assert.equal(await evaluate(() => window.phase3Fixture.applied.length), 0); assert.equal(await evaluate(() => document.activeElement?.id), "admin-filter-error");
  await set("admin-registered-to", "2030-03-01"); await button(messages.apply); assert.equal(await evaluate(() => window.phase3Fixture.applied.at(-1).search), "Synthetic");
  await button(messages.clear); assert.equal(await value("admin-user-search"), ""); assert.equal(await evaluate(() => window.phase3Fixture.applied.at(-1).timezone), "UTC");
  checks.push("admin filters edit without querying, advanced group, linked/focused date-order validation, explicit Apply/Clear and timezone retention");

  await open("categories"); await button(messages.addCategory); await until(() => !!document.querySelector('[role="alert"]'), "category field validation"); assert.equal((await writes()).length, 0);
  assert.equal(await evaluate(() => document.getElementById("category-name").getAttribute("aria-describedby")), "category-error");
  await set("category-key", "all"); await set("category-name", "Synthetic new"); await button(messages.addCategory); assert.equal((await writes()).length, 0);
  await set("category-key", "new_category"); await config({ result: "error" }); await button(messages.addCategory); await until(() => document.body.innerText.includes("Unable to save this change."), "category failed"); assert.equal(await value("category-name"), "Synthetic new");
  await config({ result: "pending" }); await button(messages.addCategory); await until(() => !!window.phase3Fixture.resolve, "category pending"); const cats = (await writes()).length; await evaluate(() => document.querySelector("form").requestSubmit()); assert.equal((await writes()).length, cats); await config({ result: "success" }); await evaluate(() => window.phase3Fixture.resolve()); await status();
  await button(messages.edit); assert.ok(await evaluate(() => document.getElementById("category-key").disabled));
  await button(messages.delete); const unchanged = (await writes()).length; await button(messages.keepCategory); assert.equal((await writes()).length, unchanged);
  await button(messages.delete); await config({ result: "conflict" }); await button(messages.confirmDelete); await until(() => document.body.innerText.includes("This key is unavailable"), "category conflict"); await config({ result: "success" }); await button(messages.confirmDelete); await status();
  checks.push("category local validation/reserved key, linked focus, rejected/pending retention, immutable edit key, named separate deletion confirmation and safe conflict feedback");

  await open("storefront"); await until(() => !!document.getElementById("storefront-slug"), "storefront form"); await button(resources.en.translation.storefront.save); await until(() => !!document.getElementById("storefront-error"), "storefront validation"); assert.equal((await writes()).length, 0); assert.equal(await evaluate(() => document.activeElement?.id), "storefront-error");
  await set("storefront-slug", "synthetic-store"); await set("storefront-name", "Synthetic public store"); await set("storefront-description", "Synthetic retained description"); await button(resources.en.translation.storefront.preview); await until(() => document.body.innerText.includes("Preview of your current changes."), "preview"); assert.equal((await writes()).length, 0);
  await button(resources.en.translation.storefront.closePreview); await config({ result: "conflict" }); await button(resources.en.translation.storefront.save); await until(() => !!document.getElementById("storefront-error"), "storefront conflict"); assert.equal(await value("storefront-description"), "Synthetic retained description");
  await config({ result: "pending" }); await click('input[type="checkbox"]'); await button(resources.en.translation.storefront.save); await until(() => !!window.phase3Fixture.resolve, "storefront pending"); const stores = (await writes()).length; await evaluate(() => document.querySelector("form").requestSubmit()); assert.equal((await writes()).length, stores); await config({ result: "success" }); await evaluate(() => window.phase3Fixture.resolve()); await until(() => document.body.innerText.includes("Storefront saved."), "storefront saved");
  assert.deepEqual((await writes()).at(-1).body, { slug: "synthetic-store", name: "Synthetic public store", description: "Synthetic retained description", logoUrl: null, coverUrl: null, isPublished: true }); assert.ok(await evaluate(() => document.getElementById("storefront-slug").disabled));
  await open("storefront", "&noPro=1"); assert.ok(!await evaluate(() => !!document.querySelector("form"))); await open("storefront", "&denied=1"); assert.ok(!await evaluate(() => !!document.querySelector("form")));
  checks.push("storefront linked validation, explicit preview without saving, conflict retention, duplicate protection, publication payload, immutable slug, Pro and permissions");

  await open("subscriptions"); await set("subscription-kind", "company"); await click("#subscription-target"); await until(() => !!document.querySelector('[role="option"]'), "subscription options"); await key("ArrowDown"); await key("Enter"); await button(resources.en.translation.storefront.loadSubscription); await until(() => !!document.getElementById("subscription-until"), "subscription loaded");
  await set("subscription-until", "2000-01-01"); await set("subscription-until-time", "12:00"); await button(resources.en.translation.storefront.saveSubscription); assert.equal((await writes()).length, 0); assert.equal(await evaluate(() => document.activeElement?.id), "subscription-until");
  await set("subscription-plan", "free"); await config({ result: "pending" }); await button(resources.en.translation.storefront.saveSubscription); await until(() => !!window.phase3Fixture.resolve, "subscription pending"); const subs = (await writes()).length; await evaluate(() => document.querySelectorAll("form")[1].requestSubmit()); assert.equal((await writes()).length, subs); await config({ result: "success" }); await evaluate(() => window.phase3Fixture.resolve()); await until(() => document.body.innerText.includes("Subscription updated."), "subscription saved");
  assert.deepEqual((await writes()).at(-1).body, { target: { kind: "company", id: 7 }, plan: "free", proUntil: null }); await set("subscription-kind", "user"); assert.ok(!await evaluate(() => !!document.getElementById("subscription-plan")));
  checks.push("subscription keyboard target selection, focused future-expiry validation, free-plan exact payload, pending duplicate guard and target switch clears editor");

  for (const mode of ["availability", "team", "filters", "categories", "storefront", "subscriptions"]) {
    await open(mode); if (mode === "storefront") await until(() => !!document.getElementById("storefront-name"), "storefront ready");
    const id = { availability: "availability-timezone", team: "team-email", filters: "admin-user-search", categories: "category-name", storefront: "storefront-name", subscriptions: "subscription-target" }[mode];
    const retained = mode === "availability" ? "Europe/Riga" : "Synthetic retained"; await set(id, retained);
    for (const language of languages) {
      await set("fixture-language", language); assert.equal(await value(id), retained, "locale change retains draft");
      assert.equal(await evaluate(() => document.documentElement.dir), "ltr");
      assert.equal(await evaluate(() => document.documentElement.lang), language);
      assert.ok(!await evaluate(() => document.body.innerText.includes("operationsForm.")), "no unresolved keys");
      for (const width of [320, 390, 639, 640, 641, 768, 1280]) { await viewport(width); await reflow(); matrix.push({ mode, language, width }); }
    }
    await set("fixture-language", "en"); await viewport(1280); await evaluate(() => document.activeElement?.blur());
    contrast.push({ mode, theme: "light", ...await measureFormContrast(fixture, ".phase3-form") }); assert.deepEqual(contrast.at(-1).failures, [], mode + " light contrast");
    if (mode === "availability") await capture("availability-desktop");
    if (mode === "team") { await button(resources.en.translation.teamManagement.cancel); await settle(); }
    await click("#fixture-theme");
    if (mode === "team") { await click("#team-invite"); await settle(); }
    contrast.push({ mode, theme: "dark", ...await measureFormContrast(fixture, ".phase3-form") }); assert.deepEqual(contrast.at(-1).failures, [], mode + " dark contrast");
    if (mode === "team") { await set("fixture-language", "ru"); await viewport(390); await capture("team-russian-dark"); }
  }
  checks.push("126 en/lv/ru locale/viewport combinations across six forms, dictionaries/placeholders, draft retention, document language/direction, light/dark text and control contrast");
  await open("availability"); await viewport(320); await evaluate(() => { document.documentElement.style.fontSize = "200%"; }); await reflow(); assert.ok(await evaluate(() => [...document.querySelectorAll('[data-time-input]')].every(input => input.clientWidth >= 160)), "time entry remains readable at 200% text"); await evaluate(() => document.getElementById("weekly-heading").scrollIntoView()); await screenshot("docs/" + prefix + "-availability-text200.png", false); screenshots.push("docs/" + prefix + "-availability-text200.png"); await evaluate(() => { document.documentElement.style.fontSize = ""; });
  await api("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await set("availability-timezone", "Europe/Riga"); await set("availability-service", "7"); await until(() => !!document.querySelector('[role="alertdialog"]'), "reduced motion confirmation"); await reflow(); assert.ok(await evaluate(() => document.querySelector('[role="alertdialog"]').contains(document.activeElement))); await key("Tab"); assert.ok(await evaluate(() => document.querySelector('[role="alertdialog"]').contains(document.activeElement))); await key("Escape"); await until(() => !document.querySelector('[role="alertdialog"]'), "dialog escape"); assert.equal(await evaluate(() => document.activeElement?.id), "availability-service", "scope dialog restores focus");
  checks.push("320px 200% text reflow, reduced-motion confirmation, keyboard focus containment and Escape");
  assert.deepEqual(await evaluate(() => window.phase3Fixture.unexpected), []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []); assert.deepEqual(fixture.errors, []);
  const evidence = { date: verificationDate, browser: await api("Browser.getVersion"), languages, deferredLanguages, messageCount: keys.length, checks, matrix, contrast, screenshots, unexpectedNetwork: fixture.network, blockedNetwork: fixture.blocked, runtimeErrors: fixture.errors, limits: "No connected app, database, services or deployment. Physical devices, screen readers, native-language review and actual 400% browser zoom are outside this runner. 320px tests equivalent reflow only." };
  await writeFile(path.join(root, "docs/" + prefix + "-evidence.json"), JSON.stringify(evidence, null, 2) + "\n");
  console.log(`Passed: ${checks.length} Phase 3 browser groups, ${matrix.length} locale/viewport combinations, ${keys.length} messages in en/lv/ru; no unexpected requests or runtime errors.`);
} finally { await fixture.close(); }
