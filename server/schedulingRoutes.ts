import type { Express } from "express";
import { z } from "zod";
import { addDateDays, bookableSlots, validDateKey, validTimezone } from "@shared/scheduling";
import { storage } from "./storage";
import { isAuthenticated } from "./auth";
import { AccessError, assertBooking, assertService, scope } from "./companyAccess";

const timezoneSchema = z.string().max(100).refine(validTimezone, "Choose a valid timezone.");
const dateSchema = z.string().refine(validDateKey, "Choose a valid date.");
const monthSchema = z.string().regex(/^(?:19|20|21)\d{2}-(?:0[1-9]|1[0-2])$/);
function monthBounds(month: string) {
  return { first: `${month}-01`, last: new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10) };
}
const clock = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Use a time in HH:MM format.");
const intervals = z.array(z.object({ startTime: clock, endTime: clock }).refine(value => value.startTime < value.endTime, "End time must be after start time.")).max(8)
  .refine(ranges => [...ranges].sort((a, b) => a.startTime.localeCompare(b.startTime)).every((range, index, sorted) => index === 0 || sorted[index - 1].endTime <= range.startTime), "Working hours must not overlap.");
const target = { serviceId: z.number().int().positive().nullable(), timezone: timezoneSchema };
function failure(error: unknown, res: import("express").Response) {
  res.status(error instanceof AccessError ? error.status : error instanceof z.ZodError ? 400 : 500)
    .json({ message: error instanceof AccessError ? error.message : error instanceof z.ZodError ? error.issues[0].message : "Unable to update availability. Please try again." });
}
export async function serviceSlotData(serviceId: number, first: string, last = first) {
  const service = await storage.getServiceById(serviceId);
  if (!service?.isActive || !service.companyActive) throw new AccessError(404, "Service not found");
  const [schedules, bookings] = await Promise.all([
    storage.getAvailabilityByProvider(service.providerId, service.companyId ?? undefined),
    storage.getBookingsForResourceRange(service, new Date(`${addDateDays(first, -1)}T00:00:00Z`), new Date(`${addDateDays(last, 2)}T00:00:00Z`)),
  ]);
  return { service, schedules, bookings };
}
export function setupSchedulingRoutes(app: Express) {
  app.get("/api/availability/month/:serviceId", async (req, res) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.serviceId);
      const month = monthSchema.parse(req.query.month);
      const timezone = timezoneSchema.parse(req.query.timezone ?? "UTC");
      const { first, last } = monthBounds(month);
      const data = await serviceSlotData(id, first, last), days = [];
      const now = new Date();
      for (let date = first; date <= last; date = addDateDays(date, 1)) days.push({ date, availableSlots: bookableSlots({ ...data, date, timezone, now }).length });
      res.json({ month, timezone, days });
    } catch (error) { failure(error, res); }
  });
  app.get("/api/availability/slots/:serviceId", async (req, res) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.serviceId);
      const date = dateSchema.parse(req.query.date), timezone = timezoneSchema.parse(req.query.timezone ?? "UTC");
      const data = await serviceSlotData(id, date);
      const slots = bookableSlots({ ...data, date, timezone });
      res.json({ date, timezone, serviceId: id, serviceDuration: data.service.duration, slots, totalSlots: slots.length, availableSlots: slots.length });
    } catch (error) { failure(error, res); }
  });
  app.get("/api/bookings/:id/available-times", isAuthenticated, async (req, res) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const booking = await storage.getBookingById(id);
      assertBooking(req, booking, true);
      const timezone = timezoneSchema.parse(req.query.timezone ?? "UTC");
      const month = req.query.month == null ? null : monthSchema.parse(req.query.month);
      const { first, last } = month ? monthBounds(month) : { first: dateSchema.parse(req.query.date), last: dateSchema.parse(req.query.date) };
      const service = { ...booking!.service, providerId: booking!.providerId, companyId: booking!.companyId, employeeId: booking!.employeeId, duration: booking!.bookingDuration ?? booking!.service.duration };
      const [schedules, allBookings] = await Promise.all([
        storage.getAvailabilityByProvider(service.providerId, service.companyId ?? undefined),
        storage.getBookingsForResourceRange(service, new Date(`${addDateDays(first, -1)}T00:00:00Z`), new Date(`${addDateDays(last, 2)}T00:00:00Z`)),
      ]);
      const bookings = allBookings.filter(row => row.id !== id), now = new Date();
      if (month) {
        const days = [];
        for (let date = first; date <= last; date = addDateDays(date, 1)) days.push({ date, availableSlots: bookableSlots({ service, schedules, bookings, date, timezone, now }).length });
        res.json({ month, timezone, days });
      } else res.json({ slots: bookableSlots({ service, schedules, bookings, date: first, timezone, now }) });
    } catch (error) { failure(error, res); }
  });
  app.put("/api/availability/weekly", isAuthenticated, async (req, res) => {
    try {
      const current = scope(req, "manageSchedules");
      const body = z.object({ ...target, inherit: z.boolean().default(false), days: z.array(z.object({ day: z.number().int().min(0).max(6), intervals })).length(7).refine(days => new Set(days.map(item => item.day)).size === 7, "Include each weekday once.") }).parse(req.body);
      if (body.serviceId != null) assertService(req, await storage.getServiceById(body.serviceId), true);
      if (body.inherit && body.serviceId == null) throw new AccessError(400, "General working hours cannot inherit another schedule.");
      const rows = body.days.flatMap(day => day.intervals.map(range => ({ ...range, providerId: current.providerId, companyId: current.companyId ?? null, serviceId: body.serviceId, timezone: body.timezone, scheduleType: "recurring" as const, daysOfWeek: [day.day], breaks: [], recurrenceEndType: "never" as const, isActive: true })));
      // An explicit empty weekly schedule prevents service-specific hours from
      // silently falling back to the company's general hours.
      if (!rows.length && !body.inherit) rows.push({ startTime: "00:00", endTime: "00:00", providerId: current.providerId, companyId: current.companyId ?? null, serviceId: body.serviceId, timezone: body.timezone, scheduleType: "recurring", daysOfWeek: [], breaks: [], recurrenceEndType: "never", isActive: true });
      await storage.replaceAvailability(current.providerId, current.companyId, body.serviceId, "recurring", body.inherit ? [] : rows);
      res.json({ success: true });
    } catch (error) { failure(error, res); }
  });
  app.put("/api/availability/override", isAuthenticated, async (req, res) => {
    try {
      const current = scope(req, "manageSchedules");
      const body = z.object({ ...target, date: dateSchema, intervals }).parse(req.body);
      if (body.serviceId != null) assertService(req, await storage.getServiceById(body.serviceId), true);
      const specificDate = new Date(`${body.date}T00:00:00Z`);
      const rows = (body.intervals.length ? body.intervals : [{ startTime: "00:00", endTime: "00:00" }]).map(range => ({ ...range, providerId: current.providerId, companyId: current.companyId ?? null, serviceId: body.serviceId, timezone: body.timezone, scheduleType: "specific" as const, specificDate, breaks: [], isActive: true }));
      await storage.replaceAvailability(current.providerId, current.companyId, body.serviceId, "specific", rows, specificDate);
      res.json({ success: true });
    } catch (error) { failure(error, res); }
  });
  app.delete("/api/availability/override", isAuthenticated, async (req, res) => {
    try {
      const current = scope(req, "manageSchedules");
      const serviceId = req.query.serviceId === "all" ? null : z.coerce.number().int().positive().parse(req.query.serviceId);
      const date = dateSchema.parse(req.query.date);
      if (serviceId != null) assertService(req, await storage.getServiceById(serviceId), true);
      await storage.replaceAvailability(current.providerId, current.companyId, serviceId, "specific", [], new Date(`${date}T00:00:00Z`));
      res.json({ success: true });
    } catch (error) { failure(error, res); }
  });
}
