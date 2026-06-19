'use client';
import '@uiw/react-md-editor/markdown-editor.css';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PageHeading } from '../../PageHeading';
import { proofread, suggestTags, summarize } from '../../../lib/chrome-ai';
import { slugFromFilename } from '../../../lib/draft';
import styles from './Editor.module.scss';

// MDEditor touches the DOM on import — load it client-only.
const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false });

type Locale = 'en' | 'pt-BR';

function nowLocalDatetime(): string {
  return isoToLocalInput(new Date().toISOString());
}

// ISO instant → the `YYYY-MM-DDTHH:mm` shape a datetime-local input expects.
function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

// Drive the markdown editor's theme from the system preference, like the rest of
// the token-based light/dark design.
function useColorScheme(): 'light' | 'dark' {
  const [scheme, setScheme] = useState<'light' | 'dark'>('dark');
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => {
      setScheme(mq.matches ? 'dark' : 'light');
    };
    update();
    mq.addEventListener('change', update);
    return () => {
      mq.removeEventListener('change', update);
    };
  }, []);
  return scheme;
}

interface LoadedPost {
  filename?: string;
  slug?: string;
  seededFromEn?: boolean;
  title?: string;
  date?: string;
  tags?: string[];
  description?: string;
  draft?: boolean;
  body?: string;
  detail?: string;
}

export function Editor() {
  const [locale, setLocale] = useState<Locale>('en');
  const [title, setTitle] = useState('');
  const [dateLocal, setDateLocal] = useState(nowLocalDatetime());
  const [tags, setTags] = useState('');
  const [description, setDescription] = useState('');
  const [draft, setDraft] = useState(true);
  const [body, setBody] = useState('');
  const [savedFilename, setSavedFilename] = useState<string | null>(null);
  // When translating an EN post to pt-BR, the pt-BR file must share the EN slug.
  // The load endpoint returns `slug` when seeded; we pin it here and send it as
  // `slugOverride` on save so title changes don't create a divergent slug.
  const [pinnedSlug, setPinnedSlug] = useState<string | null>(null);
  const [heading, setHeading] = useState('New post');
  const [status, setStatus] = useState('');
  const [tone, setTone] = useState<'info' | 'ok' | 'error'>('info');
  const [busy, setBusy] = useState(false);
  const colorScheme = useColorScheme();

  function report(message: string, statusTone: 'info' | 'ok' | 'error') {
    setStatus(message);
    setTone(statusTone);
  }

  // Edit mode: ?slug=…&locale=… loads the existing post's raw fields.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');
    const queryLocale = params.get('locale') === 'pt-BR' ? 'pt-BR' : 'en';
    setLocale(queryLocale);
    if (!slug) return;
    setHeading('Edit post');
    void (async () => {
      try {
        const res = await fetch('/blog/api/draft/load/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, locale: queryLocale }),
        });
        const data = (await res.json()) as LoadedPost;
        if (!res.ok) throw new Error(data.detail ?? 'load failed');
        setTitle(data.title ?? '');
        if (data.date) setDateLocal(isoToLocalInput(data.date));
        setTags((data.tags ?? []).join(', '));
        setDescription(data.description ?? '');
        setDraft(data.draft ?? false);
        setBody(data.body ?? '');
        setSavedFilename(data.filename ?? null);
        if (data.seededFromEn && data.slug) setPinnedSlug(data.slug);
        const note = data.seededFromEn ? ' (seeded from EN — will create a new pt-BR file)' : '';
        report(`Editing ${data.filename ?? slug}.${note}`, 'info');
      } catch (err) {
        report(err instanceof Error ? err.message : String(err), 'error');
      }
    })();
  }, []);

  async function runAi(label: string, fn: () => Promise<void>) {
    setBusy(true);
    report(`${label}…`, 'info');
    try {
      await fn();
      report(`${label} done.`, 'ok');
    } catch (err) {
      report(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    report('Saving…', 'info');
    try {
      const res = await fetch('/blog/api/draft/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale,
          title,
          date: new Date(dateLocal).toISOString(),
          tags: tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
          description: description || undefined,
          draft,
          body,
          previousFilename: savedFilename ?? undefined,
          slugOverride: pinnedSlug ?? undefined,
        }),
      });
      const data = (await res.json()) as { filename?: string; detail?: string };
      if (!res.ok) throw new Error(data.detail ?? 'save failed');
      setSavedFilename(data.filename ?? null);
      setPinnedSlug(null); // file now exists — subsequent saves use previousFilename rename
      report(`Saved content/posts/${locale}/${data.filename ?? ''} — commit to publish.`, 'ok');
    } catch (err) {
      report(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  const viewHref =
    savedFilename
      ? locale === 'pt-BR'
        ? `/pt-BR/${slugFromFilename(savedFilename)}/`
        : `/${slugFromFilename(savedFilename)}/`
      : null;

  return (
    <div className={styles.admin}>
      <PageHeading>{heading}</PageHeading>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="title">
          Title
        </label>
        <input
          className={styles.control}
          id="title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
          }}
        />
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="date">
            Date
          </label>
          <input
            className={`${styles.control} ${styles.dateControl}`}
            id="date"
            type="datetime-local"
            value={dateLocal}
            onChange={(e) => {
              setDateLocal(e.target.value);
            }}
          />
        </div>
        <label className={styles.draft}>
          <input
            className={styles.draftBox}
            type="checkbox"
            checked={draft}
            onChange={(e) => {
              setDraft(e.target.checked);
            }}
          />
          <span className={styles.label}>Draft</span>
        </label>
      </div>

      <div className={styles.field}>
        <div className={styles.fieldHead}>
          <label className={styles.label} htmlFor="tags">
            Tags (comma-separated)
          </label>
          <button
            type="button"
            className={styles.wand}
            disabled={busy}
            title="Suggest tags from the body with Chrome AI"
            onClick={() => {
              void runAi('Tag suggestions', async () => {
                setTags((await suggestTags(body)).join(', '));
              });
            }}
          >
            🪄 Suggest
          </button>
        </div>
        <input
          className={styles.control}
          id="tags"
          value={tags}
          onChange={(e) => {
            setTags(e.target.value);
          }}
        />
      </div>

      <div className={styles.field}>
        <div className={styles.fieldHead}>
          <label className={styles.label} htmlFor="description">
            Description
          </label>
          <button
            type="button"
            className={styles.wand}
            disabled={busy}
            title="Summarize the body into a description with Chrome AI"
            onClick={() => {
              void runAi('Summary', async () => {
                setDescription(await summarize(body));
              });
            }}
          >
            🪄 Summarize
          </button>
        </div>
        <textarea
          className={styles.control}
          id="description"
          rows={2}
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
          }}
        />
      </div>

      <div className={styles.field} data-color-mode={colorScheme}>
        <div className={styles.bodyHead}>
          <span className={styles.label}>Body</span>
          <button
            type="button"
            className={styles.wand}
            disabled={busy}
            title="Proofread the body with Chrome AI"
            onClick={() => {
              void runAi('Proofread', async () => {
                setBody(await proofread(body));
              });
            }}
          >
            🪄 Proofread
          </button>
        </div>
        <MDEditor
          value={body}
          onChange={(v) => {
            setBody(v ?? '');
          }}
          height={420}
        />
      </div>

      <div className={styles.footer}>
        <button
          type="button"
          className={styles.save}
          disabled={busy}
          onClick={() => {
            void save();
          }}
        >
          Save
        </button>
        <span
          className={`${styles.status} ${tone === 'ok' ? styles.statusOk : ''} ${
            tone === 'error' ? styles.statusError : ''
          }`}
        >
          {status}
        </span>
        {viewHref && (
          <Link className={styles.viewLink} href={viewHref}>
            View post →
          </Link>
        )}
      </div>
    </div>
  );
}
