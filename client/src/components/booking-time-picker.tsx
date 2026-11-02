import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addMonths, format, startOfMonth } from "date-fns";
import { useTranslation } from "react-i18next";
import { Clock, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { dateInZone, type BookableSlot } from "@shared/scheduling";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function BookingTimePicker({ serviceId, bookingId, selected, onSelect }: {
  serviceId: number; bookingId?: number; selected: BookableSlot | null; onSelect: (slot: BookableSlot | null) => void;
}) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language;
  const [timezone, setTimezone] = useState(selected?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
  const today = dateInZone(new Date(), timezone);
  const [date, setDate] = useState<Date | undefined>(() => selected ? new Date(dateInZone(new Date(selected.startsAt), timezone) + "T12:00:00") : undefined);
  const [month, setMonth] = useState(() => startOfMonth(date || new Date(today + "T12:00:00")));
  const dateKey = date ? format(date, "yyyy-MM-dd") : "";
  const zones = Array.from(new Set([timezone, Intl.DateTimeFormat().resolvedOptions().timeZone, "Europe/Riga", "Europe/London", "Europe/Berlin", "America/New_York", "America/Los_Angeles", "Asia/Tokyo", "UTC"]));
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
    if (!selected || !slotsQuery.data) return;
    const current = slotsQuery.data.slots.find(slot => slot.startsAt === selected.startsAt);
    if (!current) onSelect(null);
    else if (current.availableCapacity !== selected.availableCapacity) onSelect(current);
  }, [slotsQuery.data, selected, onSelect]);
  const available = new Set(monthQuery.data?.days.filter(day => day.availableSlots > 0).map(day => day.date));
  const dateLabel = (value: Date) => new Intl.DateTimeFormat(language, { calendar: "gregory", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(value);
  return <div className="space-y-4 min-w-0" dir={i18n.dir()}>
    <div className="flex flex-wrap items-end justify-between gap-3">
      <h3 className="font-semibold">{t("bookingForm.chooseDateTime")}</h3>
      <div className="space-y-2 min-w-0">
        <Label htmlFor="booking-timezone">{t("bookingForm.timezone")}</Label>
        <select id="booking-timezone" className="border rounded-md p-2 min-h-11 w-full max-w-full bg-background" value={timezone} dir="ltr" onChange={event => {
          setTimezone(event.target.value); setDate(undefined); onSelect(null);
          setMonth(startOfMonth(new Date(dateInZone(new Date(), event.target.value) + "T12:00:00")));
        }}>{zones.map(zone => <option key={zone} value={zone}>{zone.replaceAll("_", " ")}</option>)}</select>
      </div>
    </div>
    <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5">
      <div className="min-w-0">
        <Calendar mode="single" dir={i18n.dir()} weekStartsOn={1} month={month}
          labels={{ labelPrevious: () => t("bookingForm.previousMonth"), labelNext: () => t("bookingForm.nextMonth"), labelWeekday: value => new Intl.DateTimeFormat(language, { weekday: "long" }).format(value) }}
          formatters={{
            formatCaption: value => new Intl.DateTimeFormat(language, { calendar: "gregory", month: "long", year: "numeric" }).format(value),
            formatDay: value => new Intl.NumberFormat(language).format(value.getDate()),
            formatWeekdayName: value => new Intl.DateTimeFormat(language, { weekday: "narrow" }).format(value),
          }}
          onMonthChange={value => { setMonth(value); setDate(undefined); onSelect(null); }} selected={date}
          onSelect={value => { setDate(value); onSelect(null); }} fromMonth={startOfMonth(new Date(today + "T12:00:00"))} toMonth={addMonths(new Date(), 6)}
          disabled={value => format(value, "yyyy-MM-dd") < today || monthQuery.isPending || monthQuery.isError || !available.has(format(value, "yyyy-MM-dd"))}
          className="border rounded-xl w-full"
          classNames={{
            months: "w-full", month: "w-full space-y-4", table: "w-full border-collapse", head_row: "flex w-full",
            head_cell: "flex-1 min-w-0 text-muted-foreground font-normal text-xs", row: "flex w-full mt-2",
            cell: "relative flex-1 min-w-0 text-center text-sm p-0", day: "inline-flex items-center justify-center rounded-md h-10 w-full min-w-0 p-0 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
            nav_button: "h-10 w-10 inline-flex items-center justify-center rounded-md border bg-background focus-visible:outline focus-visible:outline-2",
            nav_button_previous: "absolute start-1", nav_button_next: "absolute end-1",
          }} />
        {monthQuery.isFetching && <p role="status" className="text-sm text-muted-foreground mt-2 flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none shrink-0" aria-hidden="true" />{t("bookingForm.checkingDates")}</p>}
        {monthQuery.isError && <div role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">{t("bookingForm.datesError")} <Button type="button" className="min-h-11 h-auto whitespace-normal" variant="ghost" onClick={() => void monthQuery.refetch()}>{t("publicSearch.retry")}</Button></div>}
        {monthQuery.isSuccess && !available.size && <p className="text-sm text-muted-foreground mt-2">{t("bookingForm.monthEmpty")}</p>}
      </div>
      <div className="min-w-0">
        {!date && <p className="text-muted-foreground text-sm py-4">{t("bookingForm.chooseHighlighted")}</p>}
        {date && <>
          <p className="font-medium mb-3">{dateLabel(date)}</p>
          {slotsQuery.isFetching && <p role="status" className="flex gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none shrink-0" aria-hidden="true" />{t("bookingForm.checkingTimes")}</p>}
          {slotsQuery.isError && <div role="alert" className="text-sm text-red-700 dark:text-red-300">{t("bookingForm.timesError")} <Button type="button" variant="ghost" className="min-h-11 h-auto whitespace-normal" onClick={() => void slotsQuery.refetch()}>{t("publicSearch.retry")}</Button></div>}
          {slotsQuery.isSuccess && !slotsQuery.data.slots.length && <p className="text-sm text-muted-foreground">{t("bookingForm.dateEmpty")}</p>}
          <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pe-1">
            {!slotsQuery.isFetching && !slotsQuery.isError && slotsQuery.data?.slots.map(slot => <Button type="button" className="min-h-11 h-auto whitespace-normal" key={slot.startsAt} variant={selected?.startsAt === slot.startsAt ? "default" : "outline"} aria-pressed={selected?.startsAt === slot.startsAt} onClick={() => onSelect(slot)}>
              <Clock className="w-3 h-3 shrink-0" aria-hidden="true" /><bdi>{slot.startTime}</bdi>
              {slotsQuery.data.slots.filter(other => other.startTime === slot.startTime).length > 1 && <span className="text-xs"><bdi>{new Intl.DateTimeFormat(language, { timeZone: timezone, timeZoneName: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(slot.startsAt))}</bdi></span>}
            </Button>)}
          </div>
        </>}
      </div>
    </div>
    {selected && <p role="status" className="text-sm rounded-lg bg-muted p-3">{new Intl.DateTimeFormat(language, { timeZone: selected.timezone, weekday: "long", day: "numeric", month: "long" }).format(new Date(selected.startsAt))} · <bdi>{selected.startTime}–{selected.endTime}</bdi> · <bdi>{selected.timezone}</bdi></p>}
  </div>;
}
