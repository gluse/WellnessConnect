import express, { type Express } from "express";
import { randomUUID } from "node:crypto";
import { and, eq, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { notificationCallbacks, notificationJobs, notificationDeliveryAttempts, userCommunicationPreferences, notificationEvents, bookings } from "../../shared/schema";
import { deliveryTransition } from "./policy";
import { notificationConfig, verifyVonage, verifyResend } from "./transports";

const providerId = z.string().min(1).max(255);
const vonagePayload = z.object({ message_uuid: providerId, channel: z.enum(["sms", "whatsapp"]), status: z.string().max(50).optional(),
  client_ref: z.string().uuid().optional(), from: z.string().max(30).optional(), to: z.string().max(30).optional(), text: z.string().max(2000).optional(), message_type: z.string().max(30).optional() });
const resendPayload = z.object({ type: z.string().max(80), data: z.object({ email_id: providerId }) });
export function mountNotificationWebhooks(app: Express) {
  app.post("/api/notifications/webhooks/:provider", express.raw({ type: "application/json", limit: "32kb" }), async (req, res) => {
    const config = notificationConfig();
    res.set("Cache-Control", "no-store");
    if (!config.enabled || !Buffer.isBuffer(req.body)) return void res.sendStatus(503);
    try {
      const provider = z.enum(["vonage", "resend"]).parse(req.params.provider);
      let eventId: string;
      if (provider === "vonage") {
        const verified = verifyVonage(req.body, req.get("authorization") ?? "", config);
        if (!verified) return void res.sendStatus(401);
        eventId = verified;
      } else {
        eventId = req.get("svix-id") ?? "";
        if (!verifyResend(req.body, { id: eventId, timestamp: req.get("svix-timestamp") ?? "", signature: req.get("svix-signature") ?? "" }, config.resendSecret)) return void res.sendStatus(401);
      }
      const input: unknown = JSON.parse(req.body.toString("utf8"));
      const vonage = provider === "vonage" ? vonagePayload.parse(input) : null;
      const resend = provider === "resend" ? resendPayload.parse(input) : null;
      await db.transaction(async tx => {
        const [record] = await tx.insert(notificationCallbacks).values({ id: randomUUID(), provider, providerEventId: eventId }).onConflictDoNothing().returning();
        if (!record) return;
        if (vonage && !vonage.status) {
          const sender = vonage.channel === "sms" ? config.smsFrom : config.whatsappFrom;
          if (vonage.to?.replace(/^\+/, "") !== sender.replace(/^\+/, "") || !vonage.from || !/^(STOP|UNSUBSCRIBE|CANCEL|END|QUIT)$/i.test(vonage.text?.trim() ?? "")) return;
          const phone = `+${vonage.from.replace(/^\+/, "")}`;
          await tx.update(userCommunicationPreferences).set(vonage.channel === "sms"
            ? { smsOptIn: false, preferredMethod: "email", updatedAt: new Date() }
            : { whatsappOptIn: false, preferredMethod: "email", updatedAt: new Date() }).where(eq(userCommunicationPreferences.phone, phone));
          return;
        }
        const messageId = vonage?.message_uuid ?? resend!.data.email_id;
        const [attempt] = await tx.select().from(notificationDeliveryAttempts).where(and(eq(notificationDeliveryAttempts.provider, provider),
          or(eq(notificationDeliveryAttempts.providerMessageId, messageId), vonage?.client_ref ? eq(notificationDeliveryAttempts.jobId, vonage.client_ref) : undefined)));
        // Callback before send response: retry later rather than acknowledge and
        // permanently lose a delivery result (transaction rolls back dedupe).
        if (!attempt) throw new Error("correlation_pending");
        if (attempt.providerMessageId && attempt.providerMessageId !== messageId) throw new Error("correlation_mismatch");
        const [job] = await tx.select().from(notificationJobs).where(eq(notificationJobs.id, attempt.jobId)).for("update");
        if (!job) return;
        const [lockedAttempt] = await tx.select().from(notificationDeliveryAttempts).where(eq(notificationDeliveryAttempts.id, attempt.id)).for("update");
        if (!lockedAttempt || lockedAttempt.providerMessageId && lockedAttempt.providerMessageId !== messageId) throw new Error("correlation_mismatch");
        const status = vonage?.status ?? resend!.type;
        const next = ["delivered", "read", "email.delivered"].includes(status) ? "delivered" : ["rejected", "undeliverable", "failed", "email.failed", "email.bounced", "email.complained", "email.suppressed"].includes(status) ? "failed" : ["submitted", "accepted", "email.sent"].includes(status) ? "accepted" : null;
        if (!next) return;
        const state = deliveryTransition(job.state, next);
        const reasonCode = state === "delivered" || state === "accepted" ? null : state === "failed" ? "delivery_failed" : job.reasonCode;
        await tx.update(notificationJobs).set({ state: state as typeof job.state, providerMessageId: messageId, leaseToken: null, leaseUntil: null, updatedAt: new Date(), reasonCode }).where(eq(notificationJobs.id, job.id));
        if (state === "accepted" || state === "delivered" || state === "failed") await tx.update(notificationDeliveryAttempts).set({ state, providerMessageId: messageId, errorCode: reasonCode, updatedAt: new Date() }).where(eq(notificationDeliveryAttempts.id, attempt.id));
        if (resend && ["email.bounced", "email.complained", "email.suppressed"].includes(resend.type)) {
          const [recipient] = await tx.select({ seekerId: bookings.seekerId }).from(notificationEvents).innerJoin(bookings, eq(bookings.id, notificationEvents.bookingId)).where(eq(notificationEvents.id, job.eventId));
          if (recipient) await tx.insert(userCommunicationPreferences).values({ userId: recipient.seekerId, emailSuppressed: true }).onConflictDoUpdate({ target: userCommunicationPreferences.userId, set: { emailSuppressed: true, updatedAt: new Date() } });
        }
      });
      res.sendStatus(204);
    } catch (error) { res.sendStatus(error instanceof z.ZodError || error instanceof SyntaxError ? 400 : 503); }
  });
}
