import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = process.cwd();
const artifacts = path.join(root, 'outputs/aws-staging-build');
fs.mkdirSync(artifacts, { recursive: true });
const output = fs.mkdtempSync(path.join(artifacts, 'source-'));
const context = path.join(output, 'context');
fs.mkdirSync(context);
const files = [];
const roots = ['package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'tailwind.config.ts', 'postcss.config.js', 'Dockerfile', '.dockerignore',
  'client', 'server', 'shared', 'migrations', 'scripts/privacy-policy.ts', 'deploy/aws/staging-proxy.mjs', 'deploy/aws/test-staging-proxy.mjs',
  'deploy/aws/buildspec.yaml', 'deploy/aws-staging/supabase-ca.crt'];
const denied = /(^|\/)(?:\.env[^/]*|node_modules|\.git|\.cache|\.vite)(\/|$)|\.(?:key|pem|dump|tsbuildinfo)$/i;
const secret = /(?:AKIA|ASIA)[A-Z0-9]{16}|sb_secret_[A-Za-z0-9_-]{24,}|sk-proj-[A-Za-z0-9_-]{24,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/;
function copy(relative) {
  if (denied.test(relative)) return;
  const input = path.join(root, relative);
  const stat = fs.lstatSync(input);
  if (stat.isSymbolicLink()) throw Error(`Source symlink refused: ${relative}`);
  if (stat.isDirectory()) { for (const name of fs.readdirSync(input).sort()) copy(`${relative}/${name}`); return; }
  if (!stat.isFile()) throw Error(`Unexpected source type: ${relative}`);
  const content = fs.readFileSync(input);
  if (/\.(?:[cm]?[jt]sx?|json|html|css|ya?ml|sql)$/.test(relative) && secret.test(content.toString('utf8'))) throw Error(`Credential-shaped content refused: ${relative}`);
  const target = path.join(context, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
  files.push({ path: relative, bytes: content.length, sha256: createHash('sha256').update(content).digest('hex') });
}
for (const relative of roots) copy(relative);
files.sort((left, right) => left.path.localeCompare(right.path, 'en'));
const manifest = { files, sha256: createHash('sha256').update(JSON.stringify(files)).digest('hex') };
fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ output, context, manifest: path.join(output, 'manifest.json'), sha256: manifest.sha256,
  files: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0) }));
