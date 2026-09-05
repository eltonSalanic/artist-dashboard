import { PrismaPg } from '@prisma/adapter-pg';
import { Pool, type PoolClient } from 'pg';

/**
 * A `$transaction` pins one pg connection for its whole body, and Prisma 7's
 * query interpreter fans a single query's relation loads out concurrently — so
 * one `findUnique` with several `include`s puts three or more queries on that
 * one connection at once. pg copes by queueing them, but warns that it will
 * stop doing so in pg@9:
 *
 *   Calling client.query() when the client is already executing a query is
 *   deprecated and will be removed in pg@9.0.
 *
 * Queueing them ourselves is that "external async flow control mechanism": the
 * same FIFO order pg's internal queue would have produced, off the deprecated
 * path, and still correct once pg@9 drops the queue entirely.
 */
const serialized = new WeakSet<PoolClient>();

/** Exported for its unit test; the pool below is the only real caller. */
export function serializeQueries(client: PoolClient): void {
  // Pooled clients are handed out many times; patch each physical one once.
  if (serialized.has(client)) return;
  serialized.add(client);

  const original = client.query.bind(client) as (
    ...args: unknown[]
  ) => Promise<unknown>;
  let tail: Promise<unknown> = Promise.resolve();

  client.query = ((...args: unknown[]) => {
    // Callback form is pg's own `pool.query` path, which holds the client
    // exclusively for one query. Nothing to serialize against.
    if (typeof args[args.length - 1] === 'function') return original(...args);

    const result = tail.then(() => original(...args));
    // A rejected query must not poison the ones queued behind it.
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }) as typeof client.query;
}

/** The one place the app's Postgres pool is built — see the note above. */
export function createPgAdapter(
  connectionString = process.env.DATABASE_URL,
): PrismaPg {
  const pool = new Pool({ connectionString });
  pool.on('connect', serializeQueries);
  return new PrismaPg(pool);
}
