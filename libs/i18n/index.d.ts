export declare const SUPPORTED_LOCALES: readonly ['en-US', 'pt-BR'];
export type Locale = 'en-US' | 'pt-BR';

export declare const sharedCatalog: Record<Locale, Record<string, string>>;

export declare function localeFromPath(pathname: string): Locale;

export declare function saveLocalePreference(locale: Locale): void;

export interface I18nInstance {
  t(key: string): string;
  locale: Locale;
}

export declare function createI18n(opts: {
  catalog: Record<Locale, Record<string, string>>;
  locale?: Locale;
}): I18nInstance;
