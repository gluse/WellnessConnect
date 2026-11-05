import type { BookingWithDetails } from "@shared/schema";
import { useTranslation } from "react-i18next";
import { amountToMinor, minorToAmount, normalizeMoneyAmount } from "@shared/money";
import { formatMoney } from "@/lib/money";

export default function AppointmentStats({ bookings }: { bookings: BookingWithDetails[] }) {
  const { t, i18n } = useTranslation();
  const totals = new Map<string, bigint>();
  let unavailable = false;
  for (const booking of bookings.filter(booking => booking.status === "confirmed" || booking.status === "completed")) {
    try {
      const value = amountToMinor(normalizeMoneyAmount(booking.totalAmount, booking.currency), booking.currency);
      totals.set(booking.currency, (totals.get(booking.currency) ?? BigInt(0)) + value);
    } catch { unavailable = true; }
  }
  const revenue = Array.from(totals).sort(([a], [b]) => a.localeCompare(b)).map(([currency, total]) =>
    formatMoney(minorToAmount(total, currency), currency, i18n.resolvedLanguage || i18n.language) ?? t("currency.unavailable"));
  if (unavailable) revenue.push(t("currency.unavailable"));
  const stats = [
    { label: t("appointmentAgenda.totalBookings"), value: bookings.length },
    { label: t("appointmentAgenda.awaitingApproval"), value: bookings.filter(booking => booking.status === "pending").length },
    { label: t("appointmentAgenda.revenue"), value: revenue.length ? revenue.map((value, index) => <span className="block break-words text-sm sm:text-base" key={index}>{value}</span>) : "0" },
  ];
  return <dl className="grid grid-cols-3 rounded-xl border bg-white py-3 divide-x rtl:divide-x-reverse" data-testid="appointment-summary">{stats.map(stat => <div key={stat.label} className="min-w-0 px-2 sm:px-4 text-center flex flex-col">
    <dt className="text-xs sm:text-sm text-neutral-600">{stat.label}</dt><dd className="order-first text-xl sm:text-2xl font-bold text-neutral-900 mb-1">{stat.value}</dd>
  </div>)}</dl>;
}
