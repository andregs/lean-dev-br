import './global.scss';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'lean.dev.br — blog',
  description: 'A dev blog by André Gomes — notes on full-stack and cloud.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav>
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
        <main className="content">{children}</main>
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
