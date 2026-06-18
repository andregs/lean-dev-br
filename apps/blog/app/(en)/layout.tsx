import type { Metadata } from 'next';
import { SiteChrome } from '../SiteChrome';
import { LocaleDefaultBoot } from '../LocaleDefaultBoot';
import { BLOG_DESCRIPTION, BLOG_TITLE, blogUrl, SITE_NAME } from '../../lib/site';
import '../global.scss';

export const metadata: Metadata = {
  metadataBase: new URL(blogUrl('/')),
  title: { default: BLOG_TITLE, template: `%s — ${SITE_NAME}` },
  description: BLOG_DESCRIPTION,
  alternates: {
    types: { 'application/rss+xml': blogUrl('/feed.xml') },
  },
  openGraph: { siteName: SITE_NAME, type: 'website' },
};

export default function EnLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <SiteChrome locale="en-US">
        <LocaleDefaultBoot />
        {children}
      </SiteChrome>
    </html>
  );
}
