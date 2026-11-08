import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { serviceImages, imageDraft } from '../client/src/lib/service-images.ts';
import { createServiceDraft } from '../client/src/components/provider/service-draft.ts';

assert.deepEqual(serviceImages({ imageUrl: 'legacy' }), ['legacy']);
assert.deepEqual(serviceImages({ imageUrl: 'legacy', imageUrls: [] }), ['legacy']);
assert.deepEqual(serviceImages({ imageUrl: 'old', imageUrls: ['new', 'second', 'new'] }), ['new', 'second']);
assert.deepEqual(serviceImages({ imageUrl: null, imageUrls: [] }), []);
assert.equal(serviceImages({ imageUrls: Array.from({ length: 12 }, (_, i) => String(i)) }).length, 10);
assert.deepEqual(imageDraft([]), { imageUrls: [], imageUrl: '' });
assert.deepEqual(imageDraft(['cover', 'second']), { imageUrls: ['cover', 'second'], imageUrl: 'cover' });
assert.deepEqual(createServiceDraft({ imageUrl: 'legacy', imageUrls: [] }).imageUrls, ['legacy']);
assert.equal(createServiceDraft({ imageUrl: 'legacy', imageUrls: ['cover', 'second'] }).imageUrl, 'cover');
for (const language of ['en', 'lv', 'ru']) {
  const messages = JSON.parse(await readFile(`client/public/locales/${language}/translation.json`, 'utf8')).servicePictures;
  for (const key of ['title','help','proHelp','retained','cover','makeCover','makeCoverLabel','remove','removeLabel','add','selected','preview','gallery','position','previous','next','unavailable','alt']) assert.ok(messages[key], `${language}.${key}`);
  assert.match(messages.help, /{{max}}/);
  assert.match(messages.help, /10/);
  assert.deepEqual(messages.alt.match(/{{\w+}}/g), ['{{name}}','{{current}}','{{total}}']);
}
console.log('Service picture frontend helpers passed: legacy compatibility, explicit clear, deduplication/bounds, cover synchronization and en/lv/ru messages.');
