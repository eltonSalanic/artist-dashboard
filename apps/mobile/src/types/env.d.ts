/**
 * `process` is not a real object here — Babel inlines `process.env.EXPO_PUBLIC_*`
 * into the bundle as string literals, and nothing else about Node exists at
 * runtime. So this declares exactly the three names that get inlined rather
 * than pulling in `@types/node`, which would type up a whole standard library
 * React Native does not have.
 *
 * Every variable is optional: a missing one is a real possibility, and
 * `src/lib/env.ts` is the single place that turns it into a readable error.
 */
declare const process: {
  readonly env: {
    readonly EXPO_PUBLIC_API_URL?: string;
    readonly EXPO_PUBLIC_SUPABASE_URL?: string;
    readonly EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
  };
};
