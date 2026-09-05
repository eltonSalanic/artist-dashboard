import type { PoolClient } from 'pg';
import { serializeQueries } from './pg-adapter';

/** Let every already-scheduled microtask and promise callback run. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

/**
 * A client that never finishes a query on its own: the test settles each one,
 * so overlap is observable. `maxInFlight` is what pg was warning about — more
 * than one query on the connection at the same time.
 */
function fakeClient() {
  const pending: {
    resolve: (value: string) => void;
    reject: (error: Error) => void;
  }[] = [];
  const started: string[] = [];
  let inFlight = 0;
  let maxInFlight = 0;

  const finish = (index: number) => {
    inFlight -= 1;
    return pending[index];
  };

  const client = {
    query: (config: { text: string }) => {
      started.push(config.text);
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      return new Promise<string>((resolve, reject) => {
        pending.push({ resolve, reject });
      });
    },
  } as unknown as PoolClient;

  return {
    client,
    started,
    resolve: (i: number, value: string) => finish(i).resolve(value),
    reject: (i: number, error: Error) => finish(i).reject(error),
    maxInFlight: () => maxInFlight,
    query: (text: string) =>
      (client.query as unknown as (c: { text: string }) => Promise<string>)({
        text,
      }),
  };
}

describe('serializeQueries', () => {
  it('runs concurrent queries one at a time, in call order', async () => {
    const fake = fakeClient();
    serializeQueries(fake.client);

    // The shape Prisma's interpreter produces inside a transaction: several
    // relation loads issued without awaiting each other.
    const all = Promise.all([
      fake.query('a'),
      fake.query('b'),
      fake.query('c'),
    ]);

    await flush();
    expect(fake.started).toEqual(['a']);

    fake.resolve(0, 'a');
    await flush();
    expect(fake.started).toEqual(['a', 'b']);

    fake.resolve(1, 'b');
    await flush();
    expect(fake.started).toEqual(['a', 'b', 'c']);

    fake.resolve(2, 'c');
    await expect(all).resolves.toEqual(['a', 'b', 'c']);
    expect(fake.maxInFlight()).toBe(1);
  });

  it('does not let a failed query poison the ones behind it', async () => {
    const fake = fakeClient();
    serializeQueries(fake.client);

    const failing = fake.query('boom');
    const following = fake.query('after');
    const rejection = expect(failing).rejects.toThrow('boom');

    await flush();
    fake.reject(0, new Error('boom'));
    await rejection;

    await flush();
    expect(fake.started).toEqual(['boom', 'after']);
    fake.resolve(1, 'after');
    await expect(following).resolves.toBe('after');
  });

  it('patches a pooled client only once', () => {
    // A pooled client is handed out and released many times; wrapping the
    // wrapper on every checkout would stack a chain per connection.
    const fake = fakeClient();
    const currentQuery = () =>
      Object.getOwnPropertyDescriptor(fake.client, 'query')?.value as unknown;

    serializeQueries(fake.client);
    const patched = currentQuery();
    serializeQueries(fake.client);

    expect(currentQuery()).toBe(patched);
  });

  it('passes the callback form straight through', () => {
    // pg's own `pool.query` path, which holds the client exclusively.
    const underlying = jest.fn();
    const client = { query: underlying } as unknown as PoolClient;
    serializeQueries(client);

    const cb = () => undefined;
    (client.query as unknown as (t: string, c: () => void) => void)(
      'select 1',
      cb,
    );
    expect(underlying).toHaveBeenCalledWith('select 1', cb);
  });
});
