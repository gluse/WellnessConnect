import type { BookingWithDetails } from "@shared/schema";
import type { ManualAppointmentDto } from "@shared/manual-appointments";
import { OCCUPYING_BOOKING_STATUSES } from "@shared/scheduling";

export type CalendarEvent = { key: string; rows: BookingWithDetails[]; manual?: ManualAppointmentDto };
export type CalendarSegment = {
  event: CalendarEvent; day: string; start: number; end: number;
  startsAt: Date; endsAt: Date; column: number; columns: number;
};
export const localDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export function shiftCalendarDay(date: Date, amount: number) {
  const result = new Date(date); result.setDate(result.getDate() + amount); return result;
}
export function calendarDays(date: Date, mode: "day" | "week") {
  const start = new Date(date); start.setHours(0, 0, 0, 0);
  if (mode === "week") start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  return Array.from({ length: mode === "week" ? 7 : 1 }, (_, index) => shiftCalendarDay(start, index));
}
export const calendarDayMinutes = (date: Date) => (shiftCalendarDay(date, 1).getTime() - date.getTime()) / 60_000;

export function calendarEventInterval(event: CalendarEvent) {
  const row = event.rows[0];
  if (event.manual) return { start: Date.parse(event.manual.startsAt), end: Date.parse(event.manual.endsAt),
    cleanup: event.manual.cleanupMinutes, employeeId: event.manual.employeeId, status: event.manual.status };
  if (!row) return null;
  const start = new Date(row.scheduledDate).getTime();
  return { start, end: start + (row.bookingDuration ?? row.service.duration) * 60_000,
    cleanup: row.bookingCleanupTime ?? 0, employeeId: row.employeeId, status: row.status };
}

export type CalendarTimeSelection = { startsAt: string; endsAt: string; employeeId: number | null };
export function calendarSelectionAvailable({ events, startsAt, endsAt, employeeId, now = Date.now() }: {
  events: CalendarEvent[]; startsAt: number; endsAt: number; employeeId?: number | null; now?: number;
}) {
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || startsAt <= now || endsAt <= startsAt) return false;
  // An all-staff view cannot establish which resource is being reserved yet.
  // Choosing the resource and the locked server check resolve that in the form.
  if (employeeId === undefined) return true;
  return !events.some(event => {
    const interval = calendarEventInterval(event);
    if (!interval || !OCCUPYING_BOOKING_STATUSES.some(status => status === interval.status)) return false;
    if (employeeId != null && interval.employeeId != null && interval.employeeId !== employeeId) return false;
    return startsAt < interval.end + interval.cleanup * 60_000 && endsAt > interval.start;
  });
}

// Positions use elapsed real minutes from local midnight. Transition days can
// have 23/25 hours; their local labels include offsets in the calendar UI.
export function calendarSegments(events: CalendarEvent[], days: Date[]): CalendarSegment[] {
  const result: CalendarSegment[] = [];
  for (const day of days) {
    const startOfDay = day.getTime(), endOfDay = shiftCalendarDay(day, 1).getTime();
    const segments: CalendarSegment[] = [];
    for (const event of events) {
      const interval = calendarEventInterval(event);
      if (!interval) continue;
      const { start, end } = interval;
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
      if (start >= endOfDay || end <= startOfDay) continue;
      segments.push({ event, day: localDateKey(day), start: (Math.max(start, startOfDay) - startOfDay) / 60_000,
        end: (Math.min(end, endOfDay) - startOfDay) / 60_000, startsAt: new Date(start), endsAt: new Date(end), column: 0, columns: 1 });
    }
    segments.sort((a, b) => a.start - b.start || b.end - a.end || a.event.key.localeCompare(b.event.key));
    let cluster: CalendarSegment[] = [], clusterEnd = -1;
    const flush = () => {
      const laneEnds: number[] = [];
      for (const segment of cluster) {
        let lane = laneEnds.findIndex(end => end <= segment.start);
        if (lane === -1) lane = laneEnds.length;
        segment.column = lane; laneEnds[lane] = segment.end;
      }
      for (const segment of cluster) { segment.columns = laneEnds.length; result.push(segment); }
    };
    for (const segment of segments) {
      if (segment.start >= clusterEnd) { flush(); cluster = []; clusterEnd = -1; }
      cluster.push(segment); clusterEnd = Math.max(clusterEnd, segment.end);
    }
    flush();
  }
  return result;
}
