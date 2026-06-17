// @ts-check
/** @import { Locale } from '@lean-dev-br/i18n' */
import './styles.css';
import { createFlagClient, loadStoredOverrides, parseOverrides } from '@lean-dev-br/flags';
import { createI18n, loadLocalePreference, localeFromNavigator } from '@lean-dev-br/i18n';
import { SyncedPasskeyKeyProvider } from './key-provider.js';
import { renderNotebook, renderSetup, renderUnlocking, renderUnlockError } from './ui.js';
import enUS from './locales/en-US.json';
import ptBR from './locales/pt-BR.json';

const app = /** @type {HTMLElement} */ (document.getElementById('app'));

/** @type {Record<Locale, Record<string, string>>} */
const catalog = { 'en-US': enUS, 'pt-BR': ptBR };

async function boot() {
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

  // Locale resolution: explicit saved preference > browser language > en-US.
  // Gated by lang-toggle flag so pt-BR is unreachable until the flag is on.
  const locale = flags.getBooleanValue('lang-toggle', false)
    ? (loadLocalePreference() ?? localeFromNavigator())
    : 'en-US';
  const i18n = createI18n({ locale, catalog });
  document.documentElement.lang = i18n.locale === 'pt-BR' ? 'pt-BR' : 'en';

  const cached = await SyncedPasskeyKeyProvider.restoreSession();
  if (cached) {
    await renderNotebook(app, cached, i18n);
    return;
  }

  const provider = SyncedPasskeyKeyProvider.load();

  if (!provider) {
    const session = await renderSetup(app, i18n);
    await renderNotebook(app, session, i18n);
    return;
  }

  renderUnlocking(app, i18n);
  try {
    const session = await provider.resolve();
    await renderNotebook(app, session, i18n);
  } catch {
    renderUnlockError(app, provider, i18n);
  }
}

boot().catch(console.error);
