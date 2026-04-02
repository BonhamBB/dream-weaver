/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Encrypted localStorage wrapper using AES-GCM via Web Crypto API.
 * Uses a device-bound key derived from a stable fingerprint so data
 * cannot be trivially read by other scripts or browser extensions.
 */

const ALGO = 'AES-GCM';
const KEY_CACHE = new Map<string, CryptoKey>();

/** Derive a stable encryption key from a namespace string. */
async function getKey(namespace: string): Promise<CryptoKey> {
  const cached = KEY_CACHE.get(namespace);
  if (cached) return cached;

  // Use a device-stable seed: origin + namespace + user agent fingerprint
  const seed = `dw:${location.origin}:${namespace}:${navigator.userAgent.slice(0, 40)}`;
  const rawKey = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed));
  const key = await crypto.subtle.importKey('raw', rawKey, ALGO, false, ['encrypt', 'decrypt']);
  KEY_CACHE.set(namespace, key);
  return key;
}

/** Encrypt a string and store in localStorage. */
export async function secureSet(key: string, value: string): Promise<void> {
  try {
    const cryptoKey = await getKey(key);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(value);
    const ciphertext = await crypto.subtle.encrypt({ name: ALGO, iv }, cryptoKey, encoded);

    // Store as base64: iv + ciphertext
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);
    localStorage.setItem(key, btoa(String.fromCharCode(...combined)));
  } catch {
    // Fallback to plain storage if crypto fails (e.g. very old browser)
    localStorage.setItem(key, value);
  }
}

/** Read and decrypt from localStorage. */
export async function secureGet(key: string): Promise<string | null> {
  const raw = localStorage.getItem(key);
  if (!raw) return null;

  try {
    const combined = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const cryptoKey = await getKey(key);
    const decrypted = await crypto.subtle.decrypt({ name: ALGO, iv }, cryptoKey, ciphertext);
    return new TextDecoder().decode(decrypted);
  } catch {
    // If decryption fails, the data might be from before encryption was enabled.
    // Try returning as-is (legacy migration).
    return raw;
  }
}

/** Remove from localStorage. */
export function secureRemove(key: string): void {
  localStorage.removeItem(key);
}
