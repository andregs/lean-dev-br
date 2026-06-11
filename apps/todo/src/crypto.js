// @ts-check
// AES-GCM encrypt/decrypt. IV (12 bytes) is prepended to every ciphertext.

const ALG = 'AES-GCM';
const IV_LEN = 12;
const enc = new TextEncoder();
const dec = new TextDecoder();

/**
 * @param {CryptoKey} aesKey
 * @param {string} plaintext
 * @returns {Promise<Uint8Array>}
 */
export async function encrypt(aesKey, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const buf = await crypto.subtle.encrypt({ name: ALG, iv }, aesKey, enc.encode(plaintext));
  const out = new Uint8Array(IV_LEN + buf.byteLength);
  out.set(iv);
  out.set(new Uint8Array(buf), IV_LEN);
  return out;
}

/**
 * @param {CryptoKey} aesKey
 * @param {Uint8Array} ciphertext
 * @returns {Promise<string>}
 */
export async function decrypt(aesKey, ciphertext) {
  const iv = ciphertext.slice(0, IV_LEN);
  const buf = await crypto.subtle.decrypt({ name: ALG, iv }, aesKey, ciphertext.slice(IV_LEN));
  return dec.decode(buf);
}
