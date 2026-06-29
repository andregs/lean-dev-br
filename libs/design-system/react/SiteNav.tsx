'use client';

import { useTranslation } from 'react-i18next';
import { saveLocalePreference } from '@lean-dev-br/i18n';

interface Props {
  logoUrl: string;
  onLocaleToggle?: (targetLocale: string) => void;
  children?: React.ReactNode;
}

export function SiteNav({ logoUrl, onLocaleToggle, children }: Props) {
  const { t, i18n } = useTranslation('common');
  const targetLocale = i18n.language === 'pt-BR' ? 'en-US' : 'pt-BR';

  function handleLocaleToggle() {
    saveLocalePreference(targetLocale);
    if (onLocaleToggle) {
      onLocaleToggle(targetLocale);
    } else {
      void i18n.changeLanguage(targetLocale);
    }
  }

  return (
    <nav className="site-nav">
      <div className="nav-inner">
        <a className="nav-logo" href="/" aria-label="lean.dev.br — home">
          <svg className="brand-mark" viewBox="0 0 112 22" role="img" aria-label="lean::dev">
            <use href={logoUrl} />
          </svg>
        </a>
        <ul className="nav-links">
          <li>
            <a href="/blog/">{t('nav.blog')}</a>
          </li>
          <li>
            <a href="/labs">{t('nav.labs')}</a>
          </li>
          <li>
            <a href="/contact">{t('nav.contact')}</a>
          </li>
          {children}
          <li>
            <button
              className="lang-toggle"
              aria-label={t('lang.toggle.label')}
              title={t('lang.toggle.label')}
              onClick={handleLocaleToggle}
            >
              {t('lang.toggle')}
            </button>
          </li>
        </ul>
      </div>
    </nav>
  );
}
