import dynamic from 'next/dynamic';
import { notFound } from 'next/navigation';

// Dev-only authoring page (new post, or edit via ?slug). The editor import lives
// in a NODE_ENV-dead branch so the production bundler drops it entirely (no
// @uiw/react-md-editor in the shipped export); the page 404s in production too.
const Editor =
  process.env.NODE_ENV === 'production'
    ? () => null
    : dynamic(() => import('./Editor').then((m) => m.Editor));

export default function EditorPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <Editor />;
}
