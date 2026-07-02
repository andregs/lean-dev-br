import { SiteFooter } from '@lean-dev-br/design-system/react';
import { BlogNav } from './BlogNav';
import { RumBoot } from './RumBoot';
import { TrustedTypesBoot } from './TrustedTypesBoot';
import type { Locale } from '../lib/posts';

interface Props {
  locale: Locale;
  children: React.ReactNode;
}

export function SiteChrome({ locale, children }: Props) {
  return (
    <body>
      <TrustedTypesBoot />
      <RumBoot />
      <BlogNav locale={locale} />
      <main className="page-shell">{children}</main>
      <SiteFooter />
    </body>
  );
}
