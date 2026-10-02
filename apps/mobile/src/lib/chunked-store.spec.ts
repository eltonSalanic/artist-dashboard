import {
  createChunkedStore,
  splitByUtf8Bytes,
  type SecureStoreBackend,
} from './chunked-store';

/** Stands in for the keychain. The real one has a per-value size limit; this
 * one enforces it too, so a test fails rather than passing on a fiction. */
function fakeBackend(maxBytes = 1024) {
  const items = new Map<string, string>();
  const backend: SecureStoreBackend = {
    getItemAsync: async (key) => items.get(key) ?? null,
    setItemAsync: async (key, value) => {
      const bytes = new TextEncoder().encode(value).length;
      if (bytes > maxBytes) {
        throw new Error(`value for ${key} is ${bytes} bytes, limit ${maxBytes}`);
      }
      items.set(key, value);
    },
    deleteItemAsync: async (key) => {
      items.delete(key);
    },
  };
  return { backend, items };
}

describe('splitByUtf8Bytes', () => {
  it('measures bytes, not UTF-16 units', () => {
    // Four 3-byte characters: 4 chars, 12 bytes, so a 6-byte budget splits
    // them in half. Counting `.length` would have left them in one chunk.
    const chunks = splitByUtf8Bytes('日本語訳', 6);
    expect(chunks).toEqual(['日本', '語訳']);
  });

  it('never splits a surrogate pair', () => {
    // Each emoji is 4 UTF-8 bytes and 2 UTF-16 units.
    const chunks = splitByUtf8Bytes('🎸🎹🥁', 5);
    expect(chunks).toEqual(['🎸', '🎹', '🥁']);
    // A cut mid-pair would leave a lone surrogate behind.
    for (const chunk of chunks) {
      expect(chunk.isWellFormed()).toBe(true);
    }
  });

  it('round-trips by concatenation', () => {
    const value = 'a'.repeat(100) + '🎸' + 'é'.repeat(50);
    expect(splitByUtf8Bytes(value, 7).join('')).toBe(value);
  });

  it('keeps a value that already fits in one chunk', () => {
    expect(splitByUtf8Bytes('short', 1024)).toEqual(['short']);
  });

  it('rejects a budget too small for one code point', () => {
    expect(() => splitByUtf8Bytes('x', 3)).toThrow(/widest single code point/);
  });
});

describe('createChunkedStore', () => {
  // The case that motivates the whole file: a real Supabase session is a few
  // kilobytes, which a single SecureStore value cannot hold.
  const session = JSON.stringify({
    access_token: `header.${'p'.repeat(2400)}.signature`,
    refresh_token: 'r'.repeat(64),
    user: { id: 'u1', email: 'drummer@example.com' },
  });

  it('round-trips a value far larger than the backend limit', async () => {
    const { backend, items } = fakeBackend();
    const store = createChunkedStore(backend);

    await store.setItem('sb-auth-token', session);
    expect(await store.getItem('sb-auth-token')).toBe(session);
    // Proof it actually chunked rather than squeaking under the limit.
    expect(items.size).toBeGreaterThan(2);
  });

  it('returns null for a key that was never written', async () => {
    const { backend } = fakeBackend();
    expect(await createChunkedStore(backend).getItem('nope')).toBeNull();
  });

  it('round-trips an empty string without losing it', async () => {
    const { backend } = fakeBackend();
    const store = createChunkedStore(backend);
    await store.setItem('k', '');
    expect(await store.getItem('k')).toBe('');
  });

  it('drops leftover chunks when a value gets shorter', async () => {
    const { backend, items } = fakeBackend(16);
    const store = createChunkedStore(backend, 8);

    await store.setItem('k', 'a'.repeat(40));
    await store.setItem('k', 'b');

    expect(await store.getItem('k')).toBe('b');
    // Manifest + exactly one chunk. A stale `k.1` would be spliced onto the
    // next longer value and silently corrupt it.
    expect([...items.keys()].sort()).toEqual(['k', 'k.0']);
  });

  it('removes every chunk, not just the manifest', async () => {
    const { backend, items } = fakeBackend(16);
    const store = createChunkedStore(backend, 8);

    await store.setItem('k', 'a'.repeat(40));
    await store.removeItem('k');

    expect(items.size).toBe(0);
    expect(await store.getItem('k')).toBeNull();
  });

  it('reports a torn write as absent rather than returning half a value', async () => {
    const { backend, items } = fakeBackend(16);
    const store = createChunkedStore(backend, 8);

    await store.setItem('k', 'a'.repeat(40));
    // Simulate the app dying mid-write: one chunk is replaced by a shorter one
    // while the manifest still describes the old total.
    items.set('k.2', 'x');

    expect(await store.getItem('k')).toBeNull();
  });

  it('reports a missing chunk as absent', async () => {
    const { backend, items } = fakeBackend(16);
    const store = createChunkedStore(backend, 8);

    await store.setItem('k', 'a'.repeat(40));
    items.delete('k.1');

    expect(await store.getItem('k')).toBeNull();
  });

  it('passes through a value written without a manifest', async () => {
    const { backend, items } = fakeBackend();
    items.set('legacy', 'plain-value');
    expect(await createChunkedStore(backend).getItem('legacy')).toBe(
      'plain-value',
    );
  });
});
