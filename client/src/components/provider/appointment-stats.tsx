import type { BookingWithDetails } from "@shared/schema";
import { useTranslation } from "react-i18next";

export default function AppointmentStats({ bookings }: { bookings: BookingWithDetails[] }) {
  const { t } = useTranslation();
  const revenue = bookings.filter(booking => booking.status === "confirmed" || booking.status === "completed")
    .reduce((sum, booking) => sum + Number(booking.totalAmount), 0);
  const stats = [
    { label: t("appointmentAgenda.totalBookings"), value: bookings.length },
    { label: t("appointmentAgenda.awaitingApproval"), value: bookings.filter(booking => booking.status === "pending").length },
    { label: t("appointmentAgenda.revenue"), value: `$${revenue.toFixed(0)}` },
  ];
  return <dl className="grid grid-cols-3 rounded-xl border bg-white py-3 divide-x rtl:divide-x-reverse" data-testid="appointment-summary">{stats.map(stat => <div key={stat.label} className="min-w-0 px-2 sm:px-4 text-center flex flex-col">
    <dt className="text-xs sm:text-sm text-neutral-600">{stat.label}</dt><dd className="order-first text-xl sm:text-2xl font-bold text-neutral-900 mb-1">{stat.value}</dd>
  </div>)}</dl>;
}
