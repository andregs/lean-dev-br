// Client-only wrappers around Chrome's built-in AI (experimental, behind flags).
// Each feature-detects and throws a clear message when unavailable — this is
// dev-only authoring tooling, so requiring Chrome + flags is acceptable.
// Refs: https://developer.chrome.com/docs/ai/built-in

type Availability = 'unavailable' | 'downloadable' | 'downloading' | 'available';

interface LanguageModelSession {
  prompt(input: string): Promise<string>;
  destroy(): void;
}
interface SummarizerSession {
  summarize(input: string): Promise<string>;
  destroy(): void;
}
interface ProofreaderSession {
  proofread(input: string): Promise<{ correctedInput: string }>;
  destroy(): void;
}

interface AiFactory<S, O = unknown> {
  // availability() takes the same options as create() — pass the language config
  // to both, or Chrome warns "no output language was specified".
  availability(options?: O): Promise<Availability>;
  create(options?: O): Promise<S>;
}

declare global {
  var LanguageModel:
    | AiFactory<LanguageModelSession, { expectedOutputs?: { type: string; languages: string[] }[] }>
    | undefined;
  var Summarizer:
    | AiFactory<
        SummarizerSession,
        {
          type?: string;
          length?: string;
          format?: string;
          outputLanguage?: string;
          expectedInputLanguages?: string[];
        }
      >
    | undefined;
  var Proofreader: AiFactory<ProofreaderSession, { expectedInputLanguages?: string[] }> | undefined;
}

async function open<S, O>(
  factory: AiFactory<S, O> | undefined,
  name: string,
  options?: O,
): Promise<S> {
  if (!factory) {
    throw new Error(`${name} unavailable — enable Chrome's built-in AI (chrome://flags).`);
  }
  if ((await factory.availability(options)) === 'unavailable') {
    throw new Error(`${name} model is unavailable on this device.`);
  }
  return factory.create(options);
}

export async function proofread(text: string): Promise<string> {
  const session = await open(globalThis.Proofreader, 'Proofreader API', {
    expectedInputLanguages: ['en'],
  });
  try {
    return (await session.proofread(text)).correctedInput;
  } finally {
    session.destroy();
  }
}

export async function summarize(text: string): Promise<string> {
  const session = await open(globalThis.Summarizer, 'Summarizer API', {
    type: 'tldr',
    length: 'short',
    format: 'plain-text',
    outputLanguage: 'en',
    expectedInputLanguages: ['en'],
  });
  try {
    return (await session.summarize(text)).trim();
  } finally {
    session.destroy();
  }
}

export async function suggestTags(text: string): Promise<string[]> {
  const session = await open(globalThis.LanguageModel, 'Prompt API', {
    expectedOutputs: [{ type: 'text', languages: ['en'] }],
  });
  try {
    const reply = await session.prompt(
      'Suggest 3 to 5 short lowercase topic tags for the following dev blog post. ' +
        'Reply with ONLY a comma-separated list, no prose.\n\n' +
        text,
    );
    return reply
      .split(',')
      .map((tag) =>
        tag
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, '-')
          .replace(/^-+|-+$/g, ''),
      )
      .filter(Boolean)
      .slice(0, 5);
  } finally {
    session.destroy();
  }
}
