import assert from "node:assert/strict";
import { createServiceReport, groupServiceReport, reportEmployees, sortServiceGroups } from "../client/src/lib/service-report.ts";

const period = { from: "2026-11-01", to: "2026-11-30" };
const booking = (id, serviceId, employeeId, status, amount, currency = "EUR") => ({ id, serviceId, employeeId, status, totalAmount: amount, currency, scheduledDate: "2026-11-07T12:00:00", employee: employeeId == null ? null : { id: employeeId, name: `Booked worker ${employeeId}` }, service: { id: serviceId, name: serviceId === 99 ? "Historical service" : "Same name", employeeId: 12 } });
const bookings = [booking(1, 1, 11, "completed", "0.10"), booking(2, 1, 11, "completed", "0.20"), booking(3, 1, null, "pending", "30"), booking(4, 1, 11, "completed", "7", "USD"), booking(5, 2, 12, "confirmed", "20"), booking(6, 99, 11, "cancelled", "40")];
const catalog = [
  { id: 1, name: "Same name", currency: "EUR", employeeId: 12 }, { id: 2, name: "Same name", currency: "EUR", employeeId: 12 },
  { id: 3, name: "No bookings", currency: "KWD", employeeId: 11, isActive: false }, { id: 4, name: "Shared", currency: "JPY", employeeId: null },
];
const report = createServiceReport(bookings, period);
const groups = groupServiceReport(report.rows, catalog);
assert.equal(groups.length, 6, "Stable service IDs and historical currency create distinct groups, plus zero catalog rows");
assert.equal(groups.filter(row => row.service === "Same name").length, 3);
const euro = groups.find(row => row.serviceId === 1 && row.currency === "EUR");
assert.equal(euro.earned, "0.30"); assert.equal(euro.pending, "30.00"); assert.equal(euro.planned, "0.00");
assert.equal(euro.bookingCount, 3); assert.equal(euro.completedCount, 2); assert.equal(euro.pendingCount, 1);
assert.equal(groups.find(row => row.serviceId === 99).lost, "40.00", "Booking absent from current catalog is retained");
assert.equal(groups.find(row => row.serviceId === 3).earned, "0.000", "Inactive zero-booking service and currency precision retained");
assert.equal(groups.find(row => row.serviceId === 3).bookingCount, 0);
assert.equal(groups.find(row => row.serviceId === 4).pending, "0");

const own = createServiceReport(bookings, period, "11");
assert.deepEqual(own.rows.map(row => row.id), [1, 2, 4, 6]);
const ownGroups = groupServiceReport(own.rows, catalog, "11");
assert.deepEqual(ownGroups.map(row => row.serviceId).sort(), [1, 1, 3, 99], "Reassigned historical bookings stay with booking employee; unrelated zero catalog rows excluded");
assert.equal(ownGroups.find(row => row.serviceId === 1 && row.currency === "EUR").earned, "0.30");
assert.deepEqual(createServiceReport(bookings, period, "unassigned").rows.map(row => row.id), [3]);
assert.deepEqual(groupServiceReport(createServiceReport(bookings, period, "unassigned").rows, catalog, "unassigned").map(row => row.serviceId).sort(), [1, 4]);
assert.deepEqual(groupServiceReport([], catalog, "11").map(row => row.serviceId), [3]);
assert.deepEqual(reportEmployees(own.rows.map(row => bookings.find(booking => booking.id === row.id)), [{ id: 11, name: "Visible worker" }]), [{ id: 11, name: "Visible worker" }]);
assert.deepEqual(reportEmployees([booking(1, 1, 33, "completed", "1")], []), [{ id: 33, name: "Booked worker 33" }]);
assert.equal(sortServiceGroups(groups, "fewest")[0].bookingCount, 0);
assert.equal(sortServiceGroups(groups, "most")[0].bookingCount, 3);
const earned = sortServiceGroups(groups, "earned");
assert.deepEqual(earned.map(row => row.currency), ["EUR", "EUR", "EUR", "JPY", "KWD", "USD"], "Currencies are grouped before ranking revenue");
assert.equal(earned[0].earned, "0.30");
console.log("Passed named-service IDs, status counts/exact currency sums, historical/reassigned employee bookings, zero inactive catalog entries, shared filters and currency-safe ranking.");
