import i18nextLib from 'i18next';
import { initReactI18next } from 'react-i18next';
import { detectLocale, createI18nOptions } from '@lean-dev-br/i18n';
import enUS from './locales/en-US.json';
import ptBR from './locales/pt-BR.json';

export const i18n = i18nextLib.createInstance();

void i18n.use(initReactI18next).init({
  lng: detectLocale(),
  ...createI18nOptions({ 'en-US': enUS, 'pt-BR': ptBR }),
});
