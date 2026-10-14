import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import type { Availability, Service } from "@shared/schema";
import { scheduleDate, workingRanges, type TimeRange } from "@shared/scheduling";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const dayOrder = [1, 2, 3, 4, 5, 6, 0];
const defaultRange = () => ({ startTime: "09:00", endTime: "17:00" });
function RangeInputs({ ranges, onChange, label }: { ranges: TimeRange[]; onChange: (ranges: TimeRange[]) => void; label: string }) {
  return <div className="space-y-2">
    {ranges.map((range, index) => <div key={index} className="flex items-center gap-2">
      <Input type="time" aria-label={`${label} start ${index + 1}`} value={range.startTime} onChange={event => onChange(ranges.map((item, i) => i === index ? { ...item, startTime: event.target.value } : item))} className="w-28" />
      <span className="text-neutral-500">–</span>
      <Input type="time" aria-label={`${label} end ${index + 1}`} value={range.endTime} onChange={event => onChange(ranges.map((item, i) => i === index ? { ...item, endTime: event.target.value } : item))} className="w-28" />
      <Button type="button" size="icon" variant="ghost" aria-label={`Remove ${label} hours ${index + 1}`} onClick={() => onChange(ranges.filter((_, i) => i !== index))}><X className="w-4 h-4" /></Button>
    </div>)}
    <Button type="button" size="sm" variant="ghost" disabled={ranges.length >= 8} onClick={() => onChange([...ranges, defaultRange()])}><Plus className="w-3 h-3 mr-1" />Add hours</Button>
  </div>;
}

export default function AvailabilityEditor({ services, schedules, onClose }: { services: Service[]; schedules: Availability[]; onClose: () => void }) {
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [week, setWeek] = useState<TimeRange[][]>(Array.from({ length: 7 }, () => []));
  const [exceptionDate, setExceptionDate] = useState("");
  const [exceptionRanges, setExceptionRanges] = useState<TimeRange[]>([]);
  const [error, setError] = useState("");
  const queryClient = useQueryClient(), { toast } = useToast();
  const scoped = schedules.filter(item => item.serviceId === serviceId && item.isActive !== false);
  const ownWeekly = scoped.filter(item => item.scheduleType === "recurring");
  useEffect(() => {
    const own = schedules.filter(item => item.serviceId === serviceId && item.scheduleType === "recurring" && item.isActive !== false);
    const effective = own.length || serviceId == null ? own : schedules.filter(item => item.serviceId == null && item.scheduleType === "recurring" && item.isActive !== false);
    setTimezone(effective[0]?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
    setWeek(Array.from({ length: 7 }, (_, day) => effective.filter(item => item.daysOfWeek?.includes(day)).flatMap(workingRanges).filter((range, index, ranges) => ranges.findIndex(other => other.startTime === range.startTime && other.endTime === range.endTime) === index).sort((a, b) => a.startTime.localeCompare(b.startTime))));
    setExceptionDate(""); setExceptionRanges([]); setError("");
  }, [serviceId, schedules]);
  const save = useMutation({
    mutationFn: async ({ path, method = "PUT", body }: { path: string; method?: string; body?: unknown }) => (await apiRequest(method, path, body)).json(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ predicate: query => String(query.queryKey[0]).startsWith("/api/availability/") });
      toast({ title: "Availability saved" }); setError("");
    },
    onError: error => {
      try { setError(JSON.parse(error.message.replace(/^\d+:\s*/, "")).message); }
      catch { setError("Unable to save availability. Please try again."); }
    },
  });
  const weeklyBody = { serviceId, timezone, days: week.map((intervals, day) => ({ day, intervals })) };
  const exceptions = Array.from(new Set(scoped.filter(item => item.scheduleType === "specific").map(scheduleDate).filter((date): date is string => Boolean(date)))).sort();
  return <Dialog open onOpenChange={open => { if (!open && !save.isPending) onClose(); }}>
    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" onEscapeKeyDown={event => { if (save.isPending) event.preventDefault(); }} onInteractOutside={event => { if (save.isPending) event.preventDefault(); }}>
      <DialogHeader><DialogTitle>Availability</DialogTitle><DialogDescription>Set your normal week, then adjust individual dates. Existing appointments stay in place.</DialogDescription></DialogHeader>
      <fieldset disabled={save.isPending} className="space-y-6 min-w-0">
        <div className="grid sm:grid-cols-2 gap-4">
          <div><Label htmlFor="availability-service">Applies to</Label><select id="availability-service" className="w-full border rounded-md p-2 bg-white" value={serviceId ?? "all"} onChange={event => setServiceId(event.target.value === "all" ? null : Number(event.target.value))}><option value="all">All services · general hours</option>{services.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}</select></div>
          <div><Label htmlFor="availability-timezone">Timezone</Label><Input id="availability-timezone" value={timezone} onChange={event => setTimezone(event.target.value)} placeholder="Europe/Riga" /></div>
        </div>
        <section className="space-y-3">
          <h3 className="font-semibold">Weekly hours</h3>
          {serviceId != null && !ownWeekly.length && <p className="text-sm text-neutral-500">This service uses general weekly hours. Saving here gives it a custom week.</p>}
          <p className="text-xs text-neutral-500">Split a day into separate ranges for lunch or other breaks. Unchecked days are unavailable.</p>
          <div className="divide-y border rounded-lg px-3">
            {dayOrder.map(day => <div key={day} className="py-3 flex flex-wrap gap-3 items-start">
              <label className="flex gap-2 items-center w-28 pt-2 text-sm"><input type="checkbox" checked={week[day].length > 0} onChange={event => setWeek(week.map((ranges, index) => index === day ? event.target.checked ? [defaultRange()] : [] : ranges))} />{dayNames[day]}</label>
              {week[day].length ? <RangeInputs ranges={week[day]} label={dayNames[day]} onChange={ranges => setWeek(week.map((item, index) => index === day ? ranges : item))} /> : <span className="text-sm text-neutral-400 pt-2">Unavailable</span>}
            </div>)}
          </div>
          <div className="flex flex-wrap gap-2"><Button onClick={() => save.mutate({ path: "/api/availability/weekly", body: weeklyBody })}>{save.isPending ? "Saving…" : "Save weekly hours"}</Button>{serviceId != null && ownWeekly.length > 0 && <Button variant="outline" onClick={() => save.mutate({ path: "/api/availability/weekly", body: { ...weeklyBody, inherit: true } })}>Use general weekly hours</Button>}</div>
        </section>
        <section className="space-y-3 border-t pt-5">
          <h3 className="font-semibold">Date exceptions</h3>
          <p className="text-sm text-neutral-500">Take a day off or set different hours for a specific date. These replace the normal week for that date.</p>
          {serviceId != null && <p className="text-xs text-neutral-500">General date exceptions also apply unless this service has its own exception for that date.</p>}
          {exceptions.map(date => {
            const rows = scoped.filter(item => item.scheduleType === "specific" && scheduleDate(item) === date), ranges = rows.flatMap(workingRanges);
            return <div key={date} className="border rounded-lg p-3 flex flex-wrap justify-between items-center gap-2">
              <div><p className="text-sm font-medium">{new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</p><p className="text-xs text-neutral-500">{ranges.length ? ranges.map(range => `${range.startTime}–${range.endTime}`).join(", ") : "Unavailable all day"} · {rows[0]?.timezone}</p></div>
              <div className="flex gap-1"><Button variant="ghost" size="sm" onClick={() => { setExceptionDate(date); setExceptionRanges(ranges); setTimezone(rows[0]?.timezone || timezone); }}>Edit</Button><Button variant="ghost" size="sm" onClick={() => save.mutate({ method: "DELETE", path: `/api/availability/override?serviceId=${serviceId ?? "all"}&date=${date}` })}>Remove</Button></div>
            </div>;
          })}
          <div className="bg-neutral-50 border rounded-lg p-4 space-y-3">
            <div><Label htmlFor="availability-exception-date">Date</Label><Input id="availability-exception-date" type="date" value={exceptionDate} onChange={event => setExceptionDate(event.target.value)} /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!exceptionRanges.length} onChange={event => setExceptionRanges(event.target.checked ? [] : [defaultRange()])} />Unavailable all day</label>
            {exceptionRanges.length > 0 && <RangeInputs ranges={exceptionRanges} label="Exception" onChange={setExceptionRanges} />}
            <Button variant="outline" disabled={!exceptionDate} onClick={() => save.mutate({ path: "/api/availability/override", body: { serviceId, timezone, date: exceptionDate, intervals: exceptionRanges } })}>Save date exception</Button>
          </div>
        </section>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end border-t pt-4"><Button variant="outline" onClick={onClose}>Done</Button></div>
      </fieldset>
    </DialogContent>
  </Dialog>;
}
