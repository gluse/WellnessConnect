import type { Request, RequestHandler } from "express";
import { passwordChangeSchema } from "@shared/password";
import { createAuthClient } from "./supabase";

const sessionOperation = (req: Request, operation: "save" | "regenerate" | "destroy") =>
  new Promise<void>((resolve, reject) => req.session[operation](error => error ? reject(error) : resolve()));

export const updatePassword: RequestHandler = async (req, res) => {
  const parsed = passwordChangeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message });
  if (!req.user?.email || !req.session.auth) return res.status(401).json({ message: "Sign in again to update your password." });

  const client = createAuthClient();
  let verifiedSession = false;
  let passwordChanged = false;
  let keepSession = false;
  try {
    // Use the authenticated account's email, never a target supplied by the browser.
    const verified = await client.auth.signInWithPassword({ email: req.user.email, password: parsed.data.currentPassword });
    verifiedSession = Boolean(verified.data.session);
    if (verified.error) {
      const status = verified.error.status;
      return res.status(status === 429 ? 429 : status && status >= 500 ? 503 : 400).json({
        message: status === 429 ? "Too many attempts. Please try again later." : status && status >= 500 ? "Unable to verify your password. Please try again." : "Current password is incorrect.",
      });
    }
    if (!verified.data.session || verified.data.user?.id !== req.user.claims.sub) return res.status(403).json({ message: "Unable to verify this account." });

    const updated = await client.auth.updateUser({ password: parsed.data.newPassword, current_password: parsed.data.currentPassword });
    if (updated.error) {
      const status = updated.error.status;
      const message = updated.error.code === "same_password" ? "Choose a password different from your current password."
        : updated.error.code === "weak_password" ? "Choose a stronger password that meets your account's password requirements."
        : status === 429 ? "Too many attempts. Please try again later."
        : status && status >= 500 ? "Unable to update your password. Please try again."
        : "Unable to update your password. Check the password requirements and try again.";
      return res.status(status === 429 ? 429 : status && status >= 500 ? 503 : 400).json({ message });
    }
    passwordChanged = true;
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
  } catch {
    if (passwordChanged) {
      await sessionOperation(req, "destroy").catch(() => {});
      res.clearCookie("wellness.sid", { path: "/" });
      return res.json({ success: true, requiresSignIn: true });
    }
    return res.status(503).json({ message: "Unable to update your password. Please try again." });
  } finally {
    if (verifiedSession && !keepSession) await client.auth.signOut({ scope: "local" }).catch(() => {});
  }
};
