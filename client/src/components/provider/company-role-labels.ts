import type { CompanyRole } from "@shared/schema";

export const roleLabels: Record<CompanyRole, string> = {
  owner: "Owner", admin: "Administrator", provider: "Service provider", viewer: "Read-only",
};
