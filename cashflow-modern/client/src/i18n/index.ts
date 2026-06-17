import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import th from './th.json';
import en from './en.json';

const saved = (typeof localStorage !== 'undefined' && localStorage.getItem('lang')) || 'th';

i18n.use(initReactI18next).init({
  resources: {
    th: { translation: th },
    en: { translation: en }
  },
  lng: saved,
  fallbackLng: 'en',
  interpolation: { escapeValue: false }
});

export const setLang = (lng: 'th' | 'en') => {
  i18n.changeLanguage(lng);
  if (typeof localStorage !== 'undefined') localStorage.setItem('lang', lng);
  document.documentElement.lang = lng;
};

document.documentElement.lang = saved;

export default i18n;
