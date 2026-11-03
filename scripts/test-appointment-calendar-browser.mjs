import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";

const languages = ["en", "lv", "ru"];
const resources = Object.fromEntries(await Promise.all(languages.map(async language => [language, { translation: JSON.parse(await readFile(new URL(`../client/public/locales/${language}/translation.json`, import.meta.url), "utf8")) }])));
for (const language of languages) {
  for (const [key, text] of Object.entries(resources.en.translation.appointmentCalendar)) {
    const translated = resources[language].translation.appointmentCalendar[key];
    assert.ok(translated?.trim(), `${language} appointmentCalendar.${key}`);
    assert.deepEqual(translated.match(/{{\w+}}/g), text.match(/{{\w+}}/g));
  }
}
const fixture = await browserFixture({ entry: "scripts/fixtures/appointment-calendar.tsx", resources });
const { evaluate, until, viewport, visit, set, key } = fixture;
const engine = process.env.FORMS_BROWSER || "chrome", matrix = [], checks = [];
const artifactPrefix = process.env.APPOINTMENT_CALENDAR_ARTIFACT_PREFIX || "appointment-calendar";
assert.match(artifactPrefix, /^[a-z0-9-]+$/);
const event = id => `[data-testid="calendar-event-${id}"]`;
const openCalendar = async (language = "en", query = "") => {
  await visit(`/my-services/appointments?lang=${language}${query}`);
  await until(() => !!document.querySelector('[data-testid="appointment-filters"]'), "appointments ready");
  await fixture.button(resources[language].translation.appointmentAgenda.calendar);
  await until(() => !!document.querySelector('[data-testid="appointment-calendar"]'), "calendar visible");
};
const closeDetails = async (keyboard = false) => {
  await until(() => !document.querySelector('[role="dialog"][data-state="open"] > button:last-child:disabled'), "pending detail action settled");
  await until(() => {
    const button = document.querySelector('[role="dialog"][data-state="open"] > button:last-child');
    if (!button) return false;
    const rect = button.getBoundingClientRect(), hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return hit === button || button.contains(hit);
  }, "detail close control is clear of closing nested overlays");
  await fixture.settle();
  if (keyboard) await key("Escape"); else await fixture.click('[role="dialog"][data-state="open"] > button:last-child');
  await until(() => !document.querySelector('[role="dialog"][data-state="open"]'), "details closed"); await fixture.settle();
};
try {
  for (const language of languages) {
    const strings = resources[language].translation;
    for (const width of [320, 390, 768, 1440]) {
      await viewport(width, 960); await openCalendar(language);
      await until(() => document.querySelectorAll('[data-testid^="calendar-event-"]').length > 0, "timed events loaded");
      const state = await evaluate(() => ({
        width: innerWidth, fits: document.documentElement.scrollWidth <= innerWidth + 1,
        mode: document.querySelector('#appointment-calendar-mode').value,
        groupCount: document.querySelectorAll('[data-testid="calendar-event-3"]').length,
        controls: [...document.querySelectorAll('[data-testid="appointment-calendar"] input, [data-testid="appointment-calendar"] select')].map(element => ({ label: !!element.labels?.length || !!element.getAttribute("aria-label"), fits: element.getBoundingClientRect().right <= innerWidth + 1 })),
        range: document.querySelector('[data-testid="calendar-range"]').textContent,
        shortHeight: document.querySelector('[data-testid="calendar-event-7"]').getBoundingClientRect().height,
        hourHeight: document.querySelector('[data-calendar-day]').getBoundingClientRect().height / 24,
        shortLabel: document.querySelector('[data-testid="calendar-event-7"]').getAttribute("aria-label"),
      }));
      assert.equal(state.fits, true, `${language}/${width}: page reflows`);
      assert.equal(state.mode, width < 640 ? "day" : "week");
      assert.equal(state.groupCount, 1, "Group session is a single block");
      assert.ok(state.hourHeight < 96, "Hour rows use the requested compact spacing");
      assert.equal(state.shortHeight, state.hourHeight / 4, "15-minute events retain their exact time geometry");
      assert.ok(state.shortLabel.includes("Consultation") && state.shortLabel.includes("14:30–14:45"), "Short events retain their full accessible detail label; existing list views provide larger equivalent controls");
      assert.ok(state.controls.every(control => control.label && control.fits));
      matrix.push({ language, width, ...state });
      if (width === 1440 && language === "en") {
        await evaluate(() => { document.querySelector('[data-testid="calendar-scroll"]').scrollTop = 7 * document.querySelector('[data-calendar-day]').getBoundingClientRect().height / 24; });
        await fixture.screenshot(`docs/${artifactPrefix}-${engine}-desktop.png`, false);
      }
      if (width === 390) {
        await evaluate(() => { document.querySelector('[data-testid="calendar-scroll"]').scrollTop = 9 * document.querySelector('[data-calendar-day]').getBoundingClientRect().height / 24; });
        await fixture.screenshot(`docs/${artifactPrefix}-${engine}-${language}-phone.png`, false);
        await evaluate(() => { document.documentElement.style.fontSize = "32px"; });
        assert.equal(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, "200% text reflows");
      }
      await set("appointment-calendar-mode", "week");
      assert.equal(await evaluate(() => document.querySelectorAll('[data-calendar-day]').length), 7);
      await set("provider-appointment-status", "pending");
      assert.deepEqual(await evaluate(() => [...document.querySelectorAll('[data-testid^="calendar-event-"]')].map(node => node.dataset.testid).sort()), ["calendar-event-2", "calendar-event-3"]);
      await fixture.click(event(3));
      assert.equal(await evaluate(() => document.querySelectorAll('[role="dialog"] [data-testid^="event-booking-"]').length), 2, "Filtering pending retains all group attendees");
      await closeDetails(true);
      await until(() => document.activeElement?.dataset.testid === "calendar-event-3", "Dialog returns focus to calendar block");
      await set("provider-appointment-status", "all"); await set("appointment-employee", "2");
      assert.deepEqual(await evaluate(() => [...document.querySelectorAll('[data-testid^="calendar-event-"]')].map(node => node.dataset.testid).sort()), ["calendar-event-6", "calendar-event-7"]);
      await set("appointment-employee", "all");
      assert.deepEqual(await evaluate(() => window.phase2Fixture.unexpected), []);
    }
    await viewport(1280, 960); await openCalendar(language);
    await set("appointment-calendar-date", "2026-12-31");
    await fixture.click(`[aria-label="${strings.appointmentCalendar.next}"]`);
    assert.equal(await evaluate(() => document.querySelector('#appointment-calendar-date').value), "2027-01-07");
    await fixture.button(strings.appointmentCalendar.today);
    assert.equal(await evaluate(() => document.querySelector('#appointment-calendar-date').value), "2026-11-03");
    await set("appointment-calendar-mode", "day");
    await fixture.click(`[aria-label="${strings.appointmentCalendar.previous}"]`);
    assert.equal(await evaluate(() => document.querySelector('#appointment-calendar-date').value), "2026-11-02");
    await fixture.button(strings.appointmentCalendar.today);
    await evaluate(() => { const button = document.querySelector('[data-testid="calendar-event-7"]'); button.scrollIntoView({ block: "center" }); button.focus(); });
    await key("Enter");
    await until(() => !!document.querySelector('[role="dialog"] [data-testid="appointment-7"]'), "Compact short event opens full details by keyboard");
    await closeDetails(true);
    await until(() => document.activeElement?.dataset.testid === "calendar-event-7", "Short event regains keyboard focus");
    await fixture.click(event(2));
    await fixture.click('[data-testid="booking-notes-toggle-2"]');
    assert.ok((await evaluate(() => document.querySelector('[data-testid="text-booking-notes-2"]').textContent)).includes("<script>"));
    assert.equal(await evaluate(() => !!window.untrustedExecuted), false);
    await closeDetails();
    await evaluate(() => { const button = document.querySelector('[data-testid="calendar-event-2"]'); button.scrollIntoView({ block: "center" }); button.focus(); });
    await key("Enter"); await until(() => !!document.querySelector('[role="dialog"][data-state="open"]'), "keyboard details");
    await fixture.click('[data-testid="booking-messages-2"]');
    await until(() => !!document.querySelector('#booking-message-body'), "message action opens current conversation");
    await key("Escape"); await until(() => !document.querySelector('#booking-message-body'), "nested conversation closes");
    await fixture.settle();
    await until(() => document.activeElement?.dataset.testid === "booking-messages-2", "Nested dialog returns focus to details action");
    await fixture.click('[data-testid="booking-actions-2"]');
    await fixture.click('[role="menuitem"]');
    await until(() => !!document.querySelector('#booking-timezone'), "existing rescheduling dialog opens");
    await key("Escape"); await until(() => !document.querySelector('#booking-timezone'), "rescheduling dialog closes");
    await until(() => document.activeElement?.dataset.testid === "booking-actions-2", "Rescheduling returns focus to its action menu");
    await closeDetails();
    checks.push(`${language}: date/year navigation, Today, Day/Week, filters/group attendees, keyboard, notes escaping, nested messages and focus`);
  }

  await viewport(1280, 960); await openCalendar();
  const overlap = await evaluate(() => [2, 5, 6].map(id => { const rect = document.querySelector(`[data-testid="calendar-event-${id}"]`).getBoundingClientRect(); return { left: rect.left, right: rect.right }; }));
  assert.ok(overlap.every((box, index) => index === overlap.length - 1 || box.right <= overlap[index + 1].left), "Three concurrent events have separate lanes");
  assert.equal(await evaluate(() => document.querySelectorAll('[data-testid="calendar-event-8"]').length), 2, "Midnight crossing has linked segments");
  await fixture.click(event(2));
  await evaluate(() => { window.phase2Fixture.holdMutation = true; });
  await fixture.button(resources.en.translation.appointmentCollaboration.approve);
  await until(() => window.phase2Fixture.mutations.length === 1, "mock mutation submitted");
  assert.equal(await evaluate(() => [...document.querySelectorAll('[role="dialog"] button')].filter(button => button.textContent.trim() === "Approve").every(button => button.disabled)), true);
  await evaluate(() => { document.querySelector('[role="dialog"] [data-testid="appointment-2"] button')?.click(); });
  assert.equal(await evaluate(() => window.phase2Fixture.mutations.length), 1, "Pending action cannot double-submit");
  await evaluate(() => { window.phase2Fixture.holdMutation = false; window.phase2Fixture.release(); });
  await until(() => document.querySelector('[data-testid="calendar-event-2"]').getAttribute("aria-label").includes("Confirmed"), "calendar reflects mutation result");
  await closeDetails();
  await fixture.click(event(5)); await evaluate(() => { window.phase2Fixture.failMutation = true; });
  await fixture.button(resources.en.translation.appointmentCollaboration.markComplete);
  await until(() => window.phase2Fixture.mutations.length === 2, "mock failure submitted");
  await until(() => document.body.textContent.includes("Failed to update booking"), "failure remains visible");
  assert.ok(await evaluate(() => document.querySelector('[data-testid="calendar-event-5"]').getAttribute("aria-label").includes("Confirmed")));
  await closeDetails();
  await fixture.click(event(2));
  await evaluate(() => window.phase2Fixture.switchWorkspace());
  await until(() => !document.querySelector('[role="dialog"][data-state="open"]'), "workspace switch clears private details");

  await openCalendar("en", "&readonly=1"); await fixture.click(event(2));
  assert.equal(await evaluate(() => document.querySelectorAll('[role="dialog"] [data-testid^="booking-actions-"], [role="dialog"] [data-testid^="booking-messages-"]').length), 0);
  assert.equal(await evaluate(() => window.phase2Fixture.mutations.length), 0);
  await closeDetails();
  await openCalendar("en", "&state=empty");
  assert.equal(await evaluate(() => document.querySelectorAll('[data-testid^="calendar-event-"]').length), 0);
  assert.ok(await evaluate(() => document.body.textContent.includes("No appointments in this period")));
  await openCalendar("en", "&state=loading");
  assert.ok(await evaluate(() => document.querySelector('[data-testid="appointment-calendar"] [role="status"]')?.textContent.length > 0));
  await evaluate(() => { window.phase2Fixture.state = "success"; window.phase2Fixture.release(); });
  await until(() => document.querySelectorAll('[data-testid^="calendar-event-"]').length > 0, "loading resolves");
  await visit("/my-services/appointments?state=error");
  await until(() => document.querySelector('main [role="alert"]')?.textContent.includes("Unable to load appointments"), "page error");
  await visit("/my-bookings?lang=en");
  await until(() => !!document.querySelector('[data-testid="appointment-filters"]'), "customer agenda");
  assert.equal(await evaluate(() => [...document.querySelectorAll('button')].some(button => button.textContent.trim() === "Calendar")), false, "Customer views unchanged");
  checks.push("Three-way overlap/midnight rendering; pending duplicate prevention; success/failure handling; workspace privacy; view-only permissions; loading/empty/error; customer regression");
  assert.deepEqual(await evaluate(() => window.phase2Fixture.unexpected), []);
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []);
  await writeFile(new URL(`../docs/${artifactPrefix}-${engine}-evidence.json`, import.meta.url), JSON.stringify({ date: "2026-11-03", browser: await fixture.api("Browser.getVersion"), languages, matrix, checks, deferredLanguages: ["ar", "zh", "fr", "de", "hi", "ja", "pt", "es"], limits: "Actual provider/customer pages with synthetic mocks; isolated loopback only. No connected services/database/session writes; no physical-device or screen-reader certification." }, null, 2) + "\n");
  console.log(`Passed ${engine}: ${matrix.length} en/lv/ru viewport cases plus calendar interaction, integration and privacy regressions.`);
} catch (error) {
  console.error(await evaluate(() => ({ unexpected: window.phase2Fixture?.unexpected, active: document.activeElement?.outerHTML.slice(0, 300), dialogs: [...document.querySelectorAll('[role="dialog"]')].map(node => node.textContent.slice(0, 200)) })));
  await fixture.screenshot(`docs/${artifactPrefix}-${engine}-failure.png`, false).catch(() => {});
  throw error;
} finally { await fixture.close(); }
