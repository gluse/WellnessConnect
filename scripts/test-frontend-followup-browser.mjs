import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";

const languages = ["en", "lv", "ru"], resources = {};
for (const language of languages) resources[language] = { translation: JSON.parse(await readFile(`client/public/locales/${language}/translation.json`, "utf8")) };
for (const language of languages) {
  const messages = resources[language].translation.frontendFollowup, canonical = resources.en.translation.frontendFollowup;
  assert.deepEqual(Object.keys(messages).sort(), Object.keys(canonical).sort());
  for (const [key, value] of Object.entries(messages)) { assert.ok(value.trim()); assert.deepEqual(value.match(/{{\w+}}/g), canonical[key].match(/{{\w+}}/g)); }
}
const avatar = 'https://synthetic.invalid/avatar.svg', brokenAvatar = 'https://synthetic.invalid/broken.svg';
const fixture = await browserFixture({ entry: "scripts/fixtures/frontend-followup.tsx", resources, imageAssets: {
  [avatar]: { body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#315d50"/><circle cx="32" cy="24" r="12" fill="#e3b184"/><path d="M8 64a24 24 0 0 1 48 0" fill="#e3b184"/></svg>' },
  [brokenAvatar]: { status: 404, body: '' },
} });
const { evaluate, until, visit, viewport, set, button, click, key } = fixture;
const output = "output/frontend-followup-2026-11-11/chrome";
await mkdir(output, { recursive: true });
const checks = [], matrix = [];
let sequence = 0;
const open = (mode, extra = "") => visit(`/${mode === "inbox" ? "inbox" : ""}?mode=${mode}&scope=all&tab=notifications&case=${++sequence}&${extra}`);
const writes = () => evaluate(() => window.followupFixture.writes);
const config = values => evaluate(values => Object.assign(window.followupFixture, values), values);
const noOverflow = async () => assert.equal(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, "page reflow " + JSON.stringify(await evaluate(() => [...document.querySelectorAll('body *')].filter(node => node.getBoundingClientRect().right > innerWidth + 1).map(node => ({ tag: node.tagName, cls: node.className, text: node.textContent.slice(0, 80), width: node.getBoundingClientRect().width })).slice(-8))));
try {
  await viewport(1280); await open("availability"); await until(() => !!document.getElementById("availability-mode"));
  await set("availability-service", "7");
  await set("availability-end-date", "2030-05-10");
  await config({ result: "error" }); await button(resources.en.translation.operationsForm.saveWeek);
  await until(() => !!document.querySelector('[role="alert"]'));
  assert.equal(await evaluate(() => document.getElementById('availability-end-date').value), "2030-05-10");
  await evaluate(() => window.followupFixture.refresh());
  assert.equal(await evaluate(() => document.getElementById('availability-end-date').value), "2030-05-10");
  await config({ result: "pending" }); await button(resources.en.translation.operationsForm.saveWeek);
  await until(() => !!window.followupFixture.release);
  assert.equal(await evaluate(() => document.getElementById('availability-end-date').matches(':disabled')), true);
  const pendingCount = (await writes()).length;
  await evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent === 'Saving…').click());
  assert.equal((await writes()).length, pendingCount);
  await config({ result: "success" }); await evaluate(() => window.followupFixture.release());
  await until(() => !document.getElementById('availability-end-date').matches(':disabled'));
  assert.equal((await writes()).at(-1).body.recurrenceEndType, "on_date");
  assert.equal((await writes()).at(-1).body.recurrenceEndValue, "2030-05-10");
  await set("availability-service", "all"); await set("availability-service", "7");
  assert.equal(await evaluate(() => document.getElementById('availability-end-date').value), "2030-05-10");
  await fixture.screenshot(`${output}/availability-end-date-en-1280.png`);
  await set("availability-end-date", ""); await button(resources.en.translation.operationsForm.saveWeek);
  await until(() => !!document.querySelector('[role="status"]'));
  assert.equal((await writes()).at(-1).body.recurrenceEndType, "never");
  assert.equal((await writes()).at(-1).body.recurrenceEndValue, null);
  checks.push("Inclusive optional recurring end-date survives refresh, rejection, pending save and scope reload; empty date clears recurrence limit");

  await set("availability-mode", "specific");
  assert.equal(await evaluate(label => [...document.querySelectorAll('button')].find(button => button.textContent === label).disabled, resources.en.translation.operationsForm.saveException), true, 'Save selected mode before dated hours');
  await button(resources.en.translation.frontendFollowup.saveSpecific);
  await until(() => !document.querySelector('[data-time-input]'));
  assert.ok((await writes()).at(-1).body.days.every(day => day.intervals.length === 0));
  await set("availability-exception-date", "2030-06-15");
  await click('#availability-exception-date');
  await evaluate(() => document.querySelector('input[type="checkbox"]').click());
  await until(() => document.querySelectorAll('[data-time-input]').length === 2);
  await button(resources.en.translation.operationsForm.saveException);
  await until(() => document.getElementById('availability-exception-date').value === '');
  assert.deepEqual((await writes()).at(-1).body, { serviceId: 7, timezone: "Europe/Riga", date: "2030-06-15", intervals: [{ startTime: "09:00", endTime: "17:00" }] });
  assert.equal(await evaluate(() => document.getElementById('availability-mode').value), "specific");
  await fixture.screenshot(`${output}/availability-specific-en-1280.png`);
  await set("availability-service", "all"); await set("availability-service", "7");
  assert.equal(await evaluate(() => document.getElementById('availability-mode').value), "specific");
  await button(resources.en.translation.operationsForm.useGeneral);
  await until(() => document.getElementById('availability-mode').value === 'recurring');
  assert.deepEqual((await writes()).at(-1).body, { serviceId: 7, inherit: true });
  checks.push("Specific-date mode persists a closed weekly sentinel, retains mode across scope changes, and saves dated hours through the existing override contract");

  for (const language of languages) for (const width of [320, 390, 768, 1280]) {
    await viewport(width); await open("availability", `lang=${language}`); await until(() => !!document.getElementById('availability-mode'));
    await noOverflow();
    await set("availability-mode", "specific"); await noOverflow();
    matrix.push({ language, width });
    if (width === 390 || width === 1280) await fixture.screenshot(`${output}/availability-${language}-${width}.png`);
  }
  await viewport(320); await evaluate(() => { document.documentElement.style.fontSize = '200%'; }); await noOverflow();
  checks.push("Availability weekly and specific modes reflow in en/lv/ru at 320/390/768/1280 and 320px at 200% text");

  for (const language of languages) {
    await viewport(390); await open("gallery", `lang=${language}`); await until(() => !!document.querySelector('[data-testid="service-image-next"]'));
    const dimensions = await evaluate(() => [...document.querySelectorAll('[data-testid^="service-image-"]:is(button)')].map(button => ({ width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height, radius: getComputedStyle(button).borderRadius })));
    assert.ok(dimensions.every(box => box.width >= 44 && box.height >= 44 && box.radius === '9999px'));
    assert.equal(await evaluate(() => document.querySelector('[data-testid="service-image-previous"]').disabled), true);
    await click('[data-testid="service-image-next"]'); await click('[data-testid="service-image-next"]');
    await until(() => !!document.querySelector('[data-testid="service-image-swipe"] [role="status"]'));
    assert.equal(await evaluate(() => document.querySelector('[data-testid="service-image-next"]').disabled), true);
    await evaluate(() => document.querySelector('[data-testid="service-image-swipe"]').focus()); await key("ArrowLeft");
    await until(() => !!document.querySelector('[data-testid="service-gallery-image"]'));
    await noOverflow(); await fixture.screenshot(`${output}/gallery-${language}.png`);
    await open("bookings", `lang=${language}`); await until(() => document.querySelectorAll('article').length === 2);
    assert.deepEqual(await evaluate(() => [...document.querySelectorAll('[data-testid^="booking-service-"]')].map(link => link.getAttribute('href'))), ['/search?service=7', '/search?service=7']);
    const colors = await evaluate(() => [...document.querySelectorAll('article')].map(row => getComputedStyle(row.querySelector('[class*="rounded-full"]')).backgroundColor));
    assert.notEqual(colors[0], colors[1]); await noOverflow(); await fixture.screenshot(`${output}/bookings-${language}.png`);
    await open("inbox", `lang=${language}`); await until(() => !!document.querySelector('[data-inbox-list] article'));
    assert.equal(await evaluate(() => document.querySelector('article a').getAttribute('href')), '/search?service=7');
    assert.ok(await evaluate(() => !!document.querySelector('article a[href="/my-bookings"]')));
    assert.equal(await evaluate(() => document.body.innerText.includes('frontendFollowup.')), false);
    await noOverflow(); await fixture.screenshot(`${output}/inbox-${language}.png`);
    await open("avatar", `lang=${language}&avatar=javascript:alert(1)`); await until(() => !!document.querySelector('[data-radix-collection-item]') || !!document.querySelector('button[aria-haspopup="menu"]'));
    assert.equal(await evaluate(() => !!document.querySelector('img')), false);
    assert.equal(await evaluate(() => document.querySelector('button').getAttribute('aria-label')), resources[language].translation.frontendFollowup.accountMenu);
    await click('button[aria-haspopup="menu"]'); await until(() => !!document.querySelector('[role="menu"]')); await key("Escape");
  }
  checks.push("en/lv/ru circular 44px gallery controls, boundary disabling, broken-image fallback and keyboard navigation; distinct completed/cancelled badges; original service links; service-change inbox review links; unsafe-avatar fallback/menu");
  await open("avatar", `avatar=${encodeURIComponent(avatar)}`);
  await until(() => !!document.querySelector('img'));
  assert.equal(await evaluate(() => document.querySelector('img').getAttribute('referrerpolicy')), 'no-referrer');
  assert.equal(await evaluate(() => document.querySelector('img').naturalWidth), 64);
  await fixture.screenshot(`${output}/avatar.png`);
  await open("avatar", `avatar=${encodeURIComponent(brokenAvatar)}`);
  await until(() => !!document.querySelector('button svg'));
  assert.equal(await evaluate(() => !!document.querySelector('img')), false);
  checks.push("HTTPS profile photo renders from an exact in-memory image response, sends no referrer, and a failed photo restores the account icon");
  await open("inbox", "unavailable"); await until(() => !!document.querySelector('article'));
  assert.equal(await evaluate(() => !!document.querySelector('article a[href^="/search"]')), false);
  assert.ok(await evaluate(() => !!document.querySelector('article a[href="/my-bookings"]')));
  assert.deepEqual(await evaluate(() => window.followupFixture.unexpected), []);
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []);
  await writeFile(`${output}/evidence.json`, JSON.stringify({ date: "2026-11-11", browser: await fixture.api("Browser.getVersion"), checks, matrix, limits: "Synthetic in-memory boundary; no database/service calls, physical-device, screen-reader or native linguistic coverage. ar/RTL,zh,fr,de,hi,ja,pt,es deferred." }, null, 2));
  console.log(`PASS: frontend follow-up, ${checks.length} behavior groups, ${matrix.length} locale/viewport cases.`);
} finally { await fixture.close(); }
