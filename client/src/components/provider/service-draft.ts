import type { Service } from "@shared/schema";

export function createServiceDraft(service?: Service) {
  return {
    name: service?.name ?? "", description: service?.description ?? "",
    category: service?.category ?? "health_wellness", serviceType: service?.serviceType ?? "one_to_one",
    price: service?.price ?? "", duration: service?.duration ?? 60, maxCapacity: service?.maxCapacity ?? 1,
    ageGroups: service?.ageGroups ?? [] as string[], targetGender: service?.targetGender ?? "both",
    instantBooking: service?.instantBooking ?? false, advancePaymentPercent: service?.advancePaymentPercent ?? 50,
    address: service?.address ?? "", latitude: service?.latitude ?? null, longitude: service?.longitude ?? null,
    imageUrl: service?.imageUrl ?? "", externalUrl: service?.externalUrl ?? "",
    isActive: service?.isActive ?? true, employeeId: service?.employeeId ?? null,
  };
}

export type ServiceDraft = ReturnType<typeof createServiceDraft>;
