// @ts-check
/** @import { TodoList } from './types' */
import { setHTML } from './trusted-types.js';

/**
 * @param {HTMLElement} rail
 * @param {TodoList[]} lists
 * @param {string} activeListId
 * @param {{ onSwitch: (id: string) => void, onAdd: () => void }} callbacks
 */
export function renderTabs(rail, lists, activeListId, { onSwitch, onAdd }) {
  const tabsHtml = lists.map((list) => {
    const isActive = list.id === activeListId;
    return `<button class="tab${isActive ? ' tab--active' : ''}"
      role="tab" aria-selected="${isActive}"
      data-color="${list.colorIndex % 6}"
      data-id="${list.id}"></button>`;
  }).join('');

  setHTML(rail, tabsHtml + `<button class="tab tab--add" aria-label="New list" title="New list">+</button>`);

  for (const list of lists) {
    const btn = /** @type {HTMLButtonElement} */ (rail.querySelector(`[data-id="${list.id}"]`));
    if (!btn) continue;
    btn.textContent = list.emoji;
    btn.title = list.title;
    btn.setAttribute('aria-label', `${list.emoji} ${list.title}`);
    btn.addEventListener('click', () => onSwitch(list.id));
  }

  rail.querySelector('.tab--add')?.addEventListener('click', onAdd);
}
