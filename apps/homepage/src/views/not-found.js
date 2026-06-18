// @ts-check
/** @import { I18nInstance } from '@lean-dev-br/i18n' */
import { setHTML } from '../trusted-types.js';

/**
 * @param {HTMLElement} root
 * @param {{ i18n: I18nInstance }} ctx
 */
export function renderNotFound(root, { i18n }) {
  root.className = 'not-found';
  setHTML(
    root,
    `<div class="not-found-inner">
      <h1>404</h1>
      <p>This page doesn't exist.</p>
      <a class="back-link" href="${i18n.locale === 'pt-BR' ? '/pt-BR' : '/'}">${i18n.t('not-found.back')}</a>
    </div>`,
  );
}
