import type { ServiceDraft } from "./service-draft";

export type ServiceErrors = Partial<Record<keyof ServiceDraft, string>>;
export const serviceControlIds: Partial<Record<keyof ServiceDraft, string>> = {
  name: "serviceName", category: "category", price: "price", duration: "duration",
  cleanupTime: "cleanupTime", maxCapacity: "maxCapacity", advancePaymentPercent: "advancePayment",
  addressId: "service-address", externalUrl: "externalUrl",
};
export function fieldFeedback(errors: ServiceErrors, field: keyof ServiceDraft, help?: string) {
  return {
    "aria-invalid": Boolean(errors[field]) || undefined,
    "aria-describedby": [help, errors[field] ? `${serviceControlIds[field]}-error` : undefined].filter(Boolean).join(" ") || undefined,
  };
}
export function ServiceFieldError({ errors, field }: { errors: ServiceErrors; field: keyof ServiceDraft }) {
  return errors[field] ? <p id={`${serviceControlIds[field]}-error`} className="text-sm text-red-700 dark:text-red-300">{errors[field]}</p> : null;
}
// Presentation validation only; server validation and authorization remain authoritative.
export function validateServiceDraft(draft: ServiceDraft): Partial<Record<keyof ServiceDraft, string>> {
  const errors: Partial<Record<keyof ServiceDraft, string>> = {};
  if (!draft.name.trim()) errors.name = "serviceForm.nameRequired";
  if (!draft.category) errors.category = "serviceForm.categoryRequired";
  if (!draft.price.trim() || !Number.isFinite(Number(draft.price)) || Number(draft.price) < 0) errors.price = "serviceForm.priceInvalid";
  if (!Number.isInteger(draft.duration) || draft.duration < 1) errors.duration = "serviceForm.positiveWhole";
  if (!Number.isInteger(draft.cleanupTime) || draft.cleanupTime < 0 || draft.cleanupTime > 1440) errors.cleanupTime = "serviceCleanup.invalid";
  if (!Number.isInteger(draft.maxCapacity) || draft.maxCapacity < 1) errors.maxCapacity = "serviceForm.positiveWhole";
  if (!Number.isInteger(draft.advancePaymentPercent) || draft.advancePaymentPercent < 0 || draft.advancePaymentPercent > 100) errors.advancePaymentPercent = "serviceForm.advanceInvalid";
  if (!draft.addressId) errors.addressId = "serviceForm.addressRequired";
  if (draft.externalUrl) {
    try { if (!["http:", "https:"].includes(new URL(draft.externalUrl).protocol)) errors.externalUrl = "serviceForm.urlInvalid"; }
    catch { errors.externalUrl = "serviceForm.urlInvalid"; }
  }
  return errors;
}
