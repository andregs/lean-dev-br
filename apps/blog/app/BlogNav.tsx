'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import i18nextLib from 'i18next';
import { I18nextProvider, initReactI18next, useTranslation } from 'react-i18next';
import { createFlagClient, type FlagsJson } from '@lean-dev-br/flags';
import { saveLocalePreference } from '@lean-dev-br/i18n';
import { BASE_OPTIONS } from '../lib/i18n';
import type { Locale } from '../lib/posts';

interface Props {
  locale: Locale;
  /** Canonical EN slug — enables post-level toggle link. */
  slug?: string;
}

function Nav({ locale, slug }: Props) {
  const { t } = useTranslation('common');
  const [showToggle, setShowToggle] = useState(false);

  useEffect(() => {
    void fetch('/flags.json')
      .then((r) => r.json() as Promise<FlagsJson>)
      .then((json) => createFlagClient(json))
      .then((client) => { setShowToggle(client.getBooleanValue('lang-toggle', false)); })
      .catch(() => { /* ignore: toggle stays hidden on flags fetch failure */ });
  }, []);

  const targetLocale: Locale = locale === 'pt-BR' ? 'en-US' : 'pt-BR';
  // Full absolute href — locale switch crosses root layouts → full page reload.
  const toggleHref =
    locale === 'pt-BR'
      ? slug
        ? `/blog/${slug}/`
        : '/blog/'
      : slug
        ? `/blog/pt-BR/${slug}/`
        : '/blog/pt-BR/';

  return (
    <nav className="site-nav">
      <div className="nav-inner">
        {/* Raw anchor: bypasses basePath so `/` hits the apex homepage, not `/blog`. */}
        <a className="nav-logo" href="/" aria-label="lean.dev.br — home">
          <svg className="brand-mark" viewBox="0 0 112 22" role="img" aria-label="lean::dev">
            <use href="/blog/logo.svg#brand-mark" />
          </svg>
        </a>
        <ul className="nav-links">
          <li>
            <Link href="/">{t('nav.blog')}</Link>
          </li>
          <li>
            <a href="/labs">{t('nav.labs')}</a>
          </li>
          <li>
            <a href="/contact">{t('nav.contact')}</a>
          </li>
          {showToggle && (
            <li>
              <a
                href={toggleHref}
                aria-label={t('lang.toggle.label')}
                onClick={() => { saveLocalePreference(targetLocale); }}
              >
                {t('lang.toggle')}
              </a>
            </li>
          )}
        </ul>
      </div>
    </nav>
  );
}

function i18nForLocale(locale: Locale) {
  const instance = i18nextLib.createInstance();
  void instance.use(initReactI18next).init({ ...BASE_OPTIONS, lng: locale });
  return instance;
}

export function BlogNav({ locale, slug }: Props) {
  const i18n = useMemo(() => i18nForLocale(locale), [locale]);
  return (
    <I18nextProvider i18n={i18n}>
      <Nav locale={locale} slug={slug} />
    </I18nextProvider>
  );
}
