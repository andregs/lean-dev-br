// Server-safe i18n utilities (no react-i18next import — safe to use in RSC).
// Client components that need <I18nextProvider> should import BASE_OPTIONS
// and wire initReactI18next themselves (see BlogNav.tsx).

import i18nextLib from 'i18next';
import { sharedCatalog, SUPPORTED_LOCALES } from '@lean-dev-br/i18n';
import type { Locale } from './posts';
import enUS from '../src/locales/en-US.json';
import ptBR from '../src/locales/pt-BR.json';

export const BASE_OPTIONS = {
  supportedLngs: SUPPORTED_LOCALES as unknown as string[],
  fallbackLng: 'en-US' as const,
  defaultNS: 'common',
  resources: {
    'en-US': { common: { ...sharedCatalog['en-US'], ...enUS } },
    'pt-BR': { common: { ...sharedCatalog['pt-BR'], ...ptBR } },
  },
  keySeparator: false as const,
  nsSeparator: ':',
  interpolation: { escapeValue: false },
};

/**
 * A plain t() function for server components — no React context needed.
 * Interpolation: t('blog.tags.heading', { tag: 'aws' }) → '#aws'
 */
export function getT(locale: Locale): (key: string, opts?: Record<string, string>) => string {
  const instance = i18nextLib.createInstance();
  void instance.init({ ...BASE_OPTIONS, lng: locale });
  return (key, opts) => {
    const result = instance.t(key, opts);
    return typeof result === 'string' ? result : key;
  };
}
