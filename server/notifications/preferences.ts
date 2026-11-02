import { randomUUID } from "node:crypto";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { userCommunicationPreferences, phoneVerificationChallenges } from "../../shared/schema";
import { communicationPatchSchema, NotificationError, type CommunicationSettings } from "../../shared/notifications";
import { db } from "../db";
import { preferencesFor } from "./repository";
import { channelReason } from "./policy";
import { createTransports, notificationConfig, TransportError, verificationReady } from "./transports";

export async function getCommunicationSettings(userId: string): Promise<CommunicationSettings> {
  const prefs = await preferencesFor(db, userId);
  return { phone: prefs.phone, phoneVerified: Boolean(prefs.phoneVerifiedAt), preferredMethod: prefs.preferredMethod,
    language: prefs.language as CommunicationSettings["language"], smsOptIn: prefs.smsOptIn, whatsappOptIn: prefs.whatsappOptIn, verificationAvailable: verificationReady(notificationConfig()) };
}
export async function updateCommunicationSettings(userId: string, input: unknown) {
  const patch = communicationPatchSchema.parse(input);
  await db.transaction(async tx => {
    await tx.insert(userCommunicationPreferences).values({ userId }).onConflictDoNothing();
    const [current] = await tx.select().from(userCommunicationPreferences).where(eq(userCommunicationPreferences.userId, userId)).for("update");
    const phoneChanged = patch.phone !== undefined && patch.phone !== current.phone;
    const next = { ...current, ...patch, ...(phoneChanged ? { phoneVerifiedAt: null, smsOptIn: false, whatsappOptIn: false, preferredMethod: "email" as const } : {}), updatedAt: new Date() };
    if ((!next.phoneVerifiedAt || !next.phone) && (next.smsOptIn || next.whatsappOptIn)) throw new NotificationError(400, "unverified_phone", "Verify your phone number before enabling phone communications.");
    // Withdrawing channel permission resets a previously selected method.
    if (patch.preferredMethod === undefined && (next.preferredMethod === "sms" && !next.smsOptIn || next.preferredMethod === "whatsapp" && !next.whatsappOptIn)) next.preferredMethod = "email";
    if (next.preferredMethod && next.preferredMethod !== "email" && channelReason(next.preferredMethod, next, null)) throw new NotificationError(400, "missing_permission", "Verify your phone and allow the selected communication method.");
    await tx.update(userCommunicationPreferences).set(next).where(eq(userCommunicationPreferences.userId, userId));
    if (phoneChanged) await tx.update(phoneVerificationChallenges).set({ status: "expired", updatedAt: new Date() })
      .where(and(eq(phoneVerificationChallenges.userId, userId), eq(phoneVerificationChallenges.status, "pending")));
  });
  return getCommunicationSettings(userId);
}
export async function startPhoneVerification(userId: string) {
  const config = notificationConfig();
  if (!verificationReady(config)) throw new NotificationError(503, "not_configured", "Phone verification is not available yet.");
  const challenge = await db.transaction(async tx => {
    await tx.insert(userCommunicationPreferences).values({ userId }).onConflictDoNothing();
    const [prefs] = await tx.select().from(userCommunicationPreferences).where(eq(userCommunicationPreferences.userId, userId)).for("update");
    if (!prefs.phone) throw new NotificationError(400, "missing_phone", "Save an international phone number first.");
    if (prefs.phoneVerifiedAt) throw new NotificationError(409, "already_verified", "This phone number is already verified.");
    // A number-wide lock also bounds verification spend across several accounts.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${prefs.phone}, 32032))`);
    const now = new Date();
    const recent = await tx.select().from(phoneVerificationChallenges).where(and(eq(phoneVerificationChallenges.userId, userId), gt(phoneVerificationChallenges.createdAt, new Date(now.getTime() - 86400_000))))
      .orderBy(desc(phoneVerificationChallenges.createdAt)).limit(11);
    const phoneRecent = await tx.select({ id: phoneVerificationChallenges.id }).from(phoneVerificationChallenges)
      .where(and(eq(phoneVerificationChallenges.phone, prefs.phone), gt(phoneVerificationChallenges.createdAt, new Date(now.getTime() - 3600_000)))).limit(6);
    if (recent.length >= 10 || phoneRecent.length >= 5 || recent.some(value => value.nextSendAt > now)) throw new NotificationError(429, "rate_limited", "Wait before requesting another verification code.");
    await tx.update(phoneVerificationChallenges).set({ status: "expired", updatedAt: now }).where(and(eq(phoneVerificationChallenges.userId, userId), eq(phoneVerificationChallenges.status, "pending")));
    const [created] = await tx.insert(phoneVerificationChallenges).values({ id: randomUUID(), userId, phone: prefs.phone,
      expiresAt: new Date(now.getTime() + 300_000), nextSendAt: new Date(now.getTime() + 60_000), createdAt: now }).returning();
    return created;
  });
  try {
    const requestId = await createTransports(config).startVerification(challenge.phone);
    await db.update(phoneVerificationChallenges).set({ providerRequestId: requestId, updatedAt: new Date() }).where(and(eq(phoneVerificationChallenges.id, challenge.id), eq(phoneVerificationChallenges.status, "pending")));
    return { status: "pending" as const, expiresAt: challenge.expiresAt.toISOString(), nextSendAt: challenge.nextSendAt.toISOString() };
  } catch (error) {
    await db.update(phoneVerificationChallenges).set({ status: error instanceof TransportError && error.outcome === "failed" ? "failed" : "unknown", updatedAt: new Date() }).where(eq(phoneVerificationChallenges.id, challenge.id));
    throw new NotificationError(503, "verification_failed", "Verification could not be started. Wait before trying again.");
  }
}
export async function checkPhoneVerification(userId: string, code: string) {
  const config = notificationConfig();
  if (!verificationReady(config)) throw new NotificationError(503, "not_configured", "Phone verification is not available yet.");
  const challenge = await db.transaction(async tx => {
    // Persist each attempt before contacting the provider. The preference row
    // serializes number changes, starts and code reservations for this account.
    await tx.select().from(userCommunicationPreferences).where(eq(userCommunicationPreferences.userId, userId)).for("update");
    const [current] = await tx.select().from(phoneVerificationChallenges).where(and(eq(phoneVerificationChallenges.userId, userId), eq(phoneVerificationChallenges.status, "pending")))
      .orderBy(desc(phoneVerificationChallenges.createdAt)).limit(1).for("update");
    if (!current?.providerRequestId || current.expiresAt <= new Date() || current.attemptCount >= 3) throw new NotificationError(400, "verification_expired", "Request a new verification code.");
    await tx.update(phoneVerificationChallenges).set({ attemptCount: current.attemptCount + 1, updatedAt: new Date() }).where(eq(phoneVerificationChallenges.id, current.id));
    return current;
  });
  let valid = false;
  try { valid = await createTransports(config).checkVerification(challenge.providerRequestId!, code); }
  catch (error) {
    if (error instanceof TransportError && error.outcome === "unknown") {
      await db.update(phoneVerificationChallenges).set({ status: "unknown", updatedAt: new Date() }).where(eq(phoneVerificationChallenges.id, challenge.id));
      throw new NotificationError(503, "verification_unknown", "Verification result is unknown. Request a new code later.");
    }
  }
  if (!valid) throw new NotificationError(400, "incorrect_code", "The verification code is incorrect or expired.");
  await db.transaction(async tx => {
    const [prefs] = await tx.select().from(userCommunicationPreferences).where(eq(userCommunicationPreferences.userId, userId)).for("update");
    const [current] = await tx.select().from(phoneVerificationChallenges).where(eq(phoneVerificationChallenges.id, challenge.id)).for("update");
    if (prefs?.phone !== challenge.phone || current?.status !== "pending" || current.expiresAt <= new Date()) throw new NotificationError(409, "phone_changed", "The phone number or verification request has changed.");
    await tx.update(userCommunicationPreferences).set({ phoneVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(userCommunicationPreferences.userId, userId));
    await tx.update(phoneVerificationChallenges).set({ status: "verified", updatedAt: new Date() }).where(eq(phoneVerificationChallenges.id, challenge.id));
  });
  return { status: "verified" as const };
}
