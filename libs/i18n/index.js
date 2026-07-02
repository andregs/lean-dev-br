// @ts-check
/** @import { Locale, I18nInstance } from './index.js' */
import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

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
    'lang.toggle': 'PT',
    'lang.toggle.label': 'Switch to Portuguese',
  },
  'pt-BR': {
    'nav.blog': 'Blog',
    'nav.labs': 'Labs',
    'nav.contact': 'Contato',
    'lang.toggle': 'EN',
    'lang.toggle.label': 'Mudar para inglês',
  },
};

/**
 * Derive the active locale from the URL pathname.
 * `/pt-BR` and `/pt-BR/*` → `pt-BR`, everything else → `en-US`.
 *
 * @param {string} pathname
 * @returns {Locale}
 */
export function localeFromPath(pathname) {
  return pathname === '/pt-BR' || pathname.startsWith('/pt-BR/') ? 'pt-BR' : 'en-US';
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
 * Call on toggle click or when a /pt-BR URL is visited via direct link.
 * @param {Locale} locale
 */
export function saveLocalePreference(locale) {
  ls()?.setItem(LOCALE_PREF_KEY, locale);
}

/**
 * Detect preferred locale for browser SPAs (no URL-prefix routing).
 * Priority: localStorage 'lean:locale' → navigator.language → 'en-US'.
 * @returns {Locale}
 */
export function detectLocale() {
  const stored = ls()?.getItem(LOCALE_PREF_KEY);
  if (stored && /** @type {readonly string[]} */ (SUPPORTED_LOCALES).includes(stored)) {
    return /** @type {Locale} */ (stored);
  }
  if (typeof navigator !== 'undefined' && navigator.language?.startsWith('pt')) return 'pt-BR';
  return 'en-US';
}

/**
 * Build i18next init options shared across React apps.
 * Merges sharedCatalog with app-specific keys; ensures identical
 * keySeparator / nsSeparator / fallbackLng across all consumers.
 *
 * Usage (SPA): `i18n.init({ lng: detectLocale(), ...createI18nOptions(appCatalog) })`
 * Usage (SSR): `i18n.init({ lng: locale, ...createI18nOptions(appCatalog) })`
 *
 * @param {{ 'en-US': Record<string, string>, 'pt-BR': Record<string, string> }} appCatalog
 * @returns {import('i18next').InitOptions}
 */
export function createI18nOptions(appCatalog) {
  return {
    supportedLngs: [...SUPPORTED_LOCALES],
    fallbackLng: 'en-US',
    defaultNS: 'common',
    resources: {
      'en-US': { common: { ...sharedCatalog['en-US'], ...appCatalog['en-US'] } },
      'pt-BR': { common: { ...sharedCatalog['pt-BR'], ...appCatalog['pt-BR'] } },
    },
    keySeparator: false,
    nsSeparator: ':',
    interpolation: { escapeValue: false },
  };
}

// ---------------------------------------------------------------------------
// createI18n
// ---------------------------------------------------------------------------

/**
 * Create a synchronously initialized i18next instance.
 *
 * When `locale` is provided the detector is skipped and that locale is used
 * directly (useful when a feature flag forces en-US).
 *
 * Without `locale`, the language detector resolves via:
 *   /pt-BR URL → localStorage (lean:locale) → navigator.language → en-US
 *
 * @param {{
 *   catalog: Record<Locale, Record<string, string>>,
 *   locale?: Locale
 * }} opts
 * @returns {I18nInstance}
 */
export function createI18n({ locale, catalog }) {
  const instance = i18next.createInstance();

  /** @type {import('i18next').InitOptions} */
  const baseOpts = {
    fallbackLng: 'en-US',
    defaultNS: 'common',
    resources: {
      'en-US': { common: catalog['en-US'] ?? {} },
      'pt-BR': { common: catalog['pt-BR'] ?? {} },
    },
    keySeparator: false,
    nsSeparator: ':',
    interpolation: { escapeValue: false },
  };

  if (locale) {
    instance.init({ ...baseOpts, lng: locale }, () => {
      /* sync init */
    });
  } else {
    // Path detection: reads first segment (e.g. /pt-BR/contact → 'pt-BR').
    // Non-locale segments like 'contact' are not in supportedLngs, so i18next
    // discards them and falls through to the next detector (localStorage, then
    // navigator). convertDetectedLanguage maps pt/* → pt-BR.
    instance.use(LanguageDetector).init(
      {
        ...baseOpts,
        supportedLngs: ['en-US', 'pt-BR'],
        detection: {
          order: ['path', 'localStorage', 'navigator'],
          lookupFromPathIndex: 0,
          lookupLocalStorage: LOCALE_PREF_KEY,
          convertDetectedLanguage: (/** @type {string} */ l) => (l.startsWith('pt') ? 'pt-BR' : l),
          caches: ['localStorage'],
        },
      },
      () => {
        /* sync init */
      },
    );
  }

  const detectedLocale = /** @type {Locale} */ (
    SUPPORTED_LOCALES.includes(/** @type {Locale} */ (instance.language))
      ? instance.language
      : 'en-US'
  );

  return {
    locale: locale ?? detectedLocale,
    t(key) {
      const result = instance.t(key);
      return typeof result === 'string' ? result : key;
    },
  };
}
