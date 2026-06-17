// @ts-check
/** @import { I18nInstance } from '@lean-dev-br/i18n' */
import { policy } from './trusted-types.js';

const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
const RECAPTCHA_SRC = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`;

/** @type {Promise<void> | null} */
let recaptchaLoader = null;

/** Lazily inject the reCAPTCHA v3 script exactly once. */
function loadRecaptcha() {
  recaptchaLoader ??= new Promise((resolve, reject) => {
    if (!SITE_KEY) {
      reject(new Error('Missing reCAPTCHA site key'));
      return;
    }
    const script = document.createElement('script');
    script.src = /** @type {any} */ (policy.createScriptURL(RECAPTCHA_SRC));
    script.async = true;
    script.defer = true;
    script.addEventListener('load', () => {
      resolve();
    });
    script.addEventListener('error', () => {
      reject(new Error('Failed to load reCAPTCHA'));
    });
    document.head.appendChild(script);
  });
  return recaptchaLoader;
}

/** Resolve a fresh reCAPTCHA token for the contact action. */
async function getToken() {
  await loadRecaptcha();
  const grecaptcha = window.grecaptcha;
  if (!grecaptcha) throw new Error('reCAPTCHA unavailable');
  await new Promise((resolve) => {
    grecaptcha.ready(() => {
      resolve(undefined);
    });
  });
  return grecaptcha.execute(SITE_KEY, { action: 'contact' });
}

/**
 * @param {Element | null} el
 * @param {'pending' | 'ok' | 'error'} state
 * @param {string} message
 */
function setStatus(el, state, message) {
  if (!(el instanceof HTMLElement)) return;
  el.dataset.state = state;
  el.textContent = message;
}

/**
 * @param {Element | null} button
 * @param {boolean} busy
 */
function setBusy(button, busy) {
  if (button instanceof HTMLButtonElement) button.disabled = busy;
}

/**
 * Wire submit handling onto the contact form.
 * @param {HTMLFormElement} form
 * @param {{ i18n: I18nInstance }} ctx
 */
export function initContactForm(form, { i18n }) {
  const status = form.querySelector('.form-status');
  const button = form.querySelector('button[type="submit"]');

  // Warm up reCAPTCHA as soon as the form is shown; ignore preload failures.
  void loadRecaptcha().catch(() => undefined);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void submit();
  });

  async function submit() {
    const data = new FormData(form);
    const payload = {
      message: String(data.get('message') ?? ''),
      email: String(data.get('email') ?? ''),
    };

    if (!form.checkValidity()) {
      form.reportValidity();
      setStatus(status, 'error', i18n.t('contact.status.error.validation'));
      return;
    }

    setBusy(button, true);
    setStatus(status, 'pending', i18n.t('contact.status.pending'));

    try {
      const token = await getToken();
      const body = JSON.stringify({
        message: payload.message,
        email: payload.email.trim() || undefined,
        token,
        locale: i18n.locale,
      });
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      });
      if (!res.ok) throw new Error(`Request failed: ${String(res.status)}`);
      form.reset();
      setStatus(status, 'ok', i18n.t('contact.status.ok'));
    } catch {
      setStatus(status, 'error', i18n.t('contact.status.error.generic'));
    } finally {
      setBusy(button, false);
    }
  }
}
