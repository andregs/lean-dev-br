// @ts-check
/** @import { I18nInstance, Locale } from '@lean-dev-br/i18n' */

/**
 * Wire or re-wire the top-nav DOM elements.
 * Safe to call on every render — the toggle uses `.onclick` so handlers
 * replace rather than accumulate.
 *
 * Markup contract (same across all apps):
 *   nav.site-nav > .nav-inner > ul.nav-links > li > [data-nav-key] | [data-lang-toggle]
 *
 * @param {object} opts
 * @param {I18nInstance} opts.i18n
 * @param {string} [opts.localePrefix]  path prefix for nav links, e.g. '/pt-BR' when showing Portuguese; '' otherwise
 * @param {(newLocale: Locale) => void} [opts.onToggle]
 */
export function initNav({ i18n, localePrefix = '', onToggle }) {
  const navBlog = document.querySelector('[data-nav-key="blog"]');
  const navLabs = document.querySelector('[data-nav-key="labs"]');
  const navContact = document.querySelector('[data-nav-key="contact"]');

  if (navBlog instanceof HTMLElement) navBlog.textContent = i18n.t('nav.blog');
  if (navLabs instanceof HTMLAnchorElement) {
    navLabs.textContent = i18n.t('nav.labs');
    navLabs.href = `${localePrefix}/labs`;
  }
  if (navContact instanceof HTMLAnchorElement) {
    navContact.textContent = i18n.t('nav.contact');
    navContact.href = `${localePrefix}/contact`;
  }

  const toggle = document.querySelector('[data-lang-toggle]');
  if (!(toggle instanceof HTMLElement)) return;

  toggle.textContent = i18n.t('lang.toggle');
  toggle.setAttribute('aria-label', i18n.t('lang.toggle.label'));
  toggle.setAttribute('title', i18n.t('lang.toggle.label'));
  toggle.onclick = onToggle ? () => onToggle(i18n.locale === 'pt-BR' ? 'en-US' : 'pt-BR') : null;
}
