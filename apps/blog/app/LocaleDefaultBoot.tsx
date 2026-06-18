'use client';

// Runs once in the EN tree. If the visitor has no stored locale preference
// and their browser language starts with 'pt', redirect them to the pt-BR
// equivalent path. Mirrors the apex/todo pt-* → pt-BR default.
//
// An explicit stored choice ('lean:locale' in localStorage) always wins —
// a user who manually switched to EN stays on EN.

import { useEffect } from 'react';

const LOCALE_KEY = 'lean:locale';

export function LocaleDefaultBoot() {
  useEffect(() => {
    if (localStorage.getItem(LOCALE_KEY)) return;
    if (!navigator.language.startsWith('pt')) return;

    // Rewrite /blog/<rest> → /blog/pt-BR/<rest>
    const { pathname } = window.location;
    const afterBase = pathname.replace(/^\/blog/, '');
    window.location.replace(`/blog/pt-BR${afterBase}`);
  }, []);

  return null;
}
