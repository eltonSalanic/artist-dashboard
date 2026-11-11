# Sign in with Apple and Google

> **Status:** merged into `main` (2026-11-11), phone only. Not tested on a device
> yet: it needs the Google client IDs below and a new dev build.

Under the email form on the phone's sign-in screen (Sign in and Start a band, not
Join with a code) sit **Sign in with Apple** (iPhone only, first, in Apple's own
button) and **Continue with Google**. Either signs the person in, or makes their
account the first time. A button whose provider isn't set up is hidden.

## How it works

1. The phone opens the provider's **native** sheet (`expo-apple-authentication`,
   `@react-native-google-signin/google-signin`). Nobody is sent to a web page.
2. The sheet returns a signed **ID token**. The app posts it to Better Auth's
   `POST /api/auth/sign-in/social` with `idToken` through `AuthClient.signInWithIdToken`.
3. The API checks the token's signature, issuer and audience with Apple or Google,
   then opens a normal session; the phone keeps the bearer token as for email sign-in.

Decisions:

- **Apple's nonce.** The app hashes a random nonce into Apple's request and sends
  the raw one to the API, which checks they match, so a token taken from elsewhere
  can't be replayed.
- **Apple's name.** Apple gives the person's name only on the very first sign-in,
  and never in the token, so the app passes it along then. A later sign-in has no name.
- **Hide My Email.** Someone who hides their email with Apple gets an
  `@privaterelay.appleid.com` address. Mail to it reaches them through Apple.
- **Same email, same account.** Apple and Google are trusted providers
  (`accountLinking.trustedProviders`): signing in with one reaches the existing
  account with that email instead of making a second one. Their emails arrive
  verified, so they skip any email-code step.
- **Signing out** also forgets the Google account picked, so the next Google
  sign-in shows the account picker again.
- **Android** shows Google only. Apple on Android or the web needs a Services ID
  and key; not built.
- The App Store requires Sign in with Apple in any app that offers Google
  sign-in, which is why the two ship together.

## Setup

### Apple

1. In the Apple Developer portal, turn on **Sign in with Apple** for the
   `com.bandwall.app` App ID. EAS normally does this itself on the next build,
   because `app.json` sets `ios.usesAppleSignIn`.
2. Nothing else for the phone. The API accepts tokens for `APPLE_BUNDLE_ID`
   (default `com.bandwall.app`). `APPLE_SERVICE_ID` is only for a future web sign-in.

### Google

1. In Google Cloud, set up the **OAuth consent screen** (External, app name, support email).
2. Create three **OAuth client IDs**:
   - **iOS**, bundle ID `com.bandwall.app`.
   - **Android**, package `com.bandwall.app` and the SHA-1 of each signing
     certificate (`eas credentials` shows it; add the debug and the store one).
   - **Web**. Android asks Google for a token for this one.
3. API (`apps/api/.env`, and the host's env): `GOOGLE_CLIENT_IDS` = all three,
   comma-separated. Unset turns Google sign-in off.
4. Phone (`apps/mobile/.env`, and the EAS environment for builds):
   `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.
   `app.config.js` turns the iOS one into the URL scheme Google's sheet returns to,
   so it must be set **when the build is made**, not only when Metro runs.

Client IDs are public, not secrets.

### A new dev build

Both sheets are native modules, so the phone needs a build made after this
branch: `npx expo run:ios` (or `eas build --profile development`). A JS reload
of an older build crashes on the missing module.
