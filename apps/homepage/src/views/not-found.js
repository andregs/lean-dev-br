// @ts-check
import { setHTML } from '../trusted-types.js';

/**
 * Render a 404 page for unregistered routes.
 * @param {HTMLElement} root
 */
export function renderNotFound(root) {
  root.className = 'not-found';
  setHTML(
    root,
    `<div class="not-found-inner">
      <h1>404</h1>
      <p>This page doesn't exist.</p>
      <a class="back-link" href="/">← Home</a>
    </div>`,
  );
}
