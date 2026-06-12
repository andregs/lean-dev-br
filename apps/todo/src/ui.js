// @ts-check
/** @import { TodoList, TodoItem } from './types' */
import { hlcNow } from './hlc.js';
import { SyncedPasskeyKeyProvider } from './key-provider.js';
import { openOpLog } from './oplog.js';
import { applyOps } from './state.js';
import { setHTML, svgIcon } from './trusted-types.js';
import { showListDialog } from './ui-dialog.js';
import { renderTabs } from './ui-tabs.js';
import { animateExit, buildTodoItem, renderTodos } from './ui-todos.js';

const TAB_COLORS = 6;
const LISTS_KEY = 'todo-lists-v1';

// ── list storage (localStorage; migrates to oplog in sync step) ───────────

/** @returns {TodoList[]} */
function loadLists() {
  try {
    const raw = localStorage.getItem(LISTS_KEY);
    if (raw) return /** @type {TodoList[]} */ (JSON.parse(raw));
  } catch {
    // corrupted storage — fall back to default
  }
  return [{ id: crypto.randomUUID(), emoji: '📋', title: 'tasks', colorIndex: 0 }];
}

/** @param {TodoList[]} lists */
function saveLists(lists) {
  localStorage.setItem(LISTS_KEY, JSON.stringify(lists));
}

// ── setup / unlock screens (exported for main.js) ─────────────────────────

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
          <button class="setup-btn" id="setup-btn" type="button">Set up passkey</button>
          <span class="setup-status" id="setup-status"></span>
        </div>
      </div>`,
    );

    const btn = /** @type {HTMLButtonElement} */ (document.getElementById('setup-btn'));
    const status = /** @type {HTMLElement} */ (document.getElementById('setup-status'));
    btn.prepend(svgIcon('icon-key'));

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      status.textContent = 'Creating passkey…';
      try {
        const provider = await SyncedPasskeyKeyProvider.register();
        status.textContent = 'Authenticating…';
        resolve(await provider.resolve());
      } catch (e) {
        btn.disabled = false;
        status.textContent = e instanceof Error ? e.message : 'Something went wrong — try again.';
      }
    });
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

// ── notebook ──────────────────────────────────────────────────────────────

/**
 * @param {HTMLElement} root
 * @param {{ aesKey: CryptoKey, roomId: string }} session
 */
export async function renderNotebook(root, session) {
  const oplog = await openOpLog();
  const lists = loadLists();
  let activeListId = lists[0].id;
  let lastHlc = '';

  root.className = 'todo';
  setHTML(
    root,
    `<div class="notebook">
      <aside class="tab-rail" id="tab-rail" role="tablist" aria-label="Lists"></aside>
      <div class="page-area" id="page-area">
        <header class="page-header">
          <h1 class="page-title" id="page-title"></h1>
          <div class="page-actions">
            <button class="clear-done-btn" id="clear-done-btn" type="button"
                    aria-label="Clear completed tasks" hidden>
              <span class="clear-done-label">Clear done</span>
            </button>
            <span class="sync-pill" title="Sync status">● local</span>
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

  clearBtn.prepend(svgIcon('icon-broom'));

  // ── helpers ─────────────────────────────────────────────────────────────

  /** @param {number} colorIndex */
  function setActiveTabColor(colorIndex) {
    document.documentElement.style.setProperty(
      '--active-tab-color',
      `var(--tc-${colorIndex % TAB_COLORS})`,
    );
  }

  async function getFilteredItems() {
    const ops = await oplog.readAll(session.aesKey);
    const all = applyOps(ops);
    return /** @type {TodoItem[]} */ (
      [...all.values()].filter(
        (item) => item !== null && /** @type {TodoItem} */ (item).listId === activeListId,
      )
    ).sort((a, b) => (a.createdHlc < b.createdHlc ? -1 : 1));
  }

  async function refresh() {
    const activeList = lists.find((l) => l.id === activeListId);
    if (activeList) {
      pageTitle.textContent = `${activeList.emoji} ${activeList.title}`;
      setActiveTabColor(activeList.colorIndex);
    }

    const items = await getFilteredItems();
    renderTodos(todoList, items, { onToggle, onEdit, onDelete });

    clearBtn.hidden = !items.some((i) => i.completed);
  }

  function refreshTabs() {
    renderTabs(tabRail, lists, activeListId, { onSwitch, onAdd });
  }

  // ── actions ──────────────────────────────────────────────────────────────

  /** @param {string} listId */
  function onSwitch(listId) {
    activeListId = listId;
    refreshTabs();
    refresh();
  }

  async function onAdd() {
    const result = await showListDialog(listDialog);
    if (!result) return;
    const newList = {
      id: crypto.randomUUID(),
      emoji: result.emoji,
      title: result.title,
      colorIndex: lists.length % TAB_COLORS,
    };
    lists.push(newList);
    saveLists(lists);
    activeListId = newList.id;
    refreshTabs();
    refresh();
    todoInput.focus();
  }

  /** @param {string} todoId @param {boolean} completed */
  async function onToggle(todoId, completed) {
    lastHlc = hlcNow(lastHlc);
    await oplog.append(session.aesKey, {
      id: crypto.randomUUID(),
      type: completed ? 'UNCOMPLETE' : 'COMPLETE',
      todoId,
      hlc: lastHlc,
    });
    // Update the single item in place — no full re-render, no animation on siblings
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
    lastHlc = hlcNow(lastHlc);
    await oplog.append(session.aesKey, {
      id: crypto.randomUUID(),
      type: 'EDIT',
      todoId,
      fields: { title },
      hlc: lastHlc,
    });
    // No refresh — title already updated in DOM via liveTitle in buildTodoItem
  }

  /** @param {string} todoId @param {HTMLElement} li */
  async function onDelete(todoId, li) {
    await animateExit(li);
    lastHlc = hlcNow(lastHlc);
    await oplog.append(session.aesKey, {
      id: crypto.randomUUID(),
      type: 'DELETE',
      todoId,
      hlc: lastHlc,
    });
    // Update clear-completed button visibility without full re-render
    const remaining = todoList.querySelectorAll('.todo-item--done');
    clearBtn.hidden = remaining.length === 0;
  }

  todoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = todoInput.value.trim();
    if (!title) return;
    todoInput.value = '';
    lastHlc = hlcNow(lastHlc);
    const todoId = crypto.randomUUID();
    await oplog.append(session.aesKey, {
      id: crypto.randomUUID(),
      type: 'ADD',
      todoId,
      fields: { title, list: activeListId },
      hlc: lastHlc,
    });
    // Append only the new item — no full re-render, no animation on existing items
    todoList.append(buildTodoItem(
      { id: todoId, title, completed: false, listId: activeListId, hlc: lastHlc, createdHlc: lastHlc },
      { onToggle, onEdit, onDelete },
    ));
    clearBtn.hidden = todoList.querySelectorAll('.todo-item--done').length === 0;
  });

  clearBtn.addEventListener('click', async () => {
    const doneLis = /** @type {HTMLElement[]} */ ([
      ...todoList.querySelectorAll('.todo-item--done'),
    ]);
    const doneIds = doneLis.map((li) => li.dataset.id ?? '');
    await Promise.all(doneLis.map(animateExit));
    for (const todoId of doneIds) {
      lastHlc = hlcNow(lastHlc);
      await oplog.append(session.aesKey, {
        id: crypto.randomUUID(),
        type: 'DELETE',
        todoId,
        hlc: lastHlc,
      });
    }
    clearBtn.hidden = true;
  });

  // ── initial render ────────────────────────────────────────────────────────

  refreshTabs();
  await refresh();
  todoInput.focus();
}
