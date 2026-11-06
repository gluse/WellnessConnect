// Regression: production ESM bundling must never turn imported DB tools into CLIs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fitsmytime-readiness-bundle-'));
try {
  const bundled = await build({
    entryPoints: [path.join(root, 'migrations/workspace-pricing/application-readiness.mjs')],
    bundle: true, platform: 'node', packages: 'external', format: 'esm', write: false, metafile: true,
  });
  const entry = path.join(directory, 'readiness.mjs');
  fs.writeFileSync(entry, bundled.outputFiles[0].contents);
  const environment = Object.fromEntries(['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP']
    .filter(key => typeof process.env[key] === 'string').map(key => [key, process.env[key]]));
  // No private variables, argv mode, app entrypoint, config file or database module.
  const result = spawnSync(process.execPath, [entry], { cwd: directory, env: environment, encoding: 'utf8', timeout: 10000, windowsHide: true });
  assert.equal(result.status, 0, `Bundled readiness import failed: ${result.stdout || result.stderr}`);
  assert.equal(result.stdout, '', 'Import must not emit CLI output');
  assert.equal(result.stderr, '', 'Import must not produce diagnostics');
  const inputs = Object.keys(bundled.metafile.inputs).map(input => input.replaceAll('\\', '/'));
  assert.ok(!inputs.some(input => /\/(?:execute-runtime-setup|execute-runtime-disabled|search-location-runtime)\.mjs$/.test(input)),
    'Application readiness must not include runtime installer/privileged-verifier implementations');
  console.log(`Production readiness bundle is inert (${bundled.outputFiles[0].contents.length} bytes); no installer CLI code included.`);
} finally {
  const resolved = path.resolve(directory);
  assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
  assert.ok(path.basename(resolved).startsWith('fitsmytime-readiness-bundle-'));
  fs.rmSync(resolved, { recursive: true, force: true });
}
