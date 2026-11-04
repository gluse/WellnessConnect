import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";

// Real creation/provider/customer components; synthetic fetch/auth/persistence.
const languages = ["en", "lv", "ru"], resources = {};
for (const language of languages) resources[language] = { translation: JSON.parse(await readFile(`client/public/locales/${language}/translation.json`, "utf8")) };
const fixture = await browserFixture({ entry: "scripts/fixtures/provider-booking-notes.tsx", resources });
const { evaluate, until, visit, viewport, click, button, set, key } = fixture;
const text = 'Lūdzu, sagatavojiet paklājiņu.\nПожалуйста, позвоните перед встречей.\n<img src=x onerror="window.messageExecuted=true">\n' + "LongWord".repeat(35);
const prepare = async (language = "en", query = "") => {
  await visit(`/booking?lang=${language}${query}`);
  await until(() => !!document.querySelector('button[name="day"]:not([disabled])'), "available day");
  await click('button[name="day"]:not([disabled])');
  await until(() => !!document.querySelector('button[aria-pressed="false"]'), "available time");
  await click('button[aria-pressed="false"]'); await button(resources[language].translation.bookingForm.continue);
};
const finish = async (language = "en", instant = false) => {
  await button(instant ? resources[language].translation.booking.confirmBooking : resources[language].translation.bookingForm.requestBooking);
  await until(() => !document.getElementById("booking-initial-message"), "booking success");
  await button(resources[language].translation.common.close);
  await until(() => !document.querySelector('[role="dialog"]'), "booking dialog closes");
};
const providerConversation = async () => {
  await click("#fixture-provider-view"); await until(() => !!document.querySelector("article"), "provider booking loaded");
  if (await evaluate(() => !!document.querySelector('[data-testid="event-toggle-1"]'))) await click('[data-testid="event-toggle-1"]');
  await evaluate(() => window.phase2Fixture.replaceNotes("Legacy private note must be ignored"));
  assert.equal(await evaluate(() => !!document.querySelector('[data-testid^="booking-notes-"], [data-testid^="text-booking-notes-"]') || document.body.textContent.includes("Legacy private note")), false, "Historical notes have no UI or fallback message");
  await click('[data-testid="booking-messages-1"]');
  await until(() => !!document.querySelector('[role="dialog"]'), "provider conversation");
};
const closeConversation = async () => { await key("Escape"); await until(() => !document.querySelector('[role="dialog"]'), "conversation closes"); };
try {
  for (const language of languages) {
    const t = resources[language].translation;
    await viewport(320, 900); await prepare(language);
    assert.deepEqual(await evaluate(() => {
      const input = document.getElementById("booking-initial-message");
      return { max: input.maxLength, label: document.querySelector('label[for="booking-initial-message"]').textContent,
        help: document.getElementById(input.getAttribute("aria-describedby")).textContent, fits: document.documentElement.scrollWidth <= innerWidth + 1 };
    }), { max: 4000, label: t.bookingForm.initialMessage, help: t.bookingForm.initialMessageHelp, fits: true });
    if (language === "en" && process.env.MESSAGE_SCREENSHOT) await fixture.screenshot(process.env.MESSAGE_SCREENSHOT.replace(/\.png$/, "-form.png"));
    await set("booking-initial-message", `  ${text}\n `); await finish(language);
    assert.deepEqual(await evaluate(() => window.phase2Fixture.writes[0]), { path: "/api/bookings", body: { serviceId: 7, scheduledDate: "2030-01-16T09:00:00.000Z", participantCount: 1, initialMessage: text } });
    assert.equal(await evaluate(() => window.phase2Fixture.writes.length), 1, "One creation request; no second message request");
    await providerConversation(); await until(() => document.querySelectorAll('[role="dialog"] article').length === 1, "initial message loaded");
    for (const width of [1280, 768, 375, 320]) {
      await viewport(width, 900);
      assert.deepEqual(await evaluate(() => {
        const article = document.querySelector('[role="dialog"] article'), body = article?.querySelector('p[dir="auto"]');
        return { text: body?.textContent, whitespace: body && getComputedStyle(body).whiteSpace,
          safe: !article?.querySelector("img,script,a"), executed: !!window.messageExecuted,
          fits: document.documentElement.scrollWidth <= innerWidth + 1, customer: article?.textContent.includes("Synthetic Customer") };
      }), { text, whitespace: "pre-wrap", safe: true, executed: false, fits: true, customer: true });
    }
    if (language === "en" && process.env.MESSAGE_SCREENSHOT) await fixture.screenshot(process.env.MESSAGE_SCREENSHOT);
    await set("booking-message-body", "Provider reply"); await button(t.appointmentCollaboration.send);
    await until(() => document.querySelectorAll('[role="dialog"] article').length === 2, "provider reply");
    await closeConversation(); await until(() => document.activeElement?.getAttribute("data-testid") === "booking-messages-1", "provider trigger focus restored");
    await click("#fixture-customer-view"); await button(t.appointmentCollaboration.messageProvider);
    await until(() => document.querySelectorAll('[role="dialog"] article').length === 2, "customer sees same thread");
    assert.equal(await evaluate(() => document.querySelector('[role="dialog"]').textContent.includes("Provider reply")), true);
    await set("booking-message-body", "Customer reply"); await button(t.appointmentCollaboration.send);
    await until(() => document.querySelectorAll('[role="dialog"] article').length === 3, "customer reply");
    await closeConversation(); assert.deepEqual(await evaluate(() => window.phase2Fixture.unexpected), []);
  }
  const t = resources.en.translation;
  await prepare(); await set("booking-initial-message", "Keep this draft");
  await evaluate(() => { window.phase2Fixture.failBooking = true; }); await button(t.bookingForm.requestBooking);
  await until(() => !!document.querySelector('[role="alert"]'), "save failure visible");
  assert.equal(await evaluate(() => document.getElementById("booking-initial-message").value), "Keep this draft");
  assert.equal(await evaluate(() => window.phase2Fixture.writes.length), 1, "Failed creation is not automatically retried");
  await finish(); await providerConversation(); await until(() => document.querySelectorAll('[role="dialog"] article').length === 1, "only successful attempt saved");
  await closeConversation();
  for (const value of ["", "  \n  ", "Initial message visible to a read-only provider"]) {
    await prepare("en", "&type=group&instant=true&viewer=true"); await set("booking-initial-message", value); await finish("en", true);
    assert.equal(await evaluate(() => window.phase2Fixture.writes[0].body.initialMessage), value.trim() || null);
    await evaluate(value => { window.phase2Fixture.emptyText = value; }, t.appointmentCollaboration.emptyMessages);
    await providerConversation();
    if (value.trim()) await until(() => document.querySelector('[role="dialog"]').textContent.includes("Initial message visible to a read-only provider"), "Read-only initial message");
    else await until(() => document.querySelector('[role="dialog"]').textContent.includes(window.phase2Fixture.emptyText), "empty conversation");
    assert.equal(await evaluate(() => document.querySelectorAll('[role="dialog"] article').length), value.trim() ? 1 : 0);
    assert.equal(await evaluate(() => !!document.querySelector('[role="dialog"] form, #booking-message-body')), false, "Read-only provider has no composer"); await closeConversation();
  }
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []);
  console.log((await fixture.api("Browser.getVersion")).product);
  console.log("Passed: creation -> provider/customer conversation/replies, one request, en/lv/ru labels/help, 4000 limit, 1280/768/375/320 reflow, multiline safe text, focus, failed-save draft/retry, blank/instant group/read-only and ignored historical notes. APIs mocked; no app server/database.");
} finally { await fixture.close(); }
