import type { Express, Request, RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { eventBookingIdsSchema, messageInputSchema, rescheduleInputSchema } from "../../shared/appointment-collaboration";
import { notificationTimezoneSchema } from "../../shared/notifications";
import { isAuthenticated } from "../auth";
import { AccessError, assertBooking } from "../companyAccess";
import { db } from "../db";
import { storage } from "../storage";
import { AppointmentError, createAppointmentRepository, type AppointmentActor } from "./repository";

export function setupAppointmentRoutes(app: Express) {
  const repository = createAppointmentRepository(db);
  const writeLimit = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: "draft-8", legacyHeaders: false,
    message: { code: "rate_limited", message: "Too many booking updates. Please try again shortly." } });
  const id = (req: Request) => z.coerce.number().int().positive().parse(req.params.id);
  async function actor(req: Request, write: boolean): Promise<AppointmentActor> {
    const booking = await storage.getBookingById(id(req));
    if (!booking) throw new AppointmentError(404, "booking_not_found", "Reservation not found.");
    try {
      const workspace = assertBooking(req, booking, write);
      return { id: req.user!.claims.sub, role: "provider", companyId: workspace.companyId };
    } catch (error) {
      if (!(error instanceof AccessError) || booking.seekerId !== req.user?.claims.sub) throw error;
      return { id: req.user.claims.sub, role: "customer" };
    }
  }
  function handler(action: (req: Request) => Promise<unknown>): RequestHandler {
    return (req, res) => { void (async () => {
      res.set("Cache-Control", "private, no-store");
      try { res.json(await action(req)); }
      catch (error) {
        const known = error instanceof AppointmentError || error instanceof AccessError;
        res.status(known ? error.status : error instanceof z.ZodError ? 400 : 500).json({
          message: known ? error.message : error instanceof z.ZodError ? error.issues[0].message : "Unable to process this booking request.",
          code: error instanceof AppointmentError ? error.code : error instanceof z.ZodError ? "invalid_input" : known ? "forbidden" : "unavailable" });
      }
    })(); };
  }
  app.get("/api/bookings/:id/conversation", isAuthenticated, handler(async req => {
    const query = z.object({ before: z.string().uuid().optional() }).strict().parse(req.query);
    return repository.conversation(await actor(req, false), id(req), query.before);
  }));
  app.post("/api/bookings/:id/conversation", isAuthenticated, writeLimit, handler(async req => repository.sendMessage(await actor(req, true), id(req), messageInputSchema.parse(req.body))));
  app.get("/api/bookings/:id/reschedule-requests", isAuthenticated, handler(async req => repository.requests(await actor(req, false), id(req))));
  app.post("/api/bookings/:id/reschedule-requests", isAuthenticated, writeLimit, handler(async req => repository.request(await actor(req, true), id(req), rescheduleInputSchema.parse(req.body))));
  app.post("/api/bookings/:id/reschedule-requests/:requestId/respond", isAuthenticated, writeLimit, handler(async req => {
    const input = z.object({ decision: z.enum(["accept", "decline"]) }).strict().parse(req.body), requestId = z.string().uuid().parse(req.params.requestId);
    return repository.respond(await actor(req, true), id(req), requestId, input.decision);
  }));
  app.post("/api/bookings/:id/reschedule-requests/:requestId/withdraw", isAuthenticated, writeLimit, handler(async req => {
    z.object({}).strict().parse(req.body);
    return repository.withdraw(await actor(req, true), id(req), z.string().uuid().parse(req.params.requestId));
  }));
  app.post("/api/bookings/:id/event/preview", isAuthenticated, handler(async req => {
    const input = z.object({ action: z.enum(["complete", "cancel", "reschedule", "message"]) }).strict().parse(req.body);
    return repository.previewEvent(await actor(req, true), id(req), input.action);
  }));
  app.get("/api/bookings/:id/event/reschedule-requests", isAuthenticated, handler(async req => repository.eventRequests(await actor(req, false), id(req))));
  app.post("/api/bookings/:id/event/status", isAuthenticated, writeLimit, handler(async req => {
    const input = z.object({ status: z.enum(["completed", "cancelled"]), bookingIds: eventBookingIdsSchema, timeZone: notificationTimezoneSchema }).strict().parse(req.body);
    return repository.updateEvent(await actor(req, true), id(req), input);
  }));
  app.post("/api/bookings/:id/event/messages", isAuthenticated, writeLimit, handler(async req => {
    const input = messageInputSchema.extend({ bookingIds: eventBookingIdsSchema }).parse(req.body);
    return repository.broadcast(await actor(req, true), id(req), input);
  }));
  app.post("/api/bookings/:id/event/reschedule-requests", isAuthenticated, writeLimit, handler(async req => {
    const { bookingIds, ...input } = rescheduleInputSchema.extend({ bookingIds: eventBookingIdsSchema }).parse(req.body);
    return repository.request(await actor(req, true), id(req), input, bookingIds);
  }));
}
