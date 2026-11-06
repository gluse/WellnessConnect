import { isSupportedCurrency, suggestedCurrency, type CurrencyCode } from "./currencies";

export type CurrencyDefaultSource = "saved" | "manual" | "location" | "workspace" | "serviceCountry" | "businessCountry" | "none";
export type CurrencyDefault = { currency: CurrencyCode | null; source: CurrencyDefaultSource };
export function resolveCurrencyDefault(input: {
  selected?: { currency: unknown; source: "saved" | "manual" } | null;
  location?: { pricingCurrency?: unknown; countryCode?: unknown } | null;
  settings?: { defaultCurrency?: unknown; businessCountryCode?: unknown } | null;
}): CurrencyDefault {
  if (input.selected) return { currency: isSupportedCurrency(input.selected.currency) ? input.selected.currency : null, source: input.selected.source };
  if (isSupportedCurrency(input.location?.pricingCurrency)) return { currency: input.location.pricingCurrency, source: "location" };
  if (isSupportedCurrency(input.settings?.defaultCurrency)) return { currency: input.settings.defaultCurrency, source: "workspace" };
  const serviceCurrency = suggestedCurrency(input.location?.countryCode);
  if (serviceCurrency) return { currency: serviceCurrency, source: "serviceCountry" };
  const businessCurrency = suggestedCurrency(input.settings?.businessCountryCode);
  return businessCurrency ? { currency: businessCurrency, source: "businessCountry" } : { currency: null, source: "none" };
}
