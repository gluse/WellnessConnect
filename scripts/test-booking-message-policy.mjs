import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderPrivacyPolicy } from './privacy-policy.ts';
import { browserFixture, measureFormContrast } from './fixtures/browser-harness.mjs';

// Synthetic public details only; no Vite config/env loading or connected services.
const template = await readFile('client/privacy-policy.template.html', 'utf8');
const english = JSON.parse(await readFile('client/public/locales/en/translation.json', 'utf8'));
const html = renderPrivacyPolicy(template, {
  PRIVACY_POLICY_OPERATOR_NAME: 'Synthetic Operator', PRIVACY_POLICY_OPERATOR_ADDRESS: 'Synthetic street, Riga',
  PRIVACY_POLICY_EMAIL: 'privacy@example.test', PRIVACY_POLICY_PUBLIC_ORIGIN: 'https://example.test',
});
const fixture = await browserFixture({ html });
const artifactPrefix = process.env.POLICY_ARTIFACT_PREFIX || 'booking-message-policy';
assert.match(artifactPrefix, /^[a-z0-9-]+$/);
try {
  await fixture.api('Page.navigate', { url: fixture.origin + '/privacy-policy.html#booking-messages' });
  await fixture.until(() => !!document.getElementById('booking-messages'), 'policy anchor rendered');
  assert.deepEqual(await fixture.evaluate(() => [...document.querySelectorAll('[aria-labelledby="booking-messages"] p')].map(node => node.textContent)), [
    "Your optional message when making a booking becomes the first message in that booking's conversation.",
    english.appointmentCollaboration.privacy, english.appointmentCollaboration.retentionNotice,
  ]);
  assert.equal(await fixture.evaluate(() => document.querySelector('nav a[href="#booking-messages"]').textContent), 'Booking messages');
  assert.equal(await fixture.evaluate(() => document.querySelector('nav a[href="#wishlist-activity"]').textContent), 'Wishlists and activity notifications');
  const wishlistNotice = await fixture.evaluate(() => document.querySelector('[aria-labelledby="wishlist-activity"]').textContent);
  assert.match(wishlistNotice, /90 days/); assert.match(wishlistNotice, /after you remove the saved selection/);
  assert.match(wishlistNotice, /do not identify individual visitors or people who saved a service/);
  assert.deepEqual(await fixture.evaluate(() => [...document.querySelectorAll('a[href^="#"]')].filter(link => !document.getElementById(link.hash.slice(1))).map(link => link.hash)), []);
  assert.equal(await fixture.evaluate(() => document.querySelectorAll('script, iframe, form').length), 0);
  for (const width of [320, 768, 1280]) {
    await fixture.viewport(width);
    assert.equal(await fixture.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  }
  await fixture.viewport(320);
  await fixture.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  assert.equal(await fixture.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  await fixture.evaluate(() => { document.documentElement.style.fontSize = ''; });
  for (const scheme of ['light', 'dark']) {
    await fixture.api('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
    assert.deepEqual((await measureFormContrast(fixture, '[aria-labelledby="booking-messages"]')).failures, []);
  }
  await fixture.evaluate(() => document.getElementById('booking-messages').scrollIntoView());
  await fixture.screenshot(`docs/${artifactPrefix}-chrome-320.png`, false);
  assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.blocked, []); assert.deepEqual(fixture.network, []);
  console.log('Passed: generated English policy, exact access/retention copy, initial-message explanation, valid deep link/contents, static script-free rendering, 320/768/1280 reflow, 200% text and light/dark contrast. Synthetic configuration only.');
} finally { await fixture.close(); }
