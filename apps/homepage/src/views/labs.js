// @ts-check
/** @import { I18nInstance } from '@lean-dev-br/i18n' */
/** @import { FlagClient } from '@lean-dev-br/flags' */
import { setHTML } from '../trusted-types.js';

/**
 * @param {HTMLElement} root
 * @param {{ i18n: I18nInstance, flags: FlagClient }} ctx
 */
export function renderLabs(root, { i18n, flags }) {
  root.className = 'labs';
  const showModulith = flags.getBooleanValue('labs-modulith', false);
  setHTML(
    root,
    `<div class="labs-inner">
      <h1>${i18n.t('labs.title')}</h1>
      <hr class="rule" />
      <p class="description">${i18n.t('labs.desc')}</p>
      <ul class="labs-grid">
        <li class="lab-card">
          <a href="/todo/" class="lab-card-link">
            <div class="lab-card-header">
              <h2 class="lab-card-title">${i18n.t('labs.todo.title')}</h2>
            </div>
            <p class="lab-card-desc">${i18n.t('labs.todo.desc')}</p>
          </a>
        </li>
        ${
          showModulith
            ? `<li class="lab-card">
          <a href="/labs/ui-modulith/" class="lab-card-link">
            <div class="lab-card-header">
              <h2 class="lab-card-title">${i18n.t('labs.modulith.title')}</h2>
            </div>
            <p class="lab-card-desc">${i18n.t('labs.modulith.desc')}</p>
          </a>
        </li>`
            : ''
        }
      </ul>
    </div>`,
  );
}
