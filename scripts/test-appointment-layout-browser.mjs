import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";

const languages = ["en", "lv", "ru"];
const resources = Object.fromEntries(await Promise.all(languages.map(async language => [language, { translation: JSON.parse(await readFile(new URL(`../client/public/locales/${language}/translation.json`, import.meta.url), "utf8")) }])));
for (const language of languages) {
  const entries = Object.entries(resources[language].translation.appointmentAgenda);
  assert.deepEqual(entries.map(([key]) => key), Object.keys(resources.en.translation.appointmentAgenda));
  for (const [key, text] of entries) { assert.ok(text.trim()); assert.deepEqual(text.match(/{{\w+}}/g), resources.en.translation.appointmentAgenda[key].match(/{{\w+}}/g)); }
}
const zoom = Boolean(process.env.APPOINTMENT_LAYOUT_ZOOM);
const fixture = await browserFixture({ entry: "scripts/fixtures/appointment-layout.tsx", resources, ...(zoom ? { nativeZoom: 4 } : {}) });
const { evaluate, until, viewport, visit, button, click, set } = fixture;
const engine = process.env.FORMS_BROWSER || "chrome", matrix = [], checks = [], screenshots = [];
const artifactPrefix = process.env.APPOINTMENT_LAYOUT_ARTIFACT_PREFIX || "appointment-layout";
assert.match(artifactPrefix, /^[a-z0-9-]+$/);
const open = async (area, language, state = "success", path = "/my-services/upcoming-appointments") => {
  await visit(`${area === "provider" ? path : "/my-bookings"}?lang=${language}&state=${state}`);
  await until(() => !!document.querySelector("main h1"), "page loaded");
  await evaluate(labels => { window.phase2Fixture.labels = labels; }, resources[language].translation.appointmentAgenda);
  if (state === "success") await until(() => document.querySelectorAll("main article[data-testid]").length > 0, "appointment cards loaded");
};
const reflow = async () => assert.equal(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, "page fits viewport");
try {
  for (const language of languages) {
    const labels = resources[language].translation.appointmentAgenda;
    for (const area of ["provider", "customer"]) {
      for (const [width, height] of zoom ? [[null, null]] : [[320, 800], [390, 844], [768, 900], [1280, 900]]) {
        if (!zoom) await viewport(width, height);
        await open(area, language);
        await reflow();
        assert.equal(await evaluate(() => document.querySelectorAll("main h1").length), 1);
        assert.equal(await evaluate(() => document.querySelector("main h1").textContent), area === "provider" ? resources[language].translation.providerNavigation.upcomingAppointments : resources[language].translation.notifications.appointments);
        assert.equal(await evaluate(label => !!document.querySelector(`main [role="group"][aria-label="${label}"]`), labels.view), area !== "provider");
        assert.equal(await evaluate(() => [...document.querySelectorAll("main h2,main h3,main h4")].some(node => node.textContent === document.querySelector("main h1").textContent)), false, "no duplicated appointment heading");
        assert.equal(await evaluate(() => [...document.querySelectorAll("main button,main a")].some(node => ["My Services", "My Bookings"].includes(node.textContent.trim()))), false, "no extra area buttons above heading");
        assert.equal(await evaluate(() => getComputedStyle(document.querySelector("[data-appointment-area]")).backgroundColor), area === "provider" ? "rgb(240, 238, 255)" : "rgb(234, 247, 243)");
        const cards = await evaluate(() => [...document.querySelectorAll("main article[data-testid]")].map(card => ({
          dates: card.querySelectorAll('[data-testid="appointment-date-time"] time').length,
          datetime: card.querySelector('[data-testid="appointment-date-time"] time')?.getAttribute("datetime"),
          dateLabel: card.querySelector('[data-testid="appointment-date-time"] time')?.textContent,
          background: getComputedStyle(card).backgroundColor,
        })));
        assert.equal(cards.length, area === "provider" ? 3 : 4);
        for (const card of cards) { assert.equal(card.dates, 1); assert.ok(card.datetime); assert.equal(card.background, "rgb(255, 255, 255)"); }
        assert.equal(cards[0].dateLabel, new Intl.DateTimeFormat(language, { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date("2030-01-16T10:30:00Z")));
        assert.equal(await evaluate(() => [...document.querySelectorAll("main time")].every(node => !!node.closest("article"))), true, "dates are inside cards");
        const gap = await evaluate(() => { const cards = [...document.querySelectorAll("main article[data-testid]")]; return cards[1].getBoundingClientRect().top - cards[0].getBoundingClientRect().bottom; });
        assert.ok(Math.abs(gap - 12) < 1, "consecutive cards use compact gaps");
        const summary = await evaluate(() => document.querySelector('[data-testid="appointment-summary"]') ? [...document.querySelectorAll('[data-testid="appointment-summary"] dd')].map(node => node.textContent) : null);
        assert.deepEqual(summary, null);
        matrix.push({ language, area, width: await evaluate(() => innerWidth), height: await evaluate(() => innerHeight), nativeZoom: zoom ? 4 : 1 });
        if ((width === 390 && language === "en") || (zoom && language === "ru")) {
          const file = `docs/${artifactPrefix}-${engine}-${area}${zoom ? "-zoom400" : ""}.png`;
          await fixture.screenshot(file); screenshots.push(file);
        }
        assert.deepEqual(await evaluate(() => window.phase2Fixture.unexpected), []);
      }
      if (area === "provider") await open(area, language, "success", "/my-services/past-appointments");
      else await button(labels.past);
      await until(() => document.querySelectorAll("main article[data-testid]").length === 1, "past filter shows cancelled booking");
      if (area === "customer") {
      await button(labels.date);
      await until(() => !!document.querySelector("main table"), "calendar appears");
      await evaluate(() => { const day = [...document.querySelectorAll('button[name="day"]')].find(node => node.textContent === "16" && !node.disabled); if (!day) throw Error("Calendar day missing"); day.id = "layout-calendar-day"; });
      await click("#layout-calendar-day");
      await until(() => document.querySelectorAll("main article[data-testid]").length === 1, "calendar filters chosen day");
      assert.equal(await evaluate(() => document.querySelector("main article time").getAttribute("datetime")), "2030-01-16T10:30:00.000Z");
      await reflow();
      await button(labels.upcoming);
      } else await open(area, language);
      await set(area === "provider" ? "provider-appointment-status" : "seeker-appointment-status", "pending");
      await until(() => document.querySelectorAll("main article[data-testid]").length === 2, "status filter matches standalone and group");
      if (area === "provider") {
        await click('[data-testid="event-toggle-3"]');
        await until(() => !!document.querySelector('[data-testid="event-booking-4"]'), "group expands");
        assert.equal(await evaluate(() => document.querySelectorAll('[data-testid="group-event-3"] [data-testid^="event-booking-"]').length), 2, "full group context remains available");
        assert.equal(await evaluate(() => document.querySelectorAll('[data-testid="group-event-3"] [data-testid="appointment-date-time"]').length), 1, "group date appears once");
        await reflow();
      }
      checks.push(`${language}/${area}: localized page heading; no extra area buttons; white dated cards; distinct background; compact gaps; no summary; status/history${area === "provider" ? "; separate pages without view tabs; group disclosure/full context" : "; date picker"}`);
      await open(area, language, "empty");
      await until(() => document.body.textContent.includes(window.phase2Fixture.labels.empty), "empty state localized");
      await open(area, language, "loading");
      await until(() => document.body.textContent.includes(window.phase2Fixture.labels.loading), "loading state localized");
      await evaluate(() => { window.phase2Fixture.state = "success"; window.phase2Fixture.release(); });
      await until(() => !!document.querySelector("main article"), "loading resolves");
      await open(area, language, "error");
      await until(() => !!document.querySelector('main [role="alert"]'), "error visible");
      assert.equal(await evaluate(() => document.querySelectorAll("main article[data-testid]").length), 0);
      assert.equal(await evaluate(() => document.querySelectorAll("main h1").length), 1, "error keeps heading/focus target");
      await reflow();
      assert.deepEqual(await evaluate(() => window.phase2Fixture.unexpected), []);
    }
  }
  if (zoom) assert.ok(await evaluate(() => devicePixelRatio >= 3.9 && innerWidth <= 320), "native 400% zoom is active");
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []);
  await writeFile(new URL(`../docs/${artifactPrefix}-${engine}${zoom ? "-zoom400" : ""}-evidence.json`, import.meta.url), JSON.stringify({ date: "2026-11-03", browser: await fixture.api("Browser.getVersion"), languages, matrix, checks, screenshots, deferredLanguages: ["ar", "zh", "fr", "de", "hi", "ja", "pt", "es"], limits: "Actual application header and provider/customer pages. Synthetic GET mocks; unexpected requests rejected; external network blocked. No real services/session/database writes. Physical devices, screen readers and native-language review unverified." }, null, 2) + "\n");
  console.log(`Passed appointment layout ${engine}${zoom ? " 400%" : ""}: ${checks.length} behavior groups, ${matrix.length} en/lv/ru viewport cases.`);
} finally { await fixture.close(); }
