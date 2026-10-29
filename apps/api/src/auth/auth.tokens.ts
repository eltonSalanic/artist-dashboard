import type { createAuth } from './better-auth';

/**
 * What the rest of the API needs to know about Better Auth, without loading
 * it: `better-auth` ships ES modules only, which Jest's CommonJS runtime
 * can't import. Guards and services use these; only the module that builds
 * the instance (and main.ts) imports `better-auth` itself.
 */

/** Nest token for the Better Auth instance. */
export const BETTER_AUTH = Symbol('BETTER_AUTH');

/** Where Express mounts Better Auth's own routes (sign-in, sign-up, codes…). */
export const AUTH_BASE_PATH = '/api/auth';

export type Auth = ReturnType<typeof createAuth>;
