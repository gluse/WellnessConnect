import assert from "node:assert/strict";
import { durationInMinutes, formatServiceDuration, preferredDurationUnit } from "../client/src/lib/service-duration.ts";

for (const [input, unit, minutes] of [["2", "day", 2880], ["1.5", "day", 2160], ["1,5", "day", 2160], ["1.5", "hour", 90], ["1,5", "hour", 90], ["1.1", "hour", 66], ["1.025", "hour", 61.5], ["45", "minute", 45]]) {
  assert.ok(Math.abs(durationInMinutes(input, unit) - minutes) < 1e-9, `${input} ${unit}`);
}
assert.equal(Number.isInteger(durationInMinutes("1.025", "hour")), false, "partial minutes stay invalid");
assert.ok(Number.isNaN(durationInMinutes("", "hour")));
assert.ok(Number.isNaN(durationInMinutes("abc", "day")));
for (const value of ["0x10", "Infinity", "1,2.3", " "]) assert.ok(Number.isNaN(durationInMinutes(value, "hour")), value);
for (const [minutes, unit] of [[45, "minute"], [90, "minute"], [120, "hour"], [1440, "day"], [2880, "day"]]) assert.equal(preferredDurationUnit(minutes), unit);

const expected = {
  en: ["1 minute", "2 minutes", "1 hour", "2 hours", "1 day", "2 days", "1 hour, 30 minutes", "1 day, 1 hour, 1 minute"],
  lv: ["1 minūte", "2 minūtes", "1 stunda", "2 stundas", "1 diena", "2 dienas", "1 stunda un 30 minūšu", "1 diena, 1 stunda un 1 minūte"],
  ru: ["1 минута", "2 минуты", "1 час", "2 часа", "1 день", "2 дня", "1 час 30 минут", "1 день 1 час 1 минута"],
};
for (const [language, values] of Object.entries(expected)) {
  for (const [index, minutes] of [1, 2, 60, 120, 1440, 2880, 90, 1501].entries()) assert.equal(formatServiceDuration(minutes, language), values[index], `${language}: ${minutes}`);
}
assert.equal(formatServiceDuration(21, "ru"), "21 минута");
assert.equal(formatServiceDuration(25, "ru"), "25 минут");
console.log("Passed duration conversion and exact en/lv/ru unit/plural formatting.");
