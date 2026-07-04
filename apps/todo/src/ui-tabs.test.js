// @ts-check
import { afterEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderTabs } from './ui-tabs.js';

const LISTS = ['📋 Tasks', '🎯 Goals'];

/** @type {import('@lean-dev-br/i18n').I18nInstance} */
const testI18n = { locale: 'en-US', t: (k) => ({ 'tabs.add.aria': 'New list' })[k] ?? k };

afterEach(() => {
  document.body.innerHTML = '';
});

describe('renderTabs', () => {
  it('renders one tab per list', () => {
    const rail = document.createElement('div');
    document.body.append(rail);
    renderTabs(rail, LISTS, '📋 Tasks', { onSwitch: vi.fn(), onAdd: vi.fn() }, testI18n);

    expect(rail.querySelectorAll('[role="tab"]')).toHaveLength(2);
  });

  it('renders a + button to add a new list', () => {
    const rail = document.createElement('div');
    document.body.append(rail);
    renderTabs(rail, LISTS, '📋 Tasks', { onSwitch: vi.fn(), onAdd: vi.fn() }, testI18n);

    expect(rail.querySelector('[aria-label="New list"]')).toBeTruthy();
  });

  it('active tab has aria-selected=true, inactive tabs false', () => {
    const rail = document.createElement('div');
    document.body.append(rail);
    renderTabs(rail, LISTS, '🎯 Goals', { onSwitch: vi.fn(), onAdd: vi.fn() }, testI18n);

    // data-idx is an ASCII attribute set in the template — safe for jsdom CSS selectors
    expect(rail.querySelector('[data-idx="1"]')?.getAttribute('aria-selected')).toBe('true');
    expect(rail.querySelector('[data-idx="0"]')?.getAttribute('aria-selected')).toBe('false');
  });

  it('tab label shows the list emoji and aria-label is the full name', () => {
    const rail = document.createElement('div');
    document.body.append(rail);
    renderTabs(rail, LISTS, '📋 Tasks', { onSwitch: vi.fn(), onAdd: vi.fn() }, testI18n);

    const tab0 = rail.querySelector('[data-idx="0"]');
    const tab1 = rail.querySelector('[data-idx="1"]');
    expect(tab0?.textContent).toBe('📋');
    expect(tab0?.getAttribute('aria-label')).toBe('📋 Tasks');
    expect(tab1?.textContent).toBe('🎯');
    expect(tab1?.getAttribute('aria-label')).toBe('🎯 Goals');
  });

  it('clicking a tab calls onSwitch with the list name', async () => {
    const rail = document.createElement('div');
    document.body.append(rail);
    const onSwitch = vi.fn();
    renderTabs(rail, LISTS, '📋 Tasks', { onSwitch, onAdd: vi.fn() }, testI18n);

    await userEvent.setup().click(/** @type {Element} */ (rail.querySelector('[data-idx="1"]')));

    expect(onSwitch).toHaveBeenCalledWith('🎯 Goals');
    expect(onSwitch).toHaveBeenCalledTimes(1);
  });

  it('clicking + calls onAdd', async () => {
    const rail = document.createElement('div');
    document.body.append(rail);
    const onAdd = vi.fn();
    renderTabs(rail, LISTS, '📋 Tasks', { onSwitch: vi.fn(), onAdd }, testI18n);

    await userEvent
      .setup()
      .click(/** @type {Element} */ (rail.querySelector('[aria-label="New list"]')));

    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('tab color cycles by position', () => {
    const rail = document.createElement('div');
    document.body.append(rail);
    renderTabs(rail, LISTS, '📋 Tasks', { onSwitch: vi.fn(), onAdd: vi.fn() }, testI18n);

    expect(rail.querySelector('[data-idx="0"]')?.getAttribute('data-color')).toBe('0');
    expect(rail.querySelector('[data-idx="1"]')?.getAttribute('data-color')).toBe('1');
  });
});
