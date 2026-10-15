import type { BookingWithDetails } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";

export default function AppointmentStats({ bookings }: { bookings: BookingWithDetails[] }) {
  const revenue = bookings.filter(booking => booking.status === "confirmed" || booking.status === "completed")
    .reduce((sum, booking) => sum + Number(booking.totalAmount), 0);
  const stats = [
    { label: "Total Bookings", value: bookings.length },
    { label: "Awaiting approval", value: bookings.filter(booking => booking.status === "pending").length },
    { label: "Revenue", value: `$${revenue.toFixed(0)}` },
  ];
  return <div className="grid grid-cols-3 gap-2 sm:gap-4">{stats.map(stat => <Card key={stat.label}>
    <CardContent className="p-3 sm:p-4 text-center"><div className="text-xl sm:text-2xl font-bold text-primary">{stat.value}</div><div className="text-xs sm:text-sm text-neutral-600">{stat.label}</div></CardContent>
  </Card>)}</div>;
}
