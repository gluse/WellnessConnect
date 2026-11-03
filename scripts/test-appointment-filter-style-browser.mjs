import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";

const languages = ["en", "lv", "ru"];
const resources = Object.fromEntries(await Promise.all(languages.map(async language => [language, { translation: JSON.parse(await readFile(new URL(`../client/public/locales/${language}/translation.json`, import.meta.url), "utf8")) }])));
const fixture = await browserFixture({ entry: "scripts/fixtures/appointment-layout.tsx", resources });
const { evaluate, until, viewport, visit, key, set } = fixture;
const engine = process.env.FORMS_BROWSER || "chrome", matrix = [], referenceStyles = new Map();
const artifactPrefix = process.env.APPOINTMENT_FILTER_ARTIFACT_PREFIX || "appointment-filter-style";
assert.match(artifactPrefix, /^[a-z0-9-]+$/, "Use a filename-safe evidence prefix");
try {
  for (const language of languages) {
    for (const area of ["provider", "customer"]) {
      for (const width of [320, 360, 768, 1280]) {
        await viewport(width, 800);
        await visit(`${area === "provider" ? "/my-services/upcoming-appointments" : "/my-bookings"}?lang=${language}&employees=1`);
        await until(() => document.querySelectorAll("main article[data-testid]").length > 0, "appointments loaded");
        const state = await evaluate(() => {
          const properties = ["height", "fontSize", "fontWeight", "borderTopColor", "borderTopWidth", "borderRadius", "backgroundColor", "paddingInlineStart"];
          const styleOf = element => { const style = getComputedStyle(element); return Object.fromEntries(properties.map(key => [key, style[key]])); };
          const fields = [...document.querySelectorAll('[data-testid="appointment-filters"] select')];
          const reference = document.querySelector('[data-testid="booking-actions-1"]');
          const filterRow = document.querySelector('[data-testid="appointment-filters"]');
          return { reference: reference && styleOf(reference), fields: fields.map(field => {
            const box = field.getBoundingClientRect();
            return { id: field.id, style: styleOf(field), labelled: field.labels.length === 1 && !!field.labels[0].textContent.trim(),
              native: field.tagName === "SELECT" && getComputedStyle(field).appearance === "none",
              chevrons: field.parentElement.querySelectorAll('svg[aria-hidden="true"]').length,
              fits: box.left >= 0 && box.right <= innerWidth + 1 && box.height >= 32 };
          }), rowGap: getComputedStyle(filterRow).rowGap, columnGap: getComputedStyle(filterRow).columnGap,
            fits: document.documentElement.scrollWidth <= innerWidth + 1,
          };
        });
        const referenceKey = `${language}/${width}`;
        if (area === "provider") referenceStyles.set(referenceKey, state.reference);
        assert.equal(state.fields.length, area === "provider" ? 2 : 1);
        for (const field of state.fields) {
          assert.deepEqual(field.style, referenceStyles.get(referenceKey), `${language}/${area}/${width}/${field.id}: match More actions`);
          assert.equal(field.labelled, true); assert.equal(field.native, true); assert.equal(field.chevrons, 1); assert.equal(field.fits, true);
        }
        assert.equal(state.rowGap, "4px"); assert.equal(state.columnGap, "8px"); assert.equal(state.fits, true);
        const statusId = `${area === "provider" ? "provider" : "seeker"}-appointment-status`;
        for (const field of state.fields) {
          await fixture.hover(`#${field.id}`); await fixture.settle();
          const colors = await evaluate(id => {
            const field = document.getElementById(id);
            return { background: getComputedStyle(field).backgroundColor, options: [...field.options].map(option => getComputedStyle(option).backgroundColor) };
          }, field.id);
          assert.equal(colors.background, field.style.backgroundColor, `${language}/${area}/${width}: hover stays neutral`);
          assert.ok(colors.options.every(background => background === field.style.backgroundColor), `${language}/${area}/${width}: options stay neutral`);
          if (width === 360) {
            await fixture.click(`#${field.id}`); await key("Escape");
            assert.equal(await evaluate(id => document.getElementById(id).value, field.id), "all", "dismissing the native popup preserves selection");
          }
        }
        await evaluate(id => document.getElementById(id).focus(), statusId);
        await key("ArrowDown");
        await until(() => document.querySelector('select[id$="-appointment-status"]').value === "pending" && document.querySelectorAll("main article[data-testid]").length === 2, "native keyboard selection filters pending appointments");
        if (area === "provider") {
          await set("appointment-employee", "2");
          await until(() => document.querySelectorAll("main article[data-testid]").length === 1, "employee and status filters combine");
          assert.equal(await evaluate(() => document.querySelector("main article").textContent.includes("Wellness massage")), true);
          await set("appointment-employee", "all");
          await until(() => document.querySelectorAll("main article[data-testid]").length === 2, "employee filter resets");
        }
        await set(statusId, "all");
        await until(() => document.querySelectorAll("main article[data-testid]").length === (document.querySelector('[data-appointment-area="provider"]') ? 3 : 4), "status filter resets");
        matrix.push({ language, area, width, height: 800, fields: state.fields.map(field => ({ id: field.id, height: field.style.height })) });
        if (width === 360) {
          await fixture.screenshot(`docs/${artifactPrefix}-${engine}-${language}-${area}-360x800.png`, false);
          await evaluate(() => { document.documentElement.style.fontSize = "32px"; });
          assert.equal(await evaluate(() => [...document.querySelectorAll('[data-testid="appointment-filters"] select')].every(field => {
            const box = field.getBoundingClientRect(); return box.left >= 0 && box.right <= innerWidth + 1;
          })), true, "enlarged filters stay within the viewport");
        }
        assert.deepEqual(await evaluate(() => window.phase2Fixture.unexpected), []);
      }
    }
  }
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []);
  await writeFile(new URL(`../docs/${artifactPrefix}-${engine}-evidence.json`, import.meta.url), JSON.stringify({ date: "2026-11-03", browser: await fixture.api("Browser.getVersion"), languages, matrix, checks: ["Filter border, radius, font, height, background and start padding match More actions", "Compact row gaps; native controls, labels and single chevrons", "Real pointer hover keeps controls and options neutral; native popup dismissal preserves selection", "Keyboard status selection, combined employee filtering and resets", "360px enlarged text stays within viewport; no unexpected API or external traffic"], deferredLanguages: ["ar", "zh", "fr", "de", "hi", "ja", "pt", "es"], limits: "Actual provider/customer pages and mobile shell with synthetic fetch mocks; no connected services/database writes. Emulation, not physical devices; native OS option highlighting remains browser-controlled." }, null, 2) + "\n");
  console.log(`Passed ${engine}: 24 en/lv/ru provider/customer filter-style cases, native keyboard/filter regressions and enlarged text.`);
} finally { await fixture.close(); }
