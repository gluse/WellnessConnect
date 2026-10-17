import type { Service } from "@shared/schema";

export function createServiceDraft(service?: Service) {
  return {
    name: service?.name ?? "", description: service?.description ?? "",
    category: service?.category ?? "", serviceType: service?.serviceType ?? "one_to_one",
    price: service?.price ?? "", duration: service?.duration ?? 60, maxCapacity: service?.maxCapacity ?? 1,
    cleanupTime: service?.cleanupTime ?? 0,
    ageGroups: service?.ageGroups ?? [] as string[], targetGender: service?.targetGender ?? "both",
    instantBooking: service?.instantBooking ?? false, advancePaymentPercent: service?.advancePaymentPercent ?? 50,
    addressId: service?.addressId ?? null,
    imageUrl: service?.imageUrl ?? "", externalUrl: service?.externalUrl ?? "",
    isActive: service?.isActive ?? true, employeeId: service?.employeeId ?? null,
  };
}

export type ServiceDraft = ReturnType<typeof createServiceDraft>;
