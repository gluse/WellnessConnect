import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { CalendarDays, ChevronDown, ChevronUp, Clock, MessageSquare } from "lucide-react";
import type { BookingWithDetails, Employee } from "@shared/schema";
import { appointmentEventKey } from "@shared/appointment-collaboration";
import { getProviderName } from "@shared/provider";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { BookingReviewSummary } from "@/components/booking-review";
import { BookingControls, EventControls, type ProviderControls } from "@/components/provider/booking-controls";
import { cn } from "@/lib/utils";
import AppointmentCalendar from "@/components/provider/appointment-calendar";

const prefix = "appointmentCollaboration.";

type Props = ProviderControls & {
  bookings: BookingWithDetails[]; employees?: Employee[]; provider?: boolean; loading?: boolean;
  renderCustomerActions?: (booking: BookingWithDetails) => ReactNode;
  renderBookingDetails?: (booking: BookingWithDetails) => ReactNode;
  renderEventDetails?: (booking: BookingWithDetails) => ReactNode;
};
export default function AppointmentAgenda({ bookings, employees = [], provider = false, loading = false, renderCustomerActions, renderBookingDetails, renderEventDetails, ...controls }: Props) {
  const { t, i18n } = useTranslation();
  const [view, setView] = useState<"upcoming" | "date" | "past" | "calendar">("upcoming"), [date, setDate] = useState(new Date());
  const [employeeId, setEmployeeId] = useState("all"), [status, setStatus] = useState("all"), [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const now = Date.now(), selectedDay = format(date, "yyyy-MM-dd");
  const filtered = bookings.filter(row => employeeId === "all" || String(row.employeeId) === employeeId);
  const matches = (row: BookingWithDetails) => {
    if (status !== "all" && row.status !== status) return false;
    const start = new Date(row.scheduledDate);
    if (view === "date") return format(start, "yyyy-MM-dd") === selectedDay;
    if (view === "past") return start.getTime() < now || row.status === "cancelled" || row.status === "completed";
    return start.getTime() >= now && (row.status === "pending" || row.status === "confirmed");
  };
  const events = new Map<string, BookingWithDetails[]>();
  for (const row of filtered) { const key = provider ? appointmentEventKey(row) : `booking:${row.id}`; events.set(key, [...(events.get(key) ?? []), row]); }
  const displayed = Array.from(events).filter(([, rows]) => rows.some(matches)).sort((a, b) => (view === "past" ? -1 : 1) * (new Date(a[1][0].scheduledDate).getTime() - new Date(b[1][0].scheduledDate).getTime()));
  const toggle = (key: string) => setExpanded(current => { const next = new Set(current); next.has(key) ? next.delete(key) : next.add(key); return next; });
  const time = (row: BookingWithDetails) => `${format(new Date(row.scheduledDate), "HH:mm")}–${format(new Date(new Date(row.scheduledDate).getTime() + (row.bookingDuration ?? row.service.duration) * 60_000), "HH:mm")}`;
  const dateLabel = (value: Date) => new Intl.DateTimeFormat(i18n.language, { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(value);
  const dateAndTime = (row: BookingWithDetails) => <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm font-medium text-neutral-700" data-testid="appointment-date-time">
    <span className="inline-flex min-w-0 items-center gap-2"><CalendarDays className="w-4 h-4 shrink-0" aria-hidden="true" /><time dateTime={new Date(row.scheduledDate).toISOString()}>{dateLabel(new Date(row.scheduledDate))}</time></span>
    <span className="inline-flex items-center gap-2 whitespace-nowrap"><Clock className="w-4 h-4 shrink-0" aria-hidden="true" />{time(row)}</span>
  </div>;
  const employee = (row: BookingWithDetails) => provider ? employees.find(item => item.id === row.employeeId)?.name : row.employee?.name;
  const name = (row: BookingWithDetails) => [row.seeker.firstName, row.seeker.lastName].filter(Boolean).join(" ") || row.seeker.email || t(prefix + "customer");
  const badge = (row: BookingWithDetails) => <Badge className={row.status === "pending" ? "bg-amber-50 text-amber-800 border-amber-200" : row.status === "confirmed" ? "bg-green-50 text-green-800 border-green-200" : "bg-neutral-100 text-neutral-600 border-neutral-200"}>{row.status ? t(prefix + "status" + row.status[0].toUpperCase() + row.status.slice(1)) : "—"}</Badge>;
  const renderEvent = (key: string, rows: BookingWithDetails[], forceOpen = false) => {
          const row = rows[0], group = provider && row.service.serviceType === "group", open = forceOpen || expanded.has(key);
          if (group) {
            const confirmed = rows.filter(item => item.status === "confirmed" || item.status === "completed").reduce((sum, item) => sum + (item.participantCount ?? 1), 0), pending = rows.filter(item => item.status === "pending").reduce((sum, item) => sum + (item.participantCount ?? 1), 0);
            return <article key={key} className="border border-indigo-200 bg-white rounded-xl overflow-hidden" data-testid={`group-event-${row.id}`}><header className="p-4 space-y-3">{dateAndTime(row)}<div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 space-y-1"><h2 className="font-semibold break-words">{row.service.name}</h2>{employee(row) && <p className="text-sm text-neutral-600">{employee(row)}</p>}<p className="text-sm">{t(prefix + "bookings", { count: rows.length })}</p></div><div className="flex flex-wrap gap-2 items-center"><EventControls {...controls} booking={row} rows={rows} />{!forceOpen && <Button size="sm" variant="ghost" aria-expanded={open} aria-controls={`event-bookings-${row.id}`} onClick={() => toggle(key)} data-testid={`event-toggle-${row.id}`}>{t(prefix + (open ? "hideBookings" : "viewBookings"), { count: rows.length })}{open ? <ChevronUp className="ms-1 h-4 w-4" aria-hidden="true" /> : <ChevronDown className="ms-1 h-4 w-4" aria-hidden="true" />}</Button>}</div></div><div className="flex flex-wrap gap-2 text-sm"><Badge className="bg-green-50 text-green-800 border-green-200">{t(prefix + "confirmedPlaces", { count: confirmed, capacity: row.service.maxCapacity ?? 1 })}</Badge>{pending > 0 && <Badge className="bg-amber-50 text-amber-800 border-amber-200">{t(prefix + "pendingPlaces", { count: pending })}</Badge>}{!open && rows.some(item => item.notes?.trim()) && <span className="inline-flex gap-1 items-center"><MessageSquare className="h-4 w-4" aria-hidden="true" />{t(prefix + "notesAvailable")}</span>}</div></header>
              {open && renderEventDetails?.(row)}{open && <div id={`event-bookings-${row.id}`} className="divide-y p-3 sm:p-4">{rows.map(item => <section key={item.id} data-testid={`event-booking-${item.id}`} className="py-3 first:pt-0 last:pb-0 space-y-2 min-w-0"><div className="flex flex-wrap gap-3 justify-between"><div className="min-w-0"><p className="font-semibold break-words">{name(item)}</p><p className="text-sm text-neutral-600">{t("booking.participants")}: {item.participantCount ?? 1} · ${item.totalAmount}</p></div>{badge(item)}</div>{status !== "all" && item.status === status && <p className="text-xs font-medium">{t(prefix + "matching")}</p>}<BookingControls {...controls} booking={item} group />{renderBookingDetails?.(item)}</section>)}</div>}
            </article>;
          }
          return <article key={key} className="border bg-white rounded-xl p-4 space-y-3" data-testid={`appointment-${row.id}`}>
            {dateAndTime(row)}
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-start">
              <div className="min-w-0"><p className="font-semibold break-words">{row.service.name}</p><p className="text-sm text-neutral-600 break-words">{provider ? name(row) : getProviderName(row.provider)}</p>{employee(row) && <p className="text-xs text-neutral-600">{employee(row)}</p>}</div>
              <div className="flex flex-col items-end gap-1">{badge(row)}<p className="font-semibold text-neutral-900">${row.totalAmount}</p></div>
            </div>
            {(row.participantCount ?? 1) > 1 && <p className="text-sm text-neutral-700">{row.participantCount} participants</p>}
            {provider && <BookingControls {...controls} booking={row} />}{!provider && row.review && <BookingReviewSummary key={row.review.id} booking={row} />}{!provider && renderCustomerActions?.(row)}{renderBookingDetails?.(row)}
          </article>;

  };
  const filterControls = <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm" data-testid="appointment-filters">
      <div className="flex items-center gap-2 min-w-0 max-w-full"><Label htmlFor={provider ? "provider-appointment-status" : "seeker-appointment-status"}>{t("appointmentAgenda.status")}</Label><select id={provider ? "provider-appointment-status" : "seeker-appointment-status"} className="min-h-11 min-w-0 max-w-full border border-neutral-500 rounded-md p-2 bg-white" value={status} onChange={event => setStatus(event.target.value)}><option value="all">{t("appointmentAgenda.allStatuses")}</option>{["pending", "confirmed", "completed", "cancelled"].map(item => <option key={item} value={item}>{t(prefix + "status" + item[0].toUpperCase() + item.slice(1))}</option>)}</select></div>
      {provider && employees.length > 0 && <div className="flex items-center gap-2 min-w-0 max-w-full"><Label htmlFor="appointment-employee">{t("appointmentAgenda.employee")}</Label><select id="appointment-employee" className="min-h-11 border border-neutral-500 rounded-md p-2 bg-white min-w-0 max-w-full" value={employeeId} onChange={event => setEmployeeId(event.target.value)}><option value="all">{t("appointmentAgenda.allEmployees")}</option>{employees.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></div>}
      <p className="text-xs text-neutral-600 sm:ms-auto">{t("appointmentAgenda.timezone", { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })}</p>
    </div>;
  return <section className="space-y-3" aria-label={t("notifications.appointments")}>
    <div className={cn("grid gap-1 bg-white border p-1 rounded-xl", provider ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3")} role="group" aria-label={t("appointmentAgenda.view")}>
      {((provider ? ["upcoming", "date", "past", "calendar"] : ["upcoming", "date", "past"]) as ("upcoming" | "date" | "past" | "calendar")[]).map(item => <Button key={item} size="sm" className="h-auto min-h-11 whitespace-normal px-2 py-2 text-xs sm:text-sm leading-tight" variant={view === item ? "default" : "ghost"} aria-pressed={view === item} onClick={() => setView(item)}>{t(`appointmentAgenda.${item}`)}</Button>)}
    </div>
    {view !== "calendar" && filterControls}
    {view === "calendar" && provider ? <AppointmentCalendar date={date} onDateChange={setDate} loading={loading} employees={employees} filters={filterControls} updating={controls.updating}
      events={Array.from(events).filter(([, rows]) => status === "all" || rows.some(row => row.status === status)).map(([key, rows]) => ({ key, rows }))}
      renderDetails={event => renderEvent(event.key, event.rows, true)} /> : <div className={view === "date" ? "grid lg:grid-cols-[auto_1fr] gap-3 items-start" : ""}>{view === "date" && <Calendar mode="single" weekStartsOn={1} selected={date} onSelect={value => { if (value) setDate(value); }} modifiers={{ booked: filtered.map(row => new Date(row.scheduledDate)) }} modifiersClassNames={{ booked: "font-bold underline decoration-primary underline-offset-4" }} className="border bg-white rounded-xl h-fit w-fit max-w-full mx-auto p-1 sm:p-3" />}
      <div className="min-w-0 space-y-3">{loading ? <p role="status" className="text-sm text-neutral-600 rounded-xl border bg-white p-4">{t("appointmentAgenda.loading")}</p> : !displayed.length ? <p className="text-sm text-neutral-600 rounded-xl border bg-white p-4">{view === "date" ? t("appointmentAgenda.emptyDate", { date: dateLabel(date) }) : t("appointmentAgenda.empty")}</p> : displayed.map(([key, rows]) => renderEvent(key, rows))}</div>
    </div>}
  </section>;
}
