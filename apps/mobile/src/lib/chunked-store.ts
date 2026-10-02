/**
 * A chunking wrapper around a key/value store with a small per-value ceiling.
 *
 * `expo-secure-store` documents a **2048-byte limit per value** (Android's
 * KeyStore), and it encrypts before storing, so the usable plaintext budget is
 * smaller still. A Supabase session is a JSON blob holding two JWTs plus the
 * user record and routinely runs past 3 KB — meaning the obvious
 * `storage: SecureStore` wiring works right up until a token gets long enough,
 * and then fails as a mysterious "signed out on relaunch".
 *
 * So values are split across `key.0`, `key.1`, … with a manifest at `key`
 * recording how many parts there are and how long the whole value was. The
 * length is what makes a torn write detectable: if the app dies between
 * writing part 0 and the manifest, reassembly would otherwise splice a new
 * first part onto an old second one and hand Supabase a plausible-looking but
 * corrupt string.
 *
 * The backend is injected, so all of this is testable without a device.
 */

/** The slice of `expo-secure-store` used here. */
export interface SecureStoreBackend {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

/** Matches Supabase's `SupportedStorage`, which allows sync or async. */
export interface AsyncStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * Conservative: half of the documented 2048-byte ceiling, because the stored
 * ciphertext is larger than the plaintext we measure. A 3 KB session becomes
 * three keychain entries, which is cheap next to getting this wrong.
 */
export const DEFAULT_CHUNK_BYTES = 1024;

const MANIFEST_PREFIX = '__chunks__:';

function utf8Length(codePoint: number): number {
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  if (codePoint < 0x10000) return 3;
  return 4;
}

/**
 * Splits on code-point boundaries measured in UTF-8 bytes — the unit the
 * backend's limit is expressed in. Splitting by `string.length` would be wrong
 * twice over: it counts UTF-16 units, not bytes, and it can cut a surrogate
 * pair in half so neither piece is valid text on its own.
 */
export function splitByUtf8Bytes(value: string, maxBytes: number): string[] {
  if (maxBytes < 4) {
    throw new Error('maxBytes must fit the widest single code point (4)');
  }
  const chunks: string[] = [];
  let current = '';
  let bytes = 0;

  for (const char of value) {
    const size = utf8Length(char.codePointAt(0) as number);
    if (bytes + size > maxBytes) {
      chunks.push(current);
      current = '';
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  if (current !== '') chunks.push(current);
  return chunks;
}

interface Manifest {
  count: number;
  length: number;
}

function parseManifest(head: string): Manifest | null {
  if (!head.startsWith(MANIFEST_PREFIX)) return null;
  const [count, length] = head.slice(MANIFEST_PREFIX.length).split(':');
  const parsed = { count: Number(count), length: Number(length) };
  if (!Number.isInteger(parsed.count) || parsed.count < 0) return null;
  if (!Number.isInteger(parsed.length) || parsed.length < 0) return null;
  return parsed;
}

export function createChunkedStore(
  backend: SecureStoreBackend,
  maxBytes: number = DEFAULT_CHUNK_BYTES,
): AsyncStore {
  const readManifest = async (key: string): Promise<Manifest | null> => {
    const head = await backend.getItemAsync(key);
    return head === null ? null : parseManifest(head);
  };

  return {
    async getItem(key) {
      const head = await backend.getItemAsync(key);
      if (head === null) return null;

      const manifest = parseManifest(head);
      // A value written before this wrapper existed, or by anything else that
      // shares the keychain: hand it back untouched.
      if (manifest === null) return head;

      const parts: string[] = [];
      for (let i = 0; i < manifest.count; i += 1) {
        const part = await backend.getItemAsync(`${key}.${i}`);
        if (part === null) return null;
        parts.push(part);
      }
      const value = parts.join('');
      // Torn write: a stale part survived under a fresh manifest, or the
      // reverse. Reporting "nothing stored" costs a sign-in; reporting a
      // half-session costs a confusing crash inside Supabase.
      return value.length === manifest.length ? value : null;
    },

    async setItem(key, value) {
      const previous = await readManifest(key);
      const chunks = splitByUtf8Bytes(value, maxBytes);

      for (let i = 0; i < chunks.length; i += 1) {
        await backend.setItemAsync(`${key}.${i}`, chunks[i]);
      }
      await backend.setItemAsync(
        key,
        `${MANIFEST_PREFIX}${chunks.length}:${value.length}`,
      );
      // Only now are the leftovers of a longer previous value unreachable.
      for (let i = chunks.length; i < (previous?.count ?? 0); i += 1) {
        await backend.deleteItemAsync(`${key}.${i}`);
      }
    },

    async removeItem(key) {
      const manifest = await readManifest(key);
      await backend.deleteItemAsync(key);
      for (let i = 0; i < (manifest?.count ?? 0); i += 1) {
        await backend.deleteItemAsync(`${key}.${i}`);
      }
    },
  };
}
