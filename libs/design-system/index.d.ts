import type { FlagClient } from '@lean-dev-br/flags';
import type { I18nInstance, Locale } from '@lean-dev-br/i18n';

export declare function initNav(opts: {
  flags: FlagClient;
  i18n: I18nInstance;
  localePrefix?: string;
  onToggle?: (newLocale: Locale) => void;
}): void;
