import type { Express, Request, Response } from "express";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { companies, companyMemberships, companyInvitations, employees, users, services, type CompanyRole } from "@shared/schema";
import { isAuthenticated } from "./auth";
import { scope, workspaceContext, saveWorkspaceSession, AccessError } from "./companyAccess";
import { supabaseAdmin, appUrl } from "./supabase";

const roleSchema = z.enum(["admin", "provider", "viewer"]);
const assignmentSchema = z.object({ role: roleSchema, employeeId: z.number().int().positive().nullable().default(null) })
  .refine(data => data.role === "admin" || data.employeeId != null, { message: "Assign an employee for provider or read-only access." });
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
const safe = (handler: (req: Request, res: Response) => Promise<unknown>) => async (req: Request, res: Response) => {
  try { await handler(req, res); } catch (error) {
    const duplicate = (error as { code?: string }).code === "23505";
    const status = error instanceof AccessError ? error.status : error instanceof z.ZodError ? 400 : duplicate ? 409 : 500;
    if (status === 500) console.error("Company request failed:", (error as { code?: string }).code ?? "Error");
    res.status(status).json({ message: error instanceof AccessError ? error.message : error instanceof z.ZodError ? error.issues[0].message : duplicate ? "This employee or account is already assigned." : "Unable to complete the company request." });
  }
};
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function manager(tx: Transaction, companyId: number, userId: string, ownerOnly = false) {
  const [company] = await tx.select().from(companies).where(eq(companies.id, companyId)).for("update");
  const [membership] = await tx.select().from(companyMemberships).where(and(eq(companyMemberships.companyId, companyId), eq(companyMemberships.userId, userId)));
  if (!company || !membership || (ownerOnly ? membership.role !== "owner" : !["owner", "admin"].includes(membership.role))) throw new AccessError(403, "Your access level does not allow this action.");
  return company;
}
async function assignment(tx: Transaction, companyId: number, employeeId: number | null, exceptUserId?: string) {
  if (employeeId == null) return;
  const [employee] = await tx.select().from(employees).where(and(eq(employees.id, employeeId), eq(employees.companyId, companyId)));
  if (!employee) throw new AccessError(400, "Choose an employee from this company.");
  const [used] = await tx.select().from(companyMemberships).where(eq(companyMemberships.employeeId, employeeId));
  if (used && used.userId !== exceptUserId) throw new AccessError(409, "This employee already has a team login.");
}

export function setupCompanyRoutes(app: Express) {
  app.use("/api", async (req, _res, next) => {
    if (req.session.auth) {
      try { req.workspace = await workspaceContext(req.session.auth.userId, req.session.activeCompanyId); }
      catch (error) { return next(error); }
    }
    next();
  });
  app.get("/api/company/context", isAuthenticated, safe(async (req, res) => {
    const ctx = await workspaceContext(req.user!.claims.sub, req.session.activeCompanyId);
    if (ctx.invalid) { req.session.activeCompanyId = null; await saveWorkspaceSession(req); res.json(await workspaceContext(req.user!.claims.sub, null)); }
    else res.json(ctx);
  }));
  app.post("/api/company/context", isAuthenticated, safe(async (req, res) => {
    const id = z.object({ companyId: z.number().int().positive().nullable() }).parse(req.body).companyId;
    const ctx = await workspaceContext(req.user!.claims.sub, id);
    if (ctx.invalid) throw new AccessError(403, "You do not belong to this company.");
    req.session.activeCompanyId = id;
    await saveWorkspaceSession(req);
    res.json(ctx);
  }));
  app.get("/api/company/team", isAuthenticated, safe(async (req, res) => {
    const current = scope(req);
    if (!current.ctx.permissions.manageTeam && !current.ctx.permissions.isOwner) throw new AccessError(403, "Only company managers can view the team.");
    if (!current.companyId) throw new AccessError(400, "Choose a company workspace.");
    const members = await db.select({ userId: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName, role: companyMemberships.role, employeeId: companyMemberships.employeeId }).from(companyMemberships)
      .innerJoin(users, eq(users.id, companyMemberships.userId)).where(eq(companyMemberships.companyId, current.companyId));
    const invitations = await db.select({ id: companyInvitations.id, email: companyInvitations.email, role: companyInvitations.role, employeeId: companyInvitations.employeeId, expiresAt: companyInvitations.expiresAt }).from(companyInvitations)
      .where(and(eq(companyInvitations.companyId, current.companyId), isNull(companyInvitations.acceptedAt), isNull(companyInvitations.revokedAt), gt(companyInvitations.expiresAt, new Date())));
    res.json({ members, invitations });
  }));
  app.post("/api/company/invitations", isAuthenticated, safe(async (req, res) => {
    const current = scope(req, "manageTeam");
    if (!current.companyId) throw new AccessError(400, "Choose a company workspace.");
    const data = assignmentSchema.and(z.object({ email: z.string().trim().email().max(254).transform(email => email.toLowerCase()), sendEmail: z.boolean().default(true) })).parse(req.body);
    const token = randomBytes(32).toString("hex");
    const id = randomUUID();
    await db.transaction(async tx => {
      await manager(tx, current.companyId!, current.userId);
      await assignment(tx, current.companyId!, data.employeeId);
      const [existing] = await tx.select().from(companyMemberships).innerJoin(users, eq(companyMemberships.userId, users.id))
        .where(and(eq(companyMemberships.companyId, current.companyId!), sql`lower(${users.email}) = ${data.email}`));
      if (existing) throw new AccessError(409, "This user is already a company member. Edit their access instead.");
      await tx.update(companyInvitations).set({ revokedAt: new Date() }).where(and(eq(companyInvitations.companyId, current.companyId!), eq(companyInvitations.email, data.email), isNull(companyInvitations.acceptedAt), isNull(companyInvitations.revokedAt)));
      if (data.employeeId != null) {
        const [pending] = await tx.select().from(companyInvitations).where(and(eq(companyInvitations.employeeId, data.employeeId), isNull(companyInvitations.acceptedAt), isNull(companyInvitations.revokedAt), gt(companyInvitations.expiresAt, new Date())));
        if (pending) throw new AccessError(409, "This employee already has a pending invitation.");
      }
      await tx.insert(companyInvitations).values({ id, companyId: current.companyId!, email: data.email, role: data.role, employeeId: data.employeeId, tokenHash: hash(token), invitedBy: current.userId, expiresAt: new Date(Date.now() + 7 * 86400_000) });
    });
    let emailSent = false;
    if (data.sendEmail) {
      const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, { redirectTo: `${appUrl}/api/callback` });
      emailSent = !error;
    }
    res.status(201).json({ id, invitationUrl: `${appUrl}/invite?token=${token}`, emailSent, message: emailSent ? "Invitation emailed." : "Invitation created. Share the invitation link with this email address." });
  }));
  app.delete("/api/company/invitations/:id", isAuthenticated, safe(async (req, res) => {
    const current = scope(req, "manageTeam");
    const result = await db.update(companyInvitations).set({ revokedAt: new Date() }).where(and(eq(companyInvitations.id, req.params.id), eq(companyInvitations.companyId, current.companyId!), isNull(companyInvitations.acceptedAt))).returning();
    if (!result.length) throw new AccessError(404, "Invitation not found.");
    res.json({ success: true });
  }));
  app.get("/api/company/invitation", safe(async (req, res) => {
    const token = tokenSchema.parse(req.query.token);
    const [result] = await db.select({ invitation: companyInvitations, company: companies }).from(companyInvitations).innerJoin(companies, eq(companyInvitations.companyId, companies.id)).where(eq(companyInvitations.tokenHash, hash(token)));
    if (!result || result.invitation.acceptedAt || result.invitation.revokedAt || result.invitation.expiresAt < new Date() || !result.company.isActive) throw new AccessError(410, "This invitation has expired or is no longer available.");
    res.json({ id: result.invitation.id, companyName: result.company.name, role: result.invitation.role, emailHint: result.invitation.email.replace(/^(.).*(@.*)$/, "$1***$2") });
  }));
  app.get("/api/company/my-invitations", isAuthenticated, safe(async (req, res) => {
    if (!req.user!.emailVerified || !req.user!.email) throw new AccessError(403, "Verify your email before joining a company.");
    const invitations = await db.select({ id: companyInvitations.id, companyName: companies.name, role: companyInvitations.role }).from(companyInvitations).innerJoin(companies, eq(companies.id, companyInvitations.companyId))
      .where(and(eq(companyInvitations.email, req.user!.email.toLowerCase()), isNull(companyInvitations.acceptedAt), isNull(companyInvitations.revokedAt), gt(companyInvitations.expiresAt, new Date()), eq(companies.isActive, true)));
    res.json(invitations);
  }));
  app.post("/api/company/invitations/accept", isAuthenticated, safe(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.body);
    if (req.session.canSetInvitationPassword) throw new AccessError(403, "Set your password before accepting this invitation.");
    if (!req.user!.emailVerified || !req.user!.email) throw new AccessError(403, "Verify the invited email address before joining.");
    const companyId = await db.transaction(async tx => {
      const [lookup] = await tx.select().from(companyInvitations).where(eq(companyInvitations.id, id));
      if (!lookup) throw new AccessError(410, "Invitation is no longer available.");
      const [company] = await tx.select().from(companies).where(eq(companies.id, lookup.companyId)).for("update");
      const [invite] = await tx.select().from(companyInvitations).where(eq(companyInvitations.id, id)).for("update");
      if (!company?.isActive || invite.acceptedAt || invite.revokedAt || invite.expiresAt < new Date()) throw new AccessError(410, "Invitation is no longer available.");
      if (invite.email !== req.user!.email!.toLowerCase()) throw new AccessError(403, "Sign in with the email address this invitation was sent to.");
      const [inviter] = await tx.select().from(companyMemberships).where(and(eq(companyMemberships.companyId, company.id), eq(companyMemberships.userId, invite.invitedBy)));
      if (!inviter || !["owner", "admin"].includes(inviter.role)) throw new AccessError(410, "The invitation sender no longer manages this company.");
      await assignment(tx, company.id, invite.employeeId);
      await tx.insert(companyMemberships).values({ companyId: company.id, userId: req.user!.claims.sub, role: invite.role, employeeId: invite.employeeId });
      await tx.update(companyInvitations).set({ acceptedAt: new Date() }).where(eq(companyInvitations.id, id));
      await tx.update(users).set({ currentRole: "provider" }).where(eq(users.id, req.user!.claims.sub));
      return company.id;
    });
    req.session.activeCompanyId = companyId;
    await saveWorkspaceSession(req);
    res.json({ success: true });
  }));
  app.patch("/api/company/members/:userId", isAuthenticated, safe(async (req, res) => {
    const current = scope(req, "manageTeam");
    const data = assignmentSchema.parse(req.body);
    await db.transaction(async tx => {
      await manager(tx, current.companyId!, current.userId);
      const [target] = await tx.select().from(companyMemberships).where(and(eq(companyMemberships.companyId, current.companyId!), eq(companyMemberships.userId, req.params.userId)));
      if (!target) throw new AccessError(404, "Member not found.");
      if (target.role === "owner") throw new AccessError(409, "Transfer ownership before changing the owner's access.");
      await assignment(tx, current.companyId!, data.employeeId, target.userId);
      await tx.update(companyMemberships).set(data).where(and(eq(companyMemberships.companyId, current.companyId!), eq(companyMemberships.userId, target.userId)));
      if (!["owner", "admin"].includes(data.role)) await tx.update(companyInvitations).set({ revokedAt: new Date() }).where(and(eq(companyInvitations.companyId, current.companyId!), eq(companyInvitations.invitedBy, target.userId), isNull(companyInvitations.acceptedAt)));
    });
    res.json({ success: true });
  }));
  app.delete("/api/company/members/:userId", isAuthenticated, safe(async (req, res) => {
    const current = scope(req, "manageTeam");
    await db.transaction(async tx => {
      await manager(tx, current.companyId!, current.userId);
      const [target] = await tx.select().from(companyMemberships).where(and(eq(companyMemberships.companyId, current.companyId!), eq(companyMemberships.userId, req.params.userId)));
      if (!target) throw new AccessError(404, "Member not found.");
      if (target.role === "owner") throw new AccessError(409, "The company must retain an owner.");
      await tx.delete(companyMemberships).where(and(eq(companyMemberships.companyId, current.companyId!), eq(companyMemberships.userId, target.userId)));
      await tx.update(companyInvitations).set({ revokedAt: new Date() }).where(and(eq(companyInvitations.companyId, current.companyId!), eq(companyInvitations.invitedBy, target.userId), isNull(companyInvitations.acceptedAt)));
    });
    res.json({ success: true });
  }));
  app.post("/api/company/transfer", isAuthenticated, safe(async (req, res) => {
    const current = scope(req, "isOwner");
    const userId = z.object({ userId: z.string().min(1) }).parse(req.body).userId;
    await db.transaction(async tx => {
      await manager(tx, current.companyId!, current.userId, true);
      const [target] = await tx.select().from(companyMemberships).where(and(eq(companyMemberships.companyId, current.companyId!), eq(companyMemberships.userId, userId)));
      if (!target || target.userId === current.userId) throw new AccessError(400, "Choose another company member.");
      await tx.update(companyMemberships).set({ role: "admin" }).where(and(eq(companyMemberships.companyId, current.companyId!), eq(companyMemberships.userId, current.userId)));
      await tx.update(companyMemberships).set({ role: "owner" }).where(and(eq(companyMemberships.companyId, current.companyId!), eq(companyMemberships.userId, userId)));
      await tx.update(companies).set({ ownerId: userId }).where(eq(companies.id, current.companyId!));
    });
    res.json({ success: true });
  }));
  app.patch("/api/company/active", isAuthenticated, safe(async (req, res) => {
    const current = scope(req, "isOwner");
    const active = z.object({ isActive: z.boolean() }).parse(req.body).isActive;
    await db.transaction(async tx => {
      await manager(tx, current.companyId!, current.userId, true);
      await tx.update(companies).set({ isActive: active }).where(eq(companies.id, current.companyId!));
      if (!active) await tx.update(companyInvitations).set({ revokedAt: new Date() }).where(and(eq(companyInvitations.companyId, current.companyId!), isNull(companyInvitations.acceptedAt)));
    });
    res.json({ success: true });
  }));
}
