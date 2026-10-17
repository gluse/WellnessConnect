import { db } from "./db";
import { companies, companyMemberships, providerSubscriptions } from "@shared/schema";
import { inArray, or } from "drizzle-orm";
import type { CompanyRole } from "@shared/schema";
import type { AdminCompanyAffiliation, AdminProSubscription, AdminUser, AdminUserFilters, AdminUsersPage } from "@shared/admin";
import { hasPro } from "@shared/storefront";
import { dateInZone } from "@shared/scheduling";
import type { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "./supabase";

type CompanyRecord = Pick<typeof companies.$inferSelect, "id" | "name" | "ownerId" | "isActive">;
type MembershipRecord = { companyId: number; userId: string; role: CompanyRole };

export function companyAffiliations(records: CompanyRecord[], memberships: MembershipRecord[]): Map<string, AdminCompanyAffiliation[]> {
  const byCompany = new Map(records.map(company => [company.id, company]));
  const byUser = new Map<string, Map<number, AdminCompanyAffiliation>>();
  function add(userId: string, company: CompanyRecord, role: CompanyRole) {
    if (!byUser.has(userId)) byUser.set(userId, new Map());
    byUser.get(userId)!.set(company.id, { id: company.id, name: company.name, isActive: company.isActive, role });
  }
  for (const membership of memberships) {
    const company = byCompany.get(membership.companyId);
    if (company) add(membership.userId, company, membership.role);
  }
  // Include owners even if a legacy record is missing its membership. The
  // historical provider/billing anchor is not proof of current membership.
  for (const company of records) add(company.ownerId, company, "owner");
  return new Map(Array.from(byUser, ([id, values]) => [id, Array.from(values.values()).sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id)]));
}

export async function loadDirectorySubscriptions(userIds: string[], companyIds: number[]): Promise<Map<string, AdminProSubscription>> {
  if (!userIds.length && !companyIds.length) return new Map();
  // One bounded query for the visible page, never a query per user/company.
  const rows = await db.select({ userId: providerSubscriptions.userId, companyId: providerSubscriptions.companyId,
    plan: providerSubscriptions.plan, proUntil: providerSubscriptions.proUntil }).from(providerSubscriptions)
    .where(or(userIds.length ? inArray(providerSubscriptions.userId, userIds) : undefined,
      companyIds.length ? inArray(providerSubscriptions.companyId, companyIds) : undefined));
  const now = Date.now();
  return new Map(rows.map(row => [row.companyId != null ? `company:${row.companyId}` : `user:${row.userId}`,
    { enabled: hasPro(row, now), proUntil: row.proUntil?.toISOString() ?? null }]));
}

const noPro = (): AdminProSubscription => ({ enabled: false, proUntil: null });

export async function loadCompanyAffiliations() {
  const [records, memberships] = await Promise.all([
    db.select({ id: companies.id, name: companies.name, ownerId: companies.ownerId, isActive: companies.isActive }).from(companies),
    db.select({ companyId: companyMemberships.companyId, userId: companyMemberships.userId, role: companyMemberships.role }).from(companyMemberships),
  ]);
  return companyAffiliations(records, memberships);
}

const text = (value: unknown): string => typeof value === "string" ? value.trim().slice(0, 200) : "";
function directoryUser(user: User, now: number): AdminUser {
  return {
    id: user.id,
    name: [text(user.user_metadata?.first_name ?? user.user_metadata?.given_name), text(user.user_metadata?.last_name ?? user.user_metadata?.family_name)].filter(Boolean).join(" ")
      || text(user.user_metadata?.full_name ?? user.user_metadata?.name) || null,
    email: user.email || null,
    emailVerified: Boolean(user.email_confirmed_at),
    accountStatus: user.deleted_at || (user.banned_until && Date.parse(user.banned_until) > now) ? "blocked" : "active",
    proSubscription: noPro(),
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at || null,
    companies: [],
  };
}

async function loadRegisteredUsers(): Promise<AdminUser[]> {
  const result = new Map<string, AdminUser>();
  const batchSize = 1000;
  const now = Date.now();
  // listUsers supports paging but not directory-wide filtering or sorting.
  // Read every Auth page on the server, then return only the requested page.
  for (let page = 1; ; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: batchSize });
    if (error) throw error;
    for (const user of data.users) result.set(user.id, directoryUser(user, now));
    if (data.users.length < batchSize) break;
  }
  return Array.from(result.values());
}

export async function registeredUserDirectory(filters: AdminUserFilters, requestedPage: number, pageSize: number,
  loadCompanies: () => Promise<Map<string, AdminCompanyAffiliation[]>> = loadCompanyAffiliations,
  loadSubscriptions = loadDirectorySubscriptions): Promise<AdminUsersPage> {
  const [registered, affiliations] = await Promise.all([loadRegisteredUsers(), loadCompanies()]);
  const search = filters.search.toLocaleLowerCase();
  const companySearch = filters.company.toLocaleLowerCase();
  const filtered = registered.filter(user => {
    user.companies = (affiliations.get(user.id) ?? []).map(company => ({ ...company, proSubscription: noPro() }));
    if (search && ![user.name, user.email].some(value => value?.toLocaleLowerCase().includes(search))) return false;
    if (companySearch && !user.companies.some(company => company.name.toLocaleLowerCase().includes(companySearch))) return false;
    if (filters.emailStatus !== "all" && user.emailVerified !== (filters.emailStatus === "verified")) return false;
    if (filters.accountStatus !== "all" && user.accountStatus !== filters.accountStatus) return false;
    if (filters.registeredFrom || filters.registeredTo) {
      const day = dateInZone(new Date(user.createdAt), filters.timezone);
      if (filters.registeredFrom && day < filters.registeredFrom) return false;
      if (filters.registeredTo && day > filters.registeredTo) return false;
    }
    return true;
  });
  const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });
  const direction = filters.sortDirection === "asc" ? 1 : -1;
  filtered.sort((a, b) => {
    if (filters.sortBy === "name" && Boolean(a.name) !== Boolean(b.name)) return a.name ? -1 : 1;
    const comparison = filters.sortBy === "name" ? collator.compare(a.name ?? "", b.name ?? "") : Date.parse(a.createdAt) - Date.parse(b.createdAt);
    return comparison * direction || a.id.localeCompare(b.id);
  });
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const subscriptions = await loadSubscriptions(visible.map(user => user.id), Array.from(new Set(visible.flatMap(user => user.companies.map(company => company.id)))));
  const users = visible.map(user => ({ ...user, proSubscription: subscriptions.get(`user:${user.id}`) ?? noPro(),
    companies: user.companies.map(company => ({ ...company, proSubscription: subscriptions.get(`company:${company.id}`) ?? noPro() })) }));
  return { users, page, pageSize, total, totalPages, hasNextPage: page < totalPages };
}
