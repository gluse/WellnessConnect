import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";

const languages = ["en", "lv", "ru"];
const resources = Object.fromEntries(await Promise.all(languages.map(async language => [language, { translation: JSON.parse(await readFile(new URL(`../client/public/locales/${language}/translation.json`, import.meta.url), "utf8")) }])));
const fixture = await browserFixture({ entry: "scripts/fixtures/appointment-calendar.tsx", resources });
const { evaluate, until, visit, viewport, set } = fixture;
const engine = process.env.FORMS_BROWSER || "chrome", checks = [];
const artifactPrefix = process.env.APPOINTMENT_CALENDAR_SWIPE_ARTIFACT_PREFIX || "appointment-calendar-swipe";
assert.match(artifactPrefix, /^[a-z0-9-]+$/);
const grid = '[data-testid="calendar-scroll"]';
const headings = `${grid} > div > div:first-child`;
const currentDate = () => evaluate(() => document.querySelector('#appointment-calendar-date').value);
const frame = () => evaluate(() => new Promise(requestAnimationFrame));
if (engine === "chrome") await fixture.api("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });

async function points(selector, dx, dy) {
  return evaluate(async ({ selector, dx, dy }) => {
    const element = document.querySelector(selector); element.scrollIntoView({ block: "center", inline: "nearest" });
    await new Promise(requestAnimationFrame);
    const rect = element.getBoundingClientRect();
    const left = Math.max(28, rect.left + 12), right = Math.min(innerWidth - 28, rect.right - 12);
    const middle = (left + right) / 2;
    const x = dx < 0 ? Math.min(right, middle + Math.abs(dx) / 2) : Math.max(left, middle - Math.abs(dx) / 2);
    const y = Math.max(100 + Math.max(0, -dy), Math.min(innerHeight - 110 - Math.max(0, dy), rect.y + rect.height / 2));
    return { x, y, dx, dy };
  }, { selector, dx, dy });
}
async function swipe(selector, dx, dy = 0, syntheticOnly = false, finish = "touchend") {
  const path = await points(selector, dx, dy);
  if (engine === "chrome" && !syntheticOnly) {
    await fixture.api("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: path.x, y: path.y, id: 1 }] });
    for (let step = 1; step <= 8; step++) {
      await fixture.api("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: path.x + dx * step / 8, y: path.y + dy * step / 8, id: 1 }] });
      await frame();
    }
    await fixture.api("Input.dispatchTouchEvent", { type: finish === "touchcancel" ? "touchCancel" : "touchEnd", touchPoints: [] });
    await frame(); return;
  }
  return evaluate(async ({ x, y, dx, dy, finish }) => {
    const target = document.elementFromPoint(x, y);
    const dispatch = (name, touches, changedTouches) => {
      const event = new Event(name, { bubbles: true, cancelable: true });
      Object.defineProperties(event, { touches: { value: touches }, changedTouches: { value: changedTouches } });
      target.dispatchEvent(event); return event.defaultPrevented;
    };
    const start = { identifier: 1, clientX: x, clientY: y }, end = { identifier: 1, clientX: x + dx, clientY: y + dy };
    dispatch("touchstart", [start], [start]);
    const prevented = dispatch("touchmove", [end], [end]);
    dispatch(finish, [], [end]); await new Promise(requestAnimationFrame);
    return prevented;
  }, { ...path, finish });
}

try {
  for (const language of languages) for (const width of [360, 768]) {
    await viewport(width, 900); await visit(`/my-services/appointments?lang=${language}`);
    await until(() => !!document.querySelector('[data-testid="appointment-filters"]'), "appointments ready");
    await until(() => !!document.querySelector('[data-testid="appointment-calendar"]'), "calendar ready");
    await set("appointment-calendar-mode", "day");
    await set("provider-appointment-status", "pending");
    await swipe(grid, -120);
    await until(() => document.querySelector('#appointment-calendar-date').value === "2026-11-04", "swipe left advances one day");
    await swipe(grid, 120);
    await until(() => document.querySelector('#appointment-calendar-date').value === "2026-11-03", "swipe right returns one day");
    assert.equal(await evaluate(() => document.querySelector('#provider-appointment-status').value), "pending");

    const before = await currentDate();
    await swipe(grid, -35); assert.equal(await currentDate(), before, "Short drags do not navigate");
    await evaluate(() => { document.querySelector('[data-testid="calendar-scroll"]').scrollTop = 350; });
    const scrollBefore = await evaluate(() => document.querySelector('[data-testid="calendar-scroll"]').scrollTop);
    const vertical = await swipe(grid, -20, -140);
    assert.equal(await currentDate(), before, "Vertical/diagonal scrolling does not navigate");
    if (engine === "chrome") await until(() => document.querySelector('[data-testid="calendar-scroll"]').scrollTop > 370, "native touch still scrolls the time grid vertically");
    else { assert.equal(vertical, false, "Vertical touch move is not prevented"); assert.equal(scrollBefore, 350); }
    assert.equal(await swipe('#appointment-calendar-mode', -120, 0, true), false, "Form controls keep their native touch behavior");
    assert.equal(await currentDate(), before);
    await swipe(grid, -120, 0, true, "touchcancel"); assert.equal(await currentDate(), before, "Cancelled gestures do not navigate");
    await evaluate(() => {
      const target = document.querySelector('[data-testid="calendar-scroll"]');
      const a = { identifier: 1, clientX: 180, clientY: 300 }, b = { identifier: 2, clientX: 220, clientY: 300 };
      const dispatch = (type, touches, changedTouches) => { const event = new Event(type, { bubbles: true, cancelable: true }); Object.defineProperties(event, { touches: { value: touches }, changedTouches: { value: changedTouches } }); target.dispatchEvent(event); if (event.defaultPrevented) throw Error("Pinch/multitouch must remain native"); };
      dispatch("touchstart", [a, b], [a, b]); dispatch("touchmove", [{ ...a, clientX: 60 }, b], [a, b]); dispatch("touchend", [], [a, b]);
    });
    assert.equal(await currentDate(), before, "Multitouch does not navigate");

    await set("appointment-calendar-mode", "week");
    await swipe(headings, -120);
    await until(() => document.querySelector('#appointment-calendar-date').value === "2026-11-10", "heading swipe advances a week");
    await evaluate(() => document.querySelector('[data-testid="calendar-scroll"] [data-calendar-swipe-navigation]').dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 })));
    assert.equal(await evaluate(() => document.querySelector('#appointment-calendar-mode').value), "week", "Swipe must not also select a heading/day");
    await swipe(headings, 120);
    await until(() => document.querySelector('#appointment-calendar-date').value === "2026-11-03", "heading swipe returns a week");
    if (width === 360) {
      await evaluate(() => { document.querySelector('[data-testid="calendar-scroll"]').scrollLeft = 0; });
      const panned = await swipe(grid, -120);
      assert.equal(await currentDate(), before, "Week body keeps native horizontal panning before its edge");
      if (engine === "chrome") await until(() => document.querySelector('[data-testid="calendar-scroll"]').scrollLeft > 0, "native weekly grid pans horizontally");
      else assert.equal(panned, false, "Weekly grid panning is not prevented");
      await evaluate(() => { const element = document.querySelector('[data-testid="calendar-scroll"]'); element.scrollLeft = element.scrollWidth; });
      await swipe(grid, -120);
      await until(() => document.querySelector('#appointment-calendar-date').value === "2026-11-10", "overswipe at week edge advances period");
    }

    await set("appointment-calendar-date", "2026-12-31"); await set("appointment-calendar-mode", "day");
    await swipe(grid, -120);
    await until(() => document.querySelector('#appointment-calendar-date').value === "2027-01-01", "swipe crosses year boundary");
    checks.push({ language, width, day: true, week: true, filters: true, smallVerticalCancelledMultiTouch: true });
    assert.deepEqual(await evaluate(() => window.phase2Fixture.unexpected), []);
  }

  await viewport(390, 900); await set("appointment-calendar-mode", "day"); await set("provider-appointment-status", "all");
  await set("appointment-calendar-date", "2026-11-03");
  await swipe('[data-testid="calendar-event-2"]', -120);
  await until(() => document.querySelector('#appointment-calendar-date').value === "2026-11-04", "swipe starting on an event navigates");
  assert.equal(await evaluate(() => document.querySelectorAll('[role="dialog"][data-state="open"]').length), 0, "Swiping must not open appointment details");
  await set("appointment-calendar-date", "2026-11-03");
  if (engine === "chrome") {
    const tap = await points('[data-testid="calendar-event-2"]', 0, 0);
    await fixture.api("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: tap.x, y: tap.y, id: 1 }] });
    await fixture.api("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } else {
    await swipe('[data-testid="calendar-event-2"]', 0, 0);
    await fixture.click('[data-testid="calendar-event-2"]');
  }
  await until(() => !!document.querySelector('[role="dialog"] [data-testid="appointment-2"]'), "Tap following swipe still opens details");
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []);
  await writeFile(new URL(`../docs/${artifactPrefix}-${engine}-evidence.json`, import.meta.url), JSON.stringify({ date: "2026-11-03", browser: await fixture.api("Browser.getVersion"), languages, checks, input: engine === "chrome" ? "Native CDP touch input plus DOM multitouch/cancel guards" : "DOM touch-event injection; layout/details via browser input", limits: "Offline synthetic fixture only. No connected app/database. Physical mobile devices and OS gestures not verified; other locales/RTL deferred." }, null, 2) + "\n");
  console.log(`Passed ${engine}: six en/lv/ru phone/tablet swipe cases, day/week/edge navigation, gesture exclusions and tap preservation.`);
} catch (error) {
  console.error(await evaluate(() => ({ date: document.querySelector('#appointment-calendar-date')?.value, mode: document.querySelector('#appointment-calendar-mode')?.value, scroll: document.querySelector('[data-testid="calendar-scroll"]')?.scrollLeft, unexpected: window.phase2Fixture?.unexpected })));
  throw error;
} finally { await fixture.close(); }
