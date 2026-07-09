import { Component, EventEmitter, Input, Output } from '@angular/core';
import type { I18nInstance, Locale } from '@lean-dev-br/i18n';

// Markup contract shared with the React SiteNav (libs/design-system/react/SiteNav.tsx):
// nav.site-nav > .nav-inner > .nav-logo > svg.brand-mark, ul.nav-links > li > a (see nav.css).
@Component({
  selector: 'lean-site-nav',
  standalone: true,
  template: `
    <nav class="site-nav">
      <div class="nav-inner">
        <a class="nav-logo" href="/" aria-label="lean.dev.br — home">
          <svg class="brand-mark" viewBox="0 0 112 22" role="img" aria-label="lean::dev">
            <use [attr.href]="logoUrl"></use>
          </svg>
        </a>
        <ul class="nav-links">
          <li>
            <a [href]="localePrefix + '/blog/'">{{ i18n.t('nav.blog') }}</a>
          </li>
          <li>
            <a [href]="localePrefix + '/labs'">{{ i18n.t('nav.labs') }}</a>
          </li>
          <li>
            <a [href]="localePrefix + '/contact'">{{ i18n.t('nav.contact') }}</a>
          </li>
          <ng-content></ng-content>
          <li>
            <button
              class="lang-toggle"
              [attr.aria-label]="i18n.t('lang.toggle.label')"
              [attr.title]="i18n.t('lang.toggle.label')"
              (click)="onToggleClick()"
            >
              {{ i18n.t('lang.toggle') }}
            </button>
          </li>
        </ul>
      </div>
    </nav>
  `,
})
export class SiteNav {
  @Input({ required: true }) logoUrl!: string;
  @Input({ required: true }) i18n!: I18nInstance;
  /** Path prefix for nav links, e.g. '/pt-BR' when showing Portuguese; '' otherwise. */
  @Input() localePrefix = '';
  @Output() localeToggle = new EventEmitter<Locale>();

  onToggleClick(): void {
    this.localeToggle.emit(this.i18n.locale === 'pt-BR' ? 'en-US' : 'pt-BR');
  }
}
