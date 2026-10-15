import type { RequestHandler } from "express";

// Only server configuration grants application support access. Company roles and
// editable user metadata never grant access to the registered-user directory.
export function isAppAdmin(userId: string | undefined): boolean {
  return Boolean(userId && (process.env.APP_ADMIN_USER_IDS ?? "").split(",").some(id => id.trim() === userId));
}

export const requireAppAdmin: RequestHandler = (req, res, next) => {
  if (!req.user?.claims.sub) return res.status(401).json({ message: "Unauthorized" });
  if (!isAppAdmin(req.user.claims.sub)) return res.status(403).json({ message: "Application support access is required." });
  next();
};
