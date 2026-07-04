// @ts-check
/** @import { I18nInstance } from '@lean-dev-br/i18n' */
import { SyncedPasskeyKeyProvider } from './key-provider.js';
import { createSync } from './sync.js';
import {
  addTodo,
  clearDone,
  deriveLists,
  doc,
  editTitle,
  onTodosChange,
  openPersistence,
  readTodos,
  removeTodo,
  setCompleted,
} from './todo-doc.js';
import { setHTML, svgIcon } from './trusted-types.js';
import { showListDialog } from './ui-dialog.js';
import { renderTabs } from './ui-tabs.js';
import { animateExit, buildTodoItem, renderTodos } from './ui-todos.js';

const RELAY_URL = import.meta.env.VITE_RELAY_URL ?? 'http://localhost:8080';
const TAB_COLORS = 6;

// ── setup / unlock screens (exported for main.js) ─────────────────────────────

/**
 * @param {HTMLElement} root
 * @param {I18nInstance} i18n
 * @returns {Promise<{ roomId: string, aesKey: CryptoKey }>}
 */
export function renderSetup(root, i18n) {
  return new Promise((resolve) => {
    root.className = 'todo';
    setHTML(
      root,
      `<div class="setup-screen">
        <div class="setup-inner">
          <h1 class="setup-heading">${i18n.t('setup.heading')}</h1>
          <hr class="rule" />
          <p class="setup-desc">${i18n.t('setup.desc')}</p>
          <button class="setup-btn" id="unlock-btn" type="button">${i18n.t('setup.unlock')}</button>
          <button class="setup-btn setup-btn--secondary" id="setup-btn" type="button">${i18n.t('setup.create')}</button>
          <span class="setup-status" id="setup-status"></span>
        </div>
      </div>`,
    );

    const unlockBtn = /** @type {HTMLButtonElement} */ (document.getElementById('unlock-btn'));
    const setupBtn = /** @type {HTMLButtonElement} */ (document.getElementById('setup-btn'));
    const status = /** @type {HTMLElement} */ (document.getElementById('setup-status'));
    unlockBtn.prepend(svgIcon('icon-key'));

    /** @param {string} msg @param {() => Promise<{ roomId: string, aesKey: CryptoKey }>} run */
    async function attempt(msg, run) {
      unlockBtn.disabled = true;
      setupBtn.disabled = true;
      status.textContent = msg;
      try {
        resolve(await run());
      } catch (e) {
        unlockBtn.disabled = false;
        setupBtn.disabled = false;
        status.textContent = e instanceof Error ? e.message : i18n.t('setup.status.error');
      }
    }

    unlockBtn.addEventListener('click', () =>
      attempt(i18n.t('setup.status.authenticating'), () => SyncedPasskeyKeyProvider.discover()),
    );

    setupBtn.addEventListener('click', () =>
      attempt(i18n.t('setup.status.creating'), async () => {
        const provider = await SyncedPasskeyKeyProvider.register();
        status.textContent = i18n.t('setup.status.authenticating');
        return provider.resolve();
      }),
    );
  });
}

/**
 * @param {HTMLElement} root
 * @param {I18nInstance} i18n
 */
export function renderUnlocking(root, i18n) {
  root.className = 'todo';
  setHTML(
    root,
    `<div class="setup-screen">
      <div class="setup-inner">
        <span class="setup-status">${i18n.t('setup.status.unlocking')}</span>
      </div>
    </div>`,
  );
}

/**
 * @param {HTMLElement} root
 * @param {SyncedPasskeyKeyProvider} provider
 * @param {I18nInstance} i18n
 */
export function renderUnlockError(root, provider, i18n) {
  root.className = 'todo';
  setHTML(
    root,
    `<div class="setup-screen">
      <div class="setup-inner">
        <h1 class="setup-heading">${i18n.t('unlock.failed.heading')}</h1>
        <hr class="rule" />
        <p class="setup-desc">${i18n.t('unlock.failed.desc')}</p>
        <button class="setup-btn" id="retry-btn" type="button">${i18n.t('unlock.failed.retry')}</button>
      </div>
    </div>`,
  );
  document.getElementById('retry-btn')?.addEventListener('click', async () => {
    renderUnlocking(root, i18n);
    try {
      const session = await provider.resolve();
      await renderNotebook(root, session, i18n);
    } catch {
      renderUnlockError(root, provider, i18n);
    }
  });
}

// ── notebook ──────────────────────────────────────────────────────────────────

/**
 * @param {HTMLElement} root
 * @param {{ aesKey: CryptoKey, roomId: string }} session
 * @param {I18nInstance} i18n
 */
export async function renderNotebook(root, session, i18n) {
  await openPersistence(session.roomId);
  let activeListId = deriveLists(i18n.t('default.list'))[0];

  root.className = 'todo';
  setHTML(
    root,
    `<div class="notebook">
      <aside class="tab-rail" id="tab-rail" role="tablist" aria-label="${i18n.t('notebook.tabs.aria')}"></aside>
      <div class="page-area" id="page-area">
        <header class="page-header">
          <h1 class="page-title" id="page-title"></h1>
          <div class="page-actions">
          <span class="sync-pill" id="sync-pill"></span>
          <button class="clear-done-btn" id="clear-done-btn" type="button"
                  aria-label="${i18n.t('notebook.clear.aria')}" hidden>
            <span class="clear-done-label">${i18n.t('notebook.clear.label')}</span>
          </button>
          </div>
        </header>
        <ul class="todo-list" id="todo-list" role="list"></ul>
        <form class="todo-form" id="todo-form" autocomplete="off">
          <span class="todo-form-dot" aria-hidden="true"></span>
          <input class="todo-input" id="todo-input" type="text"
                 placeholder="${i18n.t('notebook.input.placeholder')}" maxlength="300" aria-label="${i18n.t('notebook.input.aria')}" />
        </form>
      </div>
    </div>
    <dialog id="list-dialog">
      <form class="list-form" id="list-form">
        <h2 class="list-form-title">${i18n.t('notebook.dialog.title')}</h2>
        <div class="list-form-row">
          <div class="list-field">
            <label class="list-field-label" for="lf-emoji">${i18n.t('notebook.dialog.emoji.label')}</label>
            <input class="list-field-input list-field-input--emoji" id="lf-emoji"
                   type="text" maxlength="8" placeholder="📝" autocomplete="off" spellcheck="false" />
          </div>
          <div class="list-field">
            <label class="list-field-label" for="lf-name">${i18n.t('notebook.dialog.name.label')}</label>
            <input class="list-field-input" id="lf-name"
                   type="text" maxlength="30" placeholder="${i18n.t('notebook.dialog.name.placeholder')}" autocomplete="off" required />
          </div>
        </div>
        <div class="list-form-actions">
          <button class="btn-cancel" type="button">${i18n.t('notebook.dialog.cancel')}</button>
          <button class="btn-create" type="submit">${i18n.t('notebook.dialog.create')}</button>
        </div>
      </form>
    </dialog>`,
  );

  const tabRail = /** @type {HTMLElement} */ (document.getElementById('tab-rail'));
  const pageTitle = /** @type {HTMLElement} */ (document.getElementById('page-title'));
  const todoList = /** @type {HTMLUListElement} */ (document.getElementById('todo-list'));
  const todoForm = /** @type {HTMLFormElement} */ (document.getElementById('todo-form'));
  const todoInput = /** @type {HTMLInputElement} */ (document.getElementById('todo-input'));
  const clearBtn = /** @type {HTMLButtonElement} */ (document.getElementById('clear-done-btn'));
  const listDialog = /** @type {HTMLDialogElement} */ (document.getElementById('list-dialog'));
  const syncPill = /** @type {HTMLElement} */ (document.getElementById('sync-pill'));

  clearBtn.prepend(svgIcon('icon-broom'));

  // ── helpers ──────────────────────────────────────────────────────────────────

  /** @param {number} colorIndex */
  function setActiveTabColor(colorIndex) {
    document.documentElement.style.setProperty(
      '--active-tab-color',
      `var(--tc-${colorIndex % TAB_COLORS})`,
    );
  }

  function refreshAll() {
    const todos = readTodos();
    const lists = deriveLists(activeListId);
    const activeIdx = lists.indexOf(activeListId);

    pageTitle.textContent = activeListId;
    setActiveTabColor(activeIdx);
    renderTabs(tabRail, lists, activeListId, { onSwitch, onAdd }, i18n);

    const items = todos.filter((item) => item.listId === activeListId);
    renderTodos(todoList, items, { onToggle, onEdit, onDelete }, i18n);
    clearBtn.hidden = !items.some((i) => i.completed);
  }

  // ── actions ───────────────────────────────────────────────────────────────────

  /** @param {string} name */
  function onSwitch(name) {
    activeListId = name;
    refreshAll();
  }

  async function onAdd() {
    const currentLists = deriveLists(activeListId);
    const result = await showListDialog(listDialog, currentLists, i18n);
    if (!result) return;
    activeListId = `${result.emoji} ${result.title}`;
    refreshAll();
    todoInput.focus();
  }

  // ── sync ──────────────────────────────────────────────────────────────────────

  let _syncingTimer = 0;
  let _syncedTimer = 0;

  /** @param {import('./types').SyncStatus | 'idle'} s */
  function applyPillStatus(s) {
    const labels = /** @type {Record<string, string>} */ ({
      syncing: i18n.t('notebook.sync.syncing'),
      synced: i18n.t('notebook.sync.synced'),
      error: i18n.t('notebook.sync.error'),
    });
    syncPill.textContent = labels[s] ?? '';
    syncPill.className = s === 'idle' ? 'sync-pill' : `sync-pill sync-pill--${s}`;
  }

  /** @param {import('./types').SyncStatus} status */
  function onSyncStatus(status) {
    window.clearTimeout(_syncingTimer);
    window.clearTimeout(_syncedTimer);
    if (status === 'syncing') {
      // Defer showing 'syncing' — fast connections skip it entirely
      _syncingTimer = window.setTimeout(() => applyPillStatus('syncing'), 250);
    } else if (status === 'synced') {
      applyPillStatus('synced');
      _syncedTimer = window.setTimeout(() => applyPillStatus('idle'), 2000);
    } else {
      applyPillStatus(status);
    }
  }

  const sync = createSync(RELAY_URL, session.roomId, session.aesKey, doc, onSyncStatus);

  // Re-render on remote Yjs changes; local writes trigger their own surgical DOM updates
  const unsubTodos = onTodosChange(refreshAll);

  // Sync on load + when the page becomes visible again
  sync.syncNow();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') sync.syncNow();
  });
  window.addEventListener('focus', () => sync.syncNow());
  // pageshow covers bfcache restore where visibilitychange is not guaranteed
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) sync.syncNow();
  });

  // ── mutations ──────────────────────────────────────────────────────────────────

  /** @param {string} todoId @param {boolean} completed */
  async function onToggle(todoId, completed) {
    setCompleted(todoId, !completed);
    // Update only the affected item in-place
    const li = /** @type {HTMLElement|null} */ (todoList.querySelector(`[data-id="${todoId}"]`));
    if (li) {
      const nowDone = !completed;
      li.classList.toggle('todo-item--done', nowDone);
      const checkBtn = li.querySelector('.todo-check');
      if (checkBtn) {
        checkBtn.setAttribute('aria-pressed', String(nowDone));
        checkBtn.setAttribute(
          'aria-label',
          nowDone ? i18n.t('todo.check.incomplete') : i18n.t('todo.check.complete'),
        );
      }
    }
    clearBtn.hidden = todoList.querySelectorAll('.todo-item--done').length === 0;
  }

  /** @param {string} todoId @param {string} title */
  async function onEdit(todoId, title) {
    editTitle(todoId, title);
    // Title already updated in DOM by buildTodoItem's liveTitle binding
  }

  /** @param {string} todoId @param {HTMLElement} li */
  async function onDelete(todoId, li) {
    await animateExit(li);
    removeTodo(todoId);
    clearBtn.hidden = todoList.querySelectorAll('.todo-item--done').length === 0;
  }

  todoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = todoInput.value.trim();
    if (!title) return;
    todoInput.value = '';
    const id = addTodo({ title, listId: activeListId });
    todoList.append(
      buildTodoItem(
        { id, title, completed: false, listId: activeListId, createdAt: Date.now() },
        { onToggle, onEdit, onDelete },
        i18n,
      ),
    );
    clearBtn.hidden = todoList.querySelectorAll('.todo-item--done').length === 0;
  });

  clearBtn.addEventListener('click', async () => {
    const doneLis = /** @type {HTMLElement[]} */ ([
      ...todoList.querySelectorAll('.todo-item--done'),
    ]);
    const doneIds = doneLis.map((li) => li.dataset.id ?? '');
    await Promise.all(doneLis.map(animateExit));
    clearDone(doneIds);
    clearBtn.hidden = true;
  });

  // ── initial render ─────────────────────────────────────────────────────────────

  refreshAll();
  todoInput.focus();

  return () => {
    sync.stop();
    unsubTodos();
  };
}
