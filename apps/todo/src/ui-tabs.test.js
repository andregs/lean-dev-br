// @ts-check
import { afterEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderTabs } from './ui-tabs.js';

/** @returns {import('./types').TodoList[]} */
const makeLists = () => [
  { id: 'a', emoji: '📋', title: 'Tasks', colorIndex: 0 },
  { id: 'b', emoji: '🎯', title: 'Goals', colorIndex: 1 },
];

afterEach(() => {
  document.body.innerHTML = '';
});

describe('renderTabs', () => {
  it('renders one tab per list', () => {
    const rail = document.createElement('div');
    document.body.append(rail);
    renderTabs(rail, makeLists(), 'a', { onSwitch: vi.fn(), onAdd: vi.fn() });

    expect(rail.querySelectorAll('[role="tab"]')).toHaveLength(2);
  });

  it('renders a + button to add a new list', () => {
    const rail = document.createElement('div');
    document.body.append(rail);
    renderTabs(rail, makeLists(), 'a', { onSwitch: vi.fn(), onAdd: vi.fn() });

    expect(rail.querySelector('[aria-label="New list"]')).toBeTruthy();
  });

  it('active tab has aria-selected=true, inactive tabs false', () => {
    const rail = document.createElement('div');
    document.body.append(rail);
    renderTabs(rail, makeLists(), 'b', { onSwitch: vi.fn(), onAdd: vi.fn() });

    expect(rail.querySelector('[data-id="b"]')?.getAttribute('aria-selected')).toBe('true');
    expect(rail.querySelector('[data-id="a"]')?.getAttribute('aria-selected')).toBe('false');
  });

  it('tab label shows the list emoji', () => {
    const rail = document.createElement('div');
    document.body.append(rail);
    renderTabs(rail, makeLists(), 'a', { onSwitch: vi.fn(), onAdd: vi.fn() });

    expect(rail.querySelector('[data-id="a"]')?.textContent).toBe('📋');
    expect(rail.querySelector('[data-id="b"]')?.textContent).toBe('🎯');
  });

  it('clicking a tab calls onSwitch with the list id', async () => {
    const rail = document.createElement('div');
    document.body.append(rail);
    const onSwitch = vi.fn();
    renderTabs(rail, makeLists(), 'a', { onSwitch, onAdd: vi.fn() });

    await userEvent.setup().click(/** @type {Element} */ (rail.querySelector('[data-id="b"]')));

    expect(onSwitch).toHaveBeenCalledWith('b');
    expect(onSwitch).toHaveBeenCalledTimes(1);
  });

  it('clicking + calls onAdd', async () => {
    const rail = document.createElement('div');
    document.body.append(rail);
    const onAdd = vi.fn();
    renderTabs(rail, makeLists(), 'a', { onSwitch: vi.fn(), onAdd });

    await userEvent.setup().click(/** @type {Element} */ (rail.querySelector('[aria-label="New list"]')));

    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});
