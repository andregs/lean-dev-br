// @ts-check
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import userEvent from '@testing-library/user-event';
import { showListDialog } from './ui-dialog.js';

/** @type {import('@lean-dev-br/i18n').I18nInstance} */
const testI18n = {
  locale: 'en-US',
  t: (k) => ({ 'dialog.duplicate': 'A list with this name already exists.' })[k] ?? k,
};

// jsdom doesn't implement HTMLDialogElement.showModal — add a minimal shim
beforeAll(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open');
    };
  }
});

/**
 * Build a minimal <dialog> matching the structure renderNotebook creates.
 * @returns {HTMLDialogElement}
 */
function makeDialog() {
  const dialog = /** @type {HTMLDialogElement} */ (document.createElement('dialog'));
  // Hardcoded test infrastructure — no user input, no XSS risk
  dialog.innerHTML = `
    <form class="list-form">
      <input class="list-field-input list-field-input--emoji" id="lf-emoji"
             type="text" maxlength="8" placeholder="📝" autocomplete="off" />
      <input class="list-field-input" id="lf-name"
             type="text" maxlength="30" placeholder="my list" autocomplete="off" required />
      <button class="btn-cancel" type="button">Cancel</button>
      <button class="btn-create" type="submit">Create</button>
    </form>`;
  document.body.append(dialog);
  return dialog;
}

/**
 * closeDialog waits for the CSS exit animation to finish.
 * jsdom doesn't run CSS animations — dispatch the event manually to unblock it.
 * @param {HTMLDialogElement} dialog
 */
function fireAnimationEnd(dialog) {
  dialog.dispatchEvent(new Event('animationend'));
}

afterEach(() => {
  document.body.innerHTML = '';
});

/** @param {string} sel @returns {Element} */
const q = (sel) => /** @type {Element} */ (document.querySelector(sel));

describe('showListDialog', () => {
  it('submitting with a name resolves with default emoji and the title', async () => {
    const dialog = makeDialog();
    const result = showListDialog(dialog, [], testI18n);

    const user = userEvent.setup();
    await user.type(q('#lf-name'), 'Work tasks');
    await user.click(q('.btn-create'));
    fireAnimationEnd(dialog);

    expect(await result).toEqual({ emoji: '📋', title: 'Work tasks' });
  });

  it('a valid emoji is passed through to the result', async () => {
    const dialog = makeDialog();
    const result = showListDialog(dialog, [], testI18n);

    const user = userEvent.setup();
    await user.type(q('#lf-emoji'), '🎯');
    await user.type(q('#lf-name'), 'Goals');
    await user.click(q('.btn-create'));
    fireAnimationEnd(dialog);

    expect(await result).toEqual({ emoji: '🎯', title: 'Goals' });
  });

  it('an invalid emoji marks the field invalid and blocks submit', async () => {
    const dialog = makeDialog();
    const result = showListDialog(dialog, [], testI18n);

    const user = userEvent.setup();
    await user.type(q('#lf-emoji'), 'abc');

    expect(q('#lf-emoji')?.classList.contains('invalid')).toBe(true);

    // Clean up: cancel resolves the promise so it doesn't leak
    await user.click(q('.btn-cancel'));
    fireAnimationEnd(dialog);
    await result;
  });

  it('Cancel button resolves with null', async () => {
    const dialog = makeDialog();
    const result = showListDialog(dialog, [], testI18n);

    await userEvent.setup().click(q('.btn-cancel'));
    fireAnimationEnd(dialog);

    expect(await result).toBeNull();
  });

  it('form resets on each open — previous input is cleared', async () => {
    const dialog = makeDialog();

    // First open: fill in name and cancel
    let result = showListDialog(dialog, [], testI18n);
    const user = userEvent.setup();
    await user.type(q('#lf-name'), 'Stale input');
    await user.click(q('.btn-cancel'));
    fireAnimationEnd(dialog);
    await result;

    // Second open: form.reset() should have cleared the name field
    result = showListDialog(dialog, [], testI18n);
    expect(/** @type {HTMLInputElement} */ (q('#lf-name')).value).toBe('');

    // Clean up
    await user.click(q('.btn-cancel'));
    fireAnimationEnd(dialog);
    await result;
  });
});
