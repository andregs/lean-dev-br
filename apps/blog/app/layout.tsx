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
        <nav className="site-nav">
          <Link href="/" className="brand">
            lean.dev.br / blog
          </Link>
          {/* Plain anchor — apex root lives outside the blog basePath. */}
          <a href="/">← home</a>
        </nav>
        <main className="content">{children}</main>
        <footer className="site-footer">
          <span>25.43°S 49.27°W</span>
          <a href="https://github.com/andregs/lean-dev-br" target="_blank" rel="noopener">
            GitHub
          </a>
        </footer>
      </body>
    </html>
  );
}
