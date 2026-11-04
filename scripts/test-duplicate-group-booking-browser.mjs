import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";

const languages = ["en", "lv", "ru"], resources = {};
for (const language of languages) resources[language] = { translation: JSON.parse(await readFile(`client/public/locales/${language}/translation.json`, "utf8")) };
const fixture = await browserFixture({ entry: "scripts/fixtures/booking-capacity.tsx", resources });
const { evaluate, until, visit, viewport, click, button, set, key } = fixture;
const duplicate = { serviceId: 7, seekerId: "synthetic-customer", status: "confirmed", scheduledDate: "2030-01-16T11:00:00+02:00" };
const existing = async rows => evaluate(rows => { window.phase2Fixture.existingBookings = rows; }, rows);
const prepare = async (language = "en", query = "") => {
  await visit(`/booking?duplicates=true&lang=${language}${query}`);
  await until(() => !!document.querySelector('button[name="day"]:not([disabled])'), "available day");
  await click('button[name="day"]:not([disabled])');
  await until(() => !!document.querySelector('button[aria-pressed="false"]'), "available time");
  await click('button[aria-pressed="false"]');
  await button(resources[language].translation.bookingForm.continue);
};
const warning = () => until(() => !!document.querySelector('[role="alertdialog"]'), "duplicate warning");
const writes = () => evaluate(() => window.phase2Fixture.writes);
try {
  for (const language of languages) {
    const t = resources[language].translation, submit = t.bookingForm.requestBooking;
    for (const width of [1280, 768, 375, 320]) {
      await viewport(width, 900); await prepare(language); await existing([duplicate]);
      await set("booking-participants", "2"); await set("booking-initial-message", "Keep this note");
      await button(submit); await warning();
      assert.deepEqual(await writes(), [], "Warning never creates a booking");
      assert.equal(await evaluate(() => document.querySelector('[role="alertdialog"] h2').textContent), t.bookingForm.duplicateTitle);
      assert.equal(await evaluate(() => document.getElementById(document.querySelector('[role="alertdialog"]').getAttribute("aria-describedby")).textContent), t.bookingForm.duplicateDescription);
      assert.equal(await evaluate(() => document.activeElement.textContent), t.common.cancel, "Cancel initially receives focus");
      assert.deepEqual(await evaluate(() => {
        const dialog = document.querySelector('[role="alertdialog"]');
        return { page: document.documentElement.scrollWidth <= innerWidth + 1, dialog: dialog.scrollWidth <= dialog.clientWidth + 1 };
      }), { page: true, dialog: true });
      await key("Tab"); assert.equal(await evaluate(() => !!document.activeElement.closest('[role="alertdialog"]')), true);
      await click('[data-testid="button-cancel-duplicate-booking"]');
      await until(() => !document.querySelector('[role="alertdialog"]'), "warning cancelled");
      assert.deepEqual(await writes(), []);
      assert.equal(await evaluate(() => document.getElementById("booking-initial-message").value), "Keep this note");
      assert.equal(await evaluate(() => document.getElementById("booking-participants").value), "2");
      await until(() => document.activeElement.tagName === "BUTTON" && !!document.activeElement.closest('[role="dialog"]'), "focus restored after warning closes");
      assert.equal(await evaluate(() => document.activeElement.textContent), submit, "Cancel returns focus to booking submit");
      await button(submit); await warning(); await key("Escape");
      await until(() => !document.querySelector('[role="alertdialog"]'), "Escape dismisses warning");
      assert.equal(await evaluate(() => window.phase2Fixture.closed), 0, "Escape keeps the booking form open");
      assert.deepEqual(await writes(), []);
      await button(submit); await warning(); await click('[data-testid="button-confirm-duplicate-booking"]');
      await until(() => window.phase2Fixture.writes.length === 1, "approved repeat booking");
      assert.deepEqual(await writes(), [{ path: "/api/bookings", body: { serviceId: 7, scheduledDate: "2030-01-16T09:00:00.000Z", participantCount: 2, initialMessage: "Keep this note" } }]);
      assert.deepEqual(await evaluate(() => window.phase2Fixture.unexpected), []);
    }
  }

  const t = resources.en.translation;
  for (const status of ["pending", "completed"]) {
    await prepare(); await existing([{ ...duplicate, status }]); await button(t.bookingForm.requestBooking); await warning(); assert.deepEqual(await writes(), []);
  }
  for (const row of [null, { ...duplicate, status: "cancelled" }, { ...duplicate, serviceId: 8 }, { ...duplicate, scheduledDate: "2030-01-16T10:00:00Z" }, { ...duplicate, seekerId: "other-customer" }]) {
    await prepare(); await existing(row ? [row] : []); await button(t.bookingForm.requestBooking);
    await until(() => window.phase2Fixture.writes.length === 1, "nonduplicate booking proceeds");
    assert.equal(await evaluate(() => !!document.querySelector('[role="alertdialog"]')), false);
  }
  await prepare("en", "&type=one_to_one"); await existing([duplicate]); await button(t.bookingForm.requestBooking);
  await until(() => window.phase2Fixture.writes.length === 1, "individual booking unchanged");
  assert.equal(await evaluate(() => window.phase2Fixture.reads.includes("/api/bookings/seeker")), false);

  await prepare("en", "&instant=true"); await existing([duplicate]); await button(t.booking.confirmBooking); await warning();
  await click('[data-testid="button-confirm-duplicate-booking"]'); await until(() => window.phase2Fixture.writes.length === 1, "instant repeat booking");

  for (const result of ["error", "invalid"]) {
    await prepare(); await existing([duplicate]);
    await evaluate(result => { window.phase2Fixture.checkResult = result; }, result);
    await button(t.bookingForm.requestBooking);
    await until(() => [...document.querySelectorAll('[role="alert"]')].some(node => node.textContent.includes("check your existing bookings")), "booking lookup error");
    assert.deepEqual(await writes(), [], "Failed lookup never silently bypasses confirmation");
    await evaluate(() => { window.phase2Fixture.checkResult = "success"; });
    await button(t.bookingForm.requestBooking); await warning();
  }

  await prepare(); await existing([duplicate]);
  await evaluate(() => { window.phase2Fixture.checkResult = "pending"; });
  await button(t.bookingForm.requestBooking);
  assert.equal(await evaluate(text => [...document.querySelectorAll('button')].find(node => node.textContent === text).disabled, t.bookingForm.requestBooking), true, "Submit disabled during lookup");
  await evaluate(() => { window.phase2Fixture.switchUser("other-customer"); window.phase2Fixture.releaseCheck(); });
  await until(() => !document.getElementById("booking-participants"), "account change resets booking form");
  assert.deepEqual(await writes(), [], "Late lookup from old account cannot submit");
  assert.equal(await evaluate(() => !!document.querySelector('[role="alertdialog"]')), false);

  await prepare(); await existing([duplicate]); await button(t.bookingForm.requestBooking); await warning(); await click('[data-testid="button-cancel-duplicate-booking"]');
  await until(() => !document.querySelector('[role="alertdialog"]'), "warning closes before changing time");
  await button(t.bookingForm.changeTime);
  await until(() => !!document.querySelector('button[aria-pressed="false"]'), "alternative time reloads after changing review");
  await click('button[aria-pressed="false"]'); await button(t.bookingForm.continue); await button(t.bookingForm.requestBooking);
  await until(() => window.phase2Fixture.writes.length === 1, "different time proceeds without old warning");
  assert.equal((await writes())[0].body.scheduledDate, "2030-01-16T10:00:00.000Z");

  await prepare(); await existing([duplicate]);
  await evaluate(() => { window.phase2Fixture.bookingResult = "error"; });
  await button(t.bookingForm.requestBooking); await warning(); await click('[data-testid="button-confirm-duplicate-booking"]');
  await until(() => [...document.querySelectorAll('[role="alert"]')].some(node => node.textContent.length), "booking save error");
  await until(() => !document.querySelector('[role="alertdialog"]'), "warning closes after confirmation");
  await button(t.bookingForm.requestBooking); await warning();
  assert.equal((await writes()).length, 1, "Failed save requires fresh confirmation on retry");

  if (process.env.DUPLICATE_SCREENSHOT) await fixture.screenshot(process.env.DUPLICATE_SCREENSHOT);
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []);
  console.log((await fixture.api("Browser.getVersion")).product);
  console.log("Passed: duplicate group booking approval/cancel/Escape, retained drafts/focus, en/lv/ru at 1280/768/375/320px, matching instants/statuses/identity, unchanged ordinary/individual bookings, instant/request flows, failed lookup/retry, account switch, time change and failed-save reconfirmation. APIs mocked; no app server/database.");
} finally { await fixture.close(); }
