import { validDateKey, validTimezone } from "./scheduling";

const providerDestinations = new Set([
  "/my-services", "/my-services/appointments", "/my-services/services", "/my-services/services/new",
  "/my-services/upcoming-appointments", "/my-services/past-appointments",
  "/my-services/availability", "/my-services/settings", "/my-services/settings/team", "/my-services/settings/storefront",
  "/my-services/settings/pricing", "/my-services/settings/addresses",
]);

/** Public booking continuation only: no arbitrary destinations or private drafts. */
export function isAllowedServiceReturnTo(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 512 || /[\\#\u0000-\u0020\u007f]/.test(value)) return false;
  const [path, query] = value.split("?");
  if (value.split("?").length > 2 || !/^\/services\/[1-9]\d{0,9}$/.test(path) || Number(path.slice(10)) > 2147483647) return false;
  if (query === undefined) return true;
  if (!query) return false;
  const params = new URLSearchParams(query);
  const numeric = (text: string, maximum = 2147483647) => /^[1-9]\d{0,9}$/.test(text) && Number(text) <= maximum;
  const keys = new Set(["option", "specialist", "date", "month", "start", "timezone", "participants", "step"]);
  for (const [key, text] of Array.from(params.entries())) {
    if (!keys.has(key) || params.getAll(key).length !== 1 || !text || /[\\\u0000-\u001f\u007f]/.test(text)) return false;
    if ((key === "option" || key === "specialist" && text !== "any") && !numeric(text)) return false;
    if (key === "participants" && !numeric(text, 10000)) return false;
    if (key === "date" && !validDateKey(text)) return false;
    if (key === "month" && !/^(?:19|20|21)\d{2}-(?:0[1-9]|1[0-2])$/.test(text)) return false;
    if (key === "timezone" && (text.length > 100 || !validTimezone(text))) return false;
    if (key === "step" && text !== "choose" && text !== "review") return false;
    if (key === "start" && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(text) || !Number.isFinite(Date.parse(text)) || !validDateKey(text.slice(0, 10)) || new Date(text).toISOString().slice(0, 19) !== text.slice(0, 19))) return false;
  }
  return true;
}

export function isAllowedAuthReturnTo(value: unknown): value is string {
  if (isAllowedServiceReturnTo(value)) return true;
  return typeof value === "string" && (value === "/search" || value === "/wishlist" || value === "/inbox" || /^\/search\?service=[1-9]\d{0,9}$/.test(value) && Number(value.split("=")[1]) <= 2147483647 || value === "/account" || value === "/my-bookings" || value === "/administration" || value === "/administration?section=audit" || providerDestinations.has(value)
    || /^\/providers\/(?=[a-z0-9-]{3,64}(?:\?|$))[a-z0-9]+(?:-[a-z0-9]+)*(?:\?book=[1-9]\d{0,9})?$/.test(value)
    || /^\/my-services\/services\/\d+\/edit$/.test(value) || /^\/invite(?:\?|$)/.test(value));
}
