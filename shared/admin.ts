import { z } from "zod";
import { validDateKey, validTimezone } from "./scheduling";
import type { CompanyRole } from "./schema";

export interface AppAdminAccess {
  isAdmin: boolean;
}

export interface AdminUser {
  id: string;
  name: string | null;
  email: string | null;
  emailVerified: boolean;
  accountStatus: "active" | "blocked";
  companies: AdminCompany[];
  createdAt: string;
  lastSignInAt: string | null;
}

export interface AdminUsersPage {
  users: AdminUser[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
}

export const adminUserFiltersSchema = z.object({
  search: z.string().trim().max(200).default(""),
  company: z.string().trim().max(150).default(""),
  emailStatus: z.enum(["all", "verified", "pending"]).default("all"),
  accountStatus: z.enum(["all", "active", "blocked"]).default("all"),
  registeredFrom: z.string().refine(value => !value || validDateKey(value), "Choose a valid start date.").default(""),
  registeredTo: z.string().refine(value => !value || validDateKey(value), "Choose a valid end date.").default(""),
  timezone: z.string().max(100).refine(validTimezone, "Choose a valid timezone.").default("UTC"),
  sortBy: z.enum(["name", "registeredAt"]).default("registeredAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

export type AdminUserFilters = z.infer<typeof adminUserFiltersSchema>;
export const defaultAdminUserFilters: AdminUserFilters = adminUserFiltersSchema.parse({});

export interface AdminCompany {
  id: number;
  name: string;
  role: CompanyRole;
  isActive: boolean;
}
