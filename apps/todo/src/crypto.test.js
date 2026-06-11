// @ts-check
import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from './crypto.js';

async function makeKey() {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

describe('encrypt / decrypt', () => {
  it('round-trips plaintext', async () => {
    const key = await makeKey();
    const cipher = await encrypt(key, 'hello world');
    expect(await decrypt(key, cipher)).toBe('hello world');
  });

  it('round-trips empty string', async () => {
    const key = await makeKey();
    expect(await decrypt(key, await encrypt(key, ''))).toBe('');
  });

  it('produces different ciphertext each call (random IV)', async () => {
    const key = await makeKey();
    const c1 = await encrypt(key, 'same plaintext');
    const c2 = await encrypt(key, 'same plaintext');
    expect(c1).not.toEqual(c2);
  });

  it('throws on tampered ciphertext', async () => {
    const key = await makeKey();
    const cipher = await encrypt(key, 'sensitive');
    cipher[20] ^= 0xff;
    await expect(decrypt(key, cipher)).rejects.toThrow();
  });

  it('throws when decrypting with wrong key', async () => {
    const key1 = await makeKey();
    const key2 = await makeKey();
    const cipher = await encrypt(key1, 'secret');
    await expect(decrypt(key2, cipher)).rejects.toThrow();
  });
});
