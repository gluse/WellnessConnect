import type { Availability, Booking, Service } from "./schema";

export type TimeRange = { startTime: string; endTime: string };
export type BookableSlot = TimeRange & { startsAt: string; endsAt: string; timezone: string; available: boolean; slotDuration: number };
const formatters = new Map<string, Intl.DateTimeFormat>();
export function validTimezone(value: string) {
  try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
}
export function validDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
function parts(value: Date, zone: string) {
  let formatter = formatters.get(zone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-GB", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
    formatters.set(zone, formatter);
  }
  return Object.fromEntries(formatter.formatToParts(value).map(part => [part.type, part.value]));
}
export function dateInZone(value: Date, zone: string) {
  const p = parts(value, zone); return `${p.year}-${p.month}-${p.day}`;
}
function timeInZone(value: Date, zone: string) {
  const p = parts(value, zone); return `${p.hour}:${p.minute}`;
}
export function addDateDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10);
}
// Check both offsets around daylight-saving transitions. Nonexistent local
// times produce no instant; repeated times can produce two distinct slots.
function localInstants(date: string, time: string, zone: string, offsets: number[]) {
  const wall = Date.parse(`${date}T${time}:00Z`);
  return offsets.map(offset => new Date(wall - offset)).filter(value => dateInZone(value, zone) === date && timeInZone(value, zone) === time);
}
function zoneOffsets(date: string, zone: string) {
  const noon = Date.parse(`${date}T12:00:00Z`);
  return Array.from(new Set([-24, 0, 24].map(hours => {
    const instant = new Date(noon + hours * 3_600_000), p = parts(instant, zone);
    return Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`) - instant.getTime();
  })));
}
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const time = (value: number) => `${Math.floor(value / 60).toString().padStart(2, "0")}:${(value % 60).toString().padStart(2, "0")}`;
export function scheduleDate(schedule: Pick<Availability, "specificDate">) {
  return schedule.specificDate ? new Date(schedule.specificDate).toISOString().slice(0, 10) : null;
}
export function workingRanges(schedule: Pick<Availability, "startTime" | "endTime" | "breaks">): TimeRange[] {
  let ranges = [{ startTime: schedule.startTime, endTime: schedule.endTime }].filter(range => range.startTime < range.endTime);
  for (const pause of schedule.breaks || []) {
    ranges = ranges.flatMap(range => {
      if (pause.endTime <= range.startTime || pause.startTime >= range.endTime) return [range];
      return [
        { startTime: range.startTime, endTime: pause.startTime < range.endTime ? pause.startTime : range.endTime },
        { startTime: pause.endTime > range.startTime ? pause.endTime : range.startTime, endTime: range.endTime },
      ].filter(item => item.startTime < item.endTime);
    });
  }
  return ranges;
}
function withinRecurrence(schedule: Availability, day: string) {
  if (schedule.recurrenceEndType === "on_date" && schedule.recurrenceEndValue && day > schedule.recurrenceEndValue.slice(0, 10)) return false;
  if (schedule.recurrenceEndType === "after_events" && schedule.createdAt) {
    const start = dateInZone(new Date(schedule.createdAt), schedule.timezone);
    const elapsed = Math.floor((Date.parse(day) - Date.parse(start)) / 86_400_000);
    const limit = Number(schedule.recurrenceEndValue);
    if (elapsed < 0 || !Number.isFinite(limit) || limit <= 0) return false;
    const weekday = new Date(start).getUTCDay();
    const count = Math.floor((elapsed + 1) / 7) * (schedule.daysOfWeek?.length || 0)
      + Array.from({ length: (elapsed + 1) % 7 }, (_, index) => (weekday + index) % 7).filter(value => schedule.daysOfWeek?.includes(value)).length;
    if (count > limit) return false;
  }
  return true;
}

export function bookableSlots({ service, schedules, bookings, date, timezone, now = new Date() }: {
  service: Pick<Service, "id" | "duration"> & Partial<Pick<Service, "cleanupTime">>;
  schedules: Availability[];
  bookings: (Pick<Booking, "scheduledDate" | "bookingDuration" | "status"> & Partial<Pick<Booking, "bookingCleanupTime">>)[];
  date: string;
  timezone: string;
  now?: Date;
}): BookableSlot[] {
  const relevant = schedules.filter(item => item.isActive !== false && (item.serviceId == null || item.serviceId === service.id));
  const result = new Map<string, BookableSlot>();
  const duration = service.duration;
  const occupiedDuration = duration + (service.cleanupTime ?? 0);
  if (duration <= 0) return [];
  const zones = Array.from(new Set(relevant.map(item => item.timezone))).filter(validTimezone);
  for (const zone of zones) {
    const inZone = relevant.filter(item => item.timezone === zone);
    for (const delta of [-2, -1, 0, 1, 2]) {
      const day = addDateDays(date, delta), weekday = new Date(day).getUTCDay();
      const serviceExceptions = inZone.filter(item => item.serviceId === service.id && item.scheduleType === "specific" && scheduleDate(item) === day);
      const generalExceptions = inZone.filter(item => item.serviceId == null && item.scheduleType === "specific" && scheduleDate(item) === day);
      const serviceWeekly = inZone.filter(item => item.serviceId === service.id && item.scheduleType === "recurring");
      const generalWeekly = inZone.filter(item => item.serviceId == null && item.scheduleType === "recurring");
      const selected = relevant.some(item => item.serviceId === service.id && item.scheduleType === "specific" && scheduleDate(item) === day) ? serviceExceptions
        : relevant.some(item => item.serviceId == null && item.scheduleType === "specific" && scheduleDate(item) === day) ? generalExceptions
        : (relevant.some(item => item.serviceId === service.id && item.scheduleType === "recurring") ? serviceWeekly : generalWeekly).filter(item => item.daysOfWeek?.includes(weekday) && withinRecurrence(item, day));
      const offsets = zoneOffsets(day, zone);
      for (const schedule of selected) for (const range of workingRanges(schedule)) {
        for (let start = minutes(range.startTime); start + occupiedDuration <= minutes(range.endTime); start += 15) {
          for (const instant of localInstants(day, time(start), zone, offsets)) {
            const end = new Date(instant.getTime() + duration * 60_000);
            const occupiedEnd = new Date(instant.getTime() + occupiedDuration * 60_000);
            if (instant <= now || dateInZone(instant, timezone) !== date || dateInZone(occupiedEnd, zone) !== day || timeInZone(occupiedEnd, zone) > range.endTime || timeInZone(occupiedEnd, zone) < range.startTime) continue;
            if (offsets.length > 1 && Array.from({ length: Math.ceil(occupiedDuration / 15) }, (_, index) => new Date(instant.getTime() + index * 15 * 60_000)).some(point => dateInZone(point, zone) !== day || timeInZone(point, zone) < range.startTime || timeInZone(point, zone) >= range.endTime)) continue;
            if (bookings.some(booking => {
              if (booking.status === "cancelled") return false;
              const busyStart = new Date(booking.scheduledDate).getTime();
              return instant.getTime() < busyStart + ((booking.bookingDuration ?? 60) + (booking.bookingCleanupTime ?? 0)) * 60_000 && occupiedEnd.getTime() > busyStart;
            })) continue;
            result.set(instant.toISOString(), { startsAt: instant.toISOString(), endsAt: end.toISOString(), timezone, startTime: timeInZone(instant, timezone), endTime: timeInZone(end, timezone), slotDuration: duration, available: true });
          }
        }
      }
    }
  }
  return Array.from(result.values()).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
