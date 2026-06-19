'use client';

// Runs once in the EN tree. Redirects to the pt-BR equivalent when:
//   - lean:locale is explicitly 'pt-BR' (set by the toggle on any app), OR
//   - no stored preference and navigator.language starts with 'pt'
// An explicit 'en-US' stored choice stays on EN (the user switched deliberately).

import { useEffect } from 'react';

const LOCALE_KEY = 'lean:locale';

export function LocaleDefaultBoot() {
  useEffect(() => {
    const stored = localStorage.getItem(LOCALE_KEY);
    const prefersPt = stored === 'pt-BR' || (!stored && navigator.language.startsWith('pt'));
    if (!prefersPt) return;

    const { pathname } = window.location;
    const afterBase = pathname.replace(/^\/blog/, '');
    // Dev-only routes have no pt-BR equivalent — skip the redirect.
    if (afterBase.startsWith('/editor')) return;
    window.location.replace(`/blog/pt-BR${afterBase}`);
  }, []);

  return null;
}
