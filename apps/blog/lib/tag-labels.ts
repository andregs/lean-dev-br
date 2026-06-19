// Tag display labels per locale. Only tags with a non-trivial translation appear
// in the locale JSON (src/locales/pt-BR.json under "tag.<slug>" keys); tech
// proper nouns pass through unchanged. Identity (hrefs, generateStaticParams)
// always uses the EN slug.

import type { Locale } from './posts';
import { getT } from './i18n';

export function tagLabel(slug: string, locale: Locale): string {
  return getT(locale)(`tag.${slug}`, { defaultValue: slug });
}
