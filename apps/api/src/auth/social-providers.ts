/** Which social sign-ins the API accepts. Kept apart from Better Auth so it unit-tests. */
export interface SocialOptions {
  /**
   * Sign in with Apple. The phone's native sheet signs ID tokens for the app's
   * bundle ID; a Services ID is only needed for a web or Android sign-in.
   */
  apple?: { bundleId: string; serviceId?: string };
  /**
   * Google sign-in: every OAuth client ID whose ID tokens are accepted (iOS,
   * Android and Web). Without any, Google sign-in is off.
   */
  google?: { clientIds: string[] };
}

/** The social providers that are configured, for Better Auth. */
export function socialProviders(options: SocialOptions) {
  return {
    ...(options.apple && {
      apple: {
        clientId: options.apple.serviceId ?? options.apple.bundleId,
        // Only ID-token sign-in is used, which never needs the secret.
        clientSecret: '',
        appBundleIdentifier: options.apple.bundleId,
        // The phone's token is for the bundle ID; a web one for the Services ID.
        audience: [options.apple.bundleId, options.apple.serviceId].filter(
          (id): id is string => Boolean(id),
        ),
      },
    }),
    ...(options.google?.clientIds.length && {
      google: { clientId: options.google.clientIds },
    }),
  };
}
