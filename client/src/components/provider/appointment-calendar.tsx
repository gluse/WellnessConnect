import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { Employee } from "@shared/schema";
import { calendarDayMinutes, calendarDays, calendarSegments, localDateKey, shiftCalendarDay, type CalendarEvent } from "@/lib/appointment-calendar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCalendarSwipe } from "@/hooks/use-calendar-swipe";

const HOUR_HEIGHT = 64;
const clock = (date: Date) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
const statusClass: Record<string, string> = {
  confirmed: "border-green-600 bg-green-50 text-green-950", pending: "border-amber-500 bg-amber-50 text-amber-950",
  completed: "border-neutral-400 bg-neutral-100 text-neutral-800", cancelled: "border-neutral-400 bg-neutral-100 text-neutral-600",
};
type Props = {
  events: CalendarEvent[]; date: Date; onDateChange: (date: Date) => void; loading: boolean;
  employees: Employee[]; filters: ReactNode; updating?: boolean; renderDetails: (event: CalendarEvent) => ReactNode;
};
export default function AppointmentCalendar({ events, date, onDateChange, loading, employees, filters, updating, renderDetails }: Props) {
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState<"day" | "week">(() => typeof window !== "undefined" && window.matchMedia?.("(max-width: 639px)").matches ? "day" : "week");
  const explicitMode = useRef(false), scroll = useRef<HTMLDivElement>(null), navigation = useRef<HTMLButtonElement>(null), trigger = useRef<HTMLButtonElement | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null), [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60_000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)");
    const change = () => { if (!explicitMode.current) setMode(media.matches ? "day" : "week"); };
    media.addEventListener("change", change); return () => media.removeEventListener("change", change);
  }, []);
  const days = useMemo(() => calendarDays(date, mode), [date, mode]);
  const segments = useMemo(() => calendarSegments(events, days), [events, days]);
  const selected = events.find(event => event.key === selectedKey);
  const swipeSurface = useRef<HTMLDivElement>(null);
  const swipeNavigate = useCallback((direction: -1 | 1) => onDateChange(shiftCalendarDay(date, direction * (mode === "week" ? 7 : 1))), [date, mode, onDateChange]);
  useCalendarSwipe(swipeSurface, scroll, { mode, disabled: loading || !!updating || !!selected, onNavigate: swipeNavigate });
  useEffect(() => { if (selectedKey && !selected) setSelectedKey(null); }, [selected, selectedKey]);
  const rangeKey = `${localDateKey(days[0])}:${mode}`;
  const scrolledRange = useRef("");
  useEffect(() => {
    if (loading || !scroll.current || scrolledRange.current === rangeKey) return;
    scrolledRange.current = rangeKey;
    const today = days.find(day => localDateKey(day) === localDateKey(now));
    const minute = segments.length ? Math.min(...segments.map(segment => segment.start)) : today ? (now.getTime() - today.getTime()) / 60_000 : 480;
    scroll.current.scrollTop = Math.max(0, (minute - 60) * HOUR_HEIGHT / 60);
  }, [rangeKey, loading, days, segments, now]);
  const fullDate = (value: Date) => new Intl.DateTimeFormat(i18n.language, { dateStyle: "full" }).format(value);
  const rangeLabel = mode === "day" ? fullDate(days[0]) : new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "short", year: "numeric" }).formatRange(days[0], days[6]);
  const hours = Math.max(...days.map(calendarDayMinutes)) / 60;
  const transition = days.some(day => calendarDayMinutes(day) !== 1440);
  const ticks = Array.from({ length: Math.ceil(hours) }, (_, index) => index);
  const gridStyle = { gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` };
  const calendarStatus = (event: CalendarEvent) => Array.from(new Set(event.rows.map(row => row.status).filter(Boolean))).map(status => t(`appointmentCollaboration.status${status![0].toUpperCase()}${status!.slice(1)}`)).join(" · ");
  const customer = (event: CalendarEvent) => {
    const row = event.rows[0];
    return row.service.serviceType === "group" ? t("appointmentCollaboration.confirmedPlaces", {
      count: event.rows.filter(item => item.status === "confirmed" || item.status === "completed").reduce((sum, item) => sum + (item.participantCount ?? 1), 0), capacity: row.service.maxCapacity ?? 1,
    }) : [row.seeker.firstName, row.seeker.lastName].filter(Boolean).join(" ") || t("appointmentCollaboration.customer");
  };
  return <div ref={swipeSurface} className="min-w-0 rounded-xl border bg-white p-2 sm:p-3 space-y-3" data-testid="appointment-calendar">
    <p className="sr-only" aria-live="polite" data-testid="calendar-range">{rangeLabel}</p>
    <div className="flex min-w-0 flex-wrap items-center gap-0.5 min-[360px]:gap-2" data-testid="calendar-toolbar">
      <Button ref={navigation} variant="outline" size="sm" className="min-h-11 min-w-11 shrink-0 px-1 sm:px-3" onClick={() => onDateChange(new Date())}>{t("appointmentCalendar.today")}</Button>
      <label className="sr-only" htmlFor="appointment-calendar-mode">{t("appointmentCalendar.period")}</label>
      <select id="appointment-calendar-mode" className="min-h-11 rounded-md border border-neutral-500 bg-white px-1 sm:px-2 text-sm max-w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" value={mode} onChange={event => { explicitMode.current = true; setMode(event.target.value as "day" | "week"); }}>
        <option value="day">{t("appointmentCalendar.day")}</option><option value="week">{t("appointmentCalendar.week")}</option>
      </select>
      <label className="sr-only" htmlFor="appointment-calendar-date">{t("appointmentCalendar.chooseDate")}</label>
      <input id="appointment-calendar-date" aria-label={t("appointmentCalendar.chooseDate")} type="date" className="min-h-11 min-w-[7rem] flex-1 max-w-36 rounded-md border border-neutral-500 bg-white px-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" value={localDateKey(date)} onChange={event => {
        const [year, month, day] = event.target.value.split("-").map(Number);
        if (year > 0 && month > 0 && day > 0) { const next = new Date(year, month - 1, day); if (Number.isFinite(next.getTime())) onDateChange(next); }
      }} />
    </div>
    {filters}
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-700">{["confirmed", "pending", "cancelled"].map(status => <span key={status} className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${status === "confirmed" ? "bg-green-600" : status === "pending" ? "bg-amber-500" : "bg-neutral-400"}`} aria-hidden="true" />{t(`appointmentCollaboration.status${status[0].toUpperCase()}${status.slice(1)}`)}</span>)}</div>
    {transition && <p role="note" className="text-xs text-neutral-600">{t("appointmentCalendar.dstNote")}</p>}
    {loading ? <p role="status" className="p-4 text-sm">{t("appointmentAgenda.loading")}</p> : <>
      {!segments.length && <p role="status" className="text-sm text-neutral-600">{t("appointmentCalendar.empty")}</p>}
      <div ref={scroll} role="region" aria-label={t("appointmentCalendar.schedule")} tabIndex={0} className="max-h-[65dvh] overflow-auto rounded-lg border focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" data-testid="calendar-scroll" data-calendar-swipe-grid>
        <div className={mode === "week" ? "min-w-[840px]" : "min-w-0"} dir="ltr">
          <div className="sticky top-0 z-20 grid bg-white border-b" style={gridStyle}>
            <div className="sticky left-0 bg-white border-r" />
            {days.map(day => <button type="button" data-calendar-swipe-navigation key={localDateKey(day)} className={`min-h-14 min-w-0 border-r px-1 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${day.getDay() === 0 || day.getDay() === 6 ? "bg-neutral-50" : "bg-white"}`} aria-label={fullDate(day)} aria-current={localDateKey(day) === localDateKey(now) ? "date" : undefined} onClick={() => { explicitMode.current = true; onDateChange(day); setMode("day"); }}>
              <span className={localDateKey(day) === localDateKey(now) ? "inline-block rounded-lg bg-primary text-primary-foreground px-2 py-1" : "inline-block px-2 py-1"}>{new Intl.DateTimeFormat(i18n.language, { weekday: "short", day: "numeric" }).format(day)}</span>
            </button>)}
          </div>
          <div className="grid" style={gridStyle}>
            <div className="sticky left-0 z-10 border-r bg-white text-xs text-neutral-600" style={{ height: hours * HOUR_HEIGHT }} aria-hidden="true">
              {!transition && ticks.map(hour => <span key={hour} className="absolute right-1" style={{ top: hour * HOUR_HEIGHT + 2 }}>{String(hour).padStart(2, "0")}:00</span>)}
            </div>
            {days.map(day => <div key={localDateKey(day)} className={`relative border-r ${day.getDay() === 0 || day.getDay() === 6 ? "bg-neutral-50" : "bg-white"}`} data-calendar-day={localDateKey(day)} style={{ height: hours * HOUR_HEIGHT }}>
              {ticks.filter(hour => hour * 60 < calendarDayMinutes(day)).map(hour => <div key={hour} className="absolute inset-x-0 border-t border-neutral-200 pointer-events-none" style={{ top: hour * HOUR_HEIGHT, height: HOUR_HEIGHT }} aria-hidden="true">
                <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-neutral-200" />
                {transition && <span className="bg-white/90 px-1 text-[10px] text-neutral-600">{new Intl.DateTimeFormat(i18n.language, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "shortOffset" }).format(new Date(day.getTime() + hour * 3_600_000))}</span>}
              </div>)}
              {segments.filter(segment => segment.day === localDateKey(day)).map(segment => {
                const row = segment.event.rows[0], employee = employees.find(item => item.id === row.employeeId)?.name;
                const minutes = segment.end - segment.start;
                const statuses = calendarStatus(segment.event), time = `${clock(segment.startsAt)}–${clock(segment.endsAt)}`;
                const label = `${fullDate(segment.startsAt)}, ${time} · ${row.service.name} · ${customer(segment.event)}${employee ? ` · ${employee}` : ""} · ${statuses}`;
                const style = row.service.serviceType === "group" ? "border-indigo-500 bg-indigo-50 text-indigo-950" : statusClass[row.status ?? ""] ?? statusClass.completed;
                return <button type="button" key={segment.event.key} data-testid={`calendar-event-${row.id}`} data-calendar-event data-start={segment.start} data-end={segment.end}
                  className={`absolute z-[1] scroll-mt-20 flex flex-col items-stretch justify-start overflow-hidden rounded-md border border-s-[3px] px-1.5 text-start text-[0.6875rem] hover:brightness-95 focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${minutes < 30 ? "py-0 leading-none" : minutes < 60 ? "py-0 leading-tight" : "py-0.5 leading-tight"} ${style}`}
                  style={{ top: segment.start * HOUR_HEIGHT / 60, height: (segment.end - segment.start) * HOUR_HEIGHT / 60, insetInlineStart: `calc(${segment.column / segment.columns * 100}% + 2px)`, width: `calc(${100 / segment.columns}% - 4px)` }}
                  title={label} aria-label={label} onClick={event => { trigger.current = event.currentTarget; setSelectedKey(segment.event.key); }}>
                  <span dir={i18n.dir()} className="block"><span className="block truncate font-semibold">{row.service.name}</span>{minutes >= 30 && <span className="block truncate" dir="ltr">{time}</span>}{minutes >= 60 && <><span className="block truncate">{customer(segment.event)}{employee ? ` · ${employee}` : ""}</span><span className="block truncate font-medium">{statuses}</span></>}</span>
                </button>;
              })}
              {localDateKey(day) === localDateKey(now) && <div className="absolute inset-x-0 z-[2] border-t-2 border-primary pointer-events-none" style={{ top: (now.getTime() - day.getTime()) / 60_000 * HOUR_HEIGHT / 60 }} aria-label={t("appointmentCalendar.currentTime", { time: clock(now) })}><span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-primary" /></div>}
            </div>)}
          </div>
        </div>
      </div>
      <p className="text-xs text-neutral-600">{t("appointmentCalendar.hint")}</p>
    </>}
    <Dialog open={!!selected} onOpenChange={open => { if (!open && !updating) setSelectedKey(null); }}>
      {selected && <DialogContent closeDisabled={updating} closeLabel={t("appointmentCalendar.close")} className="max-h-[85dvh] overflow-y-auto w-[calc(100%_-_1rem)] max-w-2xl rounded-xl p-3 sm:p-5" onCloseAutoFocus={event => { event.preventDefault(); requestAnimationFrame(() => { if (trigger.current?.isConnected) trigger.current.focus(); else navigation.current?.focus(); }); }}>
        <DialogHeader className="pe-8"><DialogTitle>{t("appointmentCalendar.details")}</DialogTitle><DialogDescription>{t("appointmentCalendar.detailsHelp")}</DialogDescription></DialogHeader>
        {renderDetails(selected)}
      </DialogContent>}
    </Dialog>
  </div>;
}
