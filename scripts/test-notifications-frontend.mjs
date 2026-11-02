import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { safeNotificationHref } from "../client/src/lib/notification-links.ts";
import { createServiceDraft } from "../client/src/components/provider/service-draft.ts";
import { validateServiceDraft } from "../client/src/components/provider/service-field-feedback.tsx";

const message = encodeURIComponent("Requested service Ārstēšana & <script> ‘✓’ 2030-01-18 15:00 (Europe/Riga) has been accepted.");
assert.equal(safeNotificationHref("email", `mailto:customer%2Bbooking%40example.test?subject=Booking%20update&body=${message}`), `mailto:customer%2Bbooking%40example.test?subject=Booking%20update&body=${message}`);
assert.equal(safeNotificationHref("sms", `sms:+37120000000?body=${message}`), `sms:+37120000000?body=${message}`);
assert.equal(safeNotificationHref("whatsapp", `https://wa.me/37120000000?text=${message}`), `https://wa.me/37120000000?text=${message}`);
for (const method of ["email", "sms", "whatsapp"]) for (const href of ["javascript:alert(1)", "data:text/html,x", "https://wa.me.evil.test/37120000000?text=x", "https://wa.me@evil.test/37120000000?text=x", "https://evil.test", "sms:+37120000000\r\n?body=x", "mailto:customer%0A@example.test?subject=x&body=y"]) assert.equal(safeNotificationHref(method, href), undefined, method + ": " + href);
const valid = { ...createServiceDraft(), name: "Synthetic", category: "education", price: "25", addressId: 3 };
assert.equal(valid.reminderEnabled, false); assert.equal(valid.reminderMethod, "email"); assert.equal(valid.reminderHours, 24);
for (const reminderHours of [1, 24, 168]) assert.equal(validateServiceDraft({ ...valid, reminderHours }).reminderHours, undefined);
for (const reminderHours of [0, 169, 1.5, Number.NaN]) assert.equal(validateServiceDraft({ ...valid, reminderHours }).reminderHours, "notifications.hoursInvalid");
const languages = ["en", "lv", "ru"];
const flatten = (value, prefix = "") => Object.entries(value).flatMap(([key, text]) => typeof text === "string" ? [[prefix + key, text]] : flatten(text, prefix + key + "."));
let canonical;
for (const language of languages) {
  const data = JSON.parse(await readFile(new URL(`../client/public/locales/${language}/translation.json`, import.meta.url), "utf8"));
  const entries = flatten(data.notifications);
  canonical ??= entries.map(([key]) => key).sort();
  assert.deepEqual(entries.map(([key]) => key).sort(), canonical);
  for (const [key, text] of entries) assert.ok(text.trim(), language + ": " + key);
}
console.log("Passed notification link scheme/encoded-email guards, service reminder defaults/bounds, en/lv/ru notification resources. Browser interaction coverage runs separately.");
