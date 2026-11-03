import assert from "node:assert/strict";
import { isAllowedAuthReturnTo } from "../shared/navigation.ts";

// Pure validation only: no auth/server imports, sessions, network or database.
const appointmentPages = [
  "/my-services/appointments",
  "/my-services/upcoming-appointments",
  "/my-services/past-appointments",
];

for (const path of appointmentPages) {
  assert.equal(isAllowedAuthReturnTo(path), true, `Allow sign-in return to ${path}`);
  for (const candidate of [
    `${path}/`, `${path}/other`, `${path}-other`, `${path}?returnTo=//evil.invalid`,
    `${path}#other`, `https://evil.invalid${path}`, `//evil.invalid${path}`,
    `\\\\evil.invalid${path}`, `${path}/../../account`, `${path}\r\nLocation: //evil.invalid`,
    path.toUpperCase(), ` ${path}`, `${path} `,
  ]) {
    assert.equal(isAllowedAuthReturnTo(candidate), false, `Reject ${JSON.stringify(candidate)}`);
  }
}

for (const path of ["/my-services", "/my-services/services", "/my-services/services/42/edit", "/my-services/settings/team", "/my-bookings", "/account", "/search", "/providers/riga-studio?book=23", "/invite?token=synthetic"]) {
  assert.equal(isAllowedAuthReturnTo(path), true, `Preserve existing destination ${path}`);
}
for (const candidate of [undefined, null, 1, {}, [], new String(appointmentPages[1]), "", "/unknown"]) {
  assert.equal(isAllowedAuthReturnTo(candidate), false, "Reject unsupported value or destination");
}

console.log("Passed exact appointment sign-in return destinations, URL/suffix/query/control-character rejection, and existing route regressions. Offline only.");
