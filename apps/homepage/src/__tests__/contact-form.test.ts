/* eslint-disable @typescript-eslint/no-non-null-assertion */
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// contact-form.js reads VITE_RECAPTCHA_SITE_KEY into a module-level constant.
// vi.resetModules() + dynamic import gives each test a fresh module so the env
// stub is in place before the constant is captured.

function makeForm() {
  document.body.innerHTML = `
    <form class="contact-form">
      <input name="email" type="email" />
      <textarea name="message" required></textarea>
      <button class="submit" type="submit">Send</button>
      <p class="form-status" role="status"></p>
    </form>
  `;
  return {
    form: document.querySelector<HTMLFormElement>('.contact-form')!,
    status: document.querySelector<HTMLElement>('.form-status')!,
  };
}

describe('contact form', () => {
  let form: HTMLFormElement;
  let status: HTMLElement;
  let initContactForm: (form: HTMLFormElement) => void;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv('VITE_RECAPTCHA_SITE_KEY', 'test-key');

    // Auto-fire the reCAPTCHA script load event so loadRecaptcha() resolves in jsdom.
    vi.spyOn(document.head, 'appendChild').mockImplementation((child) => {
      if (child instanceof HTMLScriptElement) {
        queueMicrotask(() => {
          child.dispatchEvent(new Event('load'));
        });
      }
      return child;
    });

    vi.stubGlobal('grecaptcha', {
      ready: (cb: () => void) => {
        cb();
      },
      execute: vi.fn().mockResolvedValue('test-token'),
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

    ({ initContactForm } = await import('../contact-form.js'));
    ({ form, status } = makeForm());
    initContactForm(form);

    // Let the warm-up loadRecaptcha() settle.
    await new Promise<void>((r) => {
      queueMicrotask(r);
    });
    await Promise.resolve();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    document.body.innerHTML = '';
  });

  it('shows error status when required message is empty', () => {
    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
    expect(status.dataset.state).toBe('error');
  });

  it('shows success status after valid submission', async () => {
    form.querySelector<HTMLTextAreaElement>('[name="message"]')!.value = 'Hello!';
    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => {
      expect(status.dataset.state).toBe('ok');
    });
    expect(status.textContent).toMatch(/thanks/i);
  });

  it('shows error status when the API request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    form.querySelector<HTMLTextAreaElement>('[name="message"]')!.value = 'Hello!';
    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => {
      expect(status.dataset.state).toBe('error');
    });
    expect(status.textContent).toMatch(/something went wrong/i);
  });
});

describe('contact form — reCAPTCHA loader failures', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    document.body.innerHTML = '';
  });

  it('shows error when VITE_RECAPTCHA_SITE_KEY is absent', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_RECAPTCHA_SITE_KEY', '');
    const { initContactForm } = await import('../contact-form.js');
    const { form, status } = makeForm();
    initContactForm(form);
    await new Promise<void>((r) => { queueMicrotask(r); });

    form.querySelector<HTMLTextAreaElement>('[name="message"]')!.value = 'Hello!';
    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => { expect(status.dataset.state).toBe('error'); });
  });

  it('shows error when the reCAPTCHA script fails to load', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_RECAPTCHA_SITE_KEY', 'test-key');
    vi.spyOn(document.head, 'appendChild').mockImplementation((child) => {
      if (child instanceof HTMLScriptElement) {
        queueMicrotask(() => child.dispatchEvent(new Event('error')));
      }
      return child;
    });
    const { initContactForm } = await import('../contact-form.js');
    const { form, status } = makeForm();
    initContactForm(form);
    // Let the script error event fire and the rejection propagate.
    await new Promise<void>((r) => { queueMicrotask(r); });
    await Promise.resolve();

    form.querySelector<HTMLTextAreaElement>('[name="message"]')!.value = 'Hello!';
    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => { expect(status.dataset.state).toBe('error'); });
  });
});
