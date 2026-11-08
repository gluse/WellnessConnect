import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { browserFixture } from './fixtures/browser-harness.mjs';

const resources = {};
for (const language of ['en','lv','ru']) resources[language] = { translation: JSON.parse(await readFile(`client/public/locales/${language}/translation.json`, 'utf8')) };
await mkdir('output/service-pictures-check', { recursive: true });
const fixture = await browserFixture({ entry: 'scripts/fixtures/service-pictures.tsx', resources });
const { evaluate, until, click, key, viewport } = fixture;
const count = () => evaluate(() => document.querySelectorAll('[data-testid="service-picture-list"] > li').length);
const position = (scope = '') => evaluate(scope => document.querySelector(scope + '[data-testid="service-image-position"]')?.textContent, scope);
const upload = size => evaluate(async size => {
  const input = document.querySelector('input[type="file"]');
  const files = new DataTransfer(); files.items.add(new File([new Uint8Array(size)], 'synthetic.png', { type: 'image/png' }));
  input.files = files.files; input.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(requestAnimationFrame);
}, size);
const swipe = async (direction, cancel = false) => {
  if (!fixture.api || process.env.FORMS_BROWSER && process.env.FORMS_BROWSER !== 'chrome') return;
  const box = await evaluate(() => {
    const element = document.querySelector('[data-testid="service-image-swipe"]'); element.scrollIntoView({ block: 'center' });
    const r = element.getBoundingClientRect(); return { x: r.left + r.width * .7, y: r.top + r.height / 2, endX: r.left + r.width * .2 };
  });
  const left = direction === 'left', start = left ? box.x : box.endX, end = left ? box.endX : box.x;
  await fixture.api('Emulation.setTouchEmulationEnabled', { enabled: true });
  await fixture.api('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start, y: box.y }] });
  if (cancel) await fixture.api('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  else {
    for (let i = 1; i <= 4; i++) await fixture.api('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start + (end - start) * i / 4, y: box.y }] });
    await fixture.api('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  await fixture.api('Emulation.setTouchEmulationEnabled', { enabled: false });
  await evaluate(() => new Promise(requestAnimationFrame));
};
try {
  for (const language of ['en','lv','ru']) for (const width of [390,1280]) {
    await viewport(width); await fixture.visit(`/?lang=${language}`);
    await until(() => !!document.querySelector('[data-testid="service-gallery-image"]'), 'gallery ready');
    const labels = resources[language].translation.servicePictures;
    assert.equal(await position(), labels.position.replace('{{current}}','1').replace('{{total}}','3'));
    assert.equal(await evaluate(() => document.querySelector('[data-testid="service-image-previous"]').disabled), true);
    await click('[data-testid="service-image-next"]');
    assert.equal(await position(), labels.position.replace('{{current}}','2').replace('{{total}}','3'));
    await evaluate(() => document.querySelector('[data-testid="service-image-swipe"]').focus()); await key('ArrowRight');
    assert.equal(await evaluate(() => document.querySelector('[data-testid="service-image-next"]').disabled), true);
    await key('ArrowRight'); assert.match(await position(), /3/);
    await key('ArrowLeft'); await key('ArrowLeft');
    await swipe('right'); assert.match(await position(), /1/);
    await swipe('left', true); assert.match(await position(), /1/);
    if (!process.env.FORMS_BROWSER || process.env.FORMS_BROWSER === 'chrome') {
      await swipe('left'); assert.equal(await position(), labels.position.replace('{{current}}','2').replace('{{total}}','3'));
      await swipe('right'); assert.equal(await position(), labels.position.replace('{{current}}','1').replace('{{total}}','3'));
    }
    assert.equal(await evaluate(() => getComputedStyle(document.querySelector('[data-testid="service-image-swipe"]')).touchAction.includes('pan-y')), true);
    await evaluate(() => document.querySelector('[data-testid="service-gallery-image"]').dispatchEvent(new Event('error')));
    await until(() => document.body.textContent.includes('' + document.querySelector('[data-testid="service-image-swipe"] [role="status"]')?.textContent), 'image fallback');
    assert.equal(await evaluate(label => document.body.textContent.includes(label), labels.unavailable), true);
    await click('[data-testid="service-image-next"]'); assert.equal(await evaluate(() => !!document.querySelector('[data-testid="service-gallery-image"]')), true);
    await click('#fixture-legacy');
    assert.equal(await evaluate(() => !!document.querySelector('[data-testid="service-gallery-image"]') && !document.querySelector('[data-testid="service-image-next"]')), true, 'legacy [] plus cover remains visible without controls');
    assert.equal(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'no horizontal overflow');
    for (const layout of ['search','standard']) {
      await fixture.visit(`/?lang=${language}&layout=${layout}`); await click('#fixture-open');
      await until(() => !!document.querySelector('[role="dialog"] [data-testid="service-image-gallery"]'), 'details gallery');
      await click('[role="dialog"] [data-testid="service-image-next"]');
      assert.match(await position('[role="dialog"] '), /2/);
      if (width === 390 && language === 'en' && layout === 'search') await fixture.screenshot('output/service-pictures-check/search-mobile.png');
      await key('Escape'); await until(() => !document.querySelector('[role="dialog"]'), 'closed details');
      await click('#fixture-open');
      await until(() => !!document.querySelector('[role="dialog"] [data-testid="service-image-previous"]'), 'reopened details');
      assert.equal(await evaluate(() => document.querySelector('[role="dialog"] [data-testid="service-image-previous"]').disabled), true, 'reopen resets image');
      await key('Escape'); await until(() => !document.querySelector('[role="dialog"]'), 'closed details');
    }
    await fixture.visit(`/?mode=editor&lang=${language}&count=2`);
    await until(() => document.querySelectorAll('[data-testid="service-picture-list"] > li').length === 2, 'editor images');
    await click('[data-testid="service-picture-cover-1"]');
    assert.equal(await evaluate(() => document.querySelector('[data-testid="service-picture-list"] img').alt), labels.preview.replace('{{current}}','1'));
    await click('[data-testid="service-picture-remove-1"]'); assert.equal(await count(), 1);
    await evaluate(() => { window.phase2Fixture.uploadResult = 'pending'; });
    await upload(1); await until(() => window.phase2Fixture.uploads.length === 1, 'pending upload');
    assert.equal(await evaluate(() => document.querySelector('[data-testid="button-save-service"]').disabled && document.querySelector('[data-testid="button-save-inactive-service"]').disabled), true, 'saving waits for upload');
    await evaluate(() => window.phase2Fixture.pending());
    await until(() => document.querySelectorAll('[data-testid="service-picture-list"] > li').length === 2, 'upload appended');
    assert.equal(await evaluate(() => document.querySelector('[data-testid="button-save-service"]').disabled), false);
    assert.equal(await evaluate(() => window.phase2Fixture.uploads[1].credentials), 'omit');
    await evaluate(() => { window.phase2Fixture.uploadResult = 'error'; }); await upload(1);
    await until(() => !document.querySelector('[data-testid="button-upload-image"]').disabled, 'failed upload released');
    assert.equal(await count(), 2, 'failure retains draft pictures');
    const requests = await evaluate(() => window.phase2Fixture.uploads.length);
    await upload(0); await upload(10 * 1024 * 1024 + 1);
    assert.equal(await evaluate(() => window.phase2Fixture.uploads.length), requests, 'empty and oversized rejected before network');
    assert.equal(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    assert.deepEqual(await evaluate(() => window.phase2Fixture.unexpected), []);
    assert.deepEqual(await evaluate(() => window.phase2Fixture.writes), []);
    console.log(`Passed service pictures ${language}/${width}: both details, gallery, editor uploads and errors.`);
  }
  await fixture.visit('/?mode=editor&count=10'); await until(() => document.querySelectorAll('[data-testid="service-picture-list"] > li').length === 10, 'Pro maximum');
  assert.equal(await evaluate(() => document.querySelector('[data-testid="button-upload-image"]').disabled), true);
  await viewport(390); await fixture.screenshot('output/service-pictures-check/editor-pro-mobile.png');
  await fixture.visit('/?mode=editor&count=3&pro=false'); await until(() => document.querySelectorAll('[data-testid="service-picture-list"] > li').length === 3, 'downgraded retained gallery');
  assert.equal(await evaluate(() => document.querySelector('[data-testid="button-upload-image"]').disabled), true);
  await click('[data-testid="service-picture-cover-2"]'); await click('[data-testid="service-picture-remove-2"]'); await click('[data-testid="service-picture-remove-1"]');
  assert.equal(await count(), 1); assert.equal(await evaluate(() => document.querySelector('[data-testid="button-upload-image"]').disabled), true);
  await click('[data-testid="service-picture-remove-0"]'); assert.equal(await count(), 0);
  await until(() => !document.querySelector('[data-testid="button-upload-image"]').disabled, 'Free slot available');
  await upload(10 * 1024 * 1024); await until(() => document.querySelectorAll('[data-testid="service-picture-list"] > li').length === 1, '10 MiB accepted');
  await fixture.visit('/?mode=editor&count=1'); await until(() => document.querySelectorAll('[data-testid="service-picture-list"] > li').length === 1, 'workspace test ready');
  await evaluate(() => { window.phase2Fixture.uploadResult = 'pending'; }); await upload(1);
  await until(() => !!window.phase2Fixture.pending, 'upload pending before switch');
  await evaluate(() => window.phase2Fixture.changeWorkspace()); await until(() => !document.querySelector('[data-testid="button-save-service"]').disabled, 'new workspace editor mounted');
  await evaluate(() => window.phase2Fixture.pending()); await until(() => window.phase2Fixture.confirmCount === 1, 'old upload finished');
  assert.equal(await count(), 1, 'late completion cannot attach to replacement workspace editor');
  await fixture.visit('/?mode=editor&count=3'); await until(() => document.querySelectorAll('[data-testid="service-picture-list"] > li').length === 3, 'save test ready');
  await click('[data-testid="service-picture-cover-2"]');
  const savedOrder = await evaluate(() => [...document.querySelectorAll('[data-testid="service-picture-list"] img')].map(image => image.getAttribute('src')));
  await evaluate(() => { window.phase2Fixture.saveResult = 'error'; }); await click('[data-testid="button-save-service"]');
  await until(() => window.phase2Fixture.saves.length === 1 && !document.querySelector('[data-testid="button-save-service"]').disabled, 'rejected save finished');
  assert.equal(await count(), 3, 'rejected save retains complete gallery');
  assert.deepEqual(await evaluate(() => [...document.querySelectorAll('[data-testid="service-picture-list"] img')].map(image => image.getAttribute('src'))), savedOrder);
  await evaluate(() => { window.phase2Fixture.saveResult = 'success'; }); await click('[data-testid="button-save-service"]');
  await until(() => window.phase2Fixture.saves.length === 2, 'successful mocked save sent');
  const saved = await evaluate(() => window.phase2Fixture.saves[1]);
  assert.deepEqual(saved.imageUrls, savedOrder, 'saved payload preserves picture order');
  assert.equal(saved.imageUrl, savedOrder[0], 'saved payload uses selected cover');
  assert.deepEqual(await evaluate(() => window.phase2Fixture.writes), []);
  assert.deepEqual(await evaluate(() => window.phase2Fixture.unexpected), []);
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.network, []); assert.deepEqual(fixture.blocked, []);
  console.log('Passed Pro10/Free1 limits, retained downgrade, upload10MiB boundary, pending-save lock, late workspace completion, mocked save order/cover and rejected-save draft retention. All uploads/saves intercepted in memory; no connected service writes/external network.');
} finally { await fixture.close(); }
