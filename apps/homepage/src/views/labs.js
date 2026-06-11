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
      <p class="description">Demos and experiments.</p>
      <ul class="labs-grid">
        <li class="lab-card">
          <a href="/todo/" class="lab-card-link">
            <h2 class="lab-card-title">Todo</h2>
            <p class="lab-card-desc">Local-first, end-to-end encrypted. WebAuthn PRF key derivation, AES-GCM op log, WebRTC P2P sync.</p>
          </a>
        </li>
      </ul>
    </div>`,
  );
}
