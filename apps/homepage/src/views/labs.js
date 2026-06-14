// @ts-check
import { setHTML } from '../trusted-types.js';

/**
 * @param {HTMLElement} root
 */
export function renderLabs(root) {
  root.className = 'labs';
  setHTML(
    root,
    `<div class="labs-inner">
      <h1>Labs</h1>
      <hr class="rule" />
      <p class="description">Demos and experiments.</p>
      <ul class="labs-grid">
        <li class="lab-card">
          <a href="/todo/" class="lab-card-link">
            <div class="lab-card-header">
              <h2 class="lab-card-title">Todo</h2>
            </div>
            <p class="lab-card-desc">Local-first, E2E-encrypted. WebAuthn PRF key derivation, Yjs CRDT, AES-GCM relay sync.</p>
          </a>
        </li>
      </ul>
    </div>`,
  );
}
