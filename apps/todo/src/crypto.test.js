// @ts-check
import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from './crypto.js';

async function makeKey() {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

describe('crypto', () => {
  it('round-trips a plaintext string', async () => {
    const key = await makeKey();
    const ct = await encrypt(key, 'hello world');
    expect(await decrypt(key, ct)).toBe('hello world');
  });

  it('produces distinct ciphertexts for the same plaintext (random IV)', async () => {
    const key = await makeKey();
    const ct1 = await encrypt(key, 'same');
    const ct2 = await encrypt(key, 'same');
    expect(ct1).not.toEqual(ct2);
  });

  it('throws when decrypting with the wrong key', async () => {
    const key1 = await makeKey();
    const key2 = await makeKey();
    const ct = await encrypt(key1, 'secret');
    await expect(decrypt(key2, ct)).rejects.toThrow();
  });
});
