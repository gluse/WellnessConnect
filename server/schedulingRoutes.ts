import type { Express } from "express";
import { z } from "zod";
import { addDateDays, bookableSlots, validDateKey, validTimezone } from "@shared/scheduling";
import { storage } from "./storage";
import { isAuthenticated } from "./auth";
import { AccessError, assertBookingChange, assertService, scope } from "./companyAccess";
import { CustomerBookingError } from "./customerBookings";
import { optionBookableSlots, optionScheduleRows, selectedServiceOption, ServiceOptionError } from "./service-options";

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
  res.status(error instanceof AccessError || error instanceof CustomerBookingError || error instanceof ServiceOptionError ? error.status : error instanceof z.ZodError ? 400 : 500)
    .json({ ...(error instanceof ServiceOptionError ? { code: error.code } : {}), message: error instanceof AccessError || error instanceof CustomerBookingError || error instanceof ServiceOptionError ? error.message : error instanceof z.ZodError ? error.issues[0].message : "Unable to update availability. Please try again." });
}
export async function serviceSlotData(serviceId: number, first: string, last = first, optionId?: number) {
  const service = await storage.getServiceById(serviceId);
  if (!service?.isActive || !service.companyActive) throw new AccessError(404, "Service not found");
  const [schedules, bookings, options, employees] = await Promise.all([
    storage.getAvailabilityByProvider(service.providerId, service.companyId ?? undefined),
    storage.getBookingsForResourceRange({ ...service, employeeId: null }, new Date(`${addDateDays(first, -1)}T00:00:00Z`), new Date(`${addDateDays(last, 2)}T00:00:00Z`)),
    storage.getServiceOptions(service), service.companyId == null ? Promise.resolve([]) : storage.getEmployees(service.providerId, service.companyId),
  ]);
  return { service, schedules, bookings, option: selectedServiceOption(options, optionId), employees };
}
const selectionQuery = z.object({ optionId: z.coerce.number().int().positive().max(2147483647).optional(),
  specialist: z.union([z.literal("any"), z.coerce.number().int().positive().max(2147483647)]).default("any"), participantCount: z.coerce.number().int().min(1).max(10000).default(1) });
export function setupSchedulingRoutes(app: Express) {
  app.get("/api/availability/month/:serviceId", async (req, res) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.serviceId);
      const month = monthSchema.parse(req.query.month);
      const timezone = timezoneSchema.parse(req.query.timezone ?? "UTC");
      const selection = selectionQuery.parse(req.query);
      const { first, last } = monthBounds(month);
      const data = await serviceSlotData(id, first, last, selection.optionId), days = [];
      const now = new Date();
      for (let date = first; date <= last; date = addDateDays(date, 1)) days.push({ date, availableSlots: optionBookableSlots({ ...data, ...selection, date, timezone, now }).length });
      res.json({ month, timezone, days });
    } catch (error) { failure(error, res); }
  });
  app.get("/api/availability/slots/:serviceId", async (req, res) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.serviceId);
      const date = dateSchema.parse(req.query.date), timezone = timezoneSchema.parse(req.query.timezone ?? "UTC");
      const selection = selectionQuery.parse(req.query);
      const data = await serviceSlotData(id, date, date, selection.optionId);
      const slots = optionBookableSlots({ ...data, ...selection, date, timezone });
      res.json({ date, timezone, serviceId: id, optionId: data.option.id, serviceDuration: data.option.duration, slots, totalSlots: slots.length, availableSlots: slots.length });
    } catch (error) { failure(error, res); }
  });
  app.get("/api/bookings/:id/available-times", isAuthenticated, async (req, res) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const booking = await storage.getBookingById(id);
      assertBookingChange(req, booking);
      const timezone = timezoneSchema.parse(req.query.timezone ?? "UTC");
      const month = req.query.month == null ? null : monthSchema.parse(req.query.month);
      const { first, last } = month ? monthBounds(month) : { first: dateSchema.parse(req.query.date), last: dateSchema.parse(req.query.date) };
      const service = { ...booking!.service, optionId: booking!.optionId, providerId: booking!.providerId, companyId: booking!.companyId, employeeId: booking!.employeeId, duration: booking!.bookingDuration ?? booking!.service.duration, cleanupTime: booking!.bookingCleanupTime ?? 0 };
      const [inherited, allBookings, options] = await Promise.all([
        storage.getAvailabilityByProvider(service.providerId, service.companyId ?? undefined),
        storage.getBookingsForResourceRange(service, new Date(`${addDateDays(first, -1)}T00:00:00Z`), new Date(`${addDateDays(last, 2)}T00:00:00Z`)),
        storage.getServiceOptions(service, true),
      ]);
      const option = options.find(item => item.id === booking!.optionId);
      const schedules = option ? optionScheduleRows(service, option, inherited) : inherited;
      const bookings = allBookings.filter(row => row.id !== id), now = new Date();
      if (month) {
        const days = [];
        for (let date = first; date <= last; date = addDateDays(date, 1)) days.push({ date, availableSlots: bookableSlots({ service, schedules, bookings, date, timezone, participantCount: booking!.participantCount ?? 1, now }).length });
        res.json({ month, timezone, days });
      } else res.json({ slots: bookableSlots({ service, schedules, bookings, date: first, timezone, participantCount: booking!.participantCount ?? 1, now }) });
    } catch (error) { failure(error, res); }
  });
  app.put("/api/availability/weekly", isAuthenticated, async (req, res) => {
    try {
      const current = scope(req, "manageSchedules");
      const body = z.object({ ...target, inherit: z.boolean().default(false), recurrenceEndType: z.enum(["never", "on_date"]).default("never"), recurrenceEndValue: dateSchema.nullable().optional(), days: z.array(z.object({ day: z.number().int().min(0).max(6), intervals })).length(7).refine(days => new Set(days.map(item => item.day)).size === 7, "Include each weekday once.") })
        .refine(value => value.recurrenceEndType !== "on_date" || value.recurrenceEndValue != null, "Choose the last date for this schedule.").parse(req.body?.inherit === true
          ? { serviceId: req.body.serviceId, inherit: true, timezone: "UTC", days: Array.from({ length: 7 }, (_, day) => ({ day, intervals: [] })) }
          : req.body);
      if (body.serviceId != null) assertService(req, await storage.getServiceById(body.serviceId), true);
      if (body.inherit && body.serviceId == null) throw new AccessError(400, "General working hours cannot inherit another schedule.");
      const recurrence = { recurrenceEndType: body.recurrenceEndType, recurrenceEndValue: body.recurrenceEndType === "on_date" ? body.recurrenceEndValue! : null };
      const rows = body.days.flatMap(day => day.intervals.map(range => ({ ...range, providerId: current.providerId, companyId: current.companyId ?? null, serviceId: body.serviceId, timezone: body.timezone, scheduleType: "recurring" as const, daysOfWeek: [day.day], breaks: [], ...recurrence, isActive: true })));
      // An explicit empty weekly schedule prevents service-specific hours from
      // silently falling back to the company's general hours.
      if (!rows.length && !body.inherit) rows.push({ startTime: "00:00", endTime: "00:00", providerId: current.providerId, companyId: current.companyId ?? null, serviceId: body.serviceId, timezone: body.timezone, scheduleType: "recurring", daysOfWeek: [], breaks: [], recurrenceEndType: "never", recurrenceEndValue: null, isActive: true });
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
