const providerDestinations = new Set([
  "/my-services", "/my-services/appointments", "/my-services/services", "/my-services/services/new",
  "/my-services/availability", "/my-services/settings", "/my-services/settings/team",
]);

export function isAllowedAuthReturnTo(value: unknown): value is string {
  return typeof value === "string" && (value === "/search" || value === "/account" || value === "/my-bookings" || value === "/administration" || providerDestinations.has(value)
    || /^\/my-services\/services\/\d+\/edit$/.test(value) || /^\/invite(?:\?|$)/.test(value));
}
