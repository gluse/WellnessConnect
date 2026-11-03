import type { BookingWithDetails } from "@shared/schema";

export type CalendarEvent = { key: string; rows: BookingWithDetails[] };
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

// Positions use elapsed real minutes from local midnight. Transition days can
// have 23/25 hours; their local labels include offsets in the calendar UI.
export function calendarSegments(events: CalendarEvent[], days: Date[]): CalendarSegment[] {
  const result: CalendarSegment[] = [];
  for (const day of days) {
    const startOfDay = day.getTime(), endOfDay = shiftCalendarDay(day, 1).getTime();
    const segments: CalendarSegment[] = [];
    for (const event of events) {
      const row = event.rows[0];
      if (!row) continue;
      const start = new Date(row.scheduledDate).getTime(), duration = row.bookingDuration ?? row.service.duration;
      if (!Number.isFinite(start) || !Number.isFinite(duration) || duration <= 0) continue;
      const end = start + duration * 60_000;
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
