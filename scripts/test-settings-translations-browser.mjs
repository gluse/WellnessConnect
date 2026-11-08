import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";

const languages = ["en", "lv", "ru"], engine = process.env.FORMS_BROWSER || "chrome";
const resources = Object.fromEntries(await Promise.all(languages.map(async language => [language, { translation: JSON.parse(await readFile(`client/public/locales/${language}/translation.json`, "utf8")) }])));
const fixture = await browserFixture({ entry: "scripts/fixtures/settings-translations.tsx", resources });
const { evaluate, until, visit, set, button, viewport } = fixture;
let sequence = 0;
const checks = [], matrix = [];
const open = async (query = "", path = "/my-services/settings") => visit(`${path}?case=${++sequence}&${query}`);
const configure = values => evaluate(values => Object.assign(window.phase2Fixture, values), values);
const visible = async text => {
  await configure({ expected: text });
  await until(() => document.body.innerText.includes(window.phase2Fixture.expected), "translated text: " + text);
};
const language = async lang => { await evaluate(lang => window.phase2Fixture.language(lang), lang); await visible(resources[lang].translation.mobileNavigation.settings); };
const receipt = async text => {
  await configure({ expected: text });
  await until(() => [...document.querySelectorAll('[data-receipt] p')].some(element => element.textContent === window.phase2Fixture.expected), "translated receipt");
};
const settled = () => until(() => [...document.querySelectorAll('button')].some(element => element.dataset.testid === "button-save-provider-profile" && !element.disabled));
const reflow = async () => {
  const result = await evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth + 1,
    unnamed: [...document.querySelectorAll('input,select,button[role="switch"]')].filter(element => element.getClientRects().length && !element.closest('[aria-hidden="true"]') && !element.labels?.length && !document.querySelector(`label[for="${element.id}"]`) && !element.getAttribute("aria-label")).map(element => element.id),
    clipped: [...document.querySelectorAll('nav a,button')].filter(element => element.getClientRects().length && (element.scrollWidth > element.clientWidth + 2 || element.scrollHeight > element.clientHeight + 2)).map(element => element.textContent) }));
  assert.equal(result.overflow, false, JSON.stringify(result)); assert.deepEqual(result.unnamed, []); assert.deepEqual(result.clipped, []);
};
try {
  await open(); await until(() => !!document.getElementById("employee-name"));
  await set("company-name", "Unsaved company — SIA"); await set("employee-name", "Unsaved employee — Ирина");
  await fixture.click('#show-employee-name');
  for (const lang of languages) {
    const t = resources[lang].translation, p = t.providerSettings;
    await language(lang);
    const display = await evaluate(() => ({ heading: document.querySelector("h1").textContent, nav: document.querySelector("nav").getAttribute("aria-label"),
      company: document.getElementById("company-name").value, employee: document.getElementById("employee-name").value,
      placeholders: [document.getElementById("company-name").placeholder, document.getElementById("employee-name").placeholder],
      options: [...document.querySelectorAll('#provider-type option')].map(option => ({ value: option.value, label: option.textContent })),
      selected: document.getElementById("provider-type").value, showName: document.getElementById("show-employee-name").getAttribute("aria-checked"), text: document.body.innerText }));
    assert.equal(display.heading, t.mobileNavigation.settings); assert.equal(display.nav, p.sections);
    assert.equal(display.company, "Unsaved company — SIA"); assert.equal(display.employee, "Unsaved employee — Ирина");
    assert.deepEqual(display.placeholders, [p.companyPlaceholder, p.employeePlaceholder]);
    assert.deepEqual(display.options, [{ value: "individual", label: p.individual }, { value: "company", label: p.company }]);
    assert.equal(display.selected, "company"); assert.equal(display.showName, "true");
    for (const key of ["description", "profileTab", "teamTab", "profileTitle", "offerAs", "companyName", "companyHelp", "saveProfile", "employees", "employeesHelp", "nameVisible", "nameHidden", "addEmployee", "showName"]) assert.ok(display.text.includes(p[key]), `${lang}: ${key}`);
    assert.ok(!/providerSettings\.|operationsForm\./.test(display.text));
    for (const width of [320, 390, 768, 1280]) { await viewport(width); await reflow(); matrix.push({ lang, width, state: "company-form" }); }
    if (lang === "lv") { await viewport(390); await fixture.screenshot("docs/settings-translations-chrome-phone.png"); }
    if (lang === "ru") { await viewport(1280); await fixture.screenshot("docs/settings-translations-chrome-desktop.png"); }
  }
  assert.deepEqual(await evaluate(() => window.phase2Fixture.writes), []);
  checks.push("Mounted company form switches en/lv/ru labels, headings, tabs, helpers, options, placeholders and accessible nav name while preserving drafts, canonical values and visibility switch; 12 viewport cases fit without clipping");

  await configure({ result: "pending" }); await fixture.click('[data-testid="button-save-provider-profile"]');
  await until(() => !!window.phase2Fixture.release);
  await language("lv"); assert.equal(await evaluate(() => document.querySelector('[data-testid="button-save-provider-profile"]').textContent), resources.lv.translation.operationsForm.saving);
  await configure({ result: "error" }); await evaluate(() => window.phase2Fixture.release());
  await receipt(resources.lv.translation.providerSettings.saveFailed); await visible(resources.lv.translation.operationsForm.saveError);
  assert.equal(await evaluate(() => document.getElementById("company-name").value), "Unsaved company — SIA");
  assert.equal(await evaluate(() => document.body.innerText.includes("Untranslated server detail")), false);
  await language("ru"); await receipt(resources.ru.translation.providerSettings.saveFailed);
  await configure({ result: "success" }); await settled(); await fixture.click('[data-testid="button-save-provider-profile"]');
  await receipt(resources.ru.translation.providerSettings.profileSaved);
  await language("en"); await receipt(resources.en.translation.providerSettings.profileSaved);
  checks.push("Pending profile save translates live; rejected synthetic save retains drafts and uses localized safe feedback; existing failure/success receipt also changes language");

  await button(resources.en.translation.common.edit); await set("employee-name", "Edited employee draft");
  await language("lv"); await visible(resources.lv.translation.providerSettings.editEmployee); await visible(resources.lv.translation.providerSettings.saveEmployee);
  assert.equal(await evaluate(() => document.getElementById("employee-name").value), "Edited employee draft");
  await configure({ result: "error" }); await fixture.click('[data-testid="button-save-employee"]');
  await receipt(resources.lv.translation.providerSettings.saveFailed);
  assert.equal(await evaluate(() => document.getElementById("employee-name").value), "Edited employee draft");
  await configure({ result: "success" }); await fixture.click('[data-testid="button-save-employee"]'); await receipt(resources.lv.translation.providerSettings.employeeSaved);
  await button(resources.lv.translation.operationsForm.remove); await receipt(resources.lv.translation.providerSettings.employeeRemoved);
  await set("employee-name", "New employee"); await fixture.click('[data-testid="button-save-employee"]'); await receipt(resources.lv.translation.providerSettings.employeeSaved);
  const writes = await evaluate(() => window.phase2Fixture.writes);
  assert.deepEqual(writes[0], { method: "PATCH", path: "/api/provider/profile", body: { providerType: "company", companyName: "Unsaved company — SIA" } });
  assert.ok(writes.some(write => write.method === "PATCH" && write.path === "/api/provider/employees/11" && write.body.name === "Edited employee draft"));
  assert.ok(writes.some(write => write.method === "POST" && write.path === "/api/provider/employees" && write.body.name === "New employee"));
  checks.push("Translated employee edit/save/remove/add interactions and failure retention preserve existing synthetic API contracts");

  for (const lang of languages) {
    const p = resources[lang].translation.providerSettings;
    await open(`lang=${lang}&empty=1`); await visible(p.employeesEmpty);
    await open(`lang=${lang}&employees=pending`); await visible(p.loadingEmployees);
    await open(`lang=${lang}&employees=error`); await visible(p.loadEmployeesError);
    await open(`lang=${lang}&loading=1`); await visible(p.loading);
    await open(`lang=${lang}&individual=1`); await visible(p.profileTitle); assert.equal(await evaluate(() => !!document.getElementById("company-name")), false);
    await set("provider-type", "company"); await visible(p.companyName); await set("company-name", "Individual company draft");
    await language(languages[(languages.indexOf(lang) + 1) % languages.length]);
    assert.equal(await evaluate(() => document.getElementById("company-name").value), "Individual company draft");
    await open(`lang=${lang}&denied=1&noTeam=1`); await visible(p.denied);
    await open(`lang=${lang}&denied=1`); await visible(p.teamHint);
    await open(`lang=${lang}&noTeam=1`, "/my-services/settings/team"); await visible(p.teamDenied);
    await open(`lang=${lang}&employees=pending`, "/my-services/settings/team"); await visible(p.loadingEmployees);
    await open(`lang=${lang}&employees=error`, "/my-services/settings/team"); await visible(p.loadEmployeesError);
    await open(`lang=${lang}`, "/my-services/settings/missing"); await visible(p.notFound);
    assert.deepEqual(await evaluate(() => window.phase2Fixture.writes), []);
    assert.deepEqual(await evaluate(() => window.phase2Fixture.unexpected), []);
  }
  checks.push("en/lv/ru empty/loading/load-failure, individual/company selection, permission-denied/team hint/team-denied and not-found states translate without writes");
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []);
  await writeFile(`docs/settings-translations-${engine}-evidence.json`, JSON.stringify({ date: "2026-11-08", browser: await fixture.api("Browser.getVersion"), languages, checks, matrix,
    deferred: ["ar/RTL", "zh", "fr", "de", "hi", "ja", "pt", "es"], boundaries: "Isolated loopback fixture using actual SettingsPage/ProviderProfile and i18next, synthetic in-memory fetch responses; zero connected operations. Receipt wrapper renders actual toast React content; toast animations and screen-reader announcements are not tested." }, null, 2) + "\n");
  console.log(`PASS: ${engine} settings translations, ${checks.length} behavior groups and ${matrix.length} en/lv/ru viewport cases.`);
} finally { await fixture.close(); }
