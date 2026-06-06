// @ts-check
import { initContactForm } from '../contact-form.js';

/**
 * Render the contact form view, then wire up submission behaviour.
 * @param {HTMLElement} root
 */
export function renderContact(root) {
  root.className = 'contact';
  root.innerHTML = `
    <div class="contact-inner">
      <h1>Contact</h1>
      <hr class="rule" />
      <p class="description">
        Drop me a message. Leave your email if you want a reply.
      </p>

      <form class="contact-form">
        <label class="field">
          <span class="field-label">Your email <span class="optional">(optional)</span></span>
          <input name="email" type="email" maxlength="254" autocomplete="email" />
        </label>

        <label class="field">
          <span class="field-label">Message <span class="req" aria-hidden="true">*</span></span>
          <textarea name="message" required rows="7" maxlength="5000"></textarea>
        </label>

        <button class="submit" type="submit">Send message</button>

        <p class="form-status" role="status" aria-live="polite"></p>
      </form>
    </div>
  `;

  const form = root.querySelector('.contact-form');
  if (form instanceof HTMLFormElement) initContactForm(form);
}
