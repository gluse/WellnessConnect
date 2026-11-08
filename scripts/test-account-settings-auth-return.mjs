import assert from "node:assert/strict";
import { isAllowedAuthReturnTo } from "../shared/navigation.ts";

const destinations = ["/my-services/settings/pricing", "/my-services/settings/addresses"];
let cases = 0;
for (const destination of destinations) {
  assert.equal(isAllowedAuthReturnTo(destination), true, "Preserve the intended provider settings destination through sign-in");
  cases++;
  const encoded = encodeURIComponent(destination);
  assert.equal(isAllowedAuthReturnTo(new URL(`https://example.test/login?returnTo=${encoded}`).searchParams.get("returnTo")), true);
  cases++;
  for (const rejected of [
    `${destination}/`, `${destination}/other`, `${destination}-other`, destination.toUpperCase(),
    `${destination}?returnTo=https://external.example.test`, `${destination}#external`,
    `https://external.example.test${destination}`, `//external.example.test${destination}`,
    `\\external.example.test${destination}`, ` ${destination}`, `${destination}\r\n`,
    `${destination.replace("/settings/", "/settings/../")}`, encodeURIComponent(destination),
  ]) {
    assert.equal(isAllowedAuthReturnTo(rejected), false, `Reject altered or external destination: ${JSON.stringify(rejected)}`);
    cases++;
  }
}
for (const value of [undefined, null, 0, {}, [], new String(destinations[0])]) {
  assert.equal(isAllowedAuthReturnTo(value), false, "Only primitive strings can select a sign-in destination");
  cases++;
}
for (const destination of ["/", "/my-services/settings/unknown", "/my-services/settings/pricings", "/my-services/settings/address"]) {
  assert.equal(isAllowedAuthReturnTo(destination), false);
  cases++;
}
for (const destination of ["/account", "/my-services/settings", "/my-services/settings/team", "/my-services/settings/storefront", "/my-services/services/42/edit"]) {
  assert.equal(isAllowedAuthReturnTo(destination), true, "Existing return destinations remain allowed");
  cases++;
}
console.log(`Passed ${cases} offline account settings sign-in return checks; no app, database, session store or external services loaded.`);
