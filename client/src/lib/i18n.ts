import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';
import { supportedLanguages } from './languages';
import { languageFromPath } from './language-path';

export { supportedLanguages } from './languages';

const languageDetector = new LanguageDetector();
languageDetector.addDetector({ name: 'languagePath', lookup: () => typeof window === 'undefined' ? undefined : languageFromPath(window.location.pathname) });

i18n
  .use(Backend)
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    debug: false,
    interpolation: {
      escapeValue: false,
    },
    backend: {
      loadPath: '/locales/{{lng}}/translation.json',
    },
    detection: {
      order: ['languagePath', 'localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
    supportedLngs: supportedLanguages.map(l => l.code),
  });

export default i18n;
