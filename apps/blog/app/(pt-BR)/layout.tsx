import type { Metadata } from 'next';
import { SiteChrome } from '../SiteChrome';
import { BLOG_DESCRIPTION, BLOG_TITLE, blogUrl, SITE_NAME } from '../../lib/site';
import '../global.scss';

export const metadata: Metadata = {
  metadataBase: new URL(blogUrl('/')),
  title: { default: BLOG_TITLE, template: `%s — ${SITE_NAME}` },
  description: BLOG_DESCRIPTION,
  alternates: {
    types: { 'application/rss+xml': blogUrl('/pt-BR/feed.xml') },
  },
  openGraph: { siteName: SITE_NAME, type: 'website' },
};

export default function PtBRLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <SiteChrome locale="pt-BR">{children}</SiteChrome>
    </html>
  );
}
