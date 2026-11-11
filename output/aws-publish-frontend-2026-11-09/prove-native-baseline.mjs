import { execFileSync, spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const folder = 'output/aws-publish-frontend-2026-11-09';
const url = relative => pathToFileURL(path.resolve(relative)).href;
const baseline = execFileSync('git', ['show', '81b68e5:client/src/native/client.ts'], { encoding: 'utf8' });
await writeFile(`${folder}/baseline-client.ts`, baseline.replace('"../../../shared/native-proof"', JSON.stringify(url('shared/native-proof.ts'))));
let test = await readFile('scripts/test-native-client-proof.mjs', 'utf8');
for (const [before, after] of [
  ['../client/src/native/client.ts', `${folder}/baseline-client.ts`],
  ['../client/src/native/proof/NativeProof.tsx', 'client/src/native/proof/NativeProof.tsx'],
  ['../client/src/native/proof/messages.ts', 'client/src/native/proof/messages.ts'],
  ['../server/native-proof/service.ts', 'server/native-proof/service.ts'],
  ['../shared/native-proof.ts', 'shared/native-proof.ts'],
]) test = test.replace(JSON.stringify(before), JSON.stringify(url(after)));
await writeFile(`${folder}/baseline-native-client-test.mjs`, test);
const result = spawnSync(process.execPath, ['--import', 'tsx', `${folder}/baseline-native-client-test.mjs`], { encoding: 'utf8', windowsHide: true });
await writeFile(`${folder}/native-client-baseline-result.txt`, result.stdout + result.stderr);
process.stdout.write(result.stdout + result.stderr);
process.exitCode = result.status;
