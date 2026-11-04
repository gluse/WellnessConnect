import assert from "node:assert/strict";
import { formatDateTime24 } from "../client/src/lib/date-time.ts";
import { appointmentTime } from "../client/src/components/booking-collaboration.tsx";
import { isTime24 } from "../client/src/components/ui/time-input.tsx";

let cases = 0;
for (const language of ["en", "lv", "ru"]) {
  for (const [instant, expected] of [["00:00", "00:00"], ["09:05", "09:05"], ["12:00", "12:00"], ["15:45", "15:45"], ["23:59", "23:59"]]) {
    const value = `2030-01-18T${instant}:00Z`;
    const display = formatDateTime24(value, language, { timeZone: "UTC", hour: "2-digit", minute: "2-digit" });
    assert.equal(display, expected);
    assert.ok(appointmentTime(value, language, "UTC").includes(expected));
    assert.doesNotMatch(formatDateTime24(value, language, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }), /\b[AP]M\b/i);
    cases++;
  }
  assert.match(appointmentTime("2030-01-18T13:45:00Z", language, "Europe/Riga"), /15:45.*Europe\/Riga/);
  const original = new Date("2030-01-18T15:45:12Z");
  const defaultDisplay = formatDateTime24(original, language);
  assert.ok(defaultDisplay.includes(original.toLocaleDateString(language)), "Preserve numeric locale dates");
  assert.ok(defaultDisplay.includes(original.toLocaleTimeString(language, { hour12: false })), "Preserve seconds");
  // Both occurrences of a repeated local time keep their timezone abbreviation.
  const options = { timeZone: "America/New_York", timeZoneName: "short", hour: "2-digit", minute: "2-digit" };
  const first = formatDateTime24("2030-11-03T05:30:00Z", language, options);
  const second = formatDateTime24("2030-11-03T06:30:00Z", language, options);
  assert.match(first, /01:30/); assert.match(second, /01:30/); assert.notEqual(first, second);
}
assert.equal(formatDateTime24("2030-01-18T00:00:00Z", "en-US-u-hc-h12", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" }), "00:00");
for (const value of ["00:00", "09:05", "12:00", "23:59"]) assert.ok(isTime24(value), value);
for (const value of ["", "9:05", "24:00", "23:60", "12:00 PM", "15:30:00", "aa:bb"]) assert.equal(isTime24(value), false, value);
console.log(`Passed ${cases} en/lv/ru clock cases, timezone/DST labels, 12-hour locale override and HH:mm validation.`);
