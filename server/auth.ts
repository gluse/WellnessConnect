import session from "express-session";
import { isAllowedAuthReturnTo } from "@shared/navigation";
import { socialProviders } from "@shared/social-auth";
import { authProfileNames, enabledAuthProviders, loginFailureUrl, oauthSettings } from "./social-auth";
import { updatePassword } from "./password";
import connectPg from "connect-pg-simple";
import { rateLimit } from "express-rate-limit";
import type { Express, Request, Response, RequestHandler } from "express";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";
import { z } from "zod";
import { pool } from "./db";
import { storage } from "./storage";
import { appUrl, createAuthClient, supabaseAdmin } from "./supabase";
import { ensureCompany } from "./companyAccess";
import { db } from "./db";
import { companyInvitations } from "@shared/schema";
import { and, eq, gt, isNull } from "drizzle-orm";

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
    canSetInvitationPassword?: boolean;
    authReturnTo?: string;
    invitationRecoveryEmail?: string;
    socialCompanySignup?: { companyName: string; expiresAt: number };
  }
}
declare global {
  namespace Express {
    interface User { claims: { sub: string }; email?: string; emailVerified?: boolean; }
    interface Request { user?: User; }
  }
}

const credentials = z.object({ email: z.string().email().max(254), password: z.string().min(8).max(128) });
const save = (req: Request) => new Promise<void>((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
const regenerate = (req: Request) => new Promise<void>((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
const destroy = (req: Request) => new Promise<void>((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
const socialCompanySchema = z.object({ companyName: z.string().trim().min(1).max(150), returnTo: z.string().max(512).default("/") }).strict();
const socialCompanyIntentSchema = z.object({ companyName: z.string().trim().min(1).max(150), expiresAt: z.number().finite() }).strict();

function pkceClient(req: Request) {
  req.session.oauthStorage ||= {};
  return createAuthClient({
    getItem: key => req.session.oauthStorage?.[key] ?? null,
    setItem: (key, value) => { req.session.oauthStorage ||= {}; req.session.oauthStorage[key] = value; },
    removeItem: key => { delete req.session.oauthStorage?.[key]; },
  });
}

async function establishSession(req: Request, tokens: Session, socialCompanyName?: string, provisionCompany = ensureCompany) {
  const { data, error } = await createAuthClient().auth.getUser(tokens.access_token);
  if (error || !data.user) throw new Error("Unable to verify login");
  const user: SupabaseUser = data.user;
  const existing = await storage.getUser(user.id);
  const requestedCompany = z.string().trim().min(1).max(150).safeParse(user.user_metadata.requested_company_name);
  const newCompanyName = socialCompanyName ?? (requestedCompany.success ? requestedCompany.data : undefined);
  const profile = await storage.upsertUser({
    id: user.id,
    email: user.email,
    ...authProfileNames(user, existing),
    profileImageUrl: existing?.profileImageUrl || (typeof user.user_metadata.avatar_url === "string" ? user.user_metadata.avatar_url : null),
    ...(!existing && newCompanyName ? { providerType: "company", companyName: newCompanyName, currentRole: "provider" } as const : {}),
  });
  // Signup metadata can request a NEW workspace; it never supplies membership roles.
  const companyName = profile.providerType === "company" && profile.companyName ? profile.companyName : socialCompanyName;
  if (companyName) await provisionCompany(user.id, companyName);
  await regenerate(req);
  req.session.auth = {
    userId: user.id, accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token, expiresAt: tokens.expires_at ?? 0,
  };
  await save(req);
  return user;
}

export const requireSameOrigin: RequestHandler = (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (req.get("Sec-Fetch-Site") === "cross-site" || (req.get("Origin") && req.get("Origin") !== appUrl)) {
    return res.status(403).json({ message: "Request origin is not allowed" });
  }
  next();
};

export async function setupAuth(app: Express, provisionSocialCompany = ensureCompany) {
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
  app.get("/api/auth/providers", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json(enabledAuthProviders());
  });
  app.post("/api/auth/password", isAuthenticated, authLimit, updatePassword);

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
    const parsed = credentials.extend({ firstName: z.string().trim().max(100).default(""), lastName: z.string().trim().max(100).default(""), accountType: z.enum(["personal", "company"]).default("personal"), companyName: z.string().trim().max(150).default("") })
      .refine(data => data.accountType !== "company" || Boolean(data.companyName), { message: "Company name is required" }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message });
    try {
      const { email, password, firstName, lastName, accountType, companyName } = parsed.data;
      delete req.session.socialCompanySignup;
      if (isAllowedAuthReturnTo(req.body.returnTo)) req.session.authReturnTo = req.body.returnTo.slice(0, 512);
      const { data, error } = await pkceClient(req).auth.signUp({
        email, password,
        options: { emailRedirectTo: `${appUrl}/api/callback`, data: { first_name: firstName, last_name: lastName, ...(accountType === "company" ? { requested_company_name: companyName } : {}) } },
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

  // Explicit routes avoid intercepting other /api/auth/* endpoints.
  const startSocialSignIn = async (req: Request, provider: typeof socialProviders[number], returnTo: string, companyName?: string) => {
    req.session.authReturnTo = returnTo;
    req.session.oauthStorage = {};
    delete req.session.invitationRecoveryEmail;
    if (companyName) req.session.socialCompanySignup = { companyName, expiresAt: Date.now() + 60 * 60_000 };
    else delete req.session.socialCompanySignup;
    const { provider: supabaseProvider, scopes } = oauthSettings(provider);
    const { data, error } = await pkceClient(req).auth.signInWithOAuth({ provider: supabaseProvider, options: {
      redirectTo: `${appUrl}/api/callback`, skipBrowserRedirect: true, ...(scopes ? { scopes } : {}),
    } });
    if (error || !data.url) throw new Error("Unable to start social sign-in");
    await save(req);
    return data.url;
  };
  const clearSocialAttempt = (req: Request) => {
    delete req.session.oauthStorage;
    delete req.session.authReturnTo;
    delete req.session.socialCompanySignup;
  };
  for (const provider of socialProviders) {
    app.get(`/api/auth/${provider}`, authLimit, async (req, res) => {
      const returnTo = isAllowedAuthReturnTo(req.query.returnTo) ? req.query.returnTo.slice(0, 512) : "/";
      if (!enabledAuthProviders()[provider]) return res.redirect(loginFailureUrl("social_disabled", returnTo));
      try {
        res.redirect(await startSocialSignIn(req, provider, returnTo));
      } catch {
        clearSocialAttempt(req);
        res.redirect(loginFailureUrl("login_failed", returnTo));
      }
    });
    // A same-origin POST records company creation intent in the server session;
    // the OAuth URL and callback query cannot supply a company or membership ID.
    app.post(`/api/auth/${provider}`, authLimit, async (req, res) => {
      const parsed = socialCompanySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Enter a company name of 1 to 150 characters." });
      if (!enabledAuthProviders()[provider]) return res.status(503).json({ message: "This sign-in option is currently unavailable. Choose another option." });
      const returnTo = isAllowedAuthReturnTo(parsed.data.returnTo) ? parsed.data.returnTo : "/";
      try {
        res.json({ url: await startSocialSignIn(req, provider, returnTo, parsed.data.companyName) });
      } catch {
        clearSocialAttempt(req);
        res.status(503).json({ message: "Unable to start sign-in. Please try again." });
      }
    });
  }
  app.post("/api/auth/invite-recovery", authLimit, async (req, res) => {
    const parsed = z.object({ email: z.string().trim().email().max(254).transform(value => value.toLowerCase()), returnTo: z.string().max(512).regex(/^\/invite(?:\?|$)/).default("/invite") }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Enter your invited email address." });
    try {
      const pending = await db.select({ id: companyInvitations.id }).from(companyInvitations).where(and(eq(companyInvitations.email, parsed.data.email), isNull(companyInvitations.acceptedAt), isNull(companyInvitations.revokedAt), gt(companyInvitations.expiresAt, new Date()))).limit(1);
      if (pending.length) {
        delete req.session.socialCompanySignup;
        // A fresh email proof is required; the application invitation alone is
        // never sufficient to authenticate or set a password.
        const { error } = await pkceClient(req).auth.signInWithOtp({ email: parsed.data.email, options: { shouldCreateUser: false, emailRedirectTo: `${appUrl}/api/callback` } });
        if (error) return res.status(503).json({ message: "Unable to send a sign-in email. Please try again later." });
        req.session.invitationRecoveryEmail = parsed.data.email;
        req.session.authReturnTo = parsed.data.returnTo;
        await save(req);
      }
      res.json({ message: "If this address has an active invitation and an account, a fresh sign-in email will arrive. Open the newest link in this browser to set your password." });
    } catch { res.status(503).json({ message: "Unable to send a sign-in email. Please try again later." }); }
  });
  app.get("/api/callback", authLimit, async (req, res) => {
    const returnTo = isAllowedAuthReturnTo(req.session.authReturnTo) ? req.session.authReturnTo : "/";
    const fail = (error: string) => {
      clearSocialAttempt(req);
      delete req.session.invitationRecoveryEmail;
      return res.redirect(loginFailureUrl(error, returnTo));
    };
    if (req.query.error) return fail(req.query.error === "access_denied" ? "social_cancelled" : "login_failed");
    // Supabase team invitation emails use the implicit flow. The browser carries
    // the URL fragment across this redirect; /invite exchanges it server-side.
    if (typeof req.query.code !== "string") return res.redirect("/invite");
    if (!req.query.code || req.query.code.length > 4096 || !req.session.oauthStorage) return fail("social_session_expired");
    const companyIntent = req.session.socialCompanySignup === undefined ? undefined : socialCompanyIntentSchema.safeParse(req.session.socialCompanySignup);
    if (companyIntent && (!companyIntent.success || companyIntent.data.expiresAt <= Date.now())) return fail("social_session_expired");
    try {
      const { data, error } = await pkceClient(req).auth.exchangeCodeForSession(req.query.code);
      if (error || !data.session) return fail("social_session_expired");
      const recoveryEmail = req.session.invitationRecoveryEmail;
      const user = await establishSession(req, data.session, companyIntent?.success ? companyIntent.data.companyName : undefined, provisionSocialCompany);
      if (recoveryEmail && user.email_confirmed_at && user.email?.toLowerCase() === recoveryEmail) {
        const pending = await db.select({ id: companyInvitations.id }).from(companyInvitations).where(and(eq(companyInvitations.email, recoveryEmail), isNull(companyInvitations.acceptedAt), isNull(companyInvitations.revokedAt), gt(companyInvitations.expiresAt, new Date()))).limit(1);
        req.session.canSetInvitationPassword = pending.length > 0;
        await save(req);
      }
      res.redirect(returnTo);
    } catch { fail("login_failed"); }
  });
  app.post("/api/auth/invite-session", authLimit, async (req, res) => {
    const parsed = z.object({ refreshToken: z.string().min(1).max(4096) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid invitation sign-in" });
    try {
    const { data, error } = await createAuthClient().auth.refreshSession({ refresh_token: parsed.data.refreshToken });
    if (error || !data.session || !data.user?.email_confirmed_at || !data.user.email) return res.status(401).json({ message: "The sign-in link has expired. Sign in or request a new invitation." });
    const pending = await db.select({ id: companyInvitations.id }).from(companyInvitations).where(and(eq(companyInvitations.email, data.user.email.toLowerCase()), isNull(companyInvitations.acceptedAt), isNull(companyInvitations.revokedAt), gt(companyInvitations.expiresAt, new Date()))).limit(1);
    if (!pending.length) return res.status(403).json({ message: "No active team invitation exists for this account." });
      await establishSession(req, data.session);
      req.session.canSetInvitationPassword = true;
      await save(req);
      res.json({ success: true, needsPassword: true });
    } catch { res.status(503).json({ message: "Unable to finish invitation sign-in. Please try again." }); }
  });
  app.post("/api/auth/invite-password", isAuthenticated, authLimit, async (req, res) => {
    if (!req.session.canSetInvitationPassword) return res.status(403).json({ message: "Use the invitation sign-in link to set your password." });
    const parsed = z.object({ password: z.string().min(8).max(128) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Use a password with at least 8 characters." });
    try {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(req.user!.claims.sub, { password: parsed.data.password });
    if (error) return res.status(400).json({ message: "Unable to set password. Check the password strength and try again." });
    const { data, error: signInError } = await createAuthClient().auth.signInWithPassword({ email: req.user!.email!, password: parsed.data.password });
    if (signInError || !data.session || data.user?.id !== req.user!.claims.sub) return res.status(503).json({ message: "Your password was saved. Sign in with your new password to accept the invitation." });
    await establishSession(req, data.session);
    req.session.canSetInvitationPassword = false;
    await save(req);
    res.json({ success: true });
    } catch { res.status(503).json({ message: "Unable to set your password. Please try again." }); }
  });
  app.get("/api/auth/invite-status", isAuthenticated, (req, res) => res.json({ needsPassword: Boolean(req.session.canSetInvitationPassword) }));
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
    req.user = { claims: { sub: data.user.id }, email: data.user.email, emailVerified: Boolean(data.user.email_confirmed_at) };
    next();
  } catch {
    await destroy(req).catch(() => {});
    res.status(401).json({ message: "Unauthorized" });
  }
};
