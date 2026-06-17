// @ts-check
/** @import { FlagClient } from '@lean-dev-br/flags' */
/** @import { I18nInstance, Locale } from '@lean-dev-br/i18n' */
import { createFlagClient, loadStoredOverrides, parseOverrides } from '@lean-dev-br/flags';
import { initNav } from '@lean-dev-br/design-system';
import { createI18n, saveLocalePreference, sharedCatalog } from '@lean-dev-br/i18n';
import enUS from './locales/en-US.json';
import ptBR from './locales/pt-BR.json';
import './observer.js';
import './rum.js';
import { renderContact } from './views/contact.js';
import { renderHome } from './views/home.js';
import { renderLabs } from './views/labs.js';
import { renderNotFound } from './views/not-found.js';

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

// Kept between renders so onLangToggle knows the current locale without re-reading storage.
/** @type {I18nInstance} */
let currentI18n = createI18n({ locale: 'en-US', catalog });

// --- Helpers ---

/** Strip the /pt-BR locale prefix for canonical route matching.
 * @param {string} pathname
 * @returns {string}
 */
function canonicalPath(pathname) {
  if (pathname === '/pt-BR') return '/';
  if (pathname.startsWith('/pt-BR/')) return pathname.slice(6);
  return pathname;
}

const ORIGIN = 'https://lean.dev.br';

/**
 * Update <link rel="alternate" hreflang> tags in <head> to reflect the current route.
 * @param {string} pathname  current window.location.pathname
 */
function updateHreflang(pathname) {
  const canon = canonicalPath(pathname);
  const enHref = ORIGIN + canon;
  const ptHref = ORIGIN + '/pt-BR' + (canon === '/' ? '' : canon);

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
  // Detector resolves: /pt-BR URL → localStorage (lean:locale) → navigator → en-US
  currentI18n = createI18n({ catalog });

  document.documentElement.lang = currentI18n.locale === 'pt-BR' ? 'pt-BR' : 'en';
  document.body.classList.toggle('route-contact', canonicalPath(path) === '/contact');
  updateHreflang(path);

  initNav({
    flags,
    i18n: currentI18n,
    localePrefix: currentI18n.locale === 'pt-BR' ? '/pt-BR' : '',
    onToggle: (newLocale) => {
      saveLocalePreference(newLocale);
      const cur = window.location.pathname;
      const canon = canonicalPath(cur);
      const next = newLocale === 'pt-BR' ? (canon === '/' ? '/pt-BR' : '/pt-BR' + canon) : canon;
      window.history.pushState(null, '', next);
      render();
      window.scrollTo(0, 0);
    },
  });

  const view = routes[canonicalPath(path)] ?? renderNotFound;
  view(app, { i18n: currentI18n, flags });
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

document.addEventListener('click', onClick);
window.addEventListener('popstate', render);

render();
