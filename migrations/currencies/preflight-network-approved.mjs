// One newly authorized network-enabled READ-ONLY preflight. Preserve prior receipt.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { preflight, APPROVED_SOURCE, admission } from './preflight-approved.mjs';

const args = process.argv.slice(2);
admission(args);
const prior = await readFile(new URL('./source-preflight-receipt.json', import.meta.url));
const priorSha256 = createHash('sha256').update(prior).digest('hex');
if (priorSha256 !== 'be49a9d521506978983786845cfd71ea6b725b1f345e072ca1cbc37c06af1977') throw new Error('TASK039_PRIOR_RECEIPT_CHANGED');
const receiptURL = new URL('./source-network-preflight-receipt.json', import.meta.url);
const result = await preflight(args, {
  async create(value) {
    value.networkAuthorization = 'User approved one fresh read-only preflight with network access for development ' + APPROVED_SOURCE + ', 5 November 2026';
    value.priorReceiptSha256 = priorSha256;
    await writeFile(receiptURL, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  },
  async save(value) { await writeFile(receiptURL, JSON.stringify(value, null, 2) + '\n'); },
});
if (!result.passed) process.exitCode = 1;
