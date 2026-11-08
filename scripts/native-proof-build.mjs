import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

// No Vite configuration, dotenv, server module, network or app startup is loaded.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const proofRoot = path.join(root, 'client/src/native/proof');
const output = path.join(root, 'output/native-proof/www');
const entry = path.join(proofRoot, 'main.tsx');
const html = await fs.readFile(path.join(proofRoot, 'index.html'), 'utf8');
assert.match(html, /<head[\s>]/i, 'Capacitor proof needs a head element');
assert.match(html, /(?:\.\/)?main\.tsx/, 'Expected the isolated proof entry');
await fs.mkdir(path.join(output, 'assets'), { recursive: true });
for (const file of ['index.html', 'assets/main.js', 'assets/main.css']) {
  await fs.rm(path.join(output, file), { force: true });
}
const bundle = await build({
  absWorkingDir: root,
  entryPoints: [entry],
  outfile: path.join(output, 'assets/main.js'),
  bundle: true,
  platform: 'browser',
  format: 'esm',
  jsx: 'automatic',
  target: ['chrome120', 'safari17'],
  minify: true,
  sourcemap: false,
  metafile: true,
  plugins: [{ name: 'isolated-proof-inputs', setup(builder) {
    builder.onLoad({ filter: /.*/ }, args => {
      const relative = path.relative(root, args.path).replaceAll('\\', '/');
      assert.ok(relative.startsWith('client/src/native/') || relative === 'shared/native-proof.ts'
        || relative.startsWith('node_modules/'), `Refused proof input before loading: ${relative}`);
      assert.ok(!/(^|\/)\.env(?:\.|$)/i.test(relative), 'Private configuration is forbidden');
      return undefined;
    });
  } }],
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
});
const inputs = Object.keys(bundle.metafile.inputs).sort();
for (const input of inputs) {
  const normalized = input.replaceAll('\\', '/');
  assert.ok(normalized.startsWith('client/src/native/') || normalized === 'shared/native-proof.ts'
    || normalized.startsWith('node_modules/'), `Unexpected proof input: ${normalized}`);
  assert.ok(!/(^|\/)\.env(?:\.|$)/i.test(normalized), 'Private configuration is forbidden');
}
const builtHtml = html.replace(/(?:\.\/)?main\.tsx/g, './assets/main.js');
await fs.writeFile(path.join(output, 'index.html'), builtHtml);
const files = [];
for (const filename of ['index.html', 'assets/main.js', 'assets/main.css']) {
  try {
    const data = await fs.readFile(path.join(output, filename));
    files.push({ path: filename, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
if (files.some(file => file.path === 'assets/main.css') && !builtHtml.includes('assets/main.css')) {
  await fs.writeFile(path.join(output, 'index.html'), builtHtml.replace('</head>', '<link rel="stylesheet" href="./assets/main.css"></head>'));
  const data = await fs.readFile(path.join(output, 'index.html'));
  Object.assign(files.find(file => file.path === 'index.html'), { bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
}
await fs.writeFile(path.join(root, 'output/native-proof/web-manifest.json'), JSON.stringify({
  proofOnly: true, privateConfigurationLoaded: false, applicationStarted: false,
  inputs, files,
}, null, 2) + '\n');
console.log(`Built isolated native proof: ${files.length} files; ${inputs.length} allowlisted source inputs.`);
