/**
 * app.json, plus Google sign-in's native setup, which needs a value from the
 * environment: the iOS OAuth client ID, turned around into the URL scheme
 * Google's sheet returns to. Without the ID there is no Google button, so the
 * plugin is left out (docs/sign-in.md).
 */
module.exports = ({ config }) => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  if (!iosClientId) return config;
  const iosUrlScheme = `com.googleusercontent.apps.${iosClientId.replace('.apps.googleusercontent.com', '')}`;
  return {
    ...config,
    plugins: [...config.plugins, ['@react-native-google-signin/google-signin', { iosUrlScheme }]],
  };
};
