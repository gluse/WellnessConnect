// Local-routing guard only. No private configuration reads or database imports.
import { lstatSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const HISTORICAL_COMMANDS = Object.freeze({
  'db:push': ['node_modules/drizzle-kit/bin.cjs', 'push'],
  'db:setup-storefronts': ['scripts/setup-storefronts.mjs'],
  'db:setup-company': ['scripts/setup-company.mjs'],
  'db:setup-reviews': ['scripts/setup-reviews.mjs'],
  'db:setup-categories': ['scripts/setup-categories.mjs'],
  'db:setup-cleanup-time': ['scripts/setup-cleanup-time.mjs'],
  'db:setup-locations': ['scripts/setup-locations.mjs'],
  'db:setup-addresses': ['scripts/setup-addresses.mjs'],
  'db:mark-locations-verified': ['--import', 'tsx', 'scripts/mark-locations-verified.mjs'],
  'db:transfer': ['scripts/migrate-to-supabase.mjs'],
  'storage:setup': ['scripts/setup-storage.mjs'],
  'test:integration': ['scripts/test-supabase-integration.mjs'],
});
export function runHistoricalOperation(operation, args, { localProfilePresent, run }) {
  if (!Object.hasOwn(HISTORICAL_COMMANDS, operation)) throw new Error('UNKNOWN_HISTORICAL_OPERATION');
  if (localProfilePresent) throw new Error('LOCAL_COPY_REQUIRES_EXPLICIT_TARGET_REVIEW');
  return run(process.execPath, [...HISTORICAL_COMMANDS[operation], ...args]);
}
function profilePresent() {
  try { lstatSync(path.join(ROOT, '.env.local-docker.local')); return true; }
  catch (error) { if (error?.code === 'ENOENT') return false; return true; }
}
function main() {
  try {
    runHistoricalOperation(process.argv[2], process.argv.slice(3), { localProfilePresent: profilePresent(), run(program, args) {
      const child = spawn(program, args, { cwd: ROOT, env: process.env, stdio: 'inherit', windowsHide: true });
      for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal));
      child.once('error', () => { console.error('Reviewed operation could not start.'); process.exitCode = 1; });
      child.once('exit', code => { process.exitCode = code ?? 1; });
    } });
  } catch {
    console.error('Operation refused: this historical command loads hosted .env. The independent local copy is active; review the exact target with the DB owner and use an explicitly approved command. No database or storage operation was started.');
    process.exitCode = 1;
  }
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main();
