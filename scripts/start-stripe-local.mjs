// Explicit future startup command. Never imported by tests or ordinary npm run dev.
import { readFileSync, statSync } from "node:fs";
import { parse } from "dotenv";
import { loadLocalBillingConfiguration } from "../server/billing/local-diagnostics.ts";
import { selectLocalBillingRuntime } from "../server/billing/runtime.ts";

let stage = "local_configuration";
try {
  const result = loadLocalBillingConfiguration(filename => {
    const file = new URL(`../${filename}`, import.meta.url);
    if (statSync(file).size > 16384) throw new Error("Bounded local input refused");
    return readFileSync(file, "utf8");
  });
  if (!result.config) {
    console.error(JSON.stringify(result.diagnostics));
    process.exitCode = 1;
  } else {
    const config = result.config;
    // Existing app Auth/session settings are reused only after an explicit database selection.
    stage = "base_configuration";
    const baseFile = new URL("../.env", import.meta.url);
    if (statSync(baseFile).size > 65536) throw new Error("Bounded local input refused");
    const base = parse(readFileSync(baseFile, "utf8"));
    for (const [key, value] of Object.entries(base)) if (process.env[key] === undefined) process.env[key] = value;
    Object.assign(process.env, { NODE_ENV: "development", DATABASE_URL: config.databaseUrl, APP_URL: config.origin,
      PORT: "5000", AUDIT_ENABLED: "true", AUDIT_ENVIRONMENT: "development" });
    selectLocalBillingRuntime(config);
    stage = "application_import";
    await import("../server/index.ts");
  }
} catch {
  console.error(JSON.stringify({ stage, category: "local_billing_startup_refused" }));
  process.exitCode = 1;
}
