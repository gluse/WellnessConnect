import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import type { Availability, Service } from "@shared/schema";
import { scheduleDate, workingRanges, validTimezone, validDateKey, type TimeRange } from "@shared/scheduling";
import { apiRequest } from "@/lib/queryClient";
import { useFormLocale } from "@/components/forms-locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TimeInput } from "@/components/ui/time-input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";

const dayOrder = [1, 2, 3, 4, 5, 6, 0];
const defaultRange = () => ({ startTime: "09:00", endTime: "17:00" });
function validRanges(ranges: TimeRange[]) {
  const sorted = [...ranges].sort((a, b) => a.startTime.localeCompare(b.startTime));
  return ranges.length <= 8 && sorted.every((range, index) => /^([01]\d|2[0-3]):[0-5]\d$/.test(range.startTime) && /^([01]\d|2[0-3]):[0-5]\d$/.test(range.endTime) && range.startTime < range.endTime && (!index || sorted[index - 1].endTime <= range.startTime));
}
function RangeInputs({ ranges, onChange, label, errorId }: { ranges: TimeRange[]; onChange: (ranges: TimeRange[]) => void; label: string; errorId?: string }) {
  const { t } = useFormLocale();
  return <div className="space-y-2 w-full sm:w-auto min-w-0">
    {ranges.map((range, index) => <div key={index} className="grid sm:flex items-center gap-2">
      <TimeInput aria-label={t("operationsForm.rangeStart", { label, number: index + 1 })} aria-invalid={Boolean(errorId)} aria-describedby={errorId} value={range.startTime} onChange={event => onChange(ranges.map((item, i) => i === index ? { ...item, startTime: event.target.value } : item))} className="w-full sm:w-24 min-w-0 sm:flex-1" />
      <span aria-hidden="true" className="text-center">–</span>
      <TimeInput aria-label={t("operationsForm.rangeEnd", { label, number: index + 1 })} aria-invalid={Boolean(errorId)} aria-describedby={errorId} value={range.endTime} onChange={event => onChange(ranges.map((item, i) => i === index ? { ...item, endTime: event.target.value } : item))} className="w-full sm:w-24 min-w-0 sm:flex-1" />
      <Button type="button" size="icon" variant="ghost" aria-label={t("operationsForm.rangeRemove", { label, number: index + 1 })} onClick={() => onChange(ranges.filter((_, i) => i !== index))}><X className="w-4 h-4" /></Button>
    </div>)}
    <Button type="button" size="sm" variant="ghost" disabled={ranges.length >= 8} onClick={() => onChange([...ranges, defaultRange()])}><Plus className="w-3 h-3 me-1" />{t("operationsForm.addHours")}</Button>
  </div>;
}
function weeklyState(schedules: Availability[], serviceId: number | null) {
  const own = schedules.filter(item => item.serviceId === serviceId && item.scheduleType === "recurring" && item.isActive !== false);
  const effective = own.length || serviceId == null ? own : schedules.filter(item => item.serviceId == null && item.scheduleType === "recurring" && item.isActive !== false);
  return { timezone: effective[0]?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone, week: Array.from({ length: 7 }, (_, day) => effective.filter(item => item.daysOfWeek?.includes(day)).flatMap(workingRanges).filter((range, index, ranges) => ranges.findIndex(other => other.startTime === range.startTime && other.endTime === range.endTime) === index).sort((a, b) => a.startTime.localeCompare(b.startTime))) };
}
export default function AvailabilityEditor({ services, schedules }: { services: Service[]; schedules: Availability[] }) {
  const { t, language } = useFormLocale();
  const [serviceId, setServiceId] = useState<number | null>(null), [nextScope, setNextScope] = useState<number | null | undefined>();
  const [timezone, setTimezone] = useState(() => weeklyState(schedules, null).timezone);
  const [week, setWeek] = useState(() => weeklyState(schedules, null).week);
  const [baseline, setBaseline] = useState(() => JSON.stringify(weeklyState(schedules, null)));
  const [exceptionDate, setExceptionDate] = useState(""), [exceptionRanges, setExceptionRanges] = useState<TimeRange[]>([]);
  const [exceptionBaseline, setExceptionBaseline] = useState("");
  const [feedback, setFeedback] = useState<Record<string, { error?: string; message?: string }>>({});
  const [rangeErrors, setRangeErrors] = useState<number[]>([]), [timezoneError, setTimezoneError] = useState(false), [exceptionError, setExceptionError] = useState(false);
  const locked = useRef(false), queryClient = useQueryClient();
  const weeklyDirty = JSON.stringify({ timezone, week }) !== baseline;
  const exceptionDirty = exceptionBaseline ? JSON.stringify({ date: exceptionDate, ranges: exceptionRanges, timezone }) !== exceptionBaseline : Boolean(exceptionDate || exceptionRanges.length);
  const dirty = weeklyDirty || exceptionDirty;
  const latest = useRef({ weeklyDirty, dirty, timezone }); latest.current = { weeklyDirty, dirty, timezone };
  // Background refetches must not erase an edited week or an independent exception draft.
  useEffect(() => {
    const state = weeklyState(schedules, serviceId);
    if (!latest.current.weeklyDirty) { setWeek(state.week); const zone = latest.current.dirty ? latest.current.timezone : state.timezone; setBaseline(JSON.stringify({ timezone: zone, week: state.week })); if (!latest.current.dirty) setTimezone(zone); }
  }, [schedules, serviceId]);
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [dirty]);
  function selectScope(value: number | null) {
    const state = weeklyState(schedules, value); setServiceId(value); setTimezone(state.timezone); setWeek(state.week); setBaseline(JSON.stringify(state)); setExceptionDate(""); setExceptionRanges([]); setExceptionBaseline(""); setFeedback({}); setRangeErrors([]); setTimezoneError(false); setExceptionError(false);
  }
  type Action = { key: string; path: string; method?: string; body?: unknown; snapshot?: string; inherit?: boolean };
  const save = useMutation({
    mutationFn: async ({ path, method = "PUT", body }: Action) => (await apiRequest(method, path, body)).json(),
    onSuccess: async (_, action) => {
      if (action.key === "weekly") { setBaseline(action.snapshot!); if (action.inherit) { const state = JSON.parse(action.snapshot!); setWeek(state.week); setTimezone(state.timezone); } }
      if (action.key === "exception") { setExceptionDate(""); setExceptionRanges([]); setExceptionBaseline(""); }
      setFeedback(previous => ({ ...previous, [action.key]: { message: t("operationsForm.saved") } }));
      await queryClient.invalidateQueries({ predicate: query => String(query.queryKey[0]).startsWith("/api/availability/") });
    },
    onError: (_, action) => setFeedback(previous => ({ ...previous, [action.key]: { error: t("operationsForm.saveError") } })),
    onSettled: () => { locked.current = false; },
  });
  function run(action: Action) { if (locked.current) return; locked.current = true; setFeedback(previous => ({ ...previous, [action.key]: {} })); save.mutate(action); }
  function validate(key: string, days: number[]) {
    const bad = days.filter(day => !validRanges(week[day])); const zoneBad = !validTimezone(timezone);
    setRangeErrors(bad); setTimezoneError(zoneBad);
    if (bad.length || zoneBad || (key === "exception" && (!validDateKey(exceptionDate) || !validRanges(exceptionRanges)))) {
      setExceptionError(key === "exception"); setFeedback(previous => ({ ...previous, [key]: { error: t("operationsForm.checkFields") } })); requestAnimationFrame(() => document.getElementById(`availability-feedback-${key}`)?.focus()); return false;
    }
    setExceptionError(false); return true;
  }
  const scoped = schedules.filter(item => item.serviceId === serviceId && item.isActive !== false), ownWeekly = scoped.filter(item => item.scheduleType === "recurring");
  const weeklyBody = { serviceId, timezone, days: week.map((intervals, day) => ({ day, intervals })) };
  const exceptions = Array.from(new Set(scoped.filter(item => item.scheduleType === "specific").map(scheduleDate).filter((date): date is string => Boolean(date)))).sort();
  const receipt = (key: string) => <>{feedback[key]?.message && <p role="status">{feedback[key].message}</p>}{feedback[key]?.error && <p id={`availability-feedback-${key}`} tabIndex={-1} role="alert" className="text-destructive">{feedback[key].error}{timezoneError && <> <a href="#availability-timezone">{t("operationsForm.timezone")}</a></>}{key === "weekly" && rangeErrors.map(day => <a key={day} href={`#availability-day-${day}`} className="block" onClick={event => { event.preventDefault(); document.querySelector<HTMLInputElement>(`#availability-day-${day} [data-time-input]`)?.focus(); }}>{dayName(day)}</a>)}{key === "exception" && exceptionError && <> <a href="#availability-exception-date">{t("operationsForm.date")}</a></>}</p>}</>;
  const dayName = (day: number) => new Intl.DateTimeFormat(language, { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 0, 4 + day)));
  return <div className="phase3-form border rounded-xl bg-card text-card-foreground p-4 sm:p-6 space-y-6">
    <fieldset disabled={save.isPending} className="space-y-6 min-w-0">
      <legend className="font-semibold mb-4">{t("operationsForm.scheduleScope")}</legend>
      <div className="grid sm:grid-cols-2 gap-4">
        <div><Label htmlFor="availability-service">{t("operationsForm.appliesTo")}</Label><select id="availability-service" value={serviceId ?? "all"} onChange={event => { const next = event.target.value === "all" ? null : Number(event.target.value); if (dirty) setNextScope(next); else selectScope(next); }}><option value="all">{t("operationsForm.general")}</option>{services.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}</select></div>
        <div><Label htmlFor="availability-timezone">{t("operationsForm.timezone")}</Label><Input id="availability-timezone" value={timezone} aria-invalid={timezoneError} aria-describedby={timezoneError ? "availability-zone-error" : undefined} onChange={event => setTimezone(event.target.value)} placeholder="Europe/Riga" />{timezoneError && <p id="availability-zone-error" className="text-destructive">{t("operationsForm.zoneError")}</p>}</div>
      </div>
      <p className="rounded-md bg-muted p-3 text-sm">{t("operationsForm.scopeSummary", { service: serviceId == null ? t("operationsForm.general") : services.find(item => item.id === serviceId)?.name, timezone })}</p>
      <section className="space-y-4" aria-labelledby="weekly-heading">
        <h2 id="weekly-heading" className="text-lg font-semibold">{t("operationsForm.weekly")}</h2>
        {serviceId != null && !ownWeekly.length && <p className="text-sm text-muted-foreground">{t("operationsForm.inherited")}</p>}
        <p className="text-sm text-muted-foreground">{t("operationsForm.weekHelp")}</p>
        <div className="availability-day-list divide-y border rounded-lg px-3">{dayOrder.map(day => <div key={day} id={`availability-day-${day}`} className="py-3 flex flex-wrap gap-3 items-start">
          <label className="flex gap-2 items-center min-h-11 sm:min-w-28 text-sm"><input type="checkbox" checked={week[day].length > 0} onChange={event => setWeek(week.map((ranges, index) => index === day ? event.target.checked ? [defaultRange()] : [] : ranges))} />{dayName(day)}</label>
          {week[day].length ? <div className="min-w-0"><RangeInputs ranges={week[day]} label={dayName(day)} errorId={rangeErrors.includes(day) ? `day-error-${day}` : undefined} onChange={ranges => setWeek(week.map((item, index) => index === day ? ranges : item))} />{rangeErrors.includes(day) && <p id={`day-error-${day}`} className="text-sm text-destructive">{t("operationsForm.rangeError")}</p>}</div> : <span className="text-sm text-muted-foreground pt-3">{t("operationsForm.unavailable")}</span>}
        </div>)}</div>
        <div className="flex flex-wrap gap-2"><Button type="button" onClick={() => { if (validate("weekly", dayOrder)) run({ key: "weekly", path: "/api/availability/weekly", body: weeklyBody, snapshot: JSON.stringify({ timezone, week }) }); }}>{t(save.isPending && save.variables?.key === "weekly" ? "operationsForm.saving" : "operationsForm.saveWeek")}</Button>{serviceId != null && ownWeekly.length > 0 && <Button type="button" variant="outline" onClick={() => { if (weeklyDirty && !window.confirm(t("operationsForm.discardWeek"))) return; const state = weeklyState(schedules.filter(item => item.serviceId !== serviceId), serviceId); run({ inherit: true, key: "weekly", path: "/api/availability/weekly", body: { ...weeklyBody, inherit: true }, snapshot: JSON.stringify(state) }); }}>{t("operationsForm.useGeneral")}</Button>}</div>{receipt("weekly")}
      </section>
      <section className="space-y-4 border-t pt-6" aria-labelledby="exceptions-heading">
        <h2 id="exceptions-heading" className="text-lg font-semibold">{t("operationsForm.exceptions")}</h2><p className="text-sm text-muted-foreground">{t("operationsForm.exceptionHelp")}</p>{serviceId != null && <p className="text-sm text-muted-foreground">{t("operationsForm.generalExceptions")}</p>}
        {exceptions.map(date => { const rows = scoped.filter(item => item.scheduleType === "specific" && scheduleDate(item) === date), ranges = rows.flatMap(workingRanges); return <div key={date} className="border rounded-lg p-3 space-y-2">
          <p className="font-medium">{new Intl.DateTimeFormat(language, { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${date}T12:00:00`))}</p><p className="text-sm text-muted-foreground"><bdi>{ranges.length ? ranges.map(range => `${range.startTime}–${range.endTime}`).join(", ") : t("operationsForm.allDay")}</bdi> · <bdi>{rows[0]?.timezone}</bdi></p>
          <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => { if (exceptionDirty && !window.confirm(t("operationsForm.discardException"))) return; const zone = rows[0]?.timezone || timezone; setExceptionDate(date); setExceptionRanges(ranges); setTimezone(zone); setExceptionBaseline(JSON.stringify({ date, ranges, timezone: zone })); }}>{t("common.edit")}</Button><Button type="button" variant="outline" aria-label={t("operationsForm.removeDate", { date })} onClick={() => { if (window.confirm(t("operationsForm.removeDateConfirm", { date }))) run({ key: date, method: "DELETE", path: `/api/availability/override?serviceId=${serviceId ?? "all"}&date=${date}` }); }}>{t("operationsForm.remove")}</Button></div>{receipt(date)}
        </div>; })}
        {save.variables?.method === "DELETE" && feedback[save.variables.key]?.message && <p role="status">{feedback[save.variables.key].message}</p>}
        <div className="bg-muted border rounded-lg p-4 space-y-4">
          <div><Label htmlFor="availability-exception-date">{t("operationsForm.date")}</Label><Input id="availability-exception-date" type="date" value={exceptionDate} aria-invalid={exceptionError} aria-describedby={exceptionError ? "exception-error" : undefined} onChange={event => setExceptionDate(event.target.value)} /></div>
          <label className="flex items-center gap-2 min-h-11 text-sm"><input type="checkbox" checked={!exceptionRanges.length} onChange={event => setExceptionRanges(event.target.checked ? [] : [defaultRange()])} />{t("operationsForm.allDay")}</label>
          {exceptionRanges.length > 0 && <RangeInputs ranges={exceptionRanges} label={t("operationsForm.exceptions")} errorId={exceptionError ? "exception-error" : undefined} onChange={setExceptionRanges} />}
          {exceptionError && <p id="exception-error" className="text-sm text-destructive">{t("operationsForm.exceptionError")}</p>}
          <Button type="button" variant="outline" onClick={() => { if (validate("exception", [])) run({ key: "exception", path: "/api/availability/override", body: { serviceId, timezone, date: exceptionDate, intervals: exceptionRanges } }); }}>{t(save.isPending && save.variables?.key === "exception" ? "operationsForm.saving" : "operationsForm.saveException")}</Button>{receipt("exception")}
        </div>
      </section>
    </fieldset>
    <AlertDialog open={nextScope !== undefined} onOpenChange={open => { if (!open) setNextScope(undefined); }}><AlertDialogContent className="phase3-form" onCloseAutoFocus={event => { event.preventDefault(); document.getElementById("availability-service")?.focus(); }}><AlertDialogTitle>{t("operationsForm.discardTitle")}</AlertDialogTitle><AlertDialogDescription>{t("operationsForm.discardScope")}</AlertDialogDescription><div className="flex flex-wrap gap-2"><AlertDialogCancel onClick={() => document.getElementById("availability-service")?.focus()}>{t("operationsForm.keepEditing")}</AlertDialogCancel><AlertDialogAction onClick={() => { selectScope(nextScope!); setNextScope(undefined); requestAnimationFrame(() => document.getElementById("availability-service")?.focus()); }}>{t("operationsForm.discard")}</AlertDialogAction></div></AlertDialogContent></AlertDialog>
  </div>;
}
