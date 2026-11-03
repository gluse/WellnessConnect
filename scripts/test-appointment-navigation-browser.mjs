import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";

const languages = ["en", "lv", "ru"];
const resources = Object.fromEntries(await Promise.all(languages.map(async language => [language, { translation: JSON.parse(await readFile(new URL(`../client/public/locales/${language}/translation.json`, import.meta.url), "utf8")) }])));
const fixture = await browserFixture({ entry: "scripts/fixtures/appointment-layout.tsx", resources });
const { visit, viewport, evaluate, until, set, click, key } = fixture;
const engine = process.env.FORMS_BROWSER || "chrome", matrix = [];
const menu = '[data-mobile-navigation] button';
const navigate = async (path, label, mobile) => {
  if (mobile) {
    await click(menu);
    await until(() => !!document.querySelector('[role="menu"]'), "Menu opens");
    await evaluate(label => [...document.querySelectorAll('[role="menuitem"]')].find(item => item.textContent.trim() === label).focus(), label);
    await key("Enter");
  } else await click(`nav a[href="${path}"]`);
  await evaluate(path => { window.phase2Fixture.expectedPath = path; }, path);
  await until(() => location.pathname === window.phase2Fixture.expectedPath && !!document.querySelector('main h1'), "appointment list appears");
  assert.equal(await evaluate(() => location.pathname), path);
  assert.equal(await evaluate(() => document.querySelector('main h1').textContent), label);
};
try {
  for (const language of languages) for (const width of [320, 768, 1280]) {
    const labels = resources[language].translation;
    await viewport(width, 800);
    await visit(`/my-services/appointments?lang=${language}&employees=1`);
    await until(() => !!document.querySelector('[data-testid="calendar-scroll"]'), "calendar is the default page");
    assert.equal(await evaluate(() => document.querySelectorAll('main h1').length), 0, "Appointments heading removed");
    assert.equal(await evaluate(() => !!document.querySelector('[data-testid="appointment-summary"]')), false);
    assert.equal(await evaluate(label => !!document.querySelector(`main [role="group"][aria-label="${label}"]`), labels.appointmentAgenda.view), false, "view switcher removed");
    assert.equal(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    await set("appointment-calendar-mode", "day");
    await set("appointment-calendar-date", "2030-01-16");
    await until(() => !!document.querySelector('[data-testid="calendar-event-1"]'), "calendar date navigation works");
    await click('[data-testid="calendar-event-1"]');
    await until(() => !!document.querySelector('[role="dialog"] [data-testid="appointment-1"]'), "calendar keeps booking details");
    await key("Escape");
    await until(() => !document.querySelector('[role="dialog"]') && document.activeElement?.dataset.testid === "calendar-event-1", "calendar detail focus restored");
    await navigate("/my-services/upcoming-appointments", labels.providerNavigation.upcomingAppointments, width < 1024);
    await until(() => document.querySelectorAll('main article[data-testid]').length === 3, "upcoming results preserved");
    await set("provider-appointment-status", "pending");
    await until(() => document.querySelectorAll('main article[data-testid]').length === 2, "upcoming status filtering works");
    await navigate("/my-services/past-appointments", labels.providerNavigation.pastAppointments, width < 1024);
    await until(() => document.querySelectorAll('main article[data-testid]').length === 1, "past results preserved");
    assert.equal(await evaluate(() => document.querySelector('main article').dataset.testid), "appointment-5");
    assert.equal(await evaluate(() => document.querySelector('#provider-appointment-status').value), "all", "route resets list filters");
    await evaluate(() => history.back());
    await until(() => location.pathname === "/my-services/upcoming-appointments" && document.querySelectorAll('main article[data-testid]').length === 3, "Back restores upcoming page");
    if (width === 320) {
      await click(menu);
      await fixture.screenshot(`docs/appointment-navigation-${engine}-${language}-menu.png`, false);
    }
    matrix.push({ language, width, height: 800 });
    assert.deepEqual(await evaluate(() => window.phase2Fixture.unexpected), []);
  }
  for (const language of languages) for (const state of ["loading", "empty", "error"]) {
    await viewport(360, 800);
    await visit(`/my-services/appointments?lang=${language}&state=${state}`);
    if (state === "error") await until(() => !!document.querySelector('main [role="alert"]'), "calendar page load error");
    else {
      await until(() => !!document.querySelector('[data-testid="appointment-calendar"]'), "calendar shell loaded");
      const expected = resources[language].translation[state === "empty" ? "appointmentCalendar" : "appointmentAgenda"][state === "empty" ? "empty" : "loading"];
      if (state === "empty") await until(() => !!document.querySelector('[data-testid="calendar-scroll"]'), "empty request settles");
      await until(() => !!document.querySelector('main [role="status"]'), "calendar status present");
      assert.equal(await evaluate(text => document.querySelector('main').textContent.includes(text), expected), true);
      if (state === "loading") {
        await evaluate(() => { window.phase2Fixture.state = "success"; window.phase2Fixture.release(); });
        await until(() => !!document.querySelector('[data-testid="calendar-scroll"]'), "calendar loading resolves");
      }
    }
    assert.equal(await evaluate(() => document.querySelectorAll('main h1, [data-testid="appointment-summary"]').length), 0);
  }
  await visit('/my-services/appointments?lang=en');
  await until(() => !!document.querySelector('[data-testid="calendar-scroll"]'), "calendar screenshot ready");
  await fixture.screenshot(`docs/appointment-navigation-${engine}-calendar.png`, false);
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []);
  await writeFile(new URL(`../docs/appointment-navigation-${engine}-evidence.json`, import.meta.url), JSON.stringify({ date: "2026-11-03", browser: await fixture.api("Browser.getVersion"), matrix, states: ["loading", "empty", "error"], checks: ["Calendar default without view switcher, summary or h1", "Calendar date/detail/focus retained", "Menu and desktop links reach separate localized lists", "Upcoming/status/history filtering and Back navigation", "Calendar loading/empty/error states"], deferredLanguages: ["ar", "zh", "fr", "de", "hi", "ja", "pt", "es"], limits: "Actual frontend with fixed synthetic dates and mocked GET APIs; external traffic blocked. No connected sessions/database writes. Physical devices, screen readers and native language review unverified." }, null, 2) + "\n");
  console.log(`Passed appointment navigation ${engine}: 9 en/lv/ru viewport cases plus calendar loading/empty/error.`);
} finally { await fixture.close(); }
