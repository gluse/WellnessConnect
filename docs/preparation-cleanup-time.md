# Preparation and cleanup time

In **My Services → Services**, add or edit a service and set **Preparation and
cleanup after service (min)** under **Booking and pricing**. Enter a whole number from
0 to 1,440. Zero keeps the existing behavior. Copies retain the original setting.

The extra time follows the customer's appointment. For example, a 30-minute
service with 15 minutes of cleanup booked at 09:00 reserves the employee until
09:45. Customers still see a 09:00–09:30 appointment and the original price.

Daily and monthly availability, booking creation, and rescheduling include this
extra time. Both the service and cleanup must finish within one working interval,
before a break or closing time. The next appointment may start exactly when
cleanup finishes. Appointments for the same employee block each other across
services; appointments for different employees remain independent. Cancelled
appointments release their reserved time.

Each new booking saves the service duration and cleanup time. Editing a listing
does not change existing reservations, including when rescheduling them. Bookings
created before this feature retain zero cleanup time. The server reads the
current listing inside the booking transaction, so a customer cannot override
these values in a booking request.

## Database setup

For an existing database, run `npm run db:setup-cleanup-time` before starting the
updated backend. It applies
[`0006_service_cleanup_time.sql`](../migrations/0006_service_cleanup_time.sql),
adding `services.cleanup_time` and `bookings.booking_cleanup_time` with zero
defaults and constraints requiring values between 0 and 1,440. The migration is
transactional and can be rerun without resetting provider settings or bookings.
Fresh databases created with `npm run db:push` already include these columns.

## Verification

- `npm run test:cleanup-time` checks validation, all 11 translations, editor saves
  and retries, slot boundaries, breaks, daylight-saving changes, cancellations,
  protected updates, booking snapshots, and daily/monthly rescheduling previews.
- `npm run test:cleanup-time-db` checks the real PostgreSQL migration and storage
  using connection-local temporary tables. It verifies legacy defaults,
  idempotency, constraints, copies, cross-service conflicts, employee isolation,
  rescheduling, and cleanup spanning midnight without changing application data.
