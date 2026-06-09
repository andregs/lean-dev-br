import './global.scss';
import type { Metadata } from 'next';
import Link from 'next/link';
import { BLOG_DESCRIPTION, BLOG_TITLE, blogUrl, SITE_NAME, SITE_URL } from '../lib/site';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: BLOG_TITLE, template: `%s — ${SITE_NAME}` },
  description: BLOG_DESCRIPTION,
  alternates: {
    types: { 'application/rss+xml': blogUrl('/feed.xml') },
  },
  openGraph: { siteName: SITE_NAME, type: 'website' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="site-nav">
          <div className="nav-inner">
            {/* Logo → apex homepage at `/`; a raw anchor bypasses the basePath
                that would otherwise rewrite it to `/blog`. */}
            <a className="nav-logo" href="/" aria-label="lean.dev.br — home">
              <svg className="brand-mark" viewBox="0 0 112 22" role="img" aria-label="lean::dev">
                <use href="/blog/logo.svg#brand-mark" />
              </svg>
            </a>
            <ul className="nav-links">
              <li>
                <Link href="/">Blog</Link>
              </li>
              <li>
                <a href="/contact">Contact</a>
              </li>
            </ul>
          </div>
        </nav>
        <main className="page-shell">{children}</main>
        <footer className="site-footer">
          <div className="footer-inner">
            <span>25.43°S 49.27°W</span>
            <a href="https://github.com/andregs/lean-dev-br" target="_blank" rel="noopener">
              GitHub
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
