import { useState } from "react";
import { format } from "date-fns";
import { CalendarDays, Clock } from "lucide-react";
import type { BookingWithDetails, Employee } from "@shared/schema";
import { getProviderName } from "@shared/provider";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { BookingReviewSummary } from "@/components/booking-review";

export default function AppointmentAgenda({ bookings, employees = [], provider = false, loading = false, updating = false, onStatusChange, onReschedule }: {
  bookings: BookingWithDetails[]; employees?: Employee[]; provider?: boolean; loading?: boolean;
  updating?: boolean;
  onStatusChange?: (id: number, status: "confirmed" | "cancelled" | "completed") => void;
  onReschedule?: (booking: BookingWithDetails) => void;
}) {
  const [view, setView] = useState<"upcoming" | "date" | "past">("upcoming");
  const [date, setDate] = useState(new Date());
  const [employeeId, setEmployeeId] = useState("all");
  const [status, setStatus] = useState("all");
  const now = Date.now();
  const selectedDay = format(date, "yyyy-MM-dd");
  const filtered = bookings.filter(booking => (employeeId === "all" || String(booking.employeeId) === employeeId) && (status === "all" || booking.status === status));
  const displayed = filtered.filter(booking => {
    const start = new Date(booking.scheduledDate);
    if (view === "date") return format(start, "yyyy-MM-dd") === selectedDay;
    if (view === "past") return start.getTime() < now || booking.status === "cancelled" || booking.status === "completed";
    return start.getTime() >= now && (booking.status === "pending" || booking.status === "confirmed");
  }).sort((a, b) => view === "past" ? new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime() : new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
  const groups = new Map<string, BookingWithDetails[]>();
    for (const booking of displayed) {
    const key = format(new Date(booking.scheduledDate), "yyyy-MM-dd");
    groups.set(key, [...(groups.get(key) || []), booking]);
  }
  return <section className="border rounded-xl bg-white p-3 sm:p-6 space-y-5">
    <div className="flex flex-wrap gap-3 justify-between items-center">
      <h2 className="text-lg font-semibold flex items-center gap-2"><CalendarDays className="w-5 h-5" />Appointments</h2>
      <div className="flex flex-wrap gap-1 bg-neutral-100 p-1 rounded-lg" aria-label="Appointment view">{(["upcoming", "date", "past"] as const).map(item => <Button key={item} size="sm" variant={view === item ? "default" : "ghost"} aria-pressed={view === item} onClick={() => setView(item)}>{item === "upcoming" ? "Upcoming" : item === "date" ? "By date" : "Past & cancelled"}</Button>)}</div>
    </div>
    <div className="flex flex-wrap gap-3 text-sm">
      <div className="flex items-center gap-2"><Label htmlFor={provider ? "provider-appointment-status" : "seeker-appointment-status"}>Status</Label><select id={provider ? "provider-appointment-status" : "seeker-appointment-status"} className="border rounded-md p-2 bg-white" value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option>{["pending", "confirmed", "completed", "cancelled"].map(item => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}</select></div>
      {provider && employees.length > 0 && <div className="flex items-center gap-2 min-w-0 max-w-full"><Label htmlFor="appointment-employee">Employee</Label><select id="appointment-employee" className="border rounded-md p-2 bg-white min-w-0" value={employeeId} onChange={event => setEmployeeId(event.target.value)}><option value="all">All employees</option>{employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></div>}
      <p className="text-xs text-neutral-500 self-center">Times shown in {Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
    </div>
    <div className={view === "date" ? "grid md:grid-cols-[auto_1fr] gap-6" : ""}>
      {view === "date" && <Calendar mode="single" weekStartsOn={1} selected={date} onSelect={value => { if (value) setDate(value); }} modifiers={{ booked: filtered.map(booking => new Date(booking.scheduledDate)) }} modifiersClassNames={{ booked: "font-bold underline decoration-primary underline-offset-4" }} className="border rounded-xl h-fit w-fit mx-auto p-1 sm:p-3" />}
      <div className="min-w-0 space-y-5">
        {loading ? <p role="status" className="text-sm text-neutral-500">Loading appointments…</p> : !displayed.length ? <p className="text-sm text-neutral-500 py-6">{view === "date" ? `No appointments on ${format(date, "d MMMM yyyy")}.` : "No appointments in this view."}</p> : Array.from(groups).map(([day, dayBookings]) => <div key={day} className="space-y-2">
          <h3 className="text-sm font-semibold text-neutral-700">{format(new Date(`${day}T12:00:00`), "EEEE, d MMMM yyyy")}</h3>
          {dayBookings.map(booking => <article key={booking.id} className="border rounded-lg p-4 space-y-3">
            <div className="flex flex-wrap justify-between items-start gap-3">
              <div className="min-w-0"><p className="font-medium break-words">{booking.service.name}</p><p className="text-sm text-neutral-600">{provider ? [booking.seeker.firstName, booking.seeker.lastName].filter(Boolean).join(" ") || booking.seeker.email || "Customer" : getProviderName(booking.provider)}</p>
                {(provider ? employees.find(employee => employee.id === booking.employeeId)?.name : booking.employee?.name) && <p className="text-xs text-neutral-500">With {provider ? employees.find(employee => employee.id === booking.employeeId)?.name : booking.employee?.name}</p>}
              </div>
              <Badge className={booking.status === "pending" ? "bg-amber-50 text-amber-800 border-amber-200" : booking.status === "confirmed" ? "bg-green-50 text-green-800 border-green-200" : "bg-neutral-100 text-neutral-600 border-neutral-200"}>{booking.status}</Badge>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-neutral-600"><span className="flex items-center gap-1"><Clock className="w-4 h-4" />{format(new Date(booking.scheduledDate), "HH:mm")}–{format(new Date(new Date(booking.scheduledDate).getTime() + (booking.bookingDuration ?? booking.service.duration) * 60_000), "HH:mm")}</span><span>${booking.totalAmount}</span>{(booking.participantCount ?? 1) > 1 && <span>{booking.participantCount} participants</span>}</div>
            {provider && booking.notes && <p className="text-sm text-neutral-500 whitespace-pre-wrap break-words">{booking.notes}</p>}
            {!provider && booking.review && <BookingReviewSummary key={booking.review.id} booking={booking} />}
            {provider && (booking.status === "pending" || booking.status === "confirmed") && (onStatusChange || onReschedule) && <div className="flex flex-wrap gap-2">
              {booking.status === "pending" && onStatusChange && <Button size="sm" disabled={updating} onClick={() => onStatusChange(booking.id, "confirmed")}>Approve</Button>}
              {booking.status === "confirmed" && onStatusChange && <Button size="sm" disabled={updating} onClick={() => onStatusChange(booking.id, "completed")}>Mark complete</Button>}
              {onReschedule && <Button variant="outline" size="sm" disabled={updating} onClick={() => onReschedule(booking)}>Reschedule</Button>}
              {onStatusChange && <Button variant="outline" size="sm" disabled={updating} onClick={() => onStatusChange(booking.id, "cancelled")}>{booking.status === "pending" ? "Decline" : "Cancel booking"}</Button>}
            </div>}
          </article>)}
        </div>)}
      </div>
    </div>
  </section>;
}
