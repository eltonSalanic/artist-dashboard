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
    /**
     * `'ios' | 'android' | 'web'`, inlined by Babel the same way — the
     * documented alternative to `Platform.OS`, because the branch not taken is
     * dropped from the bundle instead of shipped to every platform.
     */
    readonly EXPO_OS?: 'ios' | 'android' | 'web';
    readonly EXPO_PUBLIC_API_URL?: string;
    readonly EXPO_PUBLIC_SUPABASE_URL?: string;
    /** development | staging | production, set per EAS build profile. */
    readonly EXPO_PUBLIC_APP_ENV?: string;
    /** Sentry DSN; unset means no error reporting. */
    readonly EXPO_PUBLIC_SENTRY_DSN?: string;
    /** RevenueCat public SDK keys (docs/billing.md); unset hides Band Pro buying. */
    readonly EXPO_PUBLIC_REVENUECAT_IOS_KEY?: string;
    readonly EXPO_PUBLIC_REVENUECAT_ANDROID_KEY?: string;
  };
};
