/* eslint-disable @typescript-eslint/no-non-null-assertion */
// @vitest-environment jsdom
import type { I18nInstance } from '@lean-dev-br/i18n';
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

const testI18n: I18nInstance = {
  locale: 'en-US',
  t: (key: string) => {
    const map: Record<string, string> = {
      'contact.status.pending': 'Sending…',
      'contact.status.ok': 'Thanks! Your message is on its way.',
      'contact.status.error.generic': 'Something went wrong. Please try again later.',
      'contact.status.error.validation': 'Please fill in the required fields correctly.',
    };
    return map[key] ?? key;
  },
};

describe('contact form', () => {
  let form: HTMLFormElement;
  let status: HTMLElement;
  let initContactForm: (form: HTMLFormElement, ctx: { i18n: I18nInstance }) => void;

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
    initContactForm(form, { i18n: testI18n });

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

  it('sends locale in the request body', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);
    form.querySelector<HTMLTextAreaElement>('[name="message"]')!.value = 'Hello!';
    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => {
      expect(status.dataset.state).toBe('ok');
    });
    const callArg = mockFetch.mock.calls[0][1] as { body: string };
    const body = JSON.parse(callArg.body) as Record<string, unknown>;
    expect(body.locale).toBe('en-US');
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
    initContactForm(form, { i18n: testI18n });
    await new Promise<void>((r) => {
      queueMicrotask(r);
    });

    form.querySelector<HTMLTextAreaElement>('[name="message"]')!.value = 'Hello!';
    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => {
      expect(status.dataset.state).toBe('error');
    });
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
    initContactForm(form, { i18n: testI18n });
    // Let the script error event fire and the rejection propagate.
    await new Promise<void>((r) => {
      queueMicrotask(r);
    });
    await Promise.resolve();

    form.querySelector<HTMLTextAreaElement>('[name="message"]')!.value = 'Hello!';
    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => {
      expect(status.dataset.state).toBe('error');
    });
  });
});
