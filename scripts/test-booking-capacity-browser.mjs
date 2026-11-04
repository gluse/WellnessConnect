import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";

const languages = ["en", "lv", "ru"], resources = {};
for (const language of languages) resources[language] = { translation: JSON.parse(await readFile(`client/public/locales/${language}/translation.json`, "utf8")) };
const fixture = await browserFixture({ entry: "scripts/fixtures/booking-capacity.tsx", resources });
const { evaluate, until, visit, viewport, click, button, set, key } = fixture;
const choose = async () => {
  await until(() => !!document.querySelector('button[name="day"]:not([disabled])'), "available day");
  await click('button[name="day"]:not([disabled])');
  await until(() => !!document.querySelector('button[aria-pressed="false"]'), "available time");
  await click('button[aria-pressed="false"]');
};
const reflow = async () => assert.deepEqual(await evaluate(() => {
  const dialog = document.querySelector('[role="dialog"]');
  return { page: document.documentElement.scrollWidth <= innerWidth + 1, dialog: dialog.scrollWidth <= dialog.clientWidth + 1 };
}), { page: true, dialog: true });
try {
  for (const [index, language] of languages.entries()) {
    const t = resources[language].translation, form = t.bookingForm;
    await viewport([1280, 768, 375][index], 900);
    await visit("/booking?lang=" + language);
    await choose(); await button(form.continue);
    await until(() => !!document.getElementById("booking-participants"), "participant review");
    assert.equal(await evaluate(() => document.getElementById("booking-participants").max), "4", "Six places with two occupied offers four");
    assert.equal(await evaluate(() => document.querySelector('label[for="booking-participants"]').textContent), t.booking.participants);
    assert.equal(await evaluate(() => document.getElementById("booking-participants-help").textContent), form.participantHelp.replace("{{maximum}}", "4"));
    await set("booking-participants", "5"); await button(form.requestBooking);
    await until(() => !!document.getElementById("booking-participants-error"), "over-capacity validation");
    assert.equal(await evaluate(() => document.getElementById("booking-participants-error").textContent), form.participantError.replace("{{maximum}}", "4"));
    assert.equal(await evaluate(() => document.activeElement.id), "booking-participants", "Invalid participant count receives focus");
    assert.equal(await evaluate(() => document.getElementById("booking-participants").getAttribute("aria-invalid")), "true");
    assert.deepEqual(await evaluate(() => window.phase2Fixture.writes), [], "Invalid participant count sends no request");
    await set("booking-participants", "4");
    await reflow();
    await key("Tab"); assert.equal(await evaluate(() => !!document.activeElement.closest('[role="dialog"]')), true, "Keyboard focus stays in dialog");
    await button(form.requestBooking);
    await until(() => window.phase2Fixture.writes.length === 1, "valid booking request");
    assert.deepEqual(await evaluate(() => window.phase2Fixture.writes[0]), { path: "/api/bookings", body: { serviceId: 7, scheduledDate: "2030-01-16T09:00:00.000Z", participantCount: 4, initialMessage: null } });
    assert.deepEqual(await evaluate(() => window.phase2Fixture.unexpected), []);
  }

  const form = resources.en.translation.bookingForm;
  await visit("/booking?lang=en"); await choose(); await button(form.continue);
  await set("booking-participants", "4"); await button(form.changeTime);
  await evaluate(() => window.phase2Fixture.refreshCapacity(2));
  await button(form.continue);
  await until(() => document.getElementById("booking-participants")?.max === "2", "selected slot capacity refreshed");
  assert.equal(await evaluate(() => document.getElementById("booking-participants").value), "4", "Capacity refresh preserves chosen participants");
  await button(form.requestBooking);
  assert.deepEqual(await evaluate(() => window.phase2Fixture.writes), [], "Stale count is rejected after refresh");
  await button(form.changeTime);
  await evaluate(() => window.phase2Fixture.refreshCapacity(0));
  await until(() => !document.querySelector('button[aria-pressed="true"]'), "sold-out selection cleared");
  assert.equal(await evaluate(text => [...document.querySelectorAll('[role="dialog"] button')].find(node => node.textContent === text).disabled, form.continue), true);
  await evaluate(() => window.phase2Fixture.refreshCapacity(null));
  await until(() => !!document.querySelector('button[aria-pressed="false"]'), "legacy slot without capacity");
  await click('button[aria-pressed="false"]'); await button(form.continue);
  assert.equal(await evaluate(() => document.getElementById("booking-participants").max), "6", "Legacy responses retain service maximum");
  await button(form.changeTime);
  await evaluate(() => window.phase2Fixture.refreshCapacity(99));
  await button(form.continue);
  assert.equal(await evaluate(() => document.getElementById("booking-participants").max), "6", "Slot capacity cannot exceed service maximum");
  assert.deepEqual(await evaluate(() => window.phase2Fixture.unexpected), []);
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []);
  console.log("Passed: group capacity review/validation/payload in en/lv/ru at desktop/tablet/phone widths; refreshed remaining capacity, retained participants, sold-out reset, legacy fallback, service limit and focus/reflow in isolated headless Chrome. All APIs mocked; no app server or database.");
} finally { await fixture.close(); }
