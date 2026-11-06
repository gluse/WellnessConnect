// Narrow release: reuse the reviewed local application image; replace gateway only.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const artifacts = path.join(process.cwd(), 'outputs/aws-staging-build');
const output = fs.mkdtempSync(path.join(artifacts, 'source-gateway-'));
const context = path.join(output, 'context');
fs.mkdirSync(context);
const dockerfile = 'FROM fitsmytime-staging:pc-2ea7c952e9935e96 AS runtime\nCOPY --chown=node:node deploy/aws/staging-proxy.mjs /app/staging-proxy.mjs\nUSER node\n';
const inputs = { Dockerfile: Buffer.from(dockerfile),
  'deploy/aws/staging-proxy.mjs': fs.readFileSync('deploy/aws/staging-proxy.mjs'),
  'deploy/aws/test-staging-proxy.mjs': fs.readFileSync('deploy/aws/test-staging-proxy.mjs') };
const files = Object.entries(inputs).map(([relative, content]) => {
  const target = path.join(context, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, content);
  return { path: relative, bytes: content.length, sha256: createHash('sha256').update(content).digest('hex') };
}).sort((a, b) => a.path.localeCompare(b.path, 'en'));
const manifest = { files, sha256: createHash('sha256').update(JSON.stringify(files)).digest('hex') };
fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(output, 'gateway-base.json'), JSON.stringify({ image: 'fitsmytime-staging:pc-2ea7c952e9935e96', imageId: 'sha256:283569798ce4701a333c4d05992b94618c5e5a6016b644346d4d0e559fec1a02', gatewayOnly: true }));
console.log(JSON.stringify({ output, sha256: manifest.sha256, files: files.length }));
