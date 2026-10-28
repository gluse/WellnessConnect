import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { browserFixture, measureFormContrast } from "./fixtures/browser-harness.mjs";

const root = path.resolve(import.meta.dirname, ".."), resources = {};
const languages = ["en", "lv", "ru"];
for (const language of languages) resources[language] = { translation: JSON.parse(await readFile(path.join(root, "client/public/locales", language, "translation.json"), "utf8")) };
for (const language of languages) {
  const copy = resources[language].translation.teamManagement, original = resources.en.translation.teamManagement;
  assert.deepEqual(Object.keys(copy), Object.keys(original));
  for (const key of Object.keys(original)) { assert.ok(copy[key].trim()); assert.deepEqual(copy[key].match(/{{\w+}}/g), original[key].match(/{{\w+}}/g)); }
}
const fixture = await browserFixture({ entry: "scripts/fixtures/team-member-update.tsx", resources });
const { evaluate, until, visit, set, button, viewport, key, screenshot, click, settle } = fixture;
const calls = () => evaluate(() => window.teamUpdateFixture.calls);
const writes = async () => (await calls()).filter(call => call.method !== "GET");
const value = id => evaluate(id => document.getElementById(id)?.value, id);
const configure = options => evaluate(options => Object.assign(window.teamUpdateFixture, options), options);
const closed = async () => { await until(() => !document.querySelector('[role="dialog"][data-state="open"]'), "panel closes"); await settle(); };
const ready = async (language = "en", scenario = "") => {
  await visit(`/?lang=${language}${scenario ? "&" + scenario : ""}`);
  await until(() => !!document.getElementById("team-roster"), "roster fetched");
};
const member = async () => { await click("#edit-member-member"); await until(() => !!document.getElementById("member-role-member"), "member panel"); await settle(); };
const invitation = async (id = "santa-invite") => {
  await click(`#edit-invitation-${id}`);
  await until(() => !!document.querySelector('[role="dialog"][data-state="open"] select'), "invitation panel");
  await settle();
};
const invite = async () => { await click("#team-invite"); await until(() => !!document.getElementById("team-email"), "invite panel"); await settle(); };
const rows = () => evaluate(() => [...document.querySelectorAll("#team-roster > li")].map(row => row.textContent));
const options = id => evaluate(id => [...document.getElementById(id).options].map(option => option.value), id);
const checks = [], layouts = [], contrasts = [];
const browser = await fixture.api("Browser.getVersion");
const engine = process.env.FORMS_BROWSER || "chrome";
const prefix = `docs/team-management-${engine}`;

try {
  for (const language of languages) {
    const m = resources[language].translation.operationsForm, ui = resources[language].translation.teamManagement;
    await viewport(1280); await ready(language);
    assert.equal((await rows()).length, 2);
    assert.ok(!await evaluate(() => !!document.querySelector("#team-roster select")), "roster is a summary, not a stack of forms");
    assert.ok(!await evaluate(() => !!document.getElementById("edit-member-owner")), "owner protected");
    await member();
    assert.equal(await evaluate(() => document.activeElement.id), "member-role-member");
    await set("member-role-member", "viewer"); await set("member-employee-member", "11");
    assert.ok(await evaluate(() => !!document.getElementById("reassignment-member")), "reassignment warning");
    await configure({ holdGet: true }); await button(m.saveReassignment);
    await until(() => !!window.teamUpdateFixture.resolveGet, "PATCH then GET");
    assert.ok(await evaluate(() => document.getElementById("member-role-member").disabled));
    await key("Escape");
    assert.ok(await evaluate(() => !!document.querySelector('[role="dialog"][data-state="open"]')), "cannot dismiss pending save");
    await evaluate(() => { document.getElementById("save-member-member").click(); document.querySelector('[role="dialog"] form').requestSubmit(); });
    assert.deepEqual((await calls()).map(({ method, path }) => `${method} ${path}`), ["GET /api/company/team", "PATCH /api/company/members/member", "GET /api/company/team"]);
    assert.deepEqual((await writes())[0].body, { role: "viewer", employeeId: 11 });
    await evaluate(() => window.teamUpdateFixture.resolveGet()); await closed(); await member();
    assert.equal(await value("member-role-member"), "viewer"); assert.equal(await value("member-employee-member"), "11");
    await configure({ holdGet: false }); await set("member-role-member", "provider"); await set("member-employee-member", "12");
    await button(m.saveReassignment); await closed(); await member();
    assert.equal(await value("member-employee-member"), "12");
    assert.deepEqual((await writes()).map(call => call.path), ["/api/company/members/member", "/api/company/members/member"]);
    assert.equal((await rows()).length, 2, "same login reassigned, no new member");

    await configure({ holdGet: true, resolveGet: null }); await set("member-role-member", "admin"); await set("member-employee-member", "11");
    await button(m.saveReassignment); await until(() => !!window.teamUpdateFixture.resolveGet, "authoritative GET held");
    await evaluate(() => { window.teamUpdateFixture.setServerMember("viewer", 13); window.teamUpdateFixture.resolveGet(); });
    await closed(); await member();
    assert.equal(await value("member-role-member"), "viewer"); assert.equal(await value("member-employee-member"), "13", "GET wins over submitted draft");
    await button(ui.cancel); await closed(); await evaluate(() => window.teamUpdateFixture.remount());
    await until(() => !!document.getElementById("edit-member-member"), "remount"); await member();
    assert.equal(await value("member-role-member"), "viewer"); assert.equal(await value("member-employee-member"), "13");
    await configure({ result: "forbidden", holdGet: false }); await set("member-role-member", "admin");
    const readsBefore = (await calls()).filter(call => call.method === "GET").length;
    await button(m.saveAccess); await until(() => !!document.querySelector('[role="dialog"] [role="alert"]'), "save error");
    assert.equal(await value("member-role-member"), "admin", "failed save retains draft");
    assert.equal((await calls()).filter(call => call.method === "GET").length, readsBefore);
    assert.equal(await evaluate(() => window.teamUpdateFixture.serverMember().role), "viewer");
    await configure({ confirm: false }); await key("Escape");
    assert.ok(await evaluate(() => !!document.querySelector('[role="dialog"][data-state="open"]')), "declined discard retains panel");
    await button(ui.cancel); await closed();
    await until(() => document.activeElement.id === "edit-member-member", "trigger regains focus after closing animation");
    assert.equal(await evaluate(() => document.activeElement.id), "edit-member-member", "restore focus to trigger");
    await member(); assert.equal(await value("member-role-member"), "viewer", "cancel discards draft");
    await button(ui.cancel); await closed();
    checks.push(`${language}: exact member PATCH→GET, pending lock, duplicate suppression, reassignment, authoritative refresh/remount, rejected draft, discard/cancel and focus restore`);
    console.log(`Passed member contract: ${language}`);
  }

  for (const language of languages) for (const width of [1280, 320]) {
    const m = resources[language].translation.operationsForm, ui = resources[language].translation.teamManagement;
    await viewport(width); await ready(language); const original = await evaluate(() => window.teamUpdateFixture.serverMember());
    await evaluate(() => document.getElementById("team-invite").focus()); await key("Enter");
    await until(() => !!document.getElementById("team-email"), "keyboard invite");
    await settle();
    assert.equal(await evaluate(() => document.activeElement.id), "team-email");
    await key("Tab"); assert.equal(await evaluate(() => document.activeElement.id), "team-role");
    await key("Tab"); assert.equal(await evaluate(() => document.activeElement.id), "team-employee");
    assert.deepEqual(await options("team-employee"), ["none", "11", "12", "13"]);
    await set("team-email", "first@example.test"); await set("team-employee", "11");
    await configure({ result: "forbidden" }); await button(m.createInvitation);
    await until(() => !!document.querySelector('[role="dialog"] [role="alert"]'), "invitation failure");
    assert.equal(await value("team-email"), "first@example.test"); assert.equal(await value("team-employee"), "11");
    assert.equal((await rows()).length, 2);
    await configure({ result: "success", holdWrite: true, holdGet: true }); await button(m.createInvitation);
    await until(() => !!window.teamUpdateFixture.resolveWrite, "POST held");
    assert.ok(await evaluate(() => document.getElementById("team-email").disabled));
    const count = (await writes()).length;
    await evaluate(() => document.querySelector('[role="dialog"] form').requestSubmit());
    assert.equal((await writes()).length, count);
    await evaluate(() => window.teamUpdateFixture.resolveWrite());
    await until(() => !!window.teamUpdateFixture.resolveGet, "invitation GET held");
    assert.ok(await evaluate(() => document.getElementById("team-email").disabled));
    await evaluate(() => window.teamUpdateFixture.resolveGet());
    await until(() => !!document.getElementById("invitation-link"), "invitation receipt");
    assert.ok(await value("invitation-link")); assert.equal((await rows()).length, 3);
    await button(m.copyLink); await until(() => !!window.teamUpdateFixture.clipboard, "clipboard copied");
    assert.equal(await evaluate(() => window.teamUpdateFixture.clipboard), await value("invitation-link"));
    await configure({ copyFails: true }); await button(m.copyLink);
    await until(() => !!document.querySelector('[role="dialog"] [role="alert"]'), "clipboard failure shown");
    await configure({ copyFails: false, holdGet: false, holdWrite: false }); await button(ui.inviteAnother);
    await until(() => !!document.getElementById("team-email"), "another invitation");
    assert.equal(await value("team-email"), ""); assert.equal(await value("team-employee"), "none");
    assert.deepEqual(await options("team-employee"), ["none", "12", "13"]);
    await set("team-email", "second@example.test"); await set("team-employee", "12"); await button(m.createInvitation);
    await until(() => !!document.getElementById("invitation-link"), "second invitation receipt");
    await button(ui.done); await closed();
    const entries = await rows(); assert.equal(entries.length, 4);
    assert.equal(entries.filter(text => text.includes(m.pendingAcceptance)).length, 2);
    assert.ok(entries.find(text => text.includes("first@example.test")).includes("Synthetic employee 11"));
    assert.ok(entries.find(text => text.includes("second@example.test")).includes("Synthetic employee 12"));
    assert.deepEqual(await evaluate(() => window.teamUpdateFixture.serverMember()), original, "inviting never reassigns member");
    assert.equal((await writes()).filter(call => call.method === "PATCH").length, 0);
    assert.ok(await value("invitation-link"), "link remains after closing");
    await evaluate(() => document.getElementById("invitation-link").focus());
    assert.ok(await evaluate(() => document.getElementById("invitation-link").selectionEnd > 0));
    await invitation("invite-1"); await button(m.revoke); await closed();
    assert.ok(!(await rows()).some(text => text.includes("first@example.test")));
    await invite(); assert.ok((await options("team-employee")).includes("11"));
    await set("team-email", "admin@example.test"); await set("team-role", "admin");
    await click('[role="dialog"] input[type="checkbox"]'); await button(m.createInvitation);
    await until(() => !!document.getElementById("invitation-link"), "unassigned admin invited");
    assert.deepEqual((await writes()).at(-1).body, { email: "admin@example.test", role: "admin", employeeId: null, sendEmail: false });
    await button(ui.done); await closed();
    checks.push(`${language}/${width}: invite keyboard focus, validation/filtering, failure retention, POST/GET lock, two separate pending invitations, email choice, copy success/failure, retained link, revoke frees assignment, unassigned administrator`);
    console.log(`Passed invitations: ${language}/${width}`);
  }

  for (const language of languages) for (const width of [1280, 320]) {
    const m = resources[language].translation.operationsForm, ui = resources[language].translation.teamManagement;
    await viewport(width); await ready(language, "scenario=santa"); const before = await evaluate(() => window.teamUpdateFixture.serverTeam());
    await invitation(); assert.equal(await value("invitation-role-santa-invite"), "admin");
    assert.deepEqual(await options("invitation-employee-santa-invite"), ["none", "11", "13"]);
    await set("invitation-employee-santa-invite", "none"); await set("invitation-role-santa-invite", "provider");
    assert.ok(await evaluate(() => document.getElementById("save-invitation-santa-invite").disabled));
    await set("invitation-employee-santa-invite", "11"); await configure({ result: "forbidden" });
    await click("#save-invitation-santa-invite"); await until(() => !!document.querySelector('[role="dialog"] [role="alert"]'), "pending edit rejected");
    assert.equal(await value("invitation-role-santa-invite"), "provider");
    assert.deepEqual(await evaluate(() => window.teamUpdateFixture.serverTeam()), before);
    await configure({ result: "success", holdWrite: true, holdGet: true }); await click("#save-invitation-santa-invite");
    await until(() => !!window.teamUpdateFixture.resolveWrite, "invitation PATCH held");
    await evaluate(() => document.getElementById("save-invitation-santa-invite").click());
    assert.equal((await writes()).length, 2);
    await evaluate(() => window.teamUpdateFixture.resolveWrite()); await until(() => !!window.teamUpdateFixture.resolveGet, "pending edit GET held");
    assert.ok(await evaluate(() => document.getElementById("invitation-role-santa-invite").disabled));
    await evaluate(() => window.teamUpdateFixture.resolveGet()); await closed();
    const saved = await evaluate(() => window.teamUpdateFixture.serverTeam());
    assert.deepEqual(saved.members, before.members); assert.deepEqual(saved.invitations[0], { ...before.invitations[0], role: "provider" }); assert.deepEqual(saved.invitations[1], before.invitations[1]);
    await invitation(); assert.equal(await value("invitation-role-santa-invite"), "provider");
    await set("invitation-role-santa-invite", "admin"); await set("invitation-employee-santa-invite", "13");
    await configure({ holdWrite: false, resolveGet: null }); await click("#save-invitation-santa-invite");
    await until(() => !!window.teamUpdateFixture.resolveGet, "authoritative invitation GET held");
    await evaluate(() => { window.teamUpdateFixture.setServerInvitation("santa-invite", "viewer", 11); window.teamUpdateFixture.resolveGet(); });
    await closed(); await invitation(); assert.equal(await value("invitation-role-santa-invite"), "viewer"); assert.equal(await value("invitation-employee-santa-invite"), "11");
    await configure({ holdGet: false });
    await set("invitation-employee-santa-invite", "13");
    await evaluate(async () => { window.teamUpdateFixture.setServerInvitation("other-invite", "provider", 13); await window.teamUpdateFixture.refresh(); });
    await until(() => document.getElementById("save-invitation-santa-invite").disabled, "conflicting pending draft disabled");
    assert.equal(await value("invitation-employee-santa-invite"), "13");
    assert.deepEqual(await evaluate(() => ({ disabled: document.getElementById("invitation-employee-santa-invite").selectedOptions[0].disabled, label: document.getElementById("invitation-employee-santa-invite").selectedOptions[0].textContent })), { disabled: true, label: m.employeeUnavailable });
    const count = (await writes()).length; await evaluate(() => document.querySelector('[role="dialog"] form').requestSubmit()); assert.equal((await writes()).length, count);
    await button(ui.cancel); await closed(); await member();
    assert.deepEqual(await options("member-employee-member"), ["none", "10", "12"]);
    await set("member-employee-member", "12");
    await evaluate(async () => { window.teamUpdateFixture.setServerInvitation("other-invite", "provider", 12); await window.teamUpdateFixture.refresh(); });
    await until(() => document.getElementById("save-member-member").disabled, "member reservation rendered");
    assert.equal(await value("member-employee-member"), "12"); assert.ok(await evaluate(() => document.getElementById("save-member-member").disabled));
    await button(ui.cancel); await closed(); await invite(); await set("team-email", "third@example.test"); await set("team-employee", "13");
    await evaluate(async () => { window.teamUpdateFixture.setServerInvitation("other-invite", "provider", 13); await window.teamUpdateFixture.refresh(); });
    await until(() => document.getElementById("team-employee").selectedOptions[0].disabled, "invitation reservation rendered");
    assert.equal(await value("team-employee"), "13"); assert.ok(await evaluate(() => document.querySelector('[role="dialog"] button[type="submit"], [role="dialog"] form button:last-child').disabled));
    await evaluate(() => document.querySelector('[role="dialog"] form').requestSubmit()); assert.equal((await writes()).length, count);
    await button(ui.cancel); await closed();
    assert.deepEqual(await evaluate(() => window.teamUpdateFixture.serverTeam().members), before.members);
    assert.ok((await writes()).every(call => call.path === "/api/company/invitations/santa-invite"), "pending edit never patches membership");
    checks.push(`${language}/${width}: same pending invitation edited; identity/email/expiry/other records unchanged; assignment required; rejection retained; duplicate/refresh lock; authoritative GET; remotely reserved selections stay visible and blocked across all three forms`);
    console.log(`Passed pending editing: ${language}/${width}`);
  }

  for (const language of languages) for (const width of [1280, 768, 320]) {
    const ui = resources[language].translation.teamManagement;
    await viewport(width); await ready(language, "scenario=santa");
    await click("#team-filter-members"); assert.equal((await rows()).length, 2);
    await click("#team-filter-invitations"); assert.equal((await rows()).length, 2);
    await click("#team-filter-all"); await set("team-search", "JURIS"); assert.equal((await rows()).length, 1);
    await set("team-search", "employee 11"); assert.equal((await rows()).length, 1);
    await set("team-search", "not-found"); assert.equal((await rows()).length, 0);
    await button(ui.clearSearch); assert.equal((await rows()).length, 4);
    assert.ok(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "roster reflow");
    if (language === "en" && width === 1280) await screenshot(`${prefix}-roster.png`);
    await member(); await settle();
    assert.ok(await evaluate(() => { const box = document.querySelector('[role="dialog"]').getBoundingClientRect(); return box.left >= -1 && box.right <= innerWidth + 1; }), "panel inside viewport");
    assert.ok(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "panel reflow");
    for (let index = 0; index < 9; index++) { await key("Tab"); assert.ok(await evaluate(() => !!document.activeElement.closest('[role="dialog"]')), "focus contained"); }
    const light = await measureFormContrast(fixture, '.team-management[role="dialog"]'); assert.deepEqual(light.failures, []);
    if (language === "en" && width === 1280 || language === "ru" && width === 320) await screenshot(`${prefix}-${language}-${width}-edit.png`, false);
    await evaluate(() => document.documentElement.classList.add("dark")); await settle();
    const dark = await measureFormContrast(fixture, '.team-management[role="dialog"]'); assert.deepEqual(dark.failures, []);
    if (language === "ru" && width === 320) await screenshot(`${prefix}-${language}-${width}-dark.png`, false);
    contrasts.push({ language, width, light, dark });
    await button(ui.cancel); await closed();
    await invite(); await settle();
    if (language === "en" && width === 1280) { await evaluate(() => document.documentElement.classList.remove("dark")); await screenshot(`${prefix}-invite.png`); }
    assert.ok(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await button(ui.cancel); await closed();
    layouts.push(`${language}/${width}: roster + member/invite panel, filters/search, light/dark, modal focus, reflow`);
  }

  const m = resources.en.translation.operationsForm, ui = resources.en.translation.teamManagement;
  await viewport(1280); await ready(); await member();
  await configure({ confirm: false }); await button(m.removeAccess); assert.equal((await writes()).length, 0);
  await configure({ confirm: true, result: "forbidden" }); await button(m.removeAccess); await until(() => !!document.querySelector('[role="dialog"] [role="alert"]'), "remove rejection");
  assert.equal((await rows()).length, 2);
  await configure({ result: "success" }); await button(m.removeAccess); await closed(); assert.equal((await rows()).length, 1);
  await ready(); assert.ok(!await evaluate(() => document.querySelector("details").open));
  await click("summary"); await set("team-new-owner", "member"); await configure({ confirm: false }); await button(m.transfer); assert.equal((await writes()).length, 0);
  await configure({ confirm: true }); await button(m.transfer); await until(() => document.getElementById("team-new-owner").value === "", "transfer complete");
  assert.deepEqual((await writes()).at(-1), { path: "/api/company/transfer", method: "POST", body: { userId: "member" } });
  await button(m.closeCompany); await until(() => document.querySelector("summary").parentElement.textContent.includes("Reopen company"), "company closed");
  assert.deepEqual((await writes()).at(-1), { path: "/api/company/active", method: "PATCH", body: { isActive: false } });
  await button(m.reopenCompany); await until(() => document.querySelector("summary").parentElement.textContent.includes("Close company"), "company reopened");
  assert.deepEqual((await writes()).at(-1).body, { isActive: true });

  await visit("/?lang=en&denied"); await until(() => !!document.querySelector('[role="alert"]'), "denied"); assert.equal((await calls()).length, 0);
  await ready("en", "readOnly"); assert.ok(!await evaluate(() => !!document.querySelector('#team-invite, [id^="edit-"]')));
  await ready("en", "empty"); assert.equal((await rows()).length, 0); assert.ok(await evaluate(() => !!document.querySelector('[role="status"]')));
  await visit("/?lang=en&holdGet"); await until(() => !!window.teamUpdateFixture.resolveGet, "loading held");
  assert.ok(await evaluate(() => document.getElementById("team-invite").disabled));
  await evaluate(() => window.teamUpdateFixture.resolveGet()); await until(() => !!document.getElementById("team-roster"), "loading resolves");
  await visit("/?lang=en&loadError"); await until(() => !!document.querySelector('[role="alert"]'), "GET failure");
  await configure({ errorGet: false }); await button(ui.retry); await until(() => !!document.getElementById("team-roster"), "GET retry");
  await member(); await set("member-role-member", "admin"); await configure({ errorGet: true }); await button(m.saveAccess);
  await until(() => !!document.querySelector('[role="dialog"] [role="alert"]'), "saved but refresh failed");
  assert.ok(await evaluate(text => document.querySelector('[role="dialog"]').textContent.includes(text), ui.refreshError));
  assert.equal(await value("member-role-member"), "admin");
  assert.ok(await evaluate(() => document.getElementById("save-member-member").disabled));
  const savedCount = (await writes()).length;
  await evaluate(() => document.querySelector('[role="dialog"] form').requestSubmit()); assert.equal((await writes()).length, savedCount, "failed refresh cannot repeat the saved mutation");
  await configure({ errorGet: false }); await button(ui.retry);
  await until(() => !document.querySelector('[role="dialog"] [role="alert"]'), "refresh recovered inside panel");
  assert.equal(await value("member-role-member"), "admin"); await button(ui.cancel); await closed();

  await ready(); await member(); await set("member-role-member", "admin"); await configure({ holdWrite: true }); await button(m.saveAccess);
  await until(() => !!window.teamUpdateFixture.resolveWrite, "old workspace write pending");
  await evaluate(() => window.teamUpdateFixture.switchWorkspace()); await until(() => document.body.textContent.includes("other-owner@example.test"), "new workspace isolated");
  assert.ok(!await evaluate(() => !!document.querySelector('[role="dialog"][data-state="open"]')));
  await evaluate(() => window.teamUpdateFixture.resolveWrite()); await settle();
  assert.ok(!await evaluate(() => !!document.querySelector('section > [role="status"]')), "old completion cannot show notice in new workspace");
  assert.ok(!(await rows()).some(text => text.includes("member@example.test")));
  await ready(); await invite(); await set("team-email", "draft@example.test");
  await evaluate(() => window.teamUpdateFixture.setPermissions(false, false)); await until(() => !!document.querySelector('[role="alert"]'), "revoked permissions");
  assert.ok(!await evaluate(() => !!document.querySelector('[role="dialog"][data-state="open"]')));
  checks.push("owner transfer/close/reopen and remove confirmations, rejected removal, denied/no GET, read-only, empty/loading/error/retry, saved-but-refresh-failed recovery, workspace and permission changes clear panels and ignore old receipts");

  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.blocked, []); assert.deepEqual(fixture.network, []);
  const evidence = { browser, languages, checks, layouts, contrasts, externalRequests: 0, mockBoundary: "fetch replaced by synthetic in-memory API; clipboard and confirmation mocked", deferred: ["ar/RTL", "zh", "fr", "de", "hi", "ja", "pt", "es"] };
  await writeFile(path.join(root, `${prefix}-evidence.json`), JSON.stringify(evidence, null, 2) + "\n");
  console.log(JSON.stringify({ browser, languages, checks: checks.length, layouts: layouts.length, externalRequests: 0 }, null, 2));
} catch (error) {
  await screenshot(`${prefix}-failure.png`).catch(() => {});
  throw error;
} finally { await fixture.close(); }
