// @ts-check
import { setHTML } from './trusted-types.js';

/**
 * Split a list name of the form "${emoji} ${title}" into its parts.
 * @param {string} name
 * @returns {{ emoji: string, title: string }}
 */
function parseListName(name) {
  const m = name.match(/^(\S+)\s+(.*)/s);
  return m ? { emoji: m[1], title: m[2] } : { emoji: '📋', title: name };
}

/**
 * @param {HTMLElement} rail
 * @param {string[]} lists       - sorted list names; must include activeListId
 * @param {string} activeListId
 * @param {{ onSwitch: (name: string) => void, onAdd: () => void }} callbacks
 */
export function renderTabs(rail, lists, activeListId, { onSwitch, onAdd }) {
  const tabsHtml = lists
    .map((name, i) => {
      const isActive = name === activeListId;
      return `<button class="tab${isActive ? ' tab--active' : ''}"
        role="tab" aria-selected="${isActive}"
        data-color="${i % 6}" data-idx="${i}"></button>`;
    })
    .join('');

  setHTML(
    rail,
    tabsHtml + `<button class="tab tab--add" aria-label="New list" title="New list">+</button>`,
  );

  for (const [i, name] of lists.entries()) {
    const btn = /** @type {HTMLButtonElement|null} */ (rail.querySelector(`[data-idx="${i}"]`));
    if (!btn) continue;
    const { emoji, title } = parseListName(name);
    btn.textContent = emoji;
    btn.title = title;
    btn.setAttribute('aria-label', name);
    btn.addEventListener('click', () => onSwitch(name));
  }

  rail.querySelector('.tab--add')?.addEventListener('click', onAdd);
}
