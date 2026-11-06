import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { builtinModules } from 'node:module';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

// Import the real, inert server helper with Express available but without Vite
// or its plugins. Never import server/index or server/db into the child process.
const temporaryRoot = fs.realpathSync(os.tmpdir());
const directory = fs.mkdtempSync(path.join(temporaryRoot, 'fitsmytime-production-imports-'));
try {
  fs.mkdirSync(path.join(directory, 'node_modules'));
  fs.symlinkSync(fs.realpathSync('node_modules/express'), path.join(directory, 'node_modules/express'), process.platform === 'win32' ? 'junction' : 'dir');
  const helper = await build({ entryPoints: ['server/vite.ts'], platform: 'node', packages: 'external', bundle: true,
    format: 'esm', write: false, logLevel: 'silent' });
  const helperPath = path.join(directory, 'server-helper.mjs');
  fs.writeFileSync(helperPath, helper.outputFiles[0].contents);
  const environment = Object.fromEntries(['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
  const imported = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(pathToFileURL(helperPath).href)}); console.log('PRODUCTION_HELPER_IMPORTED');`], {
    cwd: directory, env: { ...environment, NODE_ENV: 'production' }, encoding: 'utf8', timeout: 15000,
  });
  assert.equal(imported.status, 0, `Production helper import failed: ${imported.error?.code || imported.stderr}`);
  assert.equal(imported.stdout.trim(), 'PRODUCTION_HELPER_IMPORTED');

  // Check the actual application graph without executing application startup.
  const application = await build({ entryPoints: ['server/index.ts'], platform: 'node', packages: 'external', bundle: true,
    format: 'esm', write: false, metafile: true, logLevel: 'silent' });
  const manifest = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const imports = Object.values(application.metafile.outputs).flatMap(output => output.imports);
  const packageName = name => name.split('/').slice(0, name.startsWith('@') ? 2 : 1).join('/');
  const missingProductionPackages = imports.filter(item => item.external && item.kind === 'import-statement'
    && !item.path.startsWith('node:') && !builtinModules.includes(item.path)
    && !Object.hasOwn(manifest.dependencies || {}, packageName(item.path)));
  assert.deepEqual(missingProductionPackages, [], 'Application startup has static imports absent from production dependencies');
  console.log('Production server packaging passes: real helper imports without development packages; application graph has only production static packages.');
} finally {
  const resolved = path.resolve(directory);
  assert.equal(path.dirname(resolved), temporaryRoot, 'Cleanup target must remain in its verified temporary directory');
  assert.ok(path.basename(resolved).startsWith('fitsmytime-production-imports-'));
  fs.rmSync(resolved, { recursive: true, force: true });
}
