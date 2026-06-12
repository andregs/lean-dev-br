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
        <li class="lab-card lab-card--coming-soon">
          <a href="/todo/" class="lab-card-link">
            <div class="lab-card-header">
              <h2 class="lab-card-title">Todo</h2>
              <span class="lab-card-badge">Coming soon</span>
            </div>
            <p class="lab-card-desc">Local-first, end-to-end encrypted. WebAuthn PRF key derivation, AES-GCM op log, WebRTC P2P sync.</p>
          </a>
        </li>
      </ul>
    </div>`,
  );

  const todoLink = root.querySelector('.lab-card--coming-soon .lab-card-link');
  todoLink?.addEventListener('click', (e) => {
    e.preventDefault();
    const badge = /** @type {HTMLElement | null} */ (root.querySelector('.lab-card-badge'));
    if (badge) {
      badge.classList.add('lab-card-badge--pulse');
      badge.addEventListener(
        'animationend',
        () => badge.classList.remove('lab-card-badge--pulse'),
        { once: true },
      );
    }
  });
}
