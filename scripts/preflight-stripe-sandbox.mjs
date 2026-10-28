import { readFileSync, lstatSync } from "node:fs";
import { parseStripeSandboxText, parseStripeSandboxPreparation, stripeSandboxMetadata, stripeSandboxFailureMetadata } from "../server/billing/sandbox-config.ts";
import { createStripeOwnAccountReader, checkStripeOwnAccount, stripeSandboxFailureCategory } from "../server/billing/sandbox-preflight.ts";

// Explicit CLI only. Never import dotenv or any server/bootstrap/database module.
const args = process.argv.slice(2);
let connected = false;
let safeMetadata;
try {
  if (args.length > 1 || (args.length === 1 && !["--local", "--account"].includes(args[0]))) throw new Error();
  const path = new URL("../.env.stripe.local", import.meta.url);
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16384) throw new Error();
  const config = parseStripeSandboxPreparation(parseStripeSandboxText(readFileSync(path, "utf8")));
  const metadata = stripeSandboxMetadata(config);
  safeMetadata = metadata;
  if (args[0] === "--account") {
    // DO NOT invoke without separately authorized one-shot GET /v1/account scope.
    const reader = createStripeOwnAccountReader(config);
    connected = true;
    const result = await checkStripeOwnAccount(config, reader);
    process.stdout.write(JSON.stringify({ ...metadata, connectedCheckAttempted: true, ...result }) + "\n");
  } else process.stdout.write(JSON.stringify({ ...metadata, connectedCheckAttempted: false }) + "\n");
} catch (error) {
  // No raw error, environment, SDK response, key, account ID or origin is ever printed.
  process.stdout.write(JSON.stringify(stripeSandboxFailureMetadata(safeMetadata, connected, stripeSandboxFailureCategory(error))) + "\n");
  process.exitCode = 1;
}
