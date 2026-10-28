import assert from "node:assert/strict";
import { invitationEmailDiagnostic, sendInvitationEmailOnce } from "../server/invitationEmail.ts";

let cases = 0;
for (const [code, reason] of [
  ["email_address_not_authorized", "recipient_restricted"],
  ["over_email_send_rate_limit", "rate_limited"],
  ["email_exists", "existing_account"],
  ["user_already_exists", "existing_account"],
]) {
  assert.deepEqual(invitationEmailDiagnostic({ code, status: 422, message: "recipient@example.test?token=private", stack: "secret-stack", headers: { authorization: "private-key" } }), {
    event: "company_invitation_email_failed", reason, providerCode: code, status: 422,
  }); cases++;
}
for (const error of [null, undefined, "private-message", 42, false, {}, new Error("private-message"), { code: "__proto__" }, { code: "constructor" }, { code: "toString" }, { code: "unknown-private-code" }, { code: ["email_exists"] }]) {
  assert.deepEqual(invitationEmailDiagnostic(error), { event: "company_invitation_email_failed", reason: "provider_error", providerCode: "other", status: null }); cases++;
}
for (const status of [400, 422, 429, 500, 599, 200, 399, 600, 1.5, NaN, Infinity, "429", null, undefined]) {
  assert.equal(invitationEmailDiagnostic({ status }).status, typeof status === "number" && Number.isInteger(status) && status >= 400 && status <= 599 ? status : null); cases++;
}
for (const thrown of [false, true]) {
  let attempts = 0; const warnings = [];
  const result = await sendInvitationEmailOnce(async () => {
    attempts++;
    const error = { code: "over_email_send_rate_limit", status: 429, message: "private-recipient-and-link" };
    if (thrown) throw error;
    return { error };
  }, diagnostic => warnings.push(diagnostic));
  assert.equal(result, false); assert.equal(attempts, 1); assert.equal(warnings.length, 1);
  assert.deepEqual(warnings[0], { event: "company_invitation_email_failed", reason: "rate_limited", providerCode: "over_email_send_rate_limit", status: 429 }); cases++;
}
let attempts = 0;
assert.equal(await sendInvitationEmailOnce(async () => { attempts++; return { error: null }; }, () => assert.fail("Successful mail must not log failure")), true);
assert.equal(attempts, 1); cases++;
assert.equal(await sendInvitationEmailOnce(async () => { throw new Error("private"); }, () => { throw Error("logger unavailable"); }), false); cases++;
assert.equal(await sendInvitationEmailOnce(async () => { throw undefined; }, diagnostic => assert.equal(diagnostic.reason, "provider_error")), false); cases++;
console.log(`Passed ${cases} pure invitation email diagnostic cases: allowlisted fields, malformed errors/statuses, redaction, one attempt, returned/thrown failures and logger failure fallback.`);
