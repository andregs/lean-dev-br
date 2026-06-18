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
      <footer className="site-footer">
        <div className="footer-inner">
          <span>25.43°S 49.27°W</span>
          <a
            className="footer-link"
            href="https://github.com/andregs/lean-dev-br"
            target="_blank"
            rel="noopener"
          >
            GitHub
          </a>
        </div>
      </footer>
    </body>
  );
}
