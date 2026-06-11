// @ts-check
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SyncedPasskeyKeyProvider } from './key-provider.js';

// ── helpers ────────────────────────────────────────────────────────────────

function makeCredId() {
  return crypto.getRandomValues(new Uint8Array(16));
}

/** @param {ArrayBuffer | Uint8Array} buf */
function toHex(buf) {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Build a fake PublicKeyCredential-like object.
 * @param {Uint8Array} rawId
 * @param {object} [extensionResults]
 */
function fakeCredential(rawId, extensionResults = {}) {
  return {
    rawId,
    getClientExtensionResults: () => extensionResults,
  };
}

/** Real 32-byte PRF output (arbitrary deterministic bytes for tests). */
const FAKE_PRF_BYTES = new Uint8Array(32).fill(0xab);

// ── setup ──────────────────────────────────────────────────────────────────

const store = new Map();
const localStorageMock = {
  getItem: vi.fn((k) => store.get(k) ?? null),
  setItem: vi.fn((k, v) => store.set(k, v)),
  removeItem: vi.fn((k) => store.delete(k)),
};

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
  vi.stubGlobal('localStorage', localStorageMock);
  vi.stubGlobal('location', { hostname: 'localhost' });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── load ───────────────────────────────────────────────────────────────────

describe('SyncedPasskeyKeyProvider.load', () => {
  it('returns null when no credential stored', () => {
    expect(SyncedPasskeyKeyProvider.load()).toBeNull();
  });

  it('returns instance when credential stored', () => {
    const hex = toHex(makeCredId());
    store.set('todo-passkey-credId', hex);
    const provider = SyncedPasskeyKeyProvider.load();
    expect(provider).toBeInstanceOf(SyncedPasskeyKeyProvider);
  });
});

// ── register ───────────────────────────────────────────────────────────────

describe('SyncedPasskeyKeyProvider.register', () => {
  it('calls credentials.create and persists credId', async () => {
    const rawId = makeCredId();
    const createMock = vi.fn().mockResolvedValue(
      fakeCredential(rawId, { prf: { enabled: true } }),
    );
    vi.stubGlobal('navigator', { credentials: { create: createMock } });

    const provider = await SyncedPasskeyKeyProvider.register();

    expect(createMock).toHaveBeenCalledOnce();
    const [opts] = createMock.mock.calls[0];
    expect(opts.publicKey.extensions).toEqual({ prf: {} });
    expect(opts.publicKey.authenticatorSelection.residentKey).toBe('required');

    expect(localStorageMock.setItem).toHaveBeenCalledWith('todo-passkey-credId', toHex(rawId));
    expect(provider).toBeInstanceOf(SyncedPasskeyKeyProvider);
  });
});

// ── resolve ────────────────────────────────────────────────────────────────

describe('SyncedPasskeyKeyProvider.resolve', () => {
  it('derives a usable AES key from PRF output', async () => {
    const rawId = makeCredId();
    const hex = toHex(rawId);
    store.set('todo-passkey-credId', hex);

    const getMock = vi.fn().mockResolvedValue(
      fakeCredential(rawId, { prf: { results: { first: FAKE_PRF_BYTES.buffer } } }),
    );
    vi.stubGlobal('navigator', { credentials: { get: getMock } });

    const provider = SyncedPasskeyKeyProvider.load();
    const { roomId, aesKey } = await /** @type {SyncedPasskeyKeyProvider} */ (provider).resolve();

    expect(roomId).toBe(hex);
    expect(aesKey.type).toBe('secret');
    expect(aesKey.algorithm.name).toBe('AES-GCM');
    expect(aesKey.usages).toContain('encrypt');
    expect(aesKey.usages).toContain('decrypt');
  });

  it('passes credId in allowCredentials', async () => {
    const rawId = makeCredId();
    const hex = toHex(rawId);
    store.set('todo-passkey-credId', hex);

    const getMock = vi.fn().mockResolvedValue(
      fakeCredential(rawId, { prf: { results: { first: FAKE_PRF_BYTES.buffer } } }),
    );
    vi.stubGlobal('navigator', { credentials: { get: getMock } });

    await /** @type {SyncedPasskeyKeyProvider} */ (SyncedPasskeyKeyProvider.load()).resolve();

    const [opts] = getMock.mock.calls[0];
    expect(opts.publicKey.allowCredentials).toHaveLength(1);
    expect(opts.publicKey.allowCredentials[0].type).toBe('public-key');
  });

  it('two resolves with same PRF bytes produce the same key material', async () => {
    const rawId = makeCredId();
    const hex = toHex(rawId);
    store.set('todo-passkey-credId', hex);

    const getMock = vi.fn().mockResolvedValue(
      fakeCredential(rawId, { prf: { results: { first: FAKE_PRF_BYTES.buffer } } }),
    );
    vi.stubGlobal('navigator', { credentials: { get: getMock } });

    const provider = /** @type {SyncedPasskeyKeyProvider} */ (SyncedPasskeyKeyProvider.load());
    const { aesKey: k1 } = await provider.resolve();
    const { aesKey: k2 } = await provider.resolve();

    // Both keys are non-extractable — verify they encrypt/decrypt each other's output.
    const enc = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k1, enc.encode('hello'));
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, k2, ct);
    expect(new TextDecoder().decode(pt)).toBe('hello');
  });

  it('throws when PRF results absent', async () => {
    const rawId = makeCredId();
    store.set('todo-passkey-credId', toHex(rawId));

    const getMock = vi.fn().mockResolvedValue(
      fakeCredential(rawId, { prf: {} }), // no results
    );
    vi.stubGlobal('navigator', { credentials: { get: getMock } });

    const provider = /** @type {SyncedPasskeyKeyProvider} */ (SyncedPasskeyKeyProvider.load());
    await expect(provider.resolve()).rejects.toThrow('PRF extension unavailable');
  });
});
