import assert from "node:assert/strict";

export async function checkMessagePrivacy(fixture, translations, fieldId, draft) {
  const { evaluate, key, until, set, click } = fixture;
  await set(fieldId, draft);
  assert.deepEqual(await evaluate(() => {
    const details = document.querySelector('[data-booking-message-privacy]');
    return { open: details.open, label: details.querySelector('summary').textContent.trim(),
      visibleParagraphs: [...details.querySelectorAll('p')].filter(node => node.checkVisibility()).length };
  }), { open: false, label: translations.appointmentCollaboration.privacyDetails, visibleParagraphs: 0 });
  const before = await evaluate(() => window.phase2Fixture.writes.length);
  await evaluate(() => document.querySelector('[data-booking-message-privacy] summary').focus());
  await key('Enter');
  await until(() => document.querySelector('[data-booking-message-privacy]').open, 'keyboard expands privacy');
  assert.deepEqual(await evaluate(() => {
    const details = document.querySelector('[data-booking-message-privacy]'), link = details.querySelector('a');
    return { paragraphs: [...details.querySelectorAll('p')].map(node => node.textContent),
      visible: [...details.querySelectorAll('p')].every(node => node.checkVisibility()),
      link: link.getAttribute('href'), target: link.target, rel: link.rel, label: link.textContent.trim() };
  }), { paragraphs: [translations.appointmentCollaboration.privacy, translations.appointmentCollaboration.retentionNotice], visible: true,
    link: '/privacy-policy.html#booking-messages', target: '_blank', rel: 'noopener noreferrer', label: translations.legal.privacyPolicyNewTab });
  await key('Tab');
  assert.equal(await evaluate(() => document.activeElement === document.querySelector('[data-booking-message-privacy] a')), true, 'policy link follows summary in keyboard order');
  for (const width of [1280, 768, 375, 320]) {
    await fixture.viewport(width, 900);
    assert.equal(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && (() => {
      const box = document.querySelector('[data-booking-message-privacy]').getBoundingClientRect();
      return box.left >= 0 && box.right <= innerWidth + 1;
    })()), true, `expanded privacy reflows at ${width}`);
  }
  await evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  assert.equal(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'expanded privacy reflows with 200% text');
  await evaluate(() => { document.documentElement.style.fontSize = ''; });
  await click('[data-booking-message-privacy] summary');
  assert.equal(await evaluate(() => document.querySelector('[data-booking-message-privacy]').open), false);
  assert.equal(await evaluate(id => document.getElementById(id).value, fieldId), draft, 'disclosure preserves draft');
  assert.equal(await evaluate(() => window.phase2Fixture.writes.length), before, 'disclosure never submits the form');
}
