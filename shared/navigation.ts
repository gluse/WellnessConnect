const providerDestinations = new Set([
  "/my-services", "/my-services/appointments", "/my-services/services", "/my-services/services/new",
  "/my-services/availability", "/my-services/settings", "/my-services/settings/team", "/my-services/settings/storefront",
]);

export function isAllowedAuthReturnTo(value: unknown): value is string {
  return typeof value === "string" && (value === "/search" || value === "/account" || value === "/my-bookings" || value === "/administration" || providerDestinations.has(value)
    || /^\/providers\/(?=[a-z0-9-]{3,64}(?:\?|$))[a-z0-9]+(?:-[a-z0-9]+)*(?:\?book=[1-9]\d{0,9})?$/.test(value)
    || /^\/my-services\/services\/\d+\/edit$/.test(value) || /^\/invite(?:\?|$)/.test(value));
}
