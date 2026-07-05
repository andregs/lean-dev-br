import { SiteFooter } from '@lean-dev-br/design-system/react';
import { BlogNav } from './BlogNav';
import { FaroBoot } from './FaroBoot';
import { FaroRouteTracker } from './FaroRouteTracker';
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
      <FaroBoot />
      <FaroRouteTracker />
      <BlogNav locale={locale} />
      <main className="page-shell">{children}</main>
      <SiteFooter />
    </body>
  );
}
