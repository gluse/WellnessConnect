import { useEffect } from "react";
import { useTranslation } from "react-i18next";

export function useFormLocale() {
  const { t, i18n } = useTranslation();
  // Keep the explicit interface choice for controls/formatting when individual
  // translations temporarily fall back to English (including failed-load retry).
  const language = i18n.language || i18n.resolvedLanguage || 'en';
  useEffect(() => {
    if (typeof document === "undefined" || !document.documentElement) return;
    document.documentElement.lang = language;
    document.documentElement.dir = i18n.dir();
  }, [language, i18n]);
  return { t, i18n, language };
}
