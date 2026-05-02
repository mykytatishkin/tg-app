import { createI18n } from 'vue-i18n';
import ru from './ru.js';
import uk from './uk.js';
import en from './en.js';
import lt from './lt.js';

const STORAGE_KEY = 'tg_app_locale';

const SUPPORTED = ['ru', 'uk', 'en', 'lt'];

function detectLocale() {
  // 1. User override in localStorage
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && SUPPORTED.includes(stored)) return stored;

  // 2. Telegram language_code
  const tgLang = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
  if (tgLang) {
    const lang = tgLang.toLowerCase().split('-')[0];
    if (SUPPORTED.includes(lang)) return lang;
    // Ukrainian speakers sometimes have 'uk' or 'ua'
    if (lang === 'ua') return 'uk';
  }

  // 3. Browser language
  const browserLang = navigator.language?.toLowerCase().split('-')[0];
  if (browserLang && SUPPORTED.includes(browserLang)) return browserLang;

  return 'ru';
}

export const i18n = createI18n({
  legacy: false,
  locale: detectLocale(),
  fallbackLocale: 'ru',
  messages: { ru, uk, en, lt },
});

export function setLocale(lang) {
  if (!SUPPORTED.includes(lang)) return;
  i18n.global.locale.value = lang;
  localStorage.setItem(STORAGE_KEY, lang);
}

export function getLocale() {
  return i18n.global.locale.value;
}

export const LOCALE_LABELS = {
  ru: 'Русский',
  uk: 'Українська',
  en: 'English',
  lt: 'Lietuvių',
};

export { SUPPORTED };
