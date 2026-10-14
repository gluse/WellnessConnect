import type { Request } from "express";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "./db";
import { companies, companyMemberships, employees, services, bookings, availability, users, type WorkspaceContext, type Service, type Booking } from "@shared/schema";

declare module "express-session" { interface SessionData { activeCompanyId?: number | null; } }
declare global { namespace Express { interface Request { workspace?: WorkspaceContext; } } }
export class AccessError extends Error { constructor(public status: number, message: string) { super(message); } }
export const saveWorkspaceSession = (req: Request) => new Promise<void>((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));

export async function workspaceContext(userId: string, selected?: number | null): Promise<WorkspaceContext> {
  const rows = await db.select({ company: companies, membership: companyMemberships }).from(companyMemberships)
    .innerJoin(companies, eq(companies.id, companyMemberships.companyId)).where(eq(companyMemberships.userId, userId));
  const chosen = selected === null ? undefined : selected !== undefined ? rows.find(row => row.company.id === selected)
    : rows.find(row => row.membership.role === "owner") ?? rows.find(row => row.company.isActive);
  const manager = chosen?.membership.role === "owner" || chosen?.membership.role === "admin";
  const active = chosen?.company.isActive ?? true;
  const personal = !chosen && selected == null;
  return {
    company: chosen?.company ?? null, membership: chosen?.membership ?? null,
    workspaces: rows.map(row => ({ id: row.company.id, name: row.company.name, role: row.membership.role })),
    invalid: selected != null && !chosen,
    permissions: {
      manageCompany: Boolean(manager && active), manageTeam: Boolean(manager && active),
      manageServices: Boolean((personal || manager) && active), manageSchedules: Boolean((personal || manager) && active),
      manageBookings: Boolean((personal || manager || chosen?.membership.role === "provider") && active),
      readAll: Boolean(personal || manager), isOwner: chosen?.membership.role === "owner",
    },
  };
}

export function scope(req: Request, permission?: keyof WorkspaceContext["permissions"]) {
  const ctx = req.workspace!;
  if (!ctx || ctx.invalid) throw new AccessError(403, "Choose a workspace you belong to.");
  if (permission && !ctx.permissions[permission]) throw new AccessError(403, "Your access level does not allow this action.");
  return { userId: req.user!.claims.sub, providerId: ctx.company?.providerId ?? req.user!.claims.sub, companyId: ctx.company?.id, employeeId: ctx.membership?.employeeId, ctx };
}
export function assertService(req: Request, service: Service | undefined, write = false) {
  const current = scope(req, write ? "manageServices" : undefined);
  if (!service || (current.companyId != null ? service.companyId !== current.companyId : service.companyId != null || service.providerId !== current.userId)) throw new AccessError(403, "Service is not in this workspace.");
  if (!write && !current.ctx.permissions.readAll && (current.employeeId == null || service.employeeId !== current.employeeId)) throw new AccessError(403, "This service is not assigned to you.");
  return current;
}
export function assertBooking(req: Request, booking: Booking | undefined, write = false) {
  const current = scope(req, write ? "manageBookings" : undefined);
  if (!booking || (current.companyId != null ? booking.companyId !== current.companyId : booking.companyId != null || booking.providerId !== current.userId)) throw new AccessError(403, "Reservation is not in this workspace.");
  if (!current.ctx.permissions.readAll && (current.employeeId == null || booking.employeeId !== current.employeeId)) throw new AccessError(403, "This reservation is not assigned to you.");
  return current;
}

// Idempotent conversion for signup and existing individual providers, preserving all records.
export async function ensureCompany(providerId: string, name: string) {
  return db.transaction(async tx => {
    await tx.select().from(users).where(eq(users.id, providerId)).for("update");
    let [company] = await tx.select().from(companies).where(eq(companies.providerId, providerId));
    const created = !company;
    if (!company) {
      [company] = await tx.insert(companies).values({ name, ownerId: providerId, providerId }).returning();
      await tx.insert(companyMemberships).values({ companyId: company.id, userId: providerId, role: "owner" });
      for (const table of [employees, services, bookings, availability]) {
        await tx.update(table).set({ companyId: company.id }).where(and(eq(table.providerId, providerId), isNull(table.companyId)));
      }
    }
    await tx.update(users).set({ providerType: "company", companyName: company.name, ...(created ? { currentRole: "provider" as const } : {}) }).where(eq(users.id, providerId));
    return company;
  });
}
