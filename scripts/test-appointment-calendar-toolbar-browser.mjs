import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";

const languages = ["en", "lv", "ru"];
const resources = Object.fromEntries(await Promise.all(languages.map(async language => [language, { translation: JSON.parse(await readFile(new URL(`../client/public/locales/${language}/translation.json`, import.meta.url), "utf8")) }])));
const fixture = await browserFixture({ entry: "scripts/fixtures/appointment-calendar.tsx", resources });
const { evaluate, until, viewport, visit, set } = fixture;
const engine = process.env.FORMS_BROWSER || "chrome", matrix = [];
async function layout() {
  return evaluate(() => {
    const range = document.querySelector('[data-testid="calendar-range"]');
    const navigation = document.querySelector('[data-testid="calendar-toolbar"]');
    const today = navigation.querySelector("button"), mode = navigation.querySelector("select"), date = navigation.querySelector("input");
    const toolbar = [today, mode, date].map(element => { const box = element.getBoundingClientRect(); return { left: box.left, top: box.top, right: box.right, height: box.height }; });
    const filters = [...document.querySelectorAll('[data-testid="appointment-filters"] select')];
    const row = filters[0].parentElement.parentElement.parentElement;
    const context = document.createElement("canvas").getContext("2d");
    return { fits: document.documentElement.scrollWidth <= innerWidth + 1,
      toolbar,
      visibleDateHeading: getComputedStyle(range).position !== "absolute" || range.getBoundingClientRect().width > 1,
      toolbarButtons: navigation.querySelectorAll("button").length,
      visibleFilterLabels: filters.some(field => getComputedStyle(field.labels[0]).position !== "absolute" || field.labels[0].getBoundingClientRect().width > 1),
      visibleTimezone: [...document.querySelectorAll('[data-testid="appointment-filters"] p')].some(element => element.getBoundingClientRect().height > 1),
      dateValue: date.value,
      filters: filters.map(field => {
        const style = getComputedStyle(field), box = field.getBoundingClientRect();
        context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        return { id: field.id, top: box.top, height: box.height, labelled: !!field.labels?.[0]?.textContent,
          fullText: context.measureText(field.selectedOptions[0].text).width <= field.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) + 1 };
      }), filterScroll: row.scrollWidth > row.clientWidth + 1,
    };
  });
}
try {
  for (const language of languages) {
    for (const width of [320, 360, 390, 545, 640, 768, 1024, 1440]) {
      await viewport(width, 900);
      await visit(`/my-services/appointments?lang=${language}&state=empty`);
      await until(() => !!document.querySelector('#appointment-employee'), "calendar filters loaded");
      await set("appointment-calendar-date", "2026-09-30");
      for (const mode of ["day", "week"]) {
        await set("appointment-calendar-mode", mode);
        for (const enlarged of [false, true]) {
          await evaluate(enlarged => { document.documentElement.style.fontSize = enlarged ? "32px" : "16px"; }, enlarged);
          const state = await layout(), label = `${engine}/${language}/${width}/${mode}/${enlarged}`;
          assert.equal(state.fits, true, label + ": page reflows");
          assert.equal(state.visibleDateHeading, false, label + ": long date is screen-reader-only");
          assert.equal(state.toolbarButtons, 1, label + ": Today is the sole toolbar button");
          assert.equal(state.visibleFilterLabels, false, label + ": dropdown labels are screen-reader-only");
          assert.equal(state.visibleTimezone, false, label + ": timezone line removed");
          assert.equal(state.dateValue, "2026-09-30");
          assert.ok(state.toolbar.every(control => control.left >= 0 && control.right <= width + 1 && control.height >= 44), label + ": toolbar controls remain visible");
          if (!enlarged) assert.ok(state.toolbar.every(control => Math.abs(control.top - state.toolbar[0].top) < 1), label + ": Today, Day/Week and date share a row");
          assert.equal(state.filters.length, 2);
          assert.ok(Math.abs(state.filters[0].top - state.filters[1].top) < 1, label + ": dropdowns share a row");
          assert.ok(state.filters.every(field => field.labelled && field.fullText && field.height >= 32), label + ": full selected filter labels and targets");
          if (!enlarged) assert.equal(state.filterScroll, false, label + ": default filters fit without scrolling");
          matrix.push({ language, width, mode, enlarged, ...state });
        }
        await evaluate(() => { document.documentElement.style.fontSize = "16px"; });
      }
      if ([360, 545, 1440].includes(width)) {
        await set("appointment-calendar-mode", "day");
        await set("appointment-calendar-date", "2026-11-03");
        await fixture.screenshot(`docs/appointment-calendar-toolbar-v2-${engine}-${language}-${width}.png`, false);
      }
      assert.deepEqual(await evaluate(() => window.phase2Fixture.unexpected), []);
    }
  }
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []);
  await writeFile(new URL(`../docs/appointment-calendar-toolbar-v2-${engine}-evidence.json`, import.meta.url), JSON.stringify({ date: "2026-11-03", browser: await fixture.api("Browser.getVersion"), languages, matrix,
    deferredLanguages: ["ar", "zh", "fr", "de", "hi", "ja", "pt", "es"],
    limits: "Synthetic mocked APIs, isolated loopback. CSS viewports and 200% root font size; no physical-device, native zoom or screen-reader certification. Enlarged toolbar controls may wrap; enlarged filters can scroll locally without clipping text." }, null, 2) + "\n");
  console.log(`Passed ${engine}: ${matrix.length} localized toolbar layout cases, Day/Week, 320–1440px and 200% text.`);
} catch (error) {
  console.error(await layout());
  await fixture.screenshot(`docs/appointment-calendar-toolbar-v2-${engine}-failure.png`, false).catch(() => {});
  throw error;
} finally { await fixture.close(); }
