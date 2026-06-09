import dynamic from 'next/dynamic';
import { notFound } from 'next/navigation';

// Dev-only authoring page. The editor import lives in a NODE_ENV-dead branch so
// the production bundler drops it entirely (no @uiw/react-md-editor in the
// shipped static export); the page 404s in production as a backstop.
const Editor =
  process.env.NODE_ENV === 'production'
    ? () => null
    : dynamic(() => import('./Editor').then((m) => m.Editor));

export default function AdminPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <Editor />;
}
