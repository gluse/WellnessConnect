import type { Express, Request, Response, RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { and, desc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { notificationEvents } from "../../shared/schema";
import { NotificationError, notificationTimezoneSchema, type NotificationCapabilities } from "../../shared/notifications";
import { db } from "../db";
import { isAuthenticated } from "../auth";
import { assertBooking, AccessError, scope } from "../companyAccess";
import { storage } from "../storage";
import { manualPreview, renderMessage } from "./policy";
import { bookingNotificationState, preferencesFor, workspacePro } from "./repository";
import { getCommunicationSettings, updateCommunicationSettings, startPhoneVerification, checkPhoneVerification } from "./preferences";
import { notificationConfig, transportReady } from "./transports";

function handle(action: (req: Request, res: Response) => Promise<unknown>): RequestHandler {
  return (req, res) => { void (async () => {
    res.set("Cache-Control", "private, no-store");
    try { await action(req, res); }
    catch (error) {
      const known = error instanceof NotificationError || error instanceof AccessError;
      res.status(known ? error.status : error instanceof z.ZodError ? 400 : 500).json({ message: known ? error.message : error instanceof z.ZodError ? error.issues[0].message : "Unable to process notifications.", ...(error instanceof NotificationError ? { code: error.code } : {}) });
    }
  })(); };
}
export function setupNotificationRoutes(app: Express) {
  const requireEnabled: RequestHandler = (_req, res, next) => {
    if (!notificationConfig().enabled) return void res.status(503).json({ code: "feature_disabled", message: "Notifications are not available yet." });
    next();
  };
  const verificationLimit = rateLimit({ windowMs: 3600_000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false });
  app.get("/api/account/communication", isAuthenticated, requireEnabled, handle(async (req, res) => res.json(await getCommunicationSettings(req.user!.claims.sub))));
  app.patch("/api/account/communication", isAuthenticated, requireEnabled, handle(async (req, res) => res.json(await updateCommunicationSettings(req.user!.claims.sub, req.body))));
  app.post("/api/account/communication/verify/start", isAuthenticated, requireEnabled, verificationLimit, handle(async (req, res) => {
    z.object({}).strict().parse(req.body); res.json(await startPhoneVerification(req.user!.claims.sub));
  }));
  app.post("/api/account/communication/verify/check", isAuthenticated, requireEnabled, verificationLimit, handle(async (req, res) => {
    const { code } = z.object({ code: z.string().regex(/^\d{6}$/) }).strict().parse(req.body); res.json(await checkPhoneVerification(req.user!.claims.sub, code));
  }));
  app.get("/api/notifications/capabilities", isAuthenticated, handle(async (req, res) => {
    const current = scope(req), config = notificationConfig();
    const capability: NotificationCapabilities = { hasPro: await workspacePro(db, current), automationEnabled: config.automationEnabled,
      channels: { email: transportReady(config, "email"), sms: transportReady(config, "sms"), whatsapp: transportReady(config, "whatsapp") } };
    res.json(capability);
  }));
  app.get("/api/bookings/:id/notifications", isAuthenticated, requireEnabled, handle(async (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id), booking = await storage.getBookingById(id);
    assertBooking(req, booking, true); res.json(await bookingNotificationState(db, booking!));
  }));
  app.post("/api/bookings/:id/notification-preview", isAuthenticated, requireEnabled, handle(async (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const input = z.object({ kind: z.enum(["status", "reminder"]), eventId: z.string().uuid().optional(), timeZone: notificationTimezoneSchema }).strict().parse(req.body);
    const booking = await storage.getBookingById(id); assertBooking(req, booking, true);
    // PRO status updates stay automatic; reminders may be composed manually only
    // when the service explicitly disables automatic reminders.
    if (await workspacePro(db, booking!) && (input.kind !== "reminder" || booking!.service.reminderEnabled !== false)) {
      throw new NotificationError(409, "automatic_mode", "This workspace uses automatic notifications.");
    }
    let kind: "accepted" | "rejected" | "rescheduled" | "reminder" = "reminder", oldDate: Date | null = null, date = booking!.scheduledDate, timeZone = input.timeZone;
    if (input.kind === "reminder") {
      if (booking!.status !== "confirmed" || booking!.scheduledDate <= new Date()) throw new NotificationError(409, "reminder_ineligible", "Only future confirmed appointments can receive a reminder.");
    } else {
      const [event] = await db.select().from(notificationEvents).where(and(eq(notificationEvents.bookingId, id), ne(notificationEvents.kind, "reminder"),
        eq(notificationEvents.bookingRevision, booking!.notificationRevision), input.eventId ? eq(notificationEvents.id, input.eventId) : undefined))
        .orderBy(desc(notificationEvents.createdAt)).limit(1);
      if (!event || event.createdAt.getTime() < Date.now() - 30 * 86400_000) throw new NotificationError(409, "superseded", "This booking update is no longer available.");
      kind = event.kind; oldDate = event.previousScheduledDate; date = event.scheduledDate; timeZone = event.timezone;
    }
    const preferences = await preferencesFor(db, booking!.seekerId);
    const rendered = renderMessage({ kind, service: booking!.service.name, date, oldDate, language: preferences.language, timeZone });
    res.json(manualPreview({ ...rendered, preferences, email: booking!.seeker.email, customerName: [booking!.seeker.firstName, booking!.seeker.lastName].filter(Boolean).join(" ") || "Customer" }));
  }));
}
