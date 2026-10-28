import type { Booking } from "@shared/schema";

export class CustomerBookingError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// Recheck the same customer rules inside the booking transaction, after locking.
export function assertCustomerBookingChange(
  booking: Pick<Booking, "seekerId" | "status" | "scheduledDate">,
  seekerId: string,
  now = new Date(),
) {
  if (!seekerId || booking.seekerId !== seekerId) throw new CustomerBookingError(403, "This reservation does not belong to you.");
  if (booking.status !== "pending" && booking.status !== "confirmed") throw new CustomerBookingError(409, "Only pending or confirmed reservations can be changed.");
  if (!(new Date(booking.scheduledDate).getTime() > now.getTime())) throw new CustomerBookingError(409, "Only future reservations can be changed.");
}
