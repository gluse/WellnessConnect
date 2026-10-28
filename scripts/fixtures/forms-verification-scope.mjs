export const languages = ["en", "lv", "ru"];
export const deferredLanguages = ["ar", "zh", "fr", "de", "hi", "ja", "pt", "es"];
export const verificationDate = "2026-10-21";
export const browserName = process.env.FORMS_BROWSER || "chrome";
export const evidencePrefix = phase => `forms-task022-${phase}-${browserName}`;
