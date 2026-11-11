import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const output = 'output/aws-publish-frontend-2026-11-09';
const harness = pathToFileURL(path.resolve('scripts/fixtures/browser-harness.mjs')).href;
const entries = [
  ['settings', 'scripts/test-settings-translations-browser.mjs', source => source.replaceAll('docs/settings-translations-', output + '/settings/settings-translations-').replace('date: "2026-11-08"', 'date: "2026-11-09"')],
  ['graphs', 'scripts/test-reports-graph-browser.mjs', source => source.replace('output/reports-graph-check', output + '/graphs')],
  ['views', 'scripts/test-service-view-statistics-browser.mjs', source => source.replace('output/service-view-statistics-check', output + '/views')],
];
for (const [name, input, transform] of entries) {
  const original = await readFile(input, 'utf8');
  assert.ok(original.includes('from "./fixtures/browser-harness.mjs"'));
  await mkdir(`${output}/${name}`, { recursive: true });
  const source = transform(original.replace('from "./fixtures/browser-harness.mjs"', `from ${JSON.stringify(harness)}`));
  await writeFile(`${output}/${name}.mjs`, source);
}
