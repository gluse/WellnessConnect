import { useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, MessageSquare } from "lucide-react";
import type { BookingWithDetails } from "@shared/schema";
import type { EventAction } from "@shared/appointment-collaboration";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
const prefix = "appointmentCollaboration.";
export type ProviderControls = {
  updating?: boolean; onStatusChange?: (id: number, status: "confirmed" | "cancelled" | "completed", trigger?: HTMLElement) => void;
  onReschedule?: (booking: BookingWithDetails, trigger?: HTMLElement) => void; onMessage?: (booking: BookingWithDetails, trigger?: HTMLElement) => void;
  onEventAction?: (booking: BookingWithDetails, action: EventAction, trigger?: HTMLElement) => void;
  renderProviderNotifications?: (booking: BookingWithDetails) => ReactNode;
};
export function EventControls({ booking, rows, updating, onEventAction }: ProviderControls & { booking: BookingWithDetails; rows: BookingWithDetails[] }) {
  const { t } = useTranslation();
  const actionTrigger = useRef<HTMLButtonElement>(null);
  if (!onEventAction) return null;
  return <><span className="sr-only">{t(prefix + "wholeEvent")}</span>
    {rows.some(row => row.status === "confirmed") && <Button size="sm" disabled={updating} onClick={event => onEventAction(booking, "complete", event.currentTarget)}>{t(prefix + "markComplete")}</Button>}
    <DropdownMenu><DropdownMenuTrigger asChild><Button ref={actionTrigger} variant="outline" size="sm" disabled={updating} data-testid={`event-actions-${booking.id}`}>{t(prefix + "eventActions")}<ChevronDown className="ms-1 h-4 w-4" aria-hidden="true" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">{rows.some(row => row.status === "confirmed" || row.status === "pending") && <><DropdownMenuItem className="min-h-11" onSelect={() => onEventAction(booking, "reschedule", actionTrigger.current ?? undefined)}>{t(prefix + "rescheduleEvent")}</DropdownMenuItem><DropdownMenuItem className="min-h-11 text-red-700" onSelect={() => onEventAction(booking, "cancel", actionTrigger.current ?? undefined)}>{t(prefix + "cancelEvent")}</DropdownMenuItem></>}<DropdownMenuItem className="min-h-11" onSelect={() => onEventAction(booking, "message", actionTrigger.current ?? undefined)}>{t(prefix + "messageGroup")} · PRO</DropdownMenuItem></DropdownMenuContent>
    </DropdownMenu>
  </>;
}
export function BookingControls({ booking, group, updating, onStatusChange, onReschedule, onMessage, renderProviderNotifications }: ProviderControls & { booking: BookingWithDetails; group?: boolean }) {
  const { t } = useTranslation();
  const actionTrigger = useRef<HTMLButtonElement>(null);
  const active = booking.status === "pending" || booking.status === "confirmed";
  const name = [booking.seeker.firstName, booking.seeker.lastName].filter(Boolean).join(" ") || t(prefix + "customer");
  return <>
    <div className="flex flex-wrap items-center gap-2">
      {booking.status === "pending" && onStatusChange && <Button size="sm" disabled={updating} onClick={event => onStatusChange(booking.id, "confirmed", event.currentTarget)}>{t(prefix + "approve")}</Button>}
      {!group && booking.status === "confirmed" && onStatusChange && <Button size="sm" disabled={updating} onClick={event => onStatusChange(booking.id, "completed", event.currentTarget)}>{t(prefix + "markComplete")}</Button>}
      {renderProviderNotifications?.(booking)}
      {(onMessage || (active && (onStatusChange || onReschedule))) && <DropdownMenu><DropdownMenuTrigger asChild><Button ref={actionTrigger} variant="outline" size="sm" disabled={updating} aria-label={`${t(prefix + "moreActions")} · ${name}`} data-testid={`booking-actions-${booking.id}`}>{t(prefix + "moreActions")}<ChevronDown className="ms-1 h-4 w-4" aria-hidden="true" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">{active && <>{onReschedule && <DropdownMenuItem className="min-h-11" onSelect={() => onReschedule(booking, actionTrigger.current ?? undefined)}>{t(prefix + "rescheduleBooking")}</DropdownMenuItem>}{onStatusChange && <DropdownMenuItem className="min-h-11 text-red-700" onSelect={() => onStatusChange(booking.id, "cancelled", actionTrigger.current ?? undefined)}>{t(prefix + (booking.status === "pending" ? "declineBooking" : "cancelBooking"))}</DropdownMenuItem>}</>}{onMessage && <DropdownMenuItem className="min-h-11" onSelect={() => onMessage(booking, actionTrigger.current ?? undefined)}>{t(prefix + "messages")}</DropdownMenuItem>}</DropdownMenuContent>
      </DropdownMenu>}
    </div>
    {onMessage && <div className="flex flex-wrap gap-x-4 gap-y-1"><Button variant="ghost" size="sm" className="text-primary px-0 min-h-11" onClick={event => { event.currentTarget.focus(); onMessage(booking, event.currentTarget); }} data-testid={`booking-messages-${booking.id}`}><MessageSquare className="h-4 w-4 me-2" aria-hidden="true" />{t(prefix + "messages")}</Button></div>}
  </>;
}
