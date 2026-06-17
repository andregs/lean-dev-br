export declare const SUPPORTED_LOCALES: readonly ['en-US', 'pt-BR'];
export type Locale = 'en-US' | 'pt-BR';

export declare const sharedCatalog: Record<Locale, Record<string, string>>;

export declare function localeFromPath(pathname: string): Locale;

export declare function localeFromNavigator(lang?: string): Locale;

export declare function saveLocalePreference(locale: Locale): void;
export declare function loadLocalePreference(): Locale | null;

export interface I18nInstance {
  t(key: string): string;
  locale: Locale;
}

export declare function createI18n(opts: {
  locale: Locale;
  catalog: Record<Locale, Record<string, string>>;
}): I18nInstance;
