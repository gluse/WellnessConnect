import { sql } from "drizzle-orm";
import type { Service } from "@shared/schema";
import { queryRows, type ProductQuery } from "./wishlist/postgres";

export const customerVisibleServiceFields = ["name", "description", "category", "serviceType", "price", "currency", "duration", "cleanupTime", "maxCapacity", "ageGroups", "targetGender", "instantBooking", "advancePaymentPercent", "imageUrls", "externalUrl", "addressId", "employeeId", "isActive"] as const;
type ServiceListing = Pick<Service, "id" | typeof customerVisibleServiceFields[number]>;

export function changedServiceFields(previous: ServiceListing, updated: ServiceListing): string[] {
  return customerVisibleServiceFields.filter(field => {
    // ORM decimal text may have different insignificant zeroes after a save.
    if (field === "price") return Number(previous[field]) !== Number(updated[field]);
    return JSON.stringify(previous[field] ?? null) !== JSON.stringify(updated[field] ?? null);
  });
}

// Call with the service row locked FOR UPDATE. Booking creation takes FOR SHARE
// on that same row, so a reservation cannot slip between this check and removal.
export async function hasUnfinishedServiceBookings(tx: ProductQuery, serviceId: number) {
  return (await queryRows(tx, sql`SELECT id FROM public.bookings WHERE service_id=${serviceId}
    AND (status IS NULL OR status NOT IN ('completed','cancelled')) LIMIT 1`)).length > 0;
}

export async function notifyBookedServiceChanges(tx: ProductQuery, previous: ServiceListing, updated: ServiceListing, now = new Date()) {
  const fields = changedServiceFields(previous, updated);
  if (!fields.length) return;
  // Insert in the listing transaction: failures roll back the edit. No remote
  // delivery, booking mutation or new consent is inferred from reading a notice.
  await tx.execute(sql`INSERT INTO public.customer_service_notifications(id,seeker_id,booking_id,service_id,changed_fields,created_at,expires_at)
    SELECT gen_random_uuid(),b.seeker_id,b.id,b.service_id,${JSON.stringify(fields)}::jsonb,${now.toISOString()}::timestamptz,${new Date(now.getTime() + 90 * 86_400_000).toISOString()}::timestamptz
    FROM public.bookings b WHERE b.service_id=${updated.id} AND b.status IN ('pending','confirmed')`);
}
