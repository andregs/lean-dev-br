// @ts-check
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

const SIGNAL_URL = import.meta.env.VITE_SIGNAL_URL ?? 'http://localhost:8080';
const TAB_COLORS = 6;
const DEFAULT_LIST = '📋 tasks';

// ── setup / unlock screens (exported for main.js) ─────────────────────────────

/**
 * @param {HTMLElement} root
 * @returns {Promise<{ roomId: string, aesKey: CryptoKey }>}
 */
export function renderSetup(root) {
  return new Promise((resolve) => {
    root.className = 'todo';
    setHTML(
      root,
      `<div class="setup-screen">
        <div class="setup-inner">
          <h1 class="setup-heading">Your encrypted notebook</h1>
          <hr class="rule" />
          <p class="setup-desc">Tasks are encrypted on-device. A passkey derives the key — nothing is sent to a server.</p>
          <button class="setup-btn" id="unlock-btn" type="button">Unlock with passkey</button>
          <button class="setup-btn setup-btn--secondary" id="setup-btn" type="button">Create new notebook</button>
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
        status.textContent = e instanceof Error ? e.message : 'Something went wrong — try again.';
      }
    }

    unlockBtn.addEventListener('click', () =>
      attempt('Authenticating…', () => SyncedPasskeyKeyProvider.discover()),
    );

    setupBtn.addEventListener('click', () =>
      attempt('Creating passkey…', async () => {
        const provider = await SyncedPasskeyKeyProvider.register();
        status.textContent = 'Authenticating…';
        return provider.resolve();
      }),
    );
  });
}

/** @param {HTMLElement} root */
export function renderUnlocking(root) {
  root.className = 'todo';
  setHTML(
    root,
    `<div class="setup-screen">
      <div class="setup-inner">
        <span class="setup-status">Unlocking…</span>
      </div>
    </div>`,
  );
}

/**
 * @param {HTMLElement} root
 * @param {SyncedPasskeyKeyProvider} provider
 */
export function renderUnlockError(root, provider) {
  root.className = 'todo';
  setHTML(
    root,
    `<div class="setup-screen">
      <div class="setup-inner">
        <h1 class="setup-heading">Unlock failed</h1>
        <hr class="rule" />
        <p class="setup-desc">Authentication was cancelled or timed out.</p>
        <button class="setup-btn" id="retry-btn" type="button">Try again</button>
      </div>
    </div>`,
  );
  document.getElementById('retry-btn')?.addEventListener('click', async () => {
    renderUnlocking(root);
    try {
      const session = await provider.resolve();
      await renderNotebook(root, session);
    } catch {
      renderUnlockError(root, provider);
    }
  });
}

// ── notebook ──────────────────────────────────────────────────────────────────

/**
 * @param {HTMLElement} root
 * @param {{ aesKey: CryptoKey, roomId: string }} session
 */
export async function renderNotebook(root, session) {
  await openPersistence(session.roomId);
  let activeListId = deriveLists(DEFAULT_LIST)[0];

  root.className = 'todo';
  setHTML(
    root,
    `<div class="notebook">
      <aside class="tab-rail" id="tab-rail" role="tablist" aria-label="Lists"></aside>
      <div class="page-area" id="page-area">
        <header class="page-header">
          <h1 class="page-title" id="page-title"></h1>
          <div class="page-actions">
          <span class="sync-pill" id="sync-pill"></span>
          <button class="clear-done-btn" id="clear-done-btn" type="button"
                  aria-label="Clear completed tasks" hidden>
            <span class="clear-done-label">Clear done</span>
          </button>
          </div>
        </header>
        <ul class="todo-list" id="todo-list" role="list"></ul>
        <form class="todo-form" id="todo-form" autocomplete="off">
          <span class="todo-form-dot" aria-hidden="true"></span>
          <input class="todo-input" id="todo-input" type="text"
                 placeholder="Add a task…" maxlength="300" aria-label="New task" />
        </form>
      </div>
    </div>
    <dialog id="list-dialog">
      <form class="list-form" id="list-form">
        <h2 class="list-form-title">New list</h2>
        <div class="list-form-row">
          <div class="list-field">
            <label class="list-field-label" for="lf-emoji">Emoji</label>
            <input class="list-field-input list-field-input--emoji" id="lf-emoji"
                   type="text" maxlength="8" placeholder="📝" autocomplete="off" spellcheck="false" />
          </div>
          <div class="list-field">
            <label class="list-field-label" for="lf-name">Name</label>
            <input class="list-field-input" id="lf-name"
                   type="text" maxlength="30" placeholder="my list" autocomplete="off" required />
          </div>
        </div>
        <div class="list-form-actions">
          <button class="btn-cancel" type="button">Cancel</button>
          <button class="btn-create" type="submit">Create</button>
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
    renderTabs(tabRail, lists, activeListId, { onSwitch, onAdd });

    const items = todos.filter((item) => item.listId === activeListId);
    renderTodos(todoList, items, { onToggle, onEdit, onDelete });
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
    const result = await showListDialog(listDialog, currentLists);
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
      syncing: '↻ syncing',
      synced: '✓ synced',
      error: '⚠ error',
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

  const sync = createSync(SIGNAL_URL, session.roomId, session.aesKey, doc, onSyncStatus);

  // Re-render on remote Yjs changes; local writes trigger their own surgical DOM updates
  const unsubTodos = onTodosChange(refreshAll);

  // Sync on load + when the page becomes visible again
  sync.syncNow();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') sync.syncNow();
  });
  window.addEventListener('focus', () => sync.syncNow());
  // pageshow covers bfcache restore where visibilitychange is not guaranteed
  window.addEventListener('pageshow', (e) => { if (e.persisted) sync.syncNow(); });

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
        checkBtn.setAttribute('aria-label', nowDone ? 'Mark incomplete' : 'Mark complete');
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
