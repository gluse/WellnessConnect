import type { BookingWithDetails } from "@shared/schema";
import { RescheduleRequestDialog } from "@/components/booking-collaboration";

export default function RescheduleDialog(props: { booking: BookingWithDetails; onClose: () => void; restoreFocus?: () => void }) {
  return <RescheduleRequestDialog {...props} />;
}
