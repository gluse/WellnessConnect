import { mkdir, readdir, copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const output = 'outputs/aws-staging-build/live-frontend-20261109';
const archive = path.join(output, 'initial-stale-run');
await mkdir(archive, { recursive: false });
for (const file of await readdir(output)) if (/^login-(en|lv|ru)-(phone|desktop)\.png$/.test(file)) await copyFile(path.join(output, file), path.join(archive, file));
await writeFile(path.join(archive, 'failure.json'), JSON.stringify({
  date: '2026-11-09', command: 'node scripts/test-aws-staging-guest-browser.mjs --active-gateway-verified --replacement-20261109',
  passed: false, error: 'LANDING_NOT_RENDERED', runtimeErrors: 0, blockedRequests: 1,
  diagnosis: 'Source routes / and /search to Home, while the historical runner expected unused Landing controls. The default search API source now fetches GET /api/services/search/page?limit=24&sort=default, absent from the old allowlist. This path is source-derived; the first failed process did not persist its blocked-request trace.',
  reached: 'Six en/lv/ru login phone/desktop screenshots were saved before failure. Final auth-challenge/cookie acceptance was not reached.',
  privateValuesSaved: false,
}, null, 2));
