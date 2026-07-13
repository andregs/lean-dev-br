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
  const showFederation = flags.getBooleanValue('labs-federation', false);
  const showWanderlust = flags.getBooleanValue('labs-wanderlust', false);
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
        ${
          showFederation
            ? `<li class="lab-card">
          <a href="/labs/federation/" class="lab-card-link">
            <div class="lab-card-header">
              <h2 class="lab-card-title">${i18n.t('labs.federation.title')}</h2>
            </div>
            <p class="lab-card-desc">${i18n.t('labs.federation.desc')}</p>
          </a>
        </li>`
            : ''
        }
        ${
          showWanderlust
            ? `<li class="lab-card">
          <a href="/labs/wanderlust/" class="lab-card-link">
            <div class="lab-card-header">
              <h2 class="lab-card-title">${i18n.t('labs.wanderlust.title')}</h2>
            </div>
            <p class="lab-card-desc">${i18n.t('labs.wanderlust.desc')}</p>
          </a>
        </li>`
            : ''
        }
      </ul>
    </div>`,
  );
}
