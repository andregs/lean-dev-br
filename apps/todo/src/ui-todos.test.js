// @ts-check
import { afterEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { buildTodoItem, renderTodos } from './ui-todos.js';

/** @type {import('@lean-dev-br/i18n').I18nInstance} */
const testI18n = {
  locale: 'en-US',
  t: (k) =>
    ({
      'todo.check.complete': 'Mark complete',
      'todo.check.incomplete': 'Mark incomplete',
      'todo.delete': 'Delete',
    })[k] ?? k,
};

/** @returns {import('./types').TodoItem} */
const makeTodo = (overrides = {}) => ({
  id: 't1',
  title: 'Buy milk',
  completed: false,
  listId: 'l1',
  createdAt: Date.now(),
  ...overrides,
});

/** @param {Element} el @param {string} sel @returns {Element} */
const within = (el, sel) => /** @type {Element} */ (el.querySelector(sel));

const makeHandlers = () => ({
  onToggle: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
});

afterEach(() => {
  document.body.innerHTML = '';
});

// ── rendering ────────────────────────────────────────────────────────────────

describe('todo item — rendering', () => {
  it('shows the title', () => {
    document.body.append(
      buildTodoItem(makeTodo({ title: 'Write tests' }), makeHandlers(), testI18n),
    );
    expect(document.querySelector('.todo-text')?.textContent).toBe('Write tests');
  });

  it('incomplete item has no done class', () => {
    document.body.append(buildTodoItem(makeTodo({ completed: false }), makeHandlers(), testI18n));
    expect(document.querySelector('.todo-item')?.classList.contains('todo-item--done')).toBe(false);
  });

  it('completed item has done class', () => {
    document.body.append(buildTodoItem(makeTodo({ completed: true }), makeHandlers(), testI18n));
    expect(document.querySelector('.todo-item')?.classList.contains('todo-item--done')).toBe(true);
  });

  it('check button label reflects completion state', () => {
    document.body.append(buildTodoItem(makeTodo({ completed: false }), makeHandlers(), testI18n));
    expect(document.querySelector('.todo-check')?.getAttribute('aria-label')).toBe('Mark complete');
    document.body.innerHTML = '';
    document.body.append(buildTodoItem(makeTodo({ completed: true }), makeHandlers(), testI18n));
    expect(document.querySelector('.todo-check')?.getAttribute('aria-label')).toBe(
      'Mark incomplete',
    );
  });
});

// ── toggling complete ─────────────────────────────────────────────────────────

describe('todo item — toggling complete', () => {
  it('clicking check on incomplete item calls onToggle(id, false)', async () => {
    const h = makeHandlers();
    const li = buildTodoItem(makeTodo({ id: 't1', completed: false }), h, testI18n);
    document.body.append(li);

    await userEvent.setup().click(within(li, '.todo-check'));

    expect(h.onToggle).toHaveBeenCalledWith('t1', false);
  });

  it('reads live DOM state — calls onToggle(id, true) after item class is toggled', async () => {
    const h = makeHandlers();
    const li = buildTodoItem(makeTodo({ id: 't1', completed: false }), h, testI18n);
    document.body.append(li);

    const user = userEvent.setup();
    await user.click(within(li, '.todo-check'));
    expect(h.onToggle).toHaveBeenLastCalledWith('t1', false);

    // Simulate what ui.js does: toggle the class in place (no re-render)
    li.classList.add('todo-item--done');

    await user.click(within(li, '.todo-check'));
    expect(h.onToggle).toHaveBeenLastCalledWith('t1', true);
  });
});

// ── editing ──────────────────────────────────────────────────────────────────

describe('todo item — editing', () => {
  it('editing text and blurring calls onEdit with new title', async () => {
    const h = makeHandlers();
    const li = buildTodoItem(makeTodo({ id: 't1', title: 'Old title' }), h, testI18n);
    document.body.append(li);

    const user = userEvent.setup();
    const text = /** @type {HTMLElement} */ (within(li, '.todo-text'));
    // user.click doesn't focus contenteditable spans in jsdom — use native focus()
    // so that subsequent userEvent keyboard/tab fires on the right activeElement
    text.focus();
    text.textContent = 'New title';
    await user.tab(); // Tab fires on activeElement (text), triggering blur

    expect(h.onEdit).toHaveBeenCalledWith('t1', 'New title');
  });

  it('pressing Enter saves the edit', async () => {
    const h = makeHandlers();
    const li = buildTodoItem(makeTodo({ id: 't1', title: 'Draft' }), h, testI18n);
    document.body.append(li);

    const user = userEvent.setup();
    const text = /** @type {HTMLElement} */ (within(li, '.todo-text'));
    text.focus();
    text.textContent = 'Final';
    await user.keyboard('[Enter]');

    expect(h.onEdit).toHaveBeenCalledWith('t1', 'Final');
  });

  it('pressing Escape reverts to original without calling onEdit', async () => {
    const h = makeHandlers();
    const li = buildTodoItem(makeTodo({ id: 't1', title: 'Original' }), h, testI18n);
    document.body.append(li);

    const user = userEvent.setup();
    const text = /** @type {HTMLElement} */ (within(li, '.todo-text'));
    text.focus();
    text.textContent = 'Changed'; // simulate edit
    await user.keyboard('[Escape]');

    expect(h.onEdit).not.toHaveBeenCalled();
    expect(text.textContent).toBe('Original');
  });

  it('blurring without change does not call onEdit', async () => {
    const h = makeHandlers();
    const li = buildTodoItem(makeTodo({ title: 'Same text' }), h, testI18n);
    document.body.append(li);

    const user = userEvent.setup();
    await user.click(within(li, '.todo-text'));
    await user.tab();

    expect(h.onEdit).not.toHaveBeenCalled();
  });

  it('clicking item B while editing A triggers blur on A, saving its edit', async () => {
    const hA = makeHandlers();
    const liA = buildTodoItem(makeTodo({ id: 'a', title: 'Item A' }), hA, testI18n);
    const liB = buildTodoItem(makeTodo({ id: 'b', title: 'Item B' }), makeHandlers(), testI18n);
    document.body.append(liA, liB);

    const user = userEvent.setup();
    const textA = /** @type {HTMLElement} */ (liA.querySelector('.todo-text'));
    textA.focus();
    textA.textContent = 'Item A edited'; // simulate edit in A

    // Clicking B's check button (focusable) moves focus, blurring A
    await user.click(/** @type {Element} */ (liB.querySelector('.todo-check')));

    expect(hA.onEdit).toHaveBeenCalledWith('a', 'Item A edited');
  });
});

// ── deleting ─────────────────────────────────────────────────────────────────

describe('todo item — deleting', () => {
  it('clicking delete calls onDelete with item id and the li', async () => {
    const h = makeHandlers();
    const li = buildTodoItem(makeTodo({ id: 't1' }), h, testI18n);
    document.body.append(li);

    await userEvent.setup().click(within(li, '.todo-delete'));

    expect(h.onDelete).toHaveBeenCalledWith('t1', li);
  });
});

// ── renderTodos ───────────────────────────────────────────────────────────────

describe('renderTodos', () => {
  it('renders all items in order', () => {
    const list = document.createElement('ul');
    document.body.append(list);
    renderTodos(
      list,
      [makeTodo({ id: 'a', title: 'First' }), makeTodo({ id: 'b', title: 'Second' })],
      makeHandlers(),
      testI18n,
    );

    const texts = [...list.querySelectorAll('.todo-text')].map((el) => el.textContent);
    expect(texts).toEqual(['First', 'Second']);
  });

  it('re-render clears and replaces previous items', () => {
    const list = document.createElement('ul');
    document.body.append(list);
    renderTodos(list, [makeTodo({ id: 'old', title: 'Old' })], makeHandlers(), testI18n);
    renderTodos(list, [makeTodo({ id: 'new', title: 'New' })], makeHandlers(), testI18n);

    expect(list.querySelectorAll('.todo-item')).toHaveLength(1);
    expect(list.querySelector('.todo-text')?.textContent).toBe('New');
  });

  it('empty list renders nothing', () => {
    const list = document.createElement('ul');
    document.body.append(list);
    renderTodos(list, [], makeHandlers(), testI18n);

    expect(list.children).toHaveLength(0);
  });
});
