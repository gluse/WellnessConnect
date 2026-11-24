import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { browserFixture } from "./fixtures/browser-harness.mjs";

const languages = ["en", "lv", "ru"], engine = process.env.FORMS_BROWSER || "chrome";
const resources = Object.fromEntries(await Promise.all(languages.map(async language => [language, { translation: JSON.parse(await readFile(`client/public/locales/${language}/translation.json`, "utf8")) }])));
const fixture = await browserFixture({ entry: "scripts/fixtures/provider-public-navigation.tsx", resources });
const { evaluate, until, visit, viewport, click, key, set } = fixture;
const checks = [], matrix = [];
const verificationDate = "2026-11-11";
const output = `output/frontend-provider-navigation-${verificationDate}/${engine}`;
await mkdir(output, { recursive: true });
let sequence = 0;
const open = (path, query = "") => visit(`${path}?case=${++sequence}&${query}`);
const configure = values => evaluate(values => Object.assign(window.phase2Fixture, values), values);
const cardsReady = () => until(() => document.querySelectorAll('.search-service-card').length === 3, "provider cards ready");
const noOverflow = async () => assert.equal(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, "page reflow");
const signature = () => evaluate(() => {
  const card = document.querySelector('.search-service-card'), art = card.querySelector('.search-service-art'), heading = card.querySelector('h3');
  return { card: getComputedStyle(card).display, artRadius: getComputedStyle(art).borderRadius, artRatio: getComputedStyle(art).aspectRatio, heading: getComputedStyle(heading).fontSize,
    body: getComputedStyle(card.querySelector('.search-service-body')).display, badge: getComputedStyle(card.querySelector('.search-booking-badge')).backgroundColor };
});
const expectedPaths = ["/my-services/appointments", "/my-services/upcoming-appointments", "/my-services/past-appointments", "/my-services/services", "/my-services/availability", "/my-services/reports", "/my-services/settings"];
try {
  await viewport(1280); await open("/search", "guest");
  await until(() => !!document.querySelector('[data-testid="browse-without-location"]') || document.querySelectorAll('.search-service-card').length === 6, "search entry ready");
  if (await evaluate(() => !!document.querySelector('[data-testid="browse-without-location"]'))) await click('[data-testid="browse-without-location"]');
  await until(() => document.querySelectorAll('.search-service-card').length === 6);
  assert.equal(await evaluate(() => document.querySelector('[data-testid="button-view-grid"]').getAttribute('aria-pressed')), 'true', 'Search defaults to Grid view');
  assert.ok(await evaluate(() => !!document.querySelector('.search-cards-grid')));
  const access = await evaluate(() => [...document.querySelectorAll('.search-service-card')].map(card => ({ name: card.querySelector('h3').textContent, links: [...card.querySelectorAll('.search-provider-row a')].map(link => link.getAttribute('href')), providerButton: !!card.querySelector('button[data-testid^="button-provider-"]') })));
  assert.deepEqual(access.find(row => row.name === "Free provider massage").links, []);
  assert.deepEqual(access.find(row => row.name === "Expired provider training").links, []);
  assert.equal(access.some(row => row.providerButton), false);
  assert.deepEqual(access.find(row => row.name === "Morning yoga").links, ["/providers/pro-studio"]);
  assert.deepEqual(access.find(row => row.name === "Company Pilates").links, ["/providers/pro-company"]);
  const searchStyle = await signature();
  await click('[data-testid="button-view-details-2"]');
  await until(() => !!document.querySelector('.search-detail-dialog'));
  assert.equal(await evaluate(() => !!document.querySelector('.search-detail-provider :is(a,button[data-testid="button-provider-details"])')), false);
  await key("Escape"); await until(() => !document.querySelector('.search-detail-dialog'));
  assert.deepEqual(await evaluate(() => window.phase2Fixture.reads.filter(path => path.startsWith('/api/services/catalog') || path === '/api/provider/storefront')), []);
  await click('.search-provider-row a[href="/providers/pro-studio"]'); await cardsReady();
  assert.deepEqual(await signature(), searchStyle);
  assert.equal(await evaluate(() => document.title), "Pro Studio | Ordelino");
  checks.push("Guest Search exposes active Pro individual/company provider links; free/expired provider names and details have no catalog control or request; shared card presentation matches");

  await set("storefront-search", "retreat"); await until(() => document.querySelectorAll('.search-service-card').length === 1);
  await set("storefront-search", "no matching service"); await until(() => !document.querySelector('.search-service-card'));
  assert.ok((await evaluate(() => document.body.innerText)).includes(resources.en.translation.storefront.empty));
  await set("storefront-search", ""); await cardsReady(); await set("storefront-category", "wellness"); await cardsReady();
  await set("storefront-sort", "duration");
  assert.deepEqual(await evaluate(() => [...document.querySelectorAll('.search-service-title')].map(element => element.textContent)), ["Morning yoga", "Evening yoga", "Weekend retreat"]);
  await until(() => !!document.querySelector('[aria-label="Evening yoga"] svg'), "broken image fallback");
  await evaluate(() => document.querySelector('[data-testid="button-view-details-1"]').focus()); await key("Enter");
  await until(() => !!document.querySelector('.search-detail-dialog'));
  assert.ok((await evaluate(() => document.querySelector('.search-detail-dialog').innerText)).includes(resources.en.translation.searchPage.chooseTime));
  await click('[data-testid="button-book-from-details"]');
  await until(() => !!document.querySelector('[data-testid="dialog-booking-sign-in"]'));
  assert.ok((await evaluate(() => [...document.querySelectorAll('[data-testid="dialog-booking-sign-in"] a')].map(link => link.getAttribute('href')))).some(href => href.includes(encodeURIComponent('/providers/pro-studio?book=1'))));
  await key("Escape"); await until(() => !document.querySelector('[data-testid="dialog-booking-sign-in"]'));
  assert.deepEqual(await evaluate(() => window.phase2Fixture.writes), ["POST /api/services/2/view", "POST /api/services/1/view"]);
  checks.push("Provider search/category/sort, empty result, broken image fallback, keyboard details and guest booking return path work; only simulated view analytics occurred");

  await open("/providers/expired-provider", "guest");
  await until(() => !!document.querySelector('[role="alert"]'));
  assert.equal(await evaluate(() => !!document.querySelector('.search-service-card')), false);
  assert.ok((await evaluate(() => document.body.innerText)).includes(resources.en.translation.storefront.unavailable));
  await open("/providers/pro-studio", "guest&result=pending");
  await until(() => !!window.phase2Fixture.release);
  assert.equal(await evaluate(() => !!document.querySelector('.search-service-card')), false);
  await configure({ pageResult: "error" }); await evaluate(() => window.phase2Fixture.release());
  await until(() => !!document.querySelector('[role="alert"]'));
  await configure({ pageResult: "success" }); await fixture.button(resources.en.translation.catalog.retry); await cardsReady();
  await configure({ pageResult: "missing" }); await evaluate(() => window.phase2Fixture.refresh());
  await until(() => !document.querySelector('.search-service-card') && !!document.querySelector('[role="alert"]'));
  await open("/providers/pro-studio", "guest&result=empty");
  await until(() => !!document.getElementById("storefront-services"));
  assert.equal(await evaluate(() => !!document.querySelector('.search-service-card')), false);
  checks.push("Direct unavailable/expired page, pending load, failed load/retry, successful page revoked on refresh, and empty provider page render safe states");

  await open("/providers/pro-studio", "preview"); await cardsReady();
  assert.equal(await evaluate(() => !!document.querySelector('[data-wishlist-heart]')), false);
  await click('[data-testid="button-view-details-1"]'); await until(() => !!document.querySelector('.search-detail-dialog'));
  assert.equal(await evaluate(() => !!document.querySelector('[data-wishlist-heart]')), false);
  assert.deepEqual(await evaluate(() => window.phase2Fixture.writes), []);
  checks.push("Storefront preview retains the shared layout without wishlist hearts or view analytics, including details");

  await viewport(1280); await open("/my-services/services");
  await until(() => !!document.querySelector('header nav a[href="/my-services"]') && document.querySelectorAll('[data-appointment-area="provider"] nav a').length > 0);
  for (const language of languages) {
    await evaluate(language => window.phase2Fixture.language(language), language);
    const t = resources[language].translation;
    await configure({ expectedNav: [t.searchPage.navSearch, t.booking.myBookings, t.provider.myServices] });
    await until(() => JSON.stringify([...document.querySelectorAll('header nav a')].map(link => link.textContent)) === JSON.stringify(window.phase2Fixture.expectedNav), "live translated desktop navigation");
    assert.equal(await evaluate(() => document.querySelector('header nav').getAttribute('aria-label')), t.mobileNavigation.navigation);
    assert.deepEqual(await evaluate(() => [...document.querySelectorAll('[data-appointment-area="provider"] nav a')].map(link => link.getAttribute('href'))), expectedPaths);
    assert.equal(await evaluate(() => document.querySelector('header nav a[aria-current="page"]').getAttribute('href')), "/my-services");
    await noOverflow();
    await fixture.screenshot(`${output}/navigation-${language}.png`);
  }
  await viewport(390); await click('[data-mobile-navigation] button');
  await until(() => !!document.querySelector('[role="menu"]'));
  const ru = resources.ru.translation;
  assert.deepEqual(await evaluate(() => [...document.querySelectorAll('[role="menuitem"]')].slice(0, 6).map(item => item.textContent)),
    [ru.providerNavigation.upcomingAppointments, ru.providerNavigation.pastAppointments, ru.mobileNavigation.services, ru.mobileNavigation.availability, ru.reports.title, ru.mobileNavigation.settings]);
  await key("Escape");
  checks.push("Desktop labels and accessible navigation name change live in en/lv/ru; active route preserved; shared desktop/mobile order places Availability before Reports before Settings");

  for (const language of languages) for (const width of [320, 390, 768, 1280]) {
    await viewport(width, 900); await open("/providers/pro-studio", `guest&lang=${language}`); await cardsReady();
    await noOverflow();
    const result = await evaluate(() => ({ columns: getComputedStyle(document.querySelector('.search-cards-grid')).gridTemplateColumns.split(' ').length,
      clipped: [...document.querySelectorAll('.search-service-title, .search-price')].some(element => element.scrollWidth > element.clientWidth + 1) }));
    assert.equal(result.clipped, false); assert.equal(result.columns, width < 640 ? 2 : width < 1024 ? 3 : 4);
    matrix.push({ language, width, ...result });
    if (width === 390 || width === 1280) await fixture.screenshot(`${output}/provider-${language}-${width}.png`);
  }
  await viewport(320); await evaluate(() => { document.documentElement.style.fontSize = '200%'; }); await noOverflow();
  await evaluate(() => { document.documentElement.style.fontSize = ''; });
  checks.push("Provider grid reflows in 12 en/lv/ru phone/tablet/desktop cases, plus 320px at 200% text");
  assert.deepEqual(await evaluate(() => window.phase2Fixture.unexpected), []);
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []);
  await writeFile(`${output}/evidence.json`, JSON.stringify({ date: verificationDate, engine, browser: await fixture.api("Browser.getVersion"), checks, matrix,
    deferred: ["ar/RTL", "zh", "fr", "de", "hi", "ja", "pt", "es"], limits: "Isolated actual App/StorefrontView with synthetic in-memory fetch mocks. No connected sessions, database writes, private credentials, deployment, physical-device or screen-reader coverage." }, null, 2) + "\n");
  console.log(`PASS: ${engine} provider/navigation follow-up, ${checks.length} behavior groups and ${matrix.length} en/lv/ru viewport cases.`);
} finally { await fixture.close(); }
