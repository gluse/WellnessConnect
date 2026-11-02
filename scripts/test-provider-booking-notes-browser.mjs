import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";

const languages = ["en", "lv", "ru"], resources = {};
for (const language of languages) resources[language] = { translation: JSON.parse(await readFile(`client/public/locales/${language}/translation.json`, "utf8")) };
const fixture = await browserFixture({ entry: "scripts/fixtures/provider-booking-notes.tsx", resources });
const { evaluate, until, visit, viewport, click, button, set } = fixture;
const note = 'Lūdzu, sagatavojiet paklājiņu.\nПожалуйста, позвоните перед встречей.\n<img src=x onerror="window.noteExecuted=true">\n' + "LongWord".repeat(35);
const book = async (language, query = "", notes = note) => {
  const t = resources[language].translation;
  await visit(`/booking?lang=${language}${query}`);
  await until(() => !!document.querySelector('button[name="day"]:not([disabled])'), "available day");
  await click('button[name="day"]:not([disabled])');
  await until(() => !!document.querySelector('button[aria-pressed="false"]'), "available time");
  await click('button[aria-pressed="false"]'); await button(t.bookingForm.continue);
  await set("booking-notes", notes);
  await button(query.includes("instant") ? t.booking.confirmBooking : t.bookingForm.requestBooking);
  await until(() => window.phase2Fixture.writes.length === 1, "booking saved in fixture");
  await until(() => !document.getElementById("booking-notes"), "booking success");
  await button(t.common.close);
  await until(() => !document.querySelector('[role="dialog"]'), "booking dialog closes");
  await click("#fixture-provider-view");
  await until(() => !!document.querySelector("article"), "provider booking loaded");
  if (await evaluate(() => !!document.querySelector('[data-testid="event-toggle-1"]'))) await click('[data-testid="event-toggle-1"]');
  if (await evaluate(() => !!document.querySelector('[data-testid="booking-notes-toggle-1"]'))) await click('[data-testid="booking-notes-toggle-1"]');
};
try {
  for (const language of languages) {
    await viewport(1280, 900); await book(language);
    assert.equal(await evaluate(() => window.phase2Fixture.writes[0].body.notes), note);
    for (const width of [1280, 768, 375, 320]) {
      await viewport(width, 900);
      assert.deepEqual(await evaluate(() => {
        const text = document.querySelector('[data-testid="text-booking-notes-1"]'), section = text?.closest("section");
        return { note: text?.textContent, label: section && document.getElementById(section.getAttribute("aria-labelledby"))?.textContent,
          whitespace: text && getComputedStyle(text).whiteSpace, textVisible: !!text?.getBoundingClientRect().height,
          safe: !section?.querySelector("img,script,a"), executed: !!window.noteExecuted,
          pageFits: document.documentElement.scrollWidth <= innerWidth + 1 };
      }), { note, label: resources[language].translation.provider.customerNotes, whitespace: "pre-wrap", textVisible: true, safe: true, executed: false, pageFits: true });
    }
    if (language === "en" && process.env.NOTES_SCREENSHOT) await fixture.screenshot(process.env.NOTES_SCREENSHOT);
    for (const notes of [null, "", "  \n  "]) {
      await evaluate(notes => window.phase2Fixture.replaceNotes(notes), notes);
      await until(() => !document.querySelector('[data-testid="text-booking-notes-1"]'), "empty notes omitted");
    }
    await evaluate(notes => window.phase2Fixture.replaceNotes(notes), note);
    await until(() => !!document.querySelector('[data-testid="text-booking-notes-1"]'), "notes refresh");
    await click("#fixture-customer-view");
    assert.equal(await evaluate(() => !!document.querySelector('[data-testid="text-booking-notes-1"]')), false, "Provider-specific notes section does not leak into customer layout");
    assert.deepEqual(await evaluate(() => window.phase2Fixture.unexpected), []);
  }
  await book("en", "&type=group&instant=true&viewer=true", "Group booking note");
  assert.equal(await evaluate(() => document.querySelector('[data-testid="text-booking-notes-1"]').textContent), "Group booking note", "Authorized read-only provider sees notes on instant group booking");
  assert.equal(await evaluate(() => [...document.querySelectorAll('button')].some(node => node.textContent === "Mark complete")), false);
  await book("en", "", "");
  assert.equal(await evaluate(() => window.phase2Fixture.writes[0].body.notes), null);
  assert.equal(await evaluate(() => !!document.querySelector('[data-testid="text-booking-notes-1"]')), false);
  assert.deepEqual(await evaluate(() => window.phase2Fixture.unexpected), []);
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []);
  console.log((await fixture.api("Browser.getVersion")).product);
  console.log("Passed: customer booking form to provider appointment notes with mocked APIs; en/lv/ru at 1280/768/375/320px, localized label, multiline Unicode, long-word reflow, safe plain text, empty/updated notes, customer layout exclusion, instant group/read-only provider and ordinary pending bookings. No app server/database.");
} finally { await fixture.close(); }
