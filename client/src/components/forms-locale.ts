import { useEffect } from "react";
import { useTranslation } from "react-i18next";

export function useFormLocale() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language;
  useEffect(() => {
    if (typeof document === "undefined" || !document.documentElement) return;
    document.documentElement.lang = language;
    document.documentElement.dir = i18n.dir();
  }, [language, i18n]);
  return { t, i18n, language };
}

// Preserve the application's existing dollar unit; the API has no currency field.
export const serviceAmount = (amount: number, language: string) => "$" + new Intl.NumberFormat(language, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(amount.toFixed(2)));
