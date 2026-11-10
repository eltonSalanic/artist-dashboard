import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AUTH_CODE_ERRORS, apiFetch, authErrorMessage, notify } from '@artist/api-client';
import { Button } from '@/components/button';
import { MascotLockup } from '@/components/mascot';
import { PosterText } from '@/components/poster-text';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { auth } from '@/lib/auth';
import { reportError } from '@/lib/report-error';
import { setOnboardingIntent } from '@/features/onboarding/onboarding-state';
import { StepProgress } from '@/features/onboarding/step-progress';
import { spacing, usePosterCanvas } from '@/theme';

type Mode = 'signin' | 'signup' | 'invite' | 'verify';

/** Web's rule for the password an invited bandmate sets. */
const MIN_PASSWORD = 8;

// Signing in needs no explaining, so it has no lead; the logo above already says where you are.
const COPY: Record<Mode, { title: string; lead?: string; submit: string }> = {
  signin: { title: 'Welcome back', submit: 'Sign in' },
  signup: {
    title: 'First, You.',
    lead: 'Your bandmates see this name on tasks and shows.',
    submit: 'Continue',
  },
  invite: {
    title: 'Join Your Band.',
    lead: 'Use the email the invite went to and the 6-digit code in it, then choose a password.',
    submit: 'Join',
  },
  // The lead names the address, so it is filled in where the screen renders.
  verify: { title: 'Check Your Email.', submit: 'Confirm' },
};

/** Said for a wrong, used or expired sign-up code (the shared wording is about invites). */
const VERIFY_CODE_FAILED =
  "That code doesn't work: check it against the email, or send a new one. Codes expire after an hour.";

/**
 * Email + password, matching `apps/web/src/features/auth/login-page.tsx`.
 *
 * Deliberately not magic links: password sign-in is the only way in. The one
 * email link the product sends is the API's *invite*, whose link opens the
 * web's `/auth/callback`. The same email carries a 6-digit code, and "Join
 * with an invite code" takes it here — verified as an email code, then the
 * password is set in the same step, as web's callback page asks for one. So a bandmate can join from the
 * phone without ever opening the web.
 *
 * Reached from the welcome screen, which picks the mode: "Start a band" is
 * step 1 of 3 and asks for your name, "I've got an invite" takes the code.
 *
 * A new account confirms its email before it gets in: sign-up mails a 6-digit
 * code and this screen turns into "Check your email", asking for it. Signing
 * in to an account that never confirmed mails a fresh code and lands there too.
 *
 * Opens with the Band Wall logo, the phone's mascot leaning on the b and wall,
 * over the greeting set huge, so the first screen is already in the poster face.
 */
export function SignInScreen() {
  const canvas = usePosterCanvas();
  const insets = useSafeAreaInsets();
  // The welcome screen's doors open this screen in their mode.
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<Mode>(
    params.mode === 'signup' || params.mode === 'invite' ? params.mode : 'signin',
  );
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Which door led to "Check your email": a new account keeps its step 1 of 3.
  const [verifyFrom, setVerifyFrom] = useState<'signup' | 'signin'>('signup');

  const submit = async () => {
    setPending(true);
    setError(null);
    setNotice(null);

    // try/finally: the button must not stay disabled forever if anything
    // below throws.
    try {
      if (mode === 'invite') {
        await join();
        return;
      }
      if (mode === 'verify') {
        await confirmEmail();
        return;
      }

      // Set before the session lands, which swaps the stack: the band step
      // reads it to show it's step 2 of 3.
      if (mode === 'signup') setOnboardingIntent('signup');
      const result =
        mode === 'signin'
          ? await auth.signIn(email, password)
          : await auth.signUp(email, password, name.trim());

      if (result.error?.code === 'EMAIL_NOT_VERIFIED') {
        // The server has just mailed a fresh code; ask for it.
        startVerify('signin');
        return;
      }
      if (result.error) {
        setOnboardingIntent(null);
        // The draft stays put so a typo in the password costs one field, not two.
        setError(
          authErrorMessage(
            result.error,
            mode === 'signin'
              ? "Couldn't sign you in. Try again."
              : "Couldn't create your account. Try again.",
          ),
        );
        return;
      }
      // Sign-up came back without a session, so the account still needs
      // its email confirmed: the code is on its way.
      if ('needsConfirmation' in result && result.needsConfirmation) {
        startVerify('signup');
      }
      // On success the root layout swaps the stack — no navigation needed here.
    } catch (thrown) {
      setError(authErrorMessage({ message: String(thrown), status: 0 }));
    } finally {
      setPending(false);
    }
  };

  const startVerify = (from: 'signup' | 'signin') => {
    setVerifyFrom(from);
    setCode('');
    setMode('verify');
  };

  /**
   * Confirm the email with its code, which signs the person in and swaps the
   * stack. The onboarding intent set at sign-up is still in place, so a new
   * account goes on to step 2.
   */
  const confirmEmail = async () => {
    const verified = await auth.verifyEmailCode(email.trim(), code.trim());
    if (verified.error) {
      setError(
        verified.error.code && AUTH_CODE_ERRORS.includes(verified.error.code)
          ? VERIFY_CODE_FAILED
          : authErrorMessage(verified.error, "Couldn't confirm your email. Try again."),
      );
    }
  };

  const resend = async () => {
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const sent = await auth.resendEmailCode(email.trim());
      if (sent.error) {
        setError(authErrorMessage(sent.error, "Couldn't send a new code. Try again."));
      } else {
        setNotice('New code sent. It can take a minute to arrive.');
        setCode('');
      }
    } finally {
      setPending(false);
    }
  };

  /**
   * Accept the invite, then set the password. Verifying signs the person in,
   * which swaps the stack and unmounts this screen, so a failure to set the
   * password is reported as a toast rather than under the field — and they
   * are still in, as web's "Skip for now" leaves them.
   */
  const join = async () => {
    // Opens the welcome to their band once the stack has swapped.
    setOnboardingIntent('joined');
    const verified = await auth.verifyInviteCode(email.trim(), code.trim());
    if (verified.error) {
      setOnboardingIntent(null);
      // A wrong, used or expired code all read as "that code doesn't work".
      setError(authErrorMessage(verified.error, "Couldn't accept the invite. Try again."));
      return;
    }
    const saved = await auth.setPassword(password);
    if (saved.error) {
      notify.error(
        `You're in, but the password wasn't saved. ${authErrorMessage(saved.error, 'Set it from the web app.')}`,
      );
    }
    // The invite made the account, named after the email; this puts their own
    // name on it. Not worth interrupting a join for: it can be fixed later.
    await apiFetch('/me', { method: 'PATCH', body: { displayName: name.trim() } }).catch(
      (error: unknown) => reportError(error, { where: 'signIn.saveName' }),
    );
  };

  const canSubmit =
    mode === 'verify'
      ? !pending && /^\d{6}$/.test(code.trim())
      : email.trim() !== '' &&
        !pending &&
        (mode === 'signin' || name.trim() !== '') &&
        (mode === 'invite'
          ? /^\d{6}$/.test(code.trim()) && password.length >= MIN_PASSWORD
          : password !== '');
  const copy =
    mode === 'verify'
      ? {
          ...COPY.verify,
          lead: `We sent a 6-digit code to ${email.trim()}. Enter it to finish.`,
        }
      : COPY[mode];
  const switchTo = (next: Mode) => {
    // Leaving "Check your email" for sign in drops the sign-up's step 2.
    if (mode === 'verify' || next === 'signin') setOnboardingIntent(null);
    setMode(next);
    setError(null);
    setNotice(null);
  };

  return (
    // A scroll view that takes the keyboard as an inset, not a view that
    // re-centres the form above it. The row over the iOS keyboard (Passwords,
    // predictions, contacts) comes and goes as you type, which changes the
    // keyboard's height by 27pt; a KeyboardAvoidingView moved the whole form
    // each time, so it shook. An inset leaves the form still, scrolls only to
    // keep the focused field in view, and lets Join's taller form scroll
    // rather than run under the status bar.
    <View style={{ flex: 1, backgroundColor: canvas.background }}>
      <ScrollView
        style={{ backgroundColor: canvas.background }}
        contentContainerStyle={styles.root}
        // Centred on the whole screen, as before: the form fits it, so only
        // the keyboard's inset ever scrolls it.
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <View style={styles.form}>
          {(mode === 'signup' || (mode === 'verify' && verifyFrom === 'signup')) && (
            <StepProgress step={1} of={3} />
          )}
          {/* The logo: the phone's mascot leaning on the app icon's b and wall, so
              the screen echoes the icon that opened it. */}
          <MascotLockup lockup="leaningMark" width={LOCKUP_WIDTH} style={{ alignSelf: 'center' }} />
          <View accessible accessibilityRole="header" style={styles.masthead}>
            <PosterText variant="display" color={canvas.ink} style={styles.centred}>
              {copy.title}
            </PosterText>
            {copy.lead && (
              <PosterText variant="body" color={canvas.soft} style={styles.centred}>
                {copy.lead}
              </PosterText>
            )}
          </View>

          {mode === 'signup' && (
            <TextField
              label="Your name"
              value={name}
              onChangeText={setName}
              editable={!pending}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              placeholder="Jess Ortega"
              maxLength={60}
              doneBar={false}
            />
          )}

          {mode !== 'verify' && (
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              editable={!pending}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              placeholder="you@band.com"
              // No Done bar on this form: Return closes these keyboards, and the
              // bar reloaded the keyboard on each letter, which shook the centred
              // form (see `TextInput`).
              doneBar={false}
            />
          )}

          {mode === 'verify' && (
            <TextField
              label="Code"
              value={code}
              onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, 6))}
              editable={!pending}
              keyboardType="number-pad"
              doneBar={false}
              returnKeyType="done"
              // iOS offers the code from Mail above the keyboard.
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              placeholder="123456"
              maxLength={6}
              autoFocus
              error={error}
            />
          )}

          {mode === 'invite' && (
            <TextField
              label="Invite code"
              value={code}
              onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, 6))}
              editable={!pending}
              keyboardType="number-pad"
              doneBar={false}
              // The number pad has no Return key; this makes React Native add
              // its own Done toolbar, which does not reload as you type.
              returnKeyType="done"
              // iOS offers the code from Mail above the keyboard.
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              placeholder="123456"
              maxLength={6}
              // What fails in this mode is the code, so the outline goes here.
              error={error}
            />
          )}

          {mode === 'invite' && (
            <TextField
              label="Your name"
              value={name}
              onChangeText={setName}
              editable={!pending}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              placeholder="What your bandmates call you"
              maxLength={60}
              doneBar={false}
            />
          )}

          {mode !== 'verify' && (
            <TextField
              label={mode === 'invite' ? 'Choose a password' : 'Password'}
              placeholder={mode === 'invite' ? `At least ${MIN_PASSWORD} characters` : undefined}
              value={password}
              onChangeText={setPassword}
              editable={!pending}
              secureTextEntry
              autoCapitalize="none"
              // A plain password field in every mode. `newPassword` made iOS lay its
              // yellow strong-password overlay over the field on Create account,
              // which kept only the first typed letter and then stuck when you
              // switched back to Sign in. With no associated domain a generated
              // password could not reach the web sign-in anyway.
              autoComplete="current-password"
              textContentType="password"
              doneBar={false}
              returnKeyType="go"
              onSubmitEditing={() => {
                if (canSubmit) void submit();
              }}
              error={mode === 'invite' ? null : error}
            />
          )}

          {notice !== null && (
            <ThemedText variant="footnote" tone="muted" style={styles.centred}>
              {notice}
            </ThemedText>
          )}

          <Button
            title={copy.submit}
            loading={pending}
            disabled={!canSubmit}
            onPress={() => void submit()}
            style={styles.submit}
          />

          {mode === 'verify' && (
            <Pressable
              accessibilityRole="button"
              disabled={pending}
              onPress={() => void resend()}
              style={styles.link}
            >
              <ThemedText variant="subhead" tone="accent">
                Send a new code
              </ThemedText>
            </Pressable>
          )}

          <Pressable
            accessibilityRole="button"
            disabled={pending}
            onPress={() =>
              switchTo(mode === 'verify' ? verifyFrom : mode === 'signin' ? 'signup' : 'signin')
            }
            style={mode === 'verify' ? styles.inviteLink : styles.link}
          >
            <ThemedText variant="subhead" tone="accent">
              {mode === 'verify'
                ? 'Use a different email'
                : mode === 'signin'
                  ? 'New here? Start a band'
                  : 'Already have an account? Sign in'}
            </ThemedText>
          </Pressable>

          {mode === 'signin' && (
            <Pressable
              accessibilityRole="button"
              disabled={pending}
              onPress={() => switchTo('invite')}
              style={styles.inviteLink}
            >
              <ThemedText variant="subhead" tone="accent">
                Invited to a band? Join with your code
              </ThemedText>
            </Pressable>
          )}
        </View>
      </ScrollView>
      {/* Pinned to the screen's top-left corner, over the centred form, where a
          back button is expected. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={12}
        disabled={pending}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))}
        style={[styles.back, { top: insets.top + spacing.sm }]}
      >
        <PosterText variant="chip" color={canvas.soft}>
          ‹ Back
        </PosterText>
      </Pressable>
    </View>
  );
}

/** The b-and-wall lockup, at a size that leaves the form room above the keyboard. */
const LOCKUP_WIDTH = 200;

const styles = StyleSheet.create({
  root: { flexGrow: 1, justifyContent: 'center' },
  back: { position: 'absolute', left: spacing.lg, paddingVertical: spacing.xs },
  form: { padding: spacing.lg, gap: spacing.md },
  masthead: { gap: spacing.xs, marginBottom: spacing.sm },
  centred: { textAlign: 'center' },
  submit: { marginTop: spacing.sm },
  link: { alignItems: 'center', paddingVertical: spacing.sm },
  inviteLink: { alignItems: 'center', paddingBottom: spacing.sm },
});
