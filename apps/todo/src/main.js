// @ts-check
import './styles.css';
import { SyncedPasskeyKeyProvider } from './key-provider.js';
import { renderNotebook, renderSetup, renderUnlocking, renderUnlockError } from './ui.js';

const app = /** @type {HTMLElement} */ (document.getElementById('app'));

async function boot() {
  const provider = SyncedPasskeyKeyProvider.load();

  if (!provider) {
    const session = await renderSetup(app);
    await renderNotebook(app, session);
    return;
  }

  renderUnlocking(app);
  try {
    const session = await provider.resolve();
    await renderNotebook(app, session);
  } catch {
    renderUnlockError(app, provider);
  }
}

boot().catch(console.error);
