import type { User, Company } from "./schema";

export function getProviderName(provider: Pick<User, "providerType" | "companyName" | "firstName" | "lastName">): string {
  if (provider.providerType === "company") return provider.companyName?.trim() || "Company";
  return [provider.firstName, provider.lastName].filter(Boolean).join(" ") || "Service provider";
}

// Company administrators' personal details are not part of their public business profile.
export function publicProvider(user: User, company?: Company | null): User {
  const provider = { ...user, providerType: company ? "company" as const : "individual" as const, companyName: company?.name ?? null };
  return {
    ...provider, email: null,
    ...(provider.providerType === "company" ? { firstName: null, lastName: null, profileImageUrl: null } : {}),
  };
}
