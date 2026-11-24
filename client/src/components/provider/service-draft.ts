import type { Service } from "@shared/schema";
import { imageDraft, serviceImages } from "@/lib/service-images";
import type { ServiceOption, ServiceOptionInput } from "@shared/service-options";

export type ServiceOptionDraft = ServiceOptionInput & { draftKey: string };
let optionSequence = 0;
export function createOptionDraft(option?: Partial<ServiceOptionInput>, draftKey = `new-${++optionSequence}`): ServiceOptionDraft {
  const { serviceId: _serviceId, ...input } = (option ?? {}) as Partial<ServiceOption>;
  return { name: "", description: null, price: "", pricingMode: "fixed", duration: 60, isActive: true, sortOrder: 0,
    employeeIds: null, scheduleMode: "inherit", scheduleTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    scheduleDays: Array.from({ length: 7 }, (_, day) => ({ day, intervals: [] })), scheduleOverrides: [], ...input, draftKey };
}

export function createServiceDraft(service?: Service) {
  const extended = service as (Service & { options?: ServiceOption[]; onlinePaymentsOverride?: boolean | null }) | undefined;
  const options = extended?.options?.length ? extended.options.map((option, index) => createOptionDraft(option, `saved-${option.id ?? index}`))
    : [createOptionDraft({ name: service?.name ?? "", price: service?.price ?? "", duration: service?.duration ?? 60 }, "default")];
  return {
    name: service?.name ?? "", description: service?.description ?? "",
    category: service?.category ?? "", serviceType: service?.serviceType ?? "one_to_one",
    price: service?.price ?? "", currency: service?.currency ?? "", duration: service?.duration ?? 60, maxCapacity: service?.maxCapacity ?? 1,
    cleanupTime: service?.cleanupTime ?? 0,
    reminderEnabled: service?.reminderEnabled ?? false,
    reminderMethod: service?.reminderMethod ?? "email",
    reminderHours: service?.reminderHours ?? 24,
    reminderMessage: service?.reminderMessage ?? "",
    ageGroups: service?.ageGroups ?? [] as string[], targetGender: service?.targetGender ?? "both",
    instantBooking: service?.instantBooking ?? false, advancePaymentPercent: service?.advancePaymentPercent ?? 50,
    addressId: service?.addressId ?? null,
    ...imageDraft(service ? serviceImages(service) : []), externalUrl: service?.externalUrl ?? "",
    isActive: service?.isActive ?? true, employeeId: service?.employeeId ?? null,
    options, onlinePaymentsOverride: extended?.onlinePaymentsOverride ?? null as boolean | null,
  };
}

export type ServiceDraft = ReturnType<typeof createServiceDraft>;
