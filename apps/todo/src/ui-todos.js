// @ts-check
/** @import { TodoItem } from './types' */
import { setHTML, svgIcon } from './trusted-types.js';

/**
 * @param {HTMLElement} container
 * @param {TodoItem[]} items
 * @param {{
 *   onToggle: (id: string, completed: boolean) => void,
 *   onEdit:   (id: string, title: string) => void,
 *   onDelete: (id: string, li: HTMLElement) => void,
 * }} handlers
 */
export function renderTodos(container, items, handlers) {
  container.innerHTML = '';
  for (const item of items) {
    container.append(buildTodoItem(item, handlers));
  }
}

/**
 * @param {TodoItem} item
 * @param {{
 *   onToggle: (id: string, completed: boolean) => void,
 *   onEdit:   (id: string, title: string) => void,
 *   onDelete: (id: string, li: HTMLElement) => void,
 * }} handlers
 */
export function buildTodoItem(item, handlers) {
  const li = document.createElement('li');
  li.className = `todo-item${item.completed ? ' todo-item--done' : ''}`;
  li.dataset.id = item.id;

  setHTML(
    li,
    `<button class="todo-check" type="button"></button>
     <span class="todo-text" spellcheck="false"></span>
     <button class="todo-delete" type="button" aria-label="Delete"></button>`,
  );

  const checkBtn = /** @type {HTMLButtonElement} */ (li.querySelector('.todo-check'));
  const textSpan = /** @type {HTMLElement} */ (li.querySelector('.todo-text'));
  const delBtn = /** @type {HTMLButtonElement} */ (li.querySelector('.todo-delete'));

  // DOMPurify strips <use> and contenteditable — set both via DOM API
  checkBtn.append(svgIcon('icon-check'));
  delBtn.append(svgIcon('icon-x'));
  textSpan.setAttribute('contenteditable', 'plaintext-only');

  checkBtn.setAttribute('aria-label', item.completed ? 'Mark incomplete' : 'Mark complete');
  checkBtn.setAttribute('aria-pressed', String(item.completed));
  textSpan.textContent = item.title;

  // Read live DOM state — item.completed is stale after in-place toggle
  checkBtn.addEventListener('click', () => handlers.onToggle(item.id, li.classList.contains('todo-item--done')));

  // Mutable title — stays current across edits without re-render
  let liveTitle = item.title;

  textSpan.addEventListener('blur', () => {
    const val = textSpan.textContent?.trim() ?? '';
    if (val && val !== liveTitle) {
      liveTitle = val; // update before handler so a quick re-blur doesn't double-fire
      handlers.onEdit(item.id, val);
    } else {
      textSpan.textContent = liveTitle;
    }
  });
  textSpan.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      textSpan.blur();
    }
    if (e.key === 'Escape') {
      textSpan.textContent = liveTitle;
      textSpan.blur();
    }
  });

  delBtn.addEventListener('click', () => handlers.onDelete(item.id, li));

  return li;
}

/**
 * Animate a todo item out, then remove it from the DOM.
 * @param {HTMLElement} li
 * @returns {Promise<void>}
 */
export function animateExit(li) {
  return new Promise((resolve) => {
    li.classList.add('todo-item--leaving');
    li.addEventListener(
      'animationend',
      () => {
        li.remove();
        resolve();
      },
      { once: true },
    );
  });
}
