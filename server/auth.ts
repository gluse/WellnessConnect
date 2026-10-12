import session from "express-session";
import connectPg from "connect-pg-simple";
import { rateLimit } from "express-rate-limit";
import type { Express, Request, Response, RequestHandler } from "express";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";
import { z } from "zod";
import { pool } from "./db";
import { storage } from "./storage";
import { appUrl, createAuthClient, supabaseAdmin } from "./supabase";

interface AuthSession {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}
declare module "express-session" {
  interface SessionData {
    auth?: AuthSession;
    oauthStorage?: Record<string, string>;
  }
}
declare global {
  namespace Express {
    interface User { claims: { sub: string }; }
    interface Request { user?: User; }
  }
}

const credentials = z.object({ email: z.string().email().max(254), password: z.string().min(8).max(128) });
const save = (req: Request) => new Promise<void>((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
const regenerate = (req: Request) => new Promise<void>((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
const destroy = (req: Request) => new Promise<void>((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));

function pkceClient(req: Request) {
  req.session.oauthStorage ||= {};
  return createAuthClient({
    getItem: key => req.session.oauthStorage?.[key] ?? null,
    setItem: (key, value) => { req.session.oauthStorage ||= {}; req.session.oauthStorage[key] = value; },
    removeItem: key => { delete req.session.oauthStorage?.[key]; },
  });
}

async function establishSession(req: Request, tokens: Session) {
  const { data, error } = await createAuthClient().auth.getUser(tokens.access_token);
  if (error || !data.user) throw new Error("Unable to verify login");
  const user: SupabaseUser = data.user;
  await storage.upsertUser({
    id: user.id,
    email: user.email,
    firstName: user.user_metadata.first_name || user.user_metadata.given_name || null,
    lastName: user.user_metadata.last_name || user.user_metadata.family_name || null,
    profileImageUrl: user.user_metadata.avatar_url || null,
  });
  await regenerate(req);
  req.session.auth = {
    userId: user.id, accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token, expiresAt: tokens.expires_at ?? 0,
  };
  await save(req);
}

export const requireSameOrigin: RequestHandler = (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (req.get("Sec-Fetch-Site") === "cross-site" || (req.get("Origin") && req.get("Origin") !== appUrl)) {
    return res.status(403).json({ message: "Request origin is not allowed" });
  }
  next();
};

export async function setupAuth(app: Express) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters.");
  if (process.env.NODE_ENV === "production" && !appUrl.startsWith("https://")) throw new Error("APP_URL must use HTTPS in production.");
  app.set("trust proxy", 1);
  app.use("/api", requireSameOrigin);
  const PgStore = connectPg(session);
  app.use(session({
    name: "wellness.sid", secret,
    store: new PgStore({ pool, tableName: "sessions", createTableIfMissing: false, ttl: 7 * 24 * 60 * 60 }),
    resave: false, saveUninitialized: false,
    cookie: { httpOnly: true, secure: appUrl.startsWith("https://"), sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 },
  }));
  const authLimit = rateLimit({ windowMs: 10 * 60 * 1000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false, message: { message: "Too many login attempts. Please try again later." } });
  app.get("/api/login", (_req, res) => res.redirect("/login"));
  app.get("/api/auth/providers", (_req, res) => res.json({ google: process.env.SUPABASE_GOOGLE_ENABLED === "true" }));

  app.post("/api/auth/login", authLimit, async (req, res, next) => {
    const parsed = credentials.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Enter a valid email and a password with at least 8 characters." });
    try {
      const { data, error } = await createAuthClient().auth.signInWithPassword(parsed.data);
      if (error || !data.session) return res.status(401).json({ message: "Invalid email or password, or email not confirmed." });
      await establishSession(req, data.session);
      res.json({ success: true });
    } catch (error) { next(error); }
  });

  app.post("/api/auth/signup", authLimit, async (req, res, next) => {
    const parsed = credentials.extend({ firstName: z.string().trim().min(1).max(100), lastName: z.string().trim().max(100).default("") }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Enter your name, a valid email, and a password with at least 8 characters." });
    try {
      const { email, password, firstName, lastName } = parsed.data;
      const { data, error } = await pkceClient(req).auth.signUp({
        email, password,
        options: { emailRedirectTo: `${appUrl}/api/callback`, data: { first_name: firstName, last_name: lastName } },
      });
      if (error) return res.status(400).json({ message: "Unable to create your account. Check the details or try again later." });
      if (data.session) {
        await establishSession(req, data.session);
        return res.json({ signedIn: true });
      }
      await save(req);
      res.json({ signedIn: false, message: "Check your email to confirm your account. Open the link in this browser." });
    } catch (error) { next(error); }
  });

  app.get("/api/auth/google", authLimit, async (req, res, next) => {
    if (process.env.SUPABASE_GOOGLE_ENABLED !== "true") return res.redirect("/login?error=google_disabled");
    try {
      const { data, error } = await pkceClient(req).auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${appUrl}/api/callback`, skipBrowserRedirect: true } });
      if (error || !data.url) return res.redirect("/login?error=login_failed");
      await save(req);
      res.redirect(data.url);
    } catch (error) { next(error); }
  });
  app.get("/api/callback", authLimit, async (req, res) => {
    if (typeof req.query.code !== "string" || !req.session.oauthStorage) return res.redirect("/login?error=login_failed");
    try {
      const { data, error } = await pkceClient(req).auth.exchangeCodeForSession(req.query.code);
      if (error || !data.session) return res.redirect("/login?error=login_failed");
      await establishSession(req, data.session);
      res.redirect("/");
    } catch { res.redirect("/login?error=login_failed"); }
  });
  app.post("/api/logout", async (req, res, next) => {
    try {
      if (req.session.auth) await supabaseAdmin.auth.admin.signOut(req.session.auth.accessToken, "local");
      await destroy(req);
      res.clearCookie("wellness.sid", { httpOnly: true, secure: appUrl.startsWith("https://"), sameSite: "lax", path: "/" });
      res.json({ success: true });
    } catch (error) { next(error); }
  });
}

const refreshing = new Map<string, Promise<AuthSession>>();
export const isAuthenticated: RequestHandler = async (req, res, next) => {
  let auth = req.session.auth;
  if (!auth) return res.status(401).json({ message: "Unauthorized" });
  try {
    if (auth.expiresAt <= Date.now() / 1000 + 60) {
      let pending = refreshing.get(req.sessionID);
      if (!pending) {
        const refreshToken = auth.refreshToken;
        const userId = auth.userId;
        pending = (async () => {
          const { data, error } = await createAuthClient().auth.refreshSession({ refresh_token: refreshToken });
          if (error || !data.session || data.session.user.id !== userId) throw new Error("Session expired");
          return { userId, accessToken: data.session.access_token, refreshToken: data.session.refresh_token, expiresAt: data.session.expires_at ?? 0 };
        })();
        refreshing.set(req.sessionID, pending);
      }
      try { auth = await pending; } finally { refreshing.delete(req.sessionID); }
      req.session.auth = auth;
      await save(req);
    }
    const { data, error } = await createAuthClient().auth.getUser(auth.accessToken);
    if (error || !data.user || data.user.id !== auth.userId) {
      if (error && error.status && error.status >= 500) return res.status(503).json({ message: "Authentication is temporarily unavailable" });
      await destroy(req);
      return res.status(401).json({ message: "Unauthorized" });
    }
    req.user = { claims: { sub: data.user.id } };
    next();
  } catch {
    await destroy(req).catch(() => {});
    res.status(401).json({ message: "Unauthorized" });
  }
};
