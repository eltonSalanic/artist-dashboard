/**
 * app.json, plus what depends on the environment:
 *
 * 1. The app variant (APP_VARIANT). The dev client gets its own bundle ID and
 *    name, so it can sit on a phone beside the TestFlight build instead of
 *    being replaced by it. eas.json sets APP_VARIANT per build profile; the
 *    local `npm run ios` / `npm start` scripts set `development`. Unset means
 *    production, i.e. exactly what app.json says.
 *
 *    | Variant     | Name             | iOS bundle ID / Android package |
 *    |-------------|------------------|---------------------------------|
 *    | production  | Band Wall        | com.bandwall.app                |
 *    | staging     | Band Wall        | com.bandwall.app (shared, for now) |
 *    | development | Band Wall (Dev)  | com.bandwall.app.dev            |
 *
 *    A new bundle ID needs its own Google iOS OAuth client, and the local API's
 *    APPLE_BUNDLE_ID must match it, or Apple and Google sign-in fail.
 *
 * 2. Google sign-in's native setup, which needs the iOS OAuth client ID turned
 *    around into the URL scheme Google's sheet returns to. Without the ID there
 *    is no Google button, so the plugin is left out (docs/sign-in.md).
 */
const VARIANTS = {
  production: { name: 'Band Wall', id: 'com.bandwall.app' },
  staging: { name: 'Band Wall', id: 'com.bandwall.app' },
  development: { name: 'Band Wall (Dev)', id: 'com.bandwall.app.dev' },
};

module.exports = ({ config }) => {
  const variantName = process.env.APP_VARIANT || 'production';
  const variant = VARIANTS[variantName];
  if (!variant) {
    throw new Error(`Unknown APP_VARIANT "${variantName}" (${Object.keys(VARIANTS).join(', ')})`);
  }

  const result = {
    ...config,
    name: variant.name,
    ios: { ...config.ios, bundleIdentifier: variant.id },
    android: { ...config.android, package: variant.id },
  };

  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  if (!iosClientId) return result;
  const iosUrlScheme = `com.googleusercontent.apps.${iosClientId.replace('.apps.googleusercontent.com', '')}`;
  return {
    ...result,
    plugins: [...result.plugins, ['@react-native-google-signin/google-signin', { iosUrlScheme }]],
  };
};
