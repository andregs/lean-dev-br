import { describe, it, expect } from 'vitest';
import { createI18n, loadLocalePreference, localeFromNavigator, localeFromPath, saveLocalePreference, sharedCatalog } from './index.js';
import type { Locale } from './index.js';

const catalog: Record<Locale, Record<string, string>> = {
  'en-US': { ...sharedCatalog['en-US'], 'hero.title': 'Hello', 'hero.desc': 'World' },
  'pt-BR': { ...sharedCatalog['pt-BR'], 'hero.title': 'Olá', 'hero.desc': 'Mundo' },
};

describe('localeFromPath', () => {
  it('maps /pt to pt-BR', () => { expect(localeFromPath('/pt')).toBe('pt-BR'); });
  it('maps /pt/ prefix to pt-BR', () => { expect(localeFromPath('/pt/contact')).toBe('pt-BR'); });
  it('maps / to en-US', () => { expect(localeFromPath('/')).toBe('en-US'); });
  it('maps /contact to en-US', () => { expect(localeFromPath('/contact')).toBe('en-US'); });
  it('does not match /pt-extra as pt-BR', () => { expect(localeFromPath('/pt-extra')).toBe('en-US'); });
});

describe('localeFromNavigator', () => {
  it('maps pt-BR to pt-BR', () => { expect(localeFromNavigator('pt-BR')).toBe('pt-BR'); });
  it('maps pt to pt-BR', () => { expect(localeFromNavigator('pt')).toBe('pt-BR'); });
  it('maps pt-PT to pt-BR', () => { expect(localeFromNavigator('pt-PT')).toBe('pt-BR'); });
  it('maps en-US to en-US', () => { expect(localeFromNavigator('en-US')).toBe('en-US'); });
  it('maps fr-FR to en-US', () => { expect(localeFromNavigator('fr-FR')).toBe('en-US'); });
});

describe('saveLocalePreference / loadLocalePreference', () => {
  it('loadLocalePreference returns null when localStorage unavailable (node env)', () => {
    expect(loadLocalePreference()).toBeNull();
  });
  it('saveLocalePreference does not throw when localStorage unavailable', () => {
    expect(() => { saveLocalePreference('pt-BR'); }).not.toThrow();
  });
});

describe('createI18n — en-US', () => {
  const i18n = createI18n({ locale: 'en-US', catalog });

  it('translates a key', () => { expect(i18n.t('hero.title')).toBe('Hello'); });
  it('returns shared nav key', () => { expect(i18n.t('nav.contact')).toBe('Contact'); });
  it('returns the key itself for unknown keys', () => { expect(i18n.t('missing.key')).toBe('missing.key'); });
  it('exposes the active locale', () => { expect(i18n.locale).toBe('en-US'); });
});

describe('createI18n — pt-BR', () => {
  const i18n = createI18n({ locale: 'pt-BR', catalog });

  it('translates to Portuguese', () => { expect(i18n.t('hero.title')).toBe('Olá'); });
  it('returns shared nav key in pt-BR', () => { expect(i18n.t('nav.contact')).toBe('Contato'); });
  it('falls back to en-US for missing pt-BR key', () => {
    const partial: Record<Locale, Record<string, string>> = {
      'en-US': { 'only.in.en': 'English only' },
      'pt-BR': {},
    };
    const i = createI18n({ locale: 'pt-BR', catalog: partial });
    expect(i.t('only.in.en')).toBe('English only');
  });
});
