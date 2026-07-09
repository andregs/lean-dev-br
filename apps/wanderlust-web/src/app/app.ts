import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SiteNav } from '@lean-dev-br/design-system/angular/site-nav';
import { SiteFooter } from '@lean-dev-br/design-system/angular/site-footer';
import { createI18n, saveLocalePreference, sharedCatalog } from '@lean-dev-br/i18n';
import type { I18nInstance, Locale } from '@lean-dev-br/i18n';
import enUS from '../locales/en-US.json';
import ptBR from '../locales/pt-BR.json';

const catalog = {
  'en-US': { ...sharedCatalog['en-US'], ...enUS },
  'pt-BR': { ...sharedCatalog['pt-BR'], ...ptBR },
};

// No locale-prefixed routes yet (iteration 0 ships no pages) - toggling is a
// full reload. Revisit with Angular Router locale matching once real routes land.
function canonicalPath(pathname: string): string {
  if (pathname === '/pt-BR') return '/';
  if (pathname.startsWith('/pt-BR/')) return pathname.slice(6);
  return pathname;
}

@Component({
  imports: [RouterModule, SiteNav, SiteFooter],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected title = 'wanderlust-web';
  protected i18n: I18nInstance = createI18n({ catalog });
  protected localePrefix = this.i18n.locale === 'pt-BR' ? '/pt-BR' : '';

  constructor() {
    document.documentElement.lang = this.i18n.locale === 'pt-BR' ? 'pt-BR' : 'en';
  }

  onLocaleToggle(newLocale: Locale): void {
    saveLocalePreference(newLocale);
    const canon = canonicalPath(window.location.pathname);
    const next = newLocale === 'pt-BR' ? (canon === '/' ? '/pt-BR' : '/pt-BR' + canon) : canon;
    window.location.assign(next);
  }
}
