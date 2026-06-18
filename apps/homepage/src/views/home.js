// @ts-check
/** @import { I18nInstance } from '@lean-dev-br/i18n' */
import { setHTML } from '../trusted-types.js';

/**
 * @param {HTMLElement} root
 * @param {{ i18n: I18nInstance }} ctx
 */
export function renderHome(root, { i18n }) {
  root.className = 'hero';
  setHTML(
    root,
    `<div class="hero-inner">
      <h1>${i18n.t('hero.title')}</h1>
      <hr class="rule" />
      <p class="description">
        ${i18n.t('hero.desc')}<span class="cursor" aria-hidden="true"></span>
      </p>
    </div>`,
  );
}
