// @ts-check
/** @import { Locale, I18nInstance } from './index.js' */
import i18next from 'i18next';

/** @type {readonly ['en-US', 'pt-BR']} */
export const SUPPORTED_LOCALES = /** @type {const} */ (['en-US', 'pt-BR']);

/**
 * Shared nav copy exported so apps can merge it with their own catalogs.
 * Keys use literal dot notation (keySeparator is disabled in createI18n).
 *
 * @type {Record<Locale, Record<string, string>>}
 */
export const sharedCatalog = {
  'en-US': {
    'nav.blog': 'Blog',
    'nav.labs': 'Labs',
    'nav.contact': 'Contact',
  },
  'pt-BR': {
    'nav.blog': 'Blog',
    'nav.labs': 'Labs',
    'nav.contact': 'Contato',
  },
};

/**
 * Derive the active locale from the URL pathname.
 * `/pt` and `/pt/*` → `pt-BR`, everything else → `en-US`.
 *
 * @param {string} pathname
 * @returns {Locale}
 */
export function localeFromPath(pathname) {
  return pathname === '/pt' || pathname.startsWith('/pt/') ? 'pt-BR' : 'en-US';
}

/**
 * Derive the active locale from the browser's language preference.
 * `pt` and `pt-*` → `pt-BR`, everything else → `en-US`.
 *
 * @param {string} [lang] - defaults to `navigator.language`; accept explicit value for testing
 * @returns {Locale}
 */
export function localeFromNavigator(lang = typeof navigator !== 'undefined' ? navigator.language : 'en-US') {
  return lang === 'pt-BR' || lang.startsWith('pt') ? 'pt-BR' : 'en-US';
}

const LOCALE_PREF_KEY = 'lean:locale';

/** @returns {Storage | null} */
function ls() {
  try {
    return typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function'
      ? localStorage
      : null;
  } catch {
    return null;
  }
}

/**
 * Persist the user's explicit locale choice so all apps on the domain can read it.
 * Called whenever the user switches language (URL toggle or direct navigation to /pt).
 * @param {Locale} locale
 */
export function saveLocalePreference(locale) {
  ls()?.setItem(LOCALE_PREF_KEY, locale);
}

/**
 * Read the persisted locale preference. Returns null if never set or unavailable.
 * @returns {Locale | null}
 */
export function loadLocalePreference() {
  const val = ls()?.getItem(LOCALE_PREF_KEY);
  return val === 'pt-BR' || val === 'en-US' ? val : null;
}

/**
 * Create a synchronously initialized i18next instance.
 * Resources are provided inline so init is always sync regardless of initAsync.
 *
 * @param {{
 *   locale: Locale,
 *   catalog: Record<Locale, Record<string, string>>
 * }} opts
 *   `catalog` is a flat key → string map per locale (dots are literal, not nesting).
 *   Merge sharedCatalog + app-specific keys before passing in.
 * @returns {I18nInstance}
 */
export function createI18n({ locale, catalog }) {
  const instance = i18next.createInstance(
    {
      lng: locale,
      fallbackLng: 'en-US',
      defaultNS: 'common',
      resources: {
        'en-US': { common: catalog['en-US'] ?? {} },
        'pt-BR': { common: catalog['pt-BR'] ?? {} },
      },
      keySeparator: false,
      nsSeparator: ':',
      interpolation: { escapeValue: false },
    },
    () => { /* callback required to trigger synchronous init in createInstance */ },
  );

  return {
    locale,
    t(key) {
      const result = instance.t(key);
      return typeof result === 'string' ? result : key;
    },
  };
}
