process.env.TZ = 'UTC';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the heavy markdown editor + the Chrome-AI helpers — neither is the unit
// under test, and both need a real browser API.
vi.mock('@uiw/react-md-editor', () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea
      aria-label="body"
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
      }}
    />
  ),
}));
vi.mock('../../lib/chrome-ai', () => ({
  proofread: vi.fn(),
  suggestTags: vi.fn(),
  summarize: vi.fn(),
}));

import { Editor } from './Editor';

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // Fake only Date (pin the clock) so real timers keep userEvent/waitFor working.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-06-08T15:30:00.000Z'));
  window.history.replaceState(null, '', '/');
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  );
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

function input(label: string): HTMLInputElement {
  return screen.getByLabelText<HTMLInputElement>(label);
}

describe('Editor form (new post)', () => {
  it('POSTs the entered fields as a normalized draft payload with the pinned date', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ filename: '2026-06-08-my-post.md' }),
    });
    const user = userEvent.setup();
    render(<Editor />);

    await user.type(input('Title'), 'My Post');
    await user.type(input('Tags (comma-separated)'), ' nextjs ,, csp ');
    await user.type(input('Description'), 'a desc');

    const draft = input('Draft');
    expect(draft.checked).toBe(true); // drafts default on
    await user.click(draft);
    expect(draft.checked).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/blog/api/draft/');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({
      title: 'My Post',
      tags: ['nextjs', 'csp'], // trimmed, blanks dropped
      description: 'a desc',
      draft: false,
      date: '2026-06-08T15:30:00.000Z', // datetime-local default round-trips to the pinned instant
    });
  });

  it('shows a success status with a view-post link after saving', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ filename: '2026-06-08-my-post.md' }),
    });
    const user = userEvent.setup();
    render(<Editor />);

    await user.type(input('Title'), 'My Post');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(/Saved content\/posts\/2026-06-08-my-post\.md/)).toBeDefined();
    // basePath (/blog) is applied by next/link at runtime, not in this unit test.
    expect((await screen.findByText('View post →')).getAttribute('href')).toContain('my-post');
  });
});

describe('Editor form (edit mode)', () => {
  it('loads ?slug into the fields, populated and titled "Edit post"', async () => {
    window.history.replaceState(null, '', '?slug=existing');
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          filename: '2026-06-07-existing.md',
          title: 'Existing Post',
          date: '2026-06-07T09:00:00.000Z',
          tags: ['meta', 'nextjs'],
          description: 'old desc',
          draft: false,
          body: 'old body',
        }),
    });

    render(<Editor />);

    await waitFor(() => {
      expect(input('Title').value).toBe('Existing Post');
    });
    expect(input('Tags (comma-separated)').value).toBe('meta, nextjs');
    expect(input('Description').value).toBe('old desc');
    expect(input('Date').value).toBe('2026-06-07T09:00');
    expect((input('Draft')).checked).toBe(false);
    expect(screen.getByText('Edit post')).toBeDefined();

    expect(fetchMock).toHaveBeenCalledWith(
      '/blog/api/draft/load/',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
