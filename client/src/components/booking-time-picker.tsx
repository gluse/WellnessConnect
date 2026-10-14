import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addMonths, format, startOfMonth } from "date-fns";
import { Clock, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { dateInZone, type BookableSlot } from "@shared/scheduling";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function BookingTimePicker({ serviceId, bookingId, selected, onSelect }: {
  serviceId: number; bookingId?: number; selected: BookableSlot | null; onSelect: (slot: BookableSlot | null) => void;
}) {
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const today = dateInZone(new Date(), timezone);
  const [month, setMonth] = useState(startOfMonth(new Date(`${today}T12:00:00`)));
  const [date, setDate] = useState<Date>();
  const dateKey = date ? format(date, "yyyy-MM-dd") : "";
  const zones = Array.from(new Set([Intl.DateTimeFormat().resolvedOptions().timeZone, "Europe/Riga", "Europe/London", "Europe/Berlin", "America/New_York", "America/Los_Angeles", "Asia/Tokyo", "UTC"]));
  const monthQuery = useQuery<{ days: { date: string; availableSlots: number }[] }>({
    queryKey: ["/api/availability/month", serviceId, format(month, "yyyy-MM"), timezone, bookingId ?? null],
    queryFn: async ({ signal }) => (await apiRequest("GET", `${bookingId ? `/api/bookings/${bookingId}/available-times` : `/api/availability/month/${serviceId}`}?month=${format(month, "yyyy-MM")}&timezone=${encodeURIComponent(timezone)}`, undefined, signal)).json(),
    staleTime: 30_000,
  });
  const slotsQuery = useQuery<{ slots: BookableSlot[] }>({
    queryKey: ["/api/availability/slots", serviceId, dateKey, timezone, bookingId ?? null],
    queryFn: async ({ signal }) => (await apiRequest("GET", `${bookingId ? `/api/bookings/${bookingId}/available-times` : `/api/availability/slots/${serviceId}`}?date=${dateKey}&timezone=${encodeURIComponent(timezone)}`, undefined, signal)).json(),
    enabled: Boolean(dateKey), staleTime: 0,
  });
  useEffect(() => {
    if (selected && slotsQuery.data && !slotsQuery.data.slots.some(slot => slot.startsAt === selected.startsAt)) onSelect(null);
  }, [slotsQuery.data, selected, onSelect]);
  const available = new Set(monthQuery.data?.days.filter(day => day.availableSlots > 0).map(day => day.date));
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-semibold">Select a date & time</h3>
      <div className="flex items-center gap-2 text-sm">
        <Label htmlFor="booking-timezone">Timezone</Label>
        <select id="booking-timezone" className="border rounded-md p-2 max-w-[200px] bg-white" value={timezone} onChange={event => {
          setTimezone(event.target.value); setDate(undefined); onSelect(null);
          setMonth(startOfMonth(new Date(`${dateInZone(new Date(), event.target.value)}T12:00:00`)));
        }}>{zones.map(zone => <option key={zone} value={zone}>{zone.replaceAll("_", " ")}</option>)}</select>
      </div>
    </div>
    <div className="grid md:grid-cols-[auto_1fr] gap-5">
      <div>
        <Calendar mode="single" weekStartsOn={1} month={month} onMonthChange={value => { setMonth(value); setDate(undefined); onSelect(null); }} selected={date}
          onSelect={value => { setDate(value); onSelect(null); }} fromMonth={startOfMonth(new Date(`${today}T12:00:00`))} toMonth={addMonths(new Date(), 6)}
          disabled={value => format(value, "yyyy-MM-dd") < today || monthQuery.isPending || monthQuery.isError || !available.has(format(value, "yyyy-MM-dd"))}
          className="border rounded-xl w-fit mx-auto" />
        {monthQuery.isFetching && <p role="status" className="text-xs text-neutral-500 mt-2 flex items-center justify-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Checking availability…</p>}
        {monthQuery.isError && <div role="alert" className="mt-2 text-sm text-red-600">Unable to load available dates. <Button size="sm" variant="ghost" onClick={() => void monthQuery.refetch()}>Retry</Button></div>}
        {monthQuery.isSuccess && !available.size && <p className="text-sm text-neutral-500 mt-2">No openings this month. Try the next month.</p>}
      </div>
      <div className="min-w-0">
        {!date && <p className="text-neutral-500 text-sm py-4">Choose a highlighted date to see available times.</p>}
        {date && <>
          <p className="font-medium mb-3">{format(date, "EEEE, d MMMM")}</p>
          {slotsQuery.isFetching && <p role="status" className="flex gap-2 text-sm text-neutral-500"><Loader2 className="w-4 h-4 animate-spin" /> Checking times…</p>}
          {slotsQuery.isError && <div role="alert" className="text-sm text-red-600">Unable to load times. <Button variant="ghost" size="sm" onClick={() => void slotsQuery.refetch()}>Retry</Button></div>}
          {slotsQuery.isSuccess && !slotsQuery.data.slots.length && <p className="text-sm text-neutral-500">This date is fully booked. Choose another date.</p>}
          <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
            {!slotsQuery.isFetching && !slotsQuery.isError && slotsQuery.data?.slots.map(slot => <Button key={slot.startsAt} variant={selected?.startsAt === slot.startsAt ? "default" : "outline"} aria-pressed={selected?.startsAt === slot.startsAt} onClick={() => onSelect(slot)}>
              <Clock className="w-3 h-3 mr-1" />{slot.startTime}
              {slotsQuery.data.slots.filter(other => other.startTime === slot.startTime).length > 1 && <span className="text-[10px] ml-1">{new Date(slot.startsAt).toLocaleTimeString("en", { timeZone: timezone, timeZoneName: "short", hour: "2-digit", minute: "2-digit" }).split(" ").at(-1)}</span>}
            </Button>)}
          </div>
        </>}
      </div>
    </div>
    {selected && <p role="status" className="text-sm rounded-lg bg-primary/5 p-3">{new Date(selected.startsAt).toLocaleDateString(undefined, { timeZone: timezone, weekday: "long", day: "numeric", month: "long" })} · {selected.startTime}–{selected.endTime} · {timezone}</p>}
  </div>;
}
