import type { Request, RequestHandler } from "express";
import { passwordChangeSchema } from "@shared/password";
import { createAuthClient } from "./supabase";
import { recordAudit, recordDenial, requireAuditAvailability } from "./audit/http";
import { AuditCaptureUnavailable } from "./audit/capture";

const sessionOperation = (req: Request, operation: "save" | "regenerate" | "destroy") =>
  new Promise<void>((resolve, reject) => req.session[operation](error => error ? reject(error) : resolve()));

export const updatePassword: RequestHandler = async (req, res) => {
  const parsed = passwordChangeSchema.safeParse(req.body);
  if (!parsed.success) {
    try { await recordAudit(req, { eventName: "auth.password_changed.v1", outcome: "rejected", reasonCode: "INVALID_INPUT", changes: [] }); }
    catch { return res.status(503).json({ message: "Password updates are temporarily unavailable." }); }
    return res.status(400).json({ message: parsed.error.issues[0].message });
  }
  if (!req.user?.email || !req.session.auth) {
    await recordDenial(req, "UNAUTHENTICATED");
    return res.status(401).json({ message: "Sign in again to update your password." });
  }
  try { await requireAuditAvailability(); }
  catch { return res.status(503).json({ message: "Password updates are temporarily unavailable." }); }

  const client = createAuthClient();
  let verifiedSession = false;
  let passwordChanged = false;
  let keepSession = false;
  let updateAttempted = false;
  try {
    // Use the authenticated account's email, never a target supplied by the browser.
    const verified = await client.auth.signInWithPassword({ email: req.user.email, password: parsed.data.currentPassword });
    verifiedSession = Boolean(verified.data.session);
    if (verified.error) {
      const status = verified.error.status;
      try { await recordAudit(req, { eventName: "auth.password_changed.v1", changes: [],
        outcome: status && status >= 500 ? "failed" : "denied",
        reasonCode: status && status >= 500 ? "PROVIDER_UNAVAILABLE" : status === 429 ? "RATE_LIMITED" : "INVALID_CREDENTIALS" }); }
      catch { /* Access remains denied; independent capture gap already signaled. */ }
      return res.status(status === 429 ? 429 : status && status >= 500 ? 503 : 400).json({
        message: status === 429 ? "Too many attempts. Please try again later." : status && status >= 500 ? "Unable to verify your password. Please try again." : "Current password is incorrect.",
      });
    }
    if (!verified.data.session || verified.data.user?.id !== req.user.claims.sub) {
      await recordDenial(req, "FORBIDDEN");
      return res.status(403).json({ message: "Unable to verify this account." });
    }

    updateAttempted = true;
    const updated = await client.auth.updateUser({ password: parsed.data.newPassword, current_password: parsed.data.currentPassword });
    if (updated.error) {
      const status = updated.error.status;
      await recordAudit(req, { eventName: "auth.password_changed.v1", changes: [],
        outcome: status && status >= 500 ? "failed" : status === 429 ? "denied" : "rejected",
        reasonCode: status && status >= 500 ? "PROVIDER_UNAVAILABLE" : status === 429 ? "RATE_LIMITED" : "INVALID_INPUT" });
      const message = updated.error.code === "same_password" ? "Choose a password different from your current password."
        : updated.error.code === "weak_password" ? "Choose a stronger password that meets your account's password requirements."
        : status === 429 ? "Too many attempts. Please try again later."
        : status && status >= 500 ? "Unable to update your password. Please try again."
        : "Unable to update your password. Check the password requirements and try again.";
      return res.status(status === 429 ? 429 : status && status >= 500 ? 503 : 400).json({ message });
    }
    passwordChanged = true;
    await recordAudit(req, { eventName: "auth.password_changed.v1", outcome: "succeeded", changes: [] });
    const { data, error } = await client.auth.getSession();
    if (error || !data.session || data.session.user.id !== req.user.claims.sub) throw new Error("Unable to restore session");

    // Password updates can invalidate the old login; retain the fresh verified session.
    const activeCompanyId = req.session.activeCompanyId;
    await sessionOperation(req, "regenerate");
    req.session.auth = {
      userId: data.session.user.id, accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token, expiresAt: data.session.expires_at ?? 0,
    };
    req.session.activeCompanyId = activeCompanyId;
    await sessionOperation(req, "save");
    keepSession = true;
    return res.json({ success: true, requiresSignIn: false });
  } catch (error) {
    if (passwordChanged) {
      await sessionOperation(req, "destroy").catch(() => {});
      res.clearCookie("wellness.sid", { path: "/" });
      if (error instanceof AuditCaptureUnavailable) return res.status(503).json({ message: "Your password was saved. Sign in again to continue." });
      return res.json({ success: true, requiresSignIn: true });
    }
    if (updateAttempted && !(error instanceof AuditCaptureUnavailable)) {
      try { await recordAudit(req, { eventName: "auth.password_changed.v1", outcome: "unknown", reasonCode: "PROVIDER_TIMEOUT", changes: [] }); } catch { /* gap signaled */ }
    }
    return res.status(503).json({ message: "Unable to update your password. Please try again." });
  } finally {
    if (verifiedSession && !keepSession) await client.auth.signOut({ scope: "local" }).catch(() => {});
  }
};
