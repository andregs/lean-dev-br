// @ts-check
/** @import { I18nInstance } from '@lean-dev-br/i18n' */

const EMOJI_RE = /^\p{Extended_Pictographic}/u;

/** @param {string} s */
function isValidEmoji(s) {
  return EMOJI_RE.test(s.trim());
}

/**
 * Animate the dialog closed, then call dialog.close().
 * @param {HTMLDialogElement} dialog
 */
async function closeDialog(dialog) {
  dialog.classList.add('closing');
  await new Promise((resolve) => dialog.addEventListener('animationend', resolve, { once: true }));
  dialog.classList.remove('closing');
  dialog.close();
}

/**
 * Show the new-list dialog and resolve with { emoji, title } on submit, or null on cancel.
 * @param {HTMLDialogElement} dialog
 * @param {string[]} existingNames - already-taken list names; blocks duplicate submit
 * @param {I18nInstance} i18n
 * @returns {Promise<{ emoji: string, title: string } | null>}
 */
export function showListDialog(dialog, existingNames = [], i18n) {
  return new Promise((resolve) => {
    const form = /** @type {HTMLFormElement} */ (dialog.querySelector('.list-form'));
    const emojiInput = /** @type {HTMLInputElement} */ (dialog.querySelector('#lf-emoji'));
    const nameInput = /** @type {HTMLInputElement} */ (dialog.querySelector('#lf-name'));

    // Reset
    form.reset();
    emojiInput.classList.remove('invalid');
    nameInput.setCustomValidity('');

    dialog.showModal();
    nameInput.focus();

    let settled = false;

    /** @param {{ emoji: string, title: string } | null} result */
    function settle(result) {
      if (settled) return;
      settled = true;
      form.removeEventListener('submit', onSubmit);
      dialog.removeEventListener('cancel', onCancel);
      closeDialog(dialog).then(() => resolve(result));
    }

    /** @param {SubmitEvent} e */
    function onSubmit(e) {
      e.preventDefault();
      const emoji = emojiInput.value.trim() || '📋';
      const title = nameInput.value.trim();
      if (emojiInput.value.trim() && !isValidEmoji(emojiInput.value)) {
        emojiInput.classList.add('invalid');
        emojiInput.focus();
        return;
      }
      if (existingNames.includes(`${emoji} ${title}`)) {
        nameInput.setCustomValidity(i18n.t('dialog.duplicate'));
        nameInput.reportValidity();
        return;
      }
      settle({ emoji, title });
    }

    nameInput.addEventListener('input', () => nameInput.setCustomValidity(''));

    /** @param {Event} e */
    function onCancel(e) {
      e.preventDefault(); // prevent browser's immediate close so our animation can run
      settle(null);
    }

    emojiInput.addEventListener('input', () => {
      const v = emojiInput.value;
      emojiInput.classList.toggle('invalid', !!v && !isValidEmoji(v));
    });

    form.addEventListener('submit', onSubmit);
    dialog.addEventListener('cancel', onCancel);

    dialog
      .querySelector('.btn-cancel')
      ?.addEventListener('click', () => settle(null), { once: true });
  });
}
