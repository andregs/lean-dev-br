// @ts-check
/** @import { FlagClient } from '@lean-dev-br/flags' */
/** @import { I18nInstance } from '@lean-dev-br/i18n' */
import { initContactForm } from '../contact-form.js';
import { setHTML } from '../trusted-types.js';

/**
 * @param {HTMLElement} root
 * @param {{ i18n: I18nInstance, flags: FlagClient }} ctx
 */
export function renderContact(root, { i18n }) {
  root.className = 'contact';
  setHTML(
    root,
    `<div class="contact-inner">
      <h1>${i18n.t('contact.title')}</h1>
      <hr class="rule" />
      <p class="description">${i18n.t('contact.desc')}</p>

      <form class="contact-form">
        <label class="field">
          <span class="field-label">${i18n.t('contact.field.email')} <span class="optional">${i18n.t('contact.field.email.optional')}</span></span>
          <input name="email" type="email" maxlength="254" autocomplete="email" />
        </label>

        <label class="field">
          <span class="field-label">${i18n.t('contact.field.message')} <span class="req" aria-hidden="true">*</span></span>
          <textarea name="message" required rows="7" maxlength="5000"></textarea>
        </label>

        <button class="submit" type="submit">${i18n.t('contact.submit')}</button>

        <p class="form-status" role="status" aria-live="polite"></p>
      </form>
    </div>`,
  );

  const form = root.querySelector('.contact-form');
  if (form instanceof HTMLFormElement) initContactForm(form, { i18n });
}
