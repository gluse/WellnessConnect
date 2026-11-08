import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { browserFixture, measureFormContrast } from "./fixtures/browser-harness.mjs";
const resources = {};
for (const language of ["en", "lv", "ru"]) resources[language] = { translation: JSON.parse(await readFile(`client/public/locales/${language}/translation.json`, "utf8")) };
const fixture = await browserFixture({ entry: "scripts/fixtures/audit-viewer.tsx", resources });
const { evaluate, until, click, set, viewport, key } = fixture;
await mkdir("output/audit-viewer", { recursive: true });
try {
  for (const language of ["en", "lv", "ru"]) for (const width of [320, 768, 1280]) {
    const text = resources[language].translation.audit;
    await viewport(width); await fixture.visit(`/administration?section=audit&lang=${language}`);
    await until(() => !!document.querySelector("[data-audit-record]"), "audit records loaded");
    assert.equal(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${language}/${width} no page overflow`);
    assert.equal(await evaluate(title => document.querySelector("#audit-heading").textContent, text.title), text.title);
    assert.equal(await evaluate(() => document.querySelectorAll('nav[aria-label="Administration sections"] button').length), 1, "Reader-only account cannot open app administrator tabs");
    assert.equal(await evaluate(() => document.body.textContent.includes('2026') && document.body.textContent.includes('UTC')), true);
    await fixture.button(text.details);
    assert.equal(await evaluate(label => document.body.textContent.includes(label), text.redacted), true);
    assert.equal(await evaluate(() => document.querySelectorAll('[aria-expanded="true"]').length), 1);
    if (width === 1280 && language === "en") {
      await fixture.screenshot("output/audit-viewer/audit-desktop.png");
      await fixture.button(text.objectHistory); await until(() => document.querySelector('#audit-targetId').value.length > 0, "object history filter applied");
      assert.equal(await evaluate(() => new URL(window.phase2Fixture.requests.at(-1),location.origin).searchParams.get('targetType')), 'user');
      await fixture.button(text.details); await fixture.button(text.requestHistory);
      await until(() => document.querySelector('#audit-requestId').value.length > 0, "request history applied");
      assert.equal(await evaluate(() => new URL(window.phase2Fixture.requests.at(-1),location.origin).searchParams.get('targetId')), null);
      await fixture.button(text.reset);
      await until(() => !!document.querySelector('[data-audit-record]'), 'reset loaded');
      const previous = await evaluate(() => window.phase2Fixture.requests.length);
      await set('audit-action', 'audit.records_exported.v1');
      assert.equal(await evaluate(() => window.phase2Fixture.requests.length), previous, 'drafts do not query each keystroke');
      assert.equal(await evaluate(() => document.querySelector('[data-audit-record]') !== null), true);
      await fixture.button(text.search); await until(() => !document.querySelector('[data-audit-record]'), 'empty search');
      assert.equal(await evaluate(label => document.body.textContent.includes(label), text.empty), true);
      await set('audit-from','2026-11-07T12:00'); await set('audit-to','2026-11-06T12:00');
      const invalidPrevious = await evaluate(() => window.phase2Fixture.requests.length);
      await fixture.button(text.search);
      assert.equal(await evaluate(() => window.phase2Fixture.requests.length), invalidPrevious, 'invalid dates not sent');
      assert.equal(await evaluate(() => document.querySelector('#audit-from').getAttribute('aria-invalid')), 'true');
      await fixture.button(text.reset); await until(() => !!document.querySelector('[data-audit-record]'), 'reset results');
      const query = await evaluate(() => new URL(window.phase2Fixture.requests.at(-1),location.origin).searchParams.toString());
      await fixture.button(text.next); await until(() => document.querySelector('[data-audit-record]').textContent.length > 0 && window.phase2Fixture.requests.at(-1).includes('cursor='), 'cursor page');
      const next = new URLSearchParams(await evaluate(() => new URL(window.phase2Fixture.requests.at(-1),location.origin).searchParams.toString())); next.delete('cursor');
      assert.equal(next.toString(),query,'cursor paging retains exact UTC query');
      await fixture.button(text.previous);
      await until(() => document.querySelector('[data-audit-record]') && !document.querySelector('[data-audit-record] [aria-expanded="true"]'),'previous page loaded');
      await fixture.button(text.export); await until(() => window.phase2Fixture.downloads.length > 0, 'export download');
      assert.ok((await evaluate(() => window.phase2Fixture.downloads[0].text)).includes('Account details changed'));
      await evaluate(() => window.phase2Fixture.status=503); await fixture.button(text.refresh);
      await until(() => !!document.querySelector('[role="alert"]'), 'error shown');
      assert.equal(await evaluate(() => !!document.querySelector('[data-audit-record]')), false,'refresh failure hides private stale rows');
      await evaluate(() => window.phase2Fixture.status=200); await fixture.button(text.retry); await until(() => !!document.querySelector('[data-audit-record]'), 'retry success');
      await set('fixture-language','lv'); assert.equal(await evaluate(() => document.querySelector('#audit-heading').textContent),resources.lv.translation.audit.title,'live language switch');
    }
    if (width === 320 && language === 'en') await fixture.screenshot('output/audit-viewer/audit-phone.png');
    await evaluate(() => document.querySelector('#audit-from').focus());
    // Native datetime-local exposes multiple editable date/time segments.
    for(let tab=0;tab<10 && await evaluate(()=>document.activeElement.id)==='audit-from';tab++) await key('Tab');
    assert.equal(await evaluate(() => document.activeElement.id), 'audit-to','keyboard follows date inputs');
    assert.deepEqual(await evaluate(() => window.phase2Fixture.unexpected), []);
    assert.deepEqual(await evaluate(() => window.phase2Fixture.writes), []);
    console.log(`Passed Audit viewer ${language}/${width}.`);
  }
  for (const language of ['en','lv','ru']) for (const state of ['database','read','intent','integration']) {
    const text=resources[language].translation.audit;
    await fixture.visit(`/administration?section=audit&state=${state}&lang=${language}`);
    await until(()=>!!document.querySelector('[data-audit-record]'),'concrete activity loaded');
    const title=await evaluate(()=>document.querySelector('[data-audit-record] h3').textContent);
    assert.ok(!title.includes('audit.')&&!title.includes('undefined'),`${language}/${state}: readable localized title required; received ${title}`);
    if(state==='read')assert.ok(title.includes(text.reads.bookings_seeker),'name the actual protected data viewed');
    if(state==='intent'){assert.ok(title.includes(text.operations.login));assert.equal(await evaluate(label=>document.body.textContent.includes(label),text.intentHelp),true,'request is not proof of completion');}
    if(state==='integration')assert.ok(title.includes(text.operations.geocoding),'name the actual external operation');
    if(state==='database'){assert.ok(title.includes(text.recordTypes.services));assert.equal(await evaluate(label=>document.body.textContent.includes(label),text.databaseActor),true,'never infer a human from database-trigger evidence');}
    assert.equal(await evaluate(()=>document.querySelectorAll('form details[open]').length),0,'advanced filters are initially collapsed');
    assert.equal(await evaluate(()=>document.querySelector('#audit-action').tagName),'SELECT','activity query offers readable choices');
  }
  for (const state of ['readonly','denied','unavailable','empty']) {
    await fixture.visit(`/administration?section=audit&state=${state}&lang=en`);
    if(state==='readonly') await until(() => !!document.querySelector('[data-audit-record]'),state);
    else await until(() => !!document.querySelector('[role="alert"]') || document.body.textContent.includes('No audit records match'),state);
    if(state==='readonly'||state==='denied') assert.equal(await evaluate(label => [...document.querySelectorAll('button')].some(node=>node.textContent===label),resources.en.translation.audit.export),false,'export permission is separate');
    if(state==='denied') assert.equal(await evaluate(() => window.phase2Fixture.requests.length),0,'denied account never requests records');
  }
  await fixture.visit('/administration?section=audit&lang=en');
  await until(() => !!document.querySelector('[data-audit-record]'),'identity fixture ready');
  await evaluate(() => window.phase2Fixture.pending=true); await fixture.button(resources.en.translation.audit.refresh);
  await until(() => !!window.phase2Fixture.release,'old account request held');
  await evaluate(() => {window.phase2Fixture.pending=false;window.phase2Fixture.switchAccount();});
  assert.equal(await evaluate(() => document.body.textContent.includes('11111111-1111-4111-8111-111111111111')),false,'old account records removed immediately');
  await until(() => document.body.textContent.includes('66666666-6666-4666-8666-666666666666'),'new account results');
  await evaluate(() => window.phase2Fixture.release());
  assert.equal(await evaluate(() => document.body.textContent.includes('11111111-1111-4111-8111-111111111111')),false,'late old request cannot restore old account records');
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []);
  console.log('Passed Audit browser filters/query, empty/error/denied/unavailable, reader-only access, export permission/download, history, UTC cursor pagination, keyboard and en/lv/ru 320/768/1280 reflow. APIs mocked; no live data or writes.');
} finally { await fixture.close(); }
