// Local metadata only: no base .env, runtime/db imports, startup or service requests.
import { readFileSync, statSync } from "node:fs";
import { loadLocalBillingConfiguration } from "../server/billing/local-diagnostics.ts";

const result = loadLocalBillingConfiguration(filename => {
  const file = new URL(`../${filename}`, import.meta.url);
  if (statSync(file).size > 16384) throw new Error("Bounded local input refused");
  return readFileSync(file, "utf8");
});
console.log(JSON.stringify({ ...result.diagnostics, baseFileRead: false, connectedOperations: false }));
if (!result.diagnostics.configurationValid) process.exitCode = 1;
