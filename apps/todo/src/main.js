// @ts-check
/** @import { Locale } from '@lean-dev-br/i18n' */
/** @import { FlagClient } from '@lean-dev-br/flags' */
import './styles.css';
import { createFlagClient } from '@lean-dev-br/flags';
import { initObservability } from '@lean-dev-br/faro';
import { initNav } from '@lean-dev-br/design-system';
import { createI18n, saveLocalePreference, sharedCatalog } from '@lean-dev-br/i18n';
import { SyncedPasskeyKeyProvider } from './key-provider.js';
import { renderNotebook, renderSetup, renderUnlocking, renderUnlockError } from './ui.js';
import enUS from './locales/en-US.json';
import ptBR from './locales/pt-BR.json';

const app = /** @type {HTMLElement} */ (document.getElementById('app'));

// Same value ui.js reads independently for the relay sync client.
const RELAY_URL = import.meta.env.VITE_RELAY_URL ?? 'http://localhost:8080';

/**
 * No routing (single static screen, DOM-only re-renders) — nothing to track
 * via trackNavigation. propagateTraceHeaderCorsUrls carries the W3C trace
 * context to relay-service, which is cross-origin (Cloud Run's own domain) —
 * Faro doesn't send it cross-origin by default.
 * @param {FlagClient} flags
 */
function bootObservability(flags) {
  initObservability(flags, {
    appName: 'todo',
    version: import.meta.env.VITE_APP_VERSION ?? 'dev',
    environment: import.meta.env.MODE,
    extraConfig: { propagateTraceHeaderCorsUrls: [RELAY_URL] },
  });
}

fetch('/flags.json')
  .then((r) => r.json())
  .then((flagsJson) => createFlagClient(flagsJson))
  .then((flags) => bootObservability(flags))
  .catch(() => {
    /* stay dark on any failure — no flags signal means no Faro */
  });

/** @type {Record<Locale, Record<string, string>>} */
const catalog = {
  'en-US': { ...sharedCatalog['en-US'], ...enUS },
  'pt-BR': { ...sharedCatalog['pt-BR'], ...ptBR },
};

// Module-level state so locale toggle can re-render without a full page reload.
/** @type {'notebook' | 'setup' | 'unlocking' | 'error' | null} */
let _screen = null;
let _session = /** @type {any} */ (null);
let _provider = /** @type {any} */ (null);

/** @param {import('@lean-dev-br/i18n').I18nInstance} i18n */
function syncNav(i18n) {
  document.documentElement.lang = i18n.locale === 'pt-BR' ? 'pt-BR' : 'en';
  initNav({
    i18n,
    onToggle: (newLocale) => {
      saveLocalePreference(newLocale);
      if (_screen === 'setup') {
        // Setup is an async flow awaiting a button click — safest to reload.
        window.location.reload();
        return;
      }
      const newI18n = makeI18n();
      syncNav(newI18n);
      if (_screen === 'notebook') renderNotebook(app, _session, newI18n);
      else if (_screen === 'unlocking') renderUnlocking(app, newI18n);
      else if (_screen === 'error') renderUnlockError(app, _provider, newI18n);
    },
  });
}

function makeI18n() {
  return createI18n({ catalog });
}

async function boot() {
  const i18n = makeI18n();
  syncNav(i18n);

  const cached = await SyncedPasskeyKeyProvider.restoreSession();
  if (cached) {
    _screen = 'notebook';
    _session = cached;
    renderNotebook(app, cached, i18n);
    return;
  }

  const provider = SyncedPasskeyKeyProvider.load();

  if (!provider) {
    _screen = 'setup';
    const session = await renderSetup(app, i18n);
    _screen = 'notebook';
    _session = session;
    renderNotebook(app, session, i18n);
    return;
  }

  _screen = 'unlocking';
  _provider = provider;
  renderUnlocking(app, i18n);
  try {
    const session = await provider.resolve();
    _screen = 'notebook';
    _session = session;
    renderNotebook(app, session, i18n);
  } catch {
    _screen = 'error';
    renderUnlockError(app, provider, i18n);
  }
}

boot().catch(console.error);
