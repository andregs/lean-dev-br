'use client';

import i18nextLib from 'i18next';
import { useMemo } from 'react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { SiteNav } from '@lean-dev-br/design-system/react';
import { BASE_OPTIONS } from '../lib/i18n';
import type { Locale } from '../lib/posts';

interface Props {
  locale: Locale;
  slug?: string;
}

function i18nForLocale(locale: Locale) {
  const instance = i18nextLib.createInstance();
  void instance.use(initReactI18next).init({ ...BASE_OPTIONS, lng: locale });
  return instance;
}

export function BlogNav({ locale, slug }: Props) {
  const i18n = useMemo(() => i18nForLocale(locale), [locale]);

  const toggleHref =
    locale === 'pt-BR'
      ? slug
        ? `/blog/${slug}/`
        : '/blog/'
      : slug
        ? `/blog/pt-BR/${slug}/`
        : '/blog/pt-BR/';

  return (
    <I18nextProvider i18n={i18n}>
      <SiteNav
        logoUrl="/blog/logo.svg#brand-mark"
        onLocaleToggle={() => {
          window.location.href = toggleHref;
        }}
      />
    </I18nextProvider>
  );
}
