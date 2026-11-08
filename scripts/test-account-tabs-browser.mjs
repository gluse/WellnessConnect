import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { browserFixture, measureFormContrast } from "./fixtures/browser-harness.mjs";

const languages = ["en", "lv", "ru"], engine = process.env.FORMS_BROWSER || "chrome";
const resources = Object.fromEntries(await Promise.all(languages.map(async lang => [lang, { translation: JSON.parse(await readFile(`client/public/locales/${lang}/translation.json`, "utf8")) }])));
const fixture = await browserFixture({ entry: "scripts/fixtures/account-tabs.tsx", resources });
const { evaluate, until, visit, set, button, click, key, viewport } = fixture;
const checks = [], matrix = [], screenshots = [], contrast = [];
const configure = values => evaluate(values => Object.assign(window.phase2Fixture, values), values);
const writes = () => evaluate(() => window.phase2Fixture.writes);
let sequence = 0;
const open = async (extra = "", hash = "personal") => { await visit(`/account?case=${++sequence}&${extra}#${hash}`); await until(() => !!document.querySelector('[role="tab"][aria-selected="true"]'), "account tabs loaded"); };
const tab = id => click(`[role="tab"][aria-controls$="content-${id}"]`);
const visibleText = async text => {
  await configure({ expectedText: text });
  await until(() => [...document.querySelectorAll('p')].some(e => e.getClientRects().length && e.textContent === window.phase2Fixture.expectedText), "visible feedback");
};
const reflow = async () => {
  const bounds = await evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth + 1,
    section: document.querySelector('[role="tab"][aria-selected="true"]')?.textContent, width: innerWidth,
    offenders: [...document.querySelectorAll('main *')].filter(e => e.getClientRects().length && e.getBoundingClientRect().right > innerWidth + 1).slice(0, 8).map(e => ({ tag: e.tagName, id: e.id, text: e.textContent.slice(0, 70), right: e.getBoundingClientRect().right })),
    unnamed: [...document.querySelectorAll('input,select')].filter(e => e.getClientRects().length && !e.labels?.length && !e.getAttribute("aria-label")).map(e => e.id),
    panels: [...document.querySelectorAll('[role="tabpanel"]')].filter(e => e.getClientRects().length).length }));
  assert.equal(bounds.overflow, false, JSON.stringify(bounds)); assert.deepEqual(bounds.unnamed, []);
  if (await evaluate(() => location.pathname === "/account")) assert.equal(bounds.panels, 1, "exactly one visible tab panel");
};
try {
  for (const lang of languages) {
    const t = resources[lang].translation;
    await viewport(1280, 900); await open(`lang=${lang}`);
    assert.equal(await evaluate(() => document.querySelectorAll('[role="tab"]').length), 4);
    assert.equal(await evaluate(() => document.querySelectorAll('#pricing-settings,#addresses').length), 0);
    assert.equal(await evaluate(() => window.phase2Fixture.reads.some(path => /addresses|pricing-settings/.test(path))), false);
    await set("account-name", "Unsaved personal name");
    await evaluate(() => document.querySelector('[role="tab"][aria-selected="true"]').focus()); await key("ArrowRight");
    await until(() => location.hash === "#communication", "keyboard selects communication tab");
    assert.equal(await evaluate(() => document.activeElement.getAttribute("role")), "tab");
    assert.equal(await evaluate(() => document.getElementById("account-name").getClientRects().length), 0);
    await tab("personal"); assert.equal(await evaluate(() => document.getElementById("account-name").value), "Unsaved personal name");
    await evaluate(() => history.back()); await until(() => location.hash === "#communication", "back restores selected tab");
    await until(() => !!document.getElementById("communication-phone"));
    const send = () => button(t.notifications.sendCode);
    assert.ok(await evaluate(() => !!document.getElementById("communication-phone").parentElement.querySelector('button:disabled')));
    await set("communication-language", "ru"); await set("communication-phone", "123"); await send();
    await visibleText(t.notifications.phoneInvalid); assert.equal((await writes()).length, 0);
    await set("communication-phone", "+37120000001"); await configure({ result: "error" }); await send();
    await visibleText(t.notifications.saveError);
    assert.deepEqual((await writes()).map(row => row.path), ["/api/account/communication"], "failed phone save cannot request a code");
    assert.equal(await evaluate(() => document.getElementById("communication-phone").value), "+37120000001");
    await configure({ result: "success", verifyResult: "error" }); await send();
    await visibleText(t.notifications.verifyError);
    assert.equal(await evaluate(() => window.phase2Fixture.preferences().phone), "+37120000001");
    assert.equal(await evaluate(() => document.getElementById("communication-language").value), "ru");
    assert.equal(await evaluate(() => window.phase2Fixture.preferences().language), "en", "send only saves the phone");
    await configure({ verifyResult: "success" }); await send();
    await until(() => !!document.getElementById("communication-code"), "inline code input");
    assert.equal(await evaluate(() => document.querySelectorAll("form form").length), 0);
    assert.equal((await writes()).filter(row => row.path === "/api/account/communication").length, 2, "retry send does not resave unchanged phone");
    assert.ok(await evaluate(() => !!document.getElementById("communication-phone").parentElement.querySelector('button:disabled')), "cooldown disables resend");
    await set("communication-code", "123456"); await configure({ verifyResult: "error" }); await button(t.notifications.verify);
    await visibleText(t.notifications.verifyError);
    assert.equal(await evaluate(() => document.getElementById("communication-code").value), "123456");
    await configure({ verifyResult: "success" }); await evaluate(() => document.getElementById("communication-code").focus()); await key("Enter");
    await visibleText(t.notifications.verified);
    assert.equal(await evaluate(() => document.getElementById("communication-language").value), "ru", "verification preserves other draft preferences");
    assert.equal(await evaluate(() => document.querySelector('#communication-form input[type="checkbox"]').disabled), false);
    await click('#communication-form input[type="checkbox"]'); await set("communication-method", "sms"); await button(t.notifications.save);
    await visibleText(t.notifications.saved);
    const payload = (await writes()).at(-1).body;
    assert.equal(payload.preferredMethod, "sms"); assert.equal(payload.language, "ru"); assert.equal(payload.phoneVerified, undefined);
    await set("communication-phone", "+37120000002");
    assert.ok(await evaluate(() => document.querySelector('#communication-form input[type="checkbox"]').disabled));
    assert.equal(await evaluate(() => document.querySelector('#communication-form input[type="checkbox"]').checked), false);
    assert.equal(await evaluate(() => !!document.getElementById("communication-code")), false);
    checks.push(`${lang}: keyboard tabs/history, private draft retention, no provider settings requests, direct save/send, failed-save/send/code recovery, consent and server-only verification`);

    await tab("role");
    assert.equal(await evaluate(() => document.getElementById("account-role").value), t.accountRole.buyer);
    assert.ok(await evaluate(() => document.getElementById("account-role").readOnly));
    await configure({ roleResult: "error" }); await button(t.accountRole.become); await visibleText(t.accountRole.error);
    assert.equal(await evaluate(() => document.getElementById("account-role").value), t.accountRole.buyer);
    await configure({ roleResult: "success" }); await button(t.accountRole.become); await visibleText(t.accountRole.activated);
    assert.equal(await evaluate(() => document.getElementById("account-role").value), t.accountRole.provider);
    assert.deepEqual((await writes()).at(-1), { path: "/api/users/role", body: { role: "provider" } });
    assert.ok(await evaluate(() => !!document.querySelector('a[href="/my-services"]')));
    checks.push(`${lang}: read-only role, failed activation recovery, existing provider API and workspace link`);

    for (const section of ["personal", "communication", "role", "password"]) {
      await tab(section);
      for (const [width, height] of [[320, 700], [390, 300], [768, 900], [1280, 900]]) {
        await viewport(width, height); await reflow(); matrix.push({ lang, section, width, height });
      }
      await viewport(320, 700); await evaluate(() => { document.documentElement.style.fontSize = "200%"; }); await reflow();
      await evaluate(() => { document.documentElement.style.fontSize = ""; });
      if (lang === "en" && ["communication", "role"].includes(section)) { const file = `docs/account-tabs-${engine}-${section}-phone.png`; await fixture.screenshot(file); screenshots.push(file); }
    }
    await viewport(1280, 900); await tab("communication");
    await fixture.settle();
    assert.equal(await evaluate(() => getComputedStyle(document.querySelector('[role="tab"][aria-selected="true"]')).backgroundColor === getComputedStyle(document.querySelector('#communication-form button[type="submit"]')).backgroundColor), true, "active tab keeps primary styling while hovered");
    if (lang === "en") { const file = `docs/account-tabs-${engine}-desktop.png`; await fixture.screenshot(file); screenshots.push(file); }
    for (const dark of [false, true]) {
      await evaluate(dark => document.documentElement.classList.toggle("dark", dark), dark);
      await fixture.settle();
      const measured = await measureFormContrast(fixture);
      assert.deepEqual(measured.failures, [], `${lang}: form text/control contrast`);
      contrast.push({ lang, dark, ...measured });
      await reflow();
    }
    await evaluate(() => document.documentElement.classList.remove("dark"));
    assert.deepEqual(await evaluate(() => window.phase2Fixture.unexpected), []);
  }

  await open("", "communication"); await until(() => !!document.getElementById("communication-phone"));
  await set("communication-phone", "+37120000003"); await configure({ result: "pending" }); await button(resources.en.translation.notifications.sendCode);
  await until(() => !!window.phase2Fixture.release, "phone save held");
  await evaluate(() => { const b = document.getElementById("communication-phone").parentElement.querySelector("button"); b.click(); b.click(); });
  assert.equal((await writes()).length, 1);
  await evaluate(() => window.phase2Fixture.switchAccount()); await until(() => document.getElementById("communication-phone")?.value === "");
  await evaluate(() => window.phase2Fixture.release()); await fixture.settle();
  assert.equal((await writes()).some(row => row.path.endsWith("/verify/start")), false, "account switch stops dependent send");
  checks.push("pending phone save deduplicated; account switch clears drafts and prevents dependent code send");

  await open("", "role"); await configure({ roleResult: "pending" }); await button(resources.en.translation.accountRole.become);
  await until(() => !!window.phase2Fixture.release); assert.equal((await writes()).length, 1);
  await evaluate(() => window.phase2Fixture.switchAccount()); await evaluate(() => window.phase2Fixture.release()); await fixture.settle();
  assert.equal(await evaluate(() => document.getElementById("account-role").value), resources.en.translation.accountRole.buyer);
  checks.push("late role activation cannot overwrite another account");
  await open("", "role"); await configure({ roleResult: "unauthorized" }); await button(resources.en.translation.accountRole.become);
  await until(() => location.pathname === "/login", "expired session redirects after rejected activation");

  await open("unavailable", "communication"); await until(() => !!document.getElementById("communication-phone")); await set("communication-phone", "+37120000000");
  assert.ok(await evaluate(() => !!document.getElementById("communication-phone").parentElement.querySelector('button:disabled')));
  await visibleText(resources.en.translation.notifications.verificationUnavailable);
  await open("load=error", "communication"); await visibleText(resources.en.translation.notifications.loadError);
  await configure({ loadResult: "success" }); await button(resources.en.translation.notifications.retry); await until(() => !!document.getElementById("communication-phone"));
  await open("", "communication"); await until(() => !!document.getElementById("communication-phone")); await set("communication-phone", "+37120000000"); await button(resources.en.translation.notifications.sendCode);
  await until(() => !!document.getElementById("communication-code")); await evaluate(() => window.phase2Fixture.advance(301_000));
  await visibleText(resources.en.translation.notifications.codeExpired);
  assert.ok(await evaluate(() => document.getElementById("communication-code").disabled));
  assert.ok(await evaluate(() => !document.getElementById("communication-phone").parentElement.querySelector('button').disabled));
  checks.push("unavailable verification, preferences-load retry, challenge expiry and resend cooldown");

  for (const lang of languages) for (const [hash, path, id] of [["pricing-settings", "/my-services/settings/pricing", "pricing-default-currency"], ["addresses", "/my-services/settings/addresses", "account-addresses-title"]]) {
    await visit(`/account?provider=1&lang=${lang}#${hash}`); await until(() => location.pathname.startsWith("/my-services/settings/") && !!document.querySelector('#pricing-default-currency,#account-addresses-title'));
    assert.equal(await evaluate(() => location.pathname), path); assert.ok(await evaluate(id => !!document.getElementById(id), id));
    for (const width of [320, 768, 1280]) { await viewport(width, 900); await reflow(); matrix.push({ lang, section: path, width, height: 900 }); }
    assert.deepEqual(await evaluate(() => window.phase2Fixture.unexpected), []);
  }
  await visit("/my-services/settings/pricing?provider=1"); await until(() => !!document.getElementById("pricing-default-currency"));
  await set("pricing-default-currency", "USD"); await evaluate(() => window.phase2Fixture.switchWorkspace());
  await until(() => document.getElementById("pricing-default-currency")?.value === "GBP", "pricing draft resets to new workspace");
  await visit("/my-services/settings/addresses?provider=1&denied=1"); await visibleText(resources.en.translation.addressForm.denied);
  assert.equal(await evaluate(() => window.phase2Fixture.reads.includes("/api/addresses")), false);
  await visit("/my-services/settings/pricing?provider=1&denied=1"); await visibleText(resources.en.translation.pricingSettings.denied);
  assert.equal(await evaluate(() => window.phase2Fixture.reads.includes("/api/workspace/pricing-settings")), false);
  checks.push("en/lv/ru legacy links redirect to provider settings, permissions deny loading, pricing drafts reset across workspaces");
  await open("", "nonsense"); assert.ok(await evaluate(() => document.getElementById("personal").getClientRects().length));
  await visit("/account?guest=1#role"); await until(() => location.pathname === "/login");
  assert.equal((await writes()).length, 0);
  checks.push("unknown hash defaults safely; logged-out account redirects without writes");
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []);
  await writeFile(`docs/account-tabs-${engine}-evidence.json`, JSON.stringify({ date: "2026-11-08", browser: await fixture.api("Browser.getVersion"), languages, checks, matrix, screenshots, contrast,
    deferred: ["ar/RTL", "zh", "fr", "de", "hi", "ja", "pt", "es"], boundaries: "Isolated loopback fixture; synthetic data, in-memory fetch mocks; no connected database/services, credentials or SMS sends." }, null, 2) + "\n");
  console.log(`PASS: ${engine} account redesign, ${checks.length} behavior groups and ${matrix.length} en/lv/ru viewport cases.`);
} finally { await fixture.close(); }
