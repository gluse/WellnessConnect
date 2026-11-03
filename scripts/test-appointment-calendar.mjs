import assert from "node:assert/strict";
import { calendarDayMinutes, calendarDays, calendarSegments, localDateKey, shiftCalendarDay } from "../client/src/lib/appointment-calendar.ts";
const previousTimezone = process.env.TZ;
try {
  process.env.TZ = "Europe/Riga";
  const event = (id, date, duration, saved = duration) => ({ key: `booking:${id}`, rows: [{ id, scheduledDate: date, bookingDuration: saved, service: { duration } }] });
  const day = new Date(2026, 10, 3);
  assert.deepEqual(calendarDays(day, "week").map(localDateKey), ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"]);
  assert.equal(localDateKey(shiftCalendarDay(new Date(2026, 11, 31), 1)), "2027-01-01");
  assert.equal(localDateKey(shiftCalendarDay(new Date(2028, 1, 28), 1)), "2028-02-29");
  const timed = [15, 30, 60, 180].map((duration, index) => event(index + 1, "2026-11-03T09:00:00+02:00", duration));
  const segments = calendarSegments(timed, calendarDays(day, "day"));
  assert.deepEqual(segments.map(item => item.end - item.start).sort((a, b) => a - b), [15, 30, 60, 180]);
  assert.ok(segments.every(item => item.start === 540 && item.columns === 4));
  assert.equal(new Set(segments.map(item => item.column)).size, 4);
  const overlapping = calendarSegments([
    event(1, "2026-11-03T09:00:00+02:00", 180), event(2, "2026-11-03T09:30:00+02:00", 30),
    event(3, "2026-11-03T09:40:00+02:00", 40), event(4, "2026-11-03T10:00:00+02:00", 60),
    event(5, "2026-11-03T12:00:00+02:00", 30),
  ], [day]);
  assert.equal(overlapping.find(item => item.event.key === "booking:5").columns, 1, "Touching endpoints are separate clusters");
  for (const a of overlapping) for (const b of overlapping) {
    if (a !== b && a.start < b.end && b.start < a.end) assert.notEqual(a.column, b.column, "Overlapping appointments never cover each other");
  }
  const midnight = calendarSegments([event(1, "2026-11-03T23:30:00+02:00", 120)], [day, shiftCalendarDay(day, 1)]);
  assert.deepEqual(midnight.map(item => [item.day, item.start, item.end]), [["2026-11-03", 1410, 1440], ["2026-11-04", 0, 90]]);
  assert.equal(calendarSegments([event(1, "2026-11-03T09:00:00+02:00", 180, 30)], [day])[0].end, 570, "Saved duration wins over changed service duration");
  assert.equal(calendarSegments([event(1, "2026-11-03T09:00:00+02:00", 60, null)], [day])[0].end, 600, "Legacy duration falls back to service");
  assert.equal(calendarSegments([event(1, "invalid", 60), event(2, day, 0)], [day]).length, 0);
  const spring = new Date(2026, 2, 29), autumn = new Date(2026, 9, 25);
  assert.equal(calendarDayMinutes(spring), 1380); assert.equal(calendarDayMinutes(autumn), 1500);
  const springEvent = calendarSegments([event(1, "2026-03-29T00:30:00Z", 90)], [spring])[0];
  assert.equal(springEvent.end - springEvent.start, 90, "DST gap does not alter actual duration");
  assert.equal(springEvent.startsAt.getHours(), 2); assert.equal(springEvent.endsAt.getHours(), 5);
  const repeated = calendarSegments([event(1, "2026-10-25T00:30:00Z", 30), event(2, "2026-10-25T01:30:00Z", 30)], [autumn]);
  assert.equal(repeated[0].startsAt.getHours(), repeated[1].startsAt.getHours());
  assert.equal(repeated[1].start - repeated[0].start, 60, "Repeated local hours have separate real positions");
  const offset = value => new Intl.DateTimeFormat("en", { hour: "numeric", minute: "numeric", timeZoneName: "shortOffset" }).format(value);
  assert.notEqual(offset(repeated[0].startsAt), offset(repeated[1].startsAt), "Offset labels distinguish repeated times");
  console.log("Passed calendar navigation, 15/30/60/180-minute durations, overlap lanes, adjacency, midnight, saved/legacy duration, invalid data and Europe/Riga DST regressions. Offline only.");
} finally {
  if (previousTimezone === undefined) delete process.env.TZ; else process.env.TZ = previousTimezone;
}
