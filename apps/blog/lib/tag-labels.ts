// Tag display labels per locale. Only tags with a non-trivial translation are
// listed; all others (tech proper nouns) pass through the slug unchanged.
// Identity (hrefs, generateStaticParams) always uses the EN slug.

import type { Locale } from './posts';

const PT_BR_LABELS: Record<string, string> = {
  security: 'segurança',
  decisions: 'decisões',
  infrastructure: 'infraestrutura',
};

export function tagLabel(slug: string, locale: Locale): string {
  if (locale === 'pt-BR') return PT_BR_LABELS[slug] ?? slug;
  return slug;
}
