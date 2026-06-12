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

const lsStore = new Map();
const localStorageMock = {
  getItem: vi.fn((k) => lsStore.get(k) ?? null),
  setItem: vi.fn((k, v) => lsStore.set(k, v)),
  removeItem: vi.fn((k) => lsStore.delete(k)),
};

const ssStore = new Map();
const sessionStorageMock = {
  getItem: vi.fn((k) => ssStore.get(k) ?? null),
  setItem: vi.fn((k, v) => ssStore.set(k, v)),
  removeItem: vi.fn((k) => ssStore.delete(k)),
};

beforeEach(() => {
  lsStore.clear();
  ssStore.clear();
  vi.clearAllMocks();
  vi.stubGlobal('localStorage', localStorageMock);
  vi.stubGlobal('sessionStorage', sessionStorageMock);
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
    lsStore.set('todo-passkey-credId', hex);
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

// ── restoreSession ─────────────────────────────────────────────────────────

describe('SyncedPasskeyKeyProvider.restoreSession', () => {
  it('returns null when sessionStorage is empty', async () => {
    expect(await SyncedPasskeyKeyProvider.restoreSession()).toBeNull();
  });

  it('returns null when credId in session does not match localStorage', async () => {
    const hex = toHex(makeCredId());
    lsStore.set('todo-passkey-credId', toHex(makeCredId())); // different cred
    ssStore.set('todo-session-v1', JSON.stringify({ c: hex, k: 'ab'.repeat(32) }));
    expect(await SyncedPasskeyKeyProvider.restoreSession()).toBeNull();
  });

  it('returns null and clears cache on corrupt JSON', async () => {
    ssStore.set('todo-session-v1', 'not-json');
    expect(await SyncedPasskeyKeyProvider.restoreSession()).toBeNull();
    expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('todo-session-v1');
  });

  it('restores a valid session written by resolve()', async () => {
    const rawId = makeCredId();
    const hex = toHex(rawId);
    lsStore.set('todo-passkey-credId', hex);

    const getMock = vi.fn().mockResolvedValue(
      fakeCredential(rawId, { prf: { results: { first: FAKE_PRF_BYTES.buffer } } }),
    );
    vi.stubGlobal('navigator', { credentials: { get: getMock } });

    // resolve() writes session to sessionStorage
    const provider = /** @type {SyncedPasskeyKeyProvider} */ (SyncedPasskeyKeyProvider.load());
    const { aesKey: k1 } = await provider.resolve();

    // restoreSession() reads it back — no WebAuthn call
    const restored = await SyncedPasskeyKeyProvider.restoreSession();
    expect(restored).not.toBeNull();
    expect(restored?.roomId).toBe(hex);

    // confirm keys are functionally identical
    const enc = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k1, enc.encode('hello'));
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, /** @type {CryptoKey} */ (restored?.aesKey), ct);
    expect(new TextDecoder().decode(pt)).toBe('hello');
  });
});

// ── resolve ────────────────────────────────────────────────────────────────

describe('SyncedPasskeyKeyProvider.resolve', () => {
  it('derives a usable AES key from PRF output', async () => {
    const rawId = makeCredId();
    const hex = toHex(rawId);
    lsStore.set('todo-passkey-credId', hex);

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
    lsStore.set('todo-passkey-credId', hex);

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
    lsStore.set('todo-passkey-credId', hex);

    const getMock = vi.fn().mockResolvedValue(
      fakeCredential(rawId, { prf: { results: { first: FAKE_PRF_BYTES.buffer } } }),
    );
    vi.stubGlobal('navigator', { credentials: { get: getMock } });

    const provider = /** @type {SyncedPasskeyKeyProvider} */ (SyncedPasskeyKeyProvider.load());
    const { aesKey: k1 } = await provider.resolve();
    const { aesKey: k2 } = await provider.resolve();

    // Both keys derive from the same PRF bytes — verify they encrypt/decrypt each other's output.
    const enc = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k1, enc.encode('hello'));
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, k2, ct);
    expect(new TextDecoder().decode(pt)).toBe('hello');
  });

  it('throws when PRF results absent', async () => {
    const rawId = makeCredId();
    lsStore.set('todo-passkey-credId', toHex(rawId));

    const getMock = vi.fn().mockResolvedValue(
      fakeCredential(rawId, { prf: {} }), // no results
    );
    vi.stubGlobal('navigator', { credentials: { get: getMock } });

    const provider = /** @type {SyncedPasskeyKeyProvider} */ (SyncedPasskeyKeyProvider.load());
    await expect(provider.resolve()).rejects.toThrow('PRF extension unavailable');
  });
});
