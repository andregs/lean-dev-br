// @ts-check
/** @import { FlagClient } from '@lean-dev-br/flags' */
/** @import { I18nInstance, Locale } from '@lean-dev-br/i18n' */
import './rum.js';
import './observer.js';
import { createFlagClient, loadStoredOverrides, parseOverrides } from '@lean-dev-br/flags';
import { createI18n, localeFromPath, sharedCatalog } from '@lean-dev-br/i18n';
import { renderHome } from './views/home.js';
import { renderContact } from './views/contact.js';
import { renderLabs } from './views/labs.js';
import { renderNotFound } from './views/not-found.js';
import enUS from './locales/en-US.json';
import ptBR from './locales/pt-BR.json';

/** @type {Record<string, (root: HTMLElement, ctx: { i18n: I18nInstance, flags: FlagClient }) => void>} */
const routes = {
  '/': renderHome,
  '/contact': renderContact,
  '/labs': renderLabs,
};

/** @type {Record<Locale, Record<string, string>>} */
const catalog = {
  'en-US': { ...sharedCatalog['en-US'], ...enUS },
  'pt-BR': { ...sharedCatalog['pt-BR'], ...ptBR },
};

// --- Flags init (async — fetch before first render) ---
const flagsUrl = import.meta.env.VITE_FLAGS_URL ?? '/flags.json';
let flagsJson;
try {
  flagsJson = await fetch(flagsUrl).then((r) => r.json());
} catch {
  flagsJson = { flags: {} };
}
const flags = createFlagClient(flagsJson, {
  overrides: { ...loadStoredOverrides(), ...parseOverrides() },
});

// --- Helpers ---

/** Strip the /pt locale prefix for canonical route matching.
 * @param {string} pathname
 * @returns {string}
 */
function canonicalPath(pathname) {
  if (pathname === '/pt') return '/';
  if (pathname.startsWith('/pt/')) return pathname.slice(3);
  return pathname;
}

/**
 * Update nav link text + hrefs and the language-toggle label to match `i18n`.
 * @param {I18nInstance} i18n
 */
function updateNav(i18n) {
  const locale = i18n.locale;
  const prefix = locale === 'pt-BR' ? '/pt' : '';

  const navBlog = document.querySelector('[data-nav-key="blog"]');
  const navLabs = document.querySelector('[data-nav-key="labs"]');
  const navContact = document.querySelector('[data-nav-key="contact"]');
  if (navBlog instanceof HTMLElement) navBlog.textContent = i18n.t('nav.blog');
  if (navLabs instanceof HTMLAnchorElement) {
    navLabs.textContent = i18n.t('nav.labs');
    navLabs.href = `${prefix}/labs`;
  }
  if (navContact instanceof HTMLAnchorElement) {
    navContact.textContent = i18n.t('nav.contact');
    navContact.href = `${prefix}/contact`;
  }

  const toggle = document.querySelector('[data-lang-toggle]');
  if (toggle instanceof HTMLElement) {
    toggle.textContent = i18n.t('lang.toggle');
    toggle.setAttribute('aria-label', i18n.t('lang.toggle.label'));
  }
}

const ORIGIN = 'https://lean.dev.br';

/**
 * Update <link rel="alternate" hreflang> tags in <head> to reflect the current route.
 * Allows search engines to discover the pt-BR equivalent for each page.
 * @param {string} pathname  current window.location.pathname
 */
function updateHreflang(pathname) {
  const canon = canonicalPath(pathname);
  const enHref = ORIGIN + canon;
  const ptHref = ORIGIN + '/pt' + (canon === '/' ? '' : canon);

  /** @param {string} hreflang @param {string} href */
  function setLink(hreflang, href) {
    let el = document.querySelector(`link[hreflang="${hreflang}"]`);
    if (!el) {
      el = document.createElement('link');
      el.setAttribute('rel', 'alternate');
      el.setAttribute('hreflang', hreflang);
      document.head.appendChild(el);
    }
    el.setAttribute('href', href);
  }

  setLink('en', enHref);
  setLink('pt-BR', ptHref);
  setLink('x-default', enHref);
}

// --- Render ---

function render() {
  const app = document.querySelector('#app');
  if (!(app instanceof HTMLElement)) return;

  const path = window.location.pathname;
  const i18n = createI18n({ locale: localeFromPath(path), catalog });

  document.documentElement.lang = i18n.locale === 'pt-BR' ? 'pt-BR' : 'en';
  document.body.classList.toggle('route-contact', canonicalPath(path) === '/contact');
  updateHreflang(path);

  const toggle = document.querySelector('[data-lang-toggle]');
  if (toggle instanceof HTMLElement) {
    toggle.hidden = !flags.getBooleanValue('lang-toggle', false);
  }
  updateNav(i18n);

  const view = routes[canonicalPath(path)] ?? renderNotFound;
  view(app, { i18n, flags });
}

// --- Navigation ---

/** @param {MouseEvent} event */
function onClick(event) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) return;
  const target = event.target;
  const anchor = target instanceof Element ? target.closest('a') : null;
  if (!anchor) return;

  const href = anchor.getAttribute('href');
  if (href === null || anchor.target === '_blank') return;

  const url = new URL(href, window.location.href);
  if (url.origin !== window.location.origin) return;
  if (!(canonicalPath(url.pathname) in routes)) return;

  event.preventDefault();
  if (url.pathname !== window.location.pathname) {
    window.history.pushState(null, '', url.pathname);
    render();
    window.scrollTo(0, 0);
  }
}

/** Toggle between /pt and bare paths without a page reload. */
function onLangToggle() {
  const path = window.location.pathname;
  const locale = localeFromPath(path);
  const next =
    locale === 'pt-BR'
      ? path === '/pt'
        ? '/'
        : path.slice(3)
      : path === '/'
        ? '/pt'
        : '/pt' + path;
  window.history.pushState(null, '', next);
  render();
  window.scrollTo(0, 0);
}

document.addEventListener('click', onClick);
window.addEventListener('popstate', render);
document.querySelector('[data-lang-toggle]')?.addEventListener('click', onLangToggle);

render();
