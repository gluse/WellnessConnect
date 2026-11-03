import { CalendarDays, CalendarClock, History, Clock, List, Settings } from "lucide-react";
import type { WorkspaceContext } from "@shared/schema";

export function providerSections(context?: WorkspaceContext) {
  return [
    { path: "/my-services/appointments", labelKey: "appointmentAgenda.calendar", icon: CalendarDays, visible: true },
    { path: "/my-services/upcoming-appointments", labelKey: "providerNavigation.upcomingAppointments", icon: CalendarClock, visible: true },
    { path: "/my-services/past-appointments", labelKey: "providerNavigation.pastAppointments", icon: History, visible: true },
    { path: "/my-services/services", labelKey: "mobileNavigation.services", icon: List, visible: true },
    { path: "/my-services/availability", labelKey: "mobileNavigation.availability", icon: Clock, visible: context?.permissions.manageSchedules },
    { path: "/my-services/settings", labelKey: "mobileNavigation.settings", icon: Settings, visible: context && (context.permissions.manageServices || context.permissions.manageTeam || context.permissions.isOwner) },
  ].filter(section => section.visible);
}
