import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { authErrorMessage, notify } from '@artist/api-client';
import { Button } from '@/components/button';
import { PosterText } from '@/components/poster-text';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { auth } from '@/lib/auth';
import { spacing, usePosterCanvas } from '@/theme';

type Mode = 'signin' | 'signup' | 'invite';

/** Web's rule for the password an invited bandmate sets. */
const MIN_PASSWORD = 8;

const COPY: Record<Mode, { title: string; lead: string; submit: string }> = {
  signin: { title: 'Welcome back', lead: "Sign in to your band's dashboard.", submit: 'Sign in' },
  signup: {
    title: 'Create your account',
    lead: 'Start a dashboard for your band.',
    submit: 'Create account',
  },
  invite: {
    title: 'Join your band',
    lead: 'Enter the 6-digit code from your invite email and choose a password.',
    submit: 'Join',
  },
};

/**
 * Email + password, matching `apps/web/src/features/auth/login-page.tsx`.
 *
 * Deliberately not magic links: password sign-in is the only way in. The one
 * email link the product sends is a Supabase *invite*, whose link opens the
 * web's `/auth/callback`. The same email carries a 6-digit code
 * (`supabase/templates/invite.html`), and "Join with an invite code" takes it
 * here — verified as an `invite` OTP, then the password is set in the same
 * step, as web's callback page asks for one. So a bandmate can join from the
 * phone without ever opening the web.
 *
 * Opens with the widget page's masthead: the app's name in small caps over
 * the greeting set huge, so the first screen is already in the poster face.
 */
export function SignInScreen() {
  const canvas = usePosterCanvas();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

      const result =
        mode === 'signin'
          ? await auth.signIn(email, password)
          : await auth.signUp(email, password);

      if (result.error) {
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
      // Local Supabase has email confirmation off, so this is the
      // deployed-project path.
      if ('needsConfirmation' in result && result.needsConfirmation) {
        setNotice('Check your email to confirm your account, then sign in.');
        setMode('signin');
      }
      // On success the root layout swaps the stack — no navigation needed here.
    } catch (thrown) {
      setError(authErrorMessage({ message: String(thrown), status: 0 }));
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
    const verified = await auth.verifyInviteCode(email.trim(), code.trim());
    if (verified.error) {
      setError(
        verified.error.code === 'otp_expired'
          ? // Supabase answers a wrong code with the same error as a used one.
            "That code doesn't work: check it against the email. Codes expire after an hour and work once; your band admin can invite you again."
          : authErrorMessage(verified.error, "Couldn't accept the invite. Try again."),
      );
      return;
    }
    const saved = await auth.setPassword(password);
    if (saved.error) {
      notify.error(
        `You're in, but the password wasn't saved. ${authErrorMessage(saved.error, 'Set it from the web app.')}`,
      );
    }
  };

  const canSubmit =
    email.trim() !== '' &&
    !pending &&
    (mode === 'invite'
      ? /^\d{6}$/.test(code.trim()) && password.length >= MIN_PASSWORD
      : password !== '');
  const copy = COPY[mode];
  const switchTo = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: canvas.background }]}
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.form}>
        <View accessible accessibilityRole="header" style={styles.masthead}>
          <PosterText variant="label" color={canvas.soft}>
            BAND WALL
          </PosterText>
          <PosterText variant="display" color={canvas.ink}>
            {copy.title}
          </PosterText>
          <PosterText variant="body" color={canvas.soft}>
            {copy.lead}
          </PosterText>
        </View>

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
        />

        {mode === 'invite' && (
          <TextField
            label="Invite code"
            value={code}
            onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, 6))}
            editable={!pending}
            keyboardType="number-pad"
            // iOS offers the code from Mail above the keyboard.
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            placeholder="123456"
            maxLength={6}
            // What fails in this mode is the code, so the outline goes here.
            error={error}
          />
        )}

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
          returnKeyType="go"
          onSubmitEditing={() => {
            if (canSubmit) void submit();
          }}
          error={mode === 'invite' ? null : error}
        />

        {notice !== null && (
          <ThemedText variant="footnote" tone="muted">
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

        <Pressable
          accessibilityRole="button"
          disabled={pending}
          onPress={() => switchTo(mode === 'signin' ? 'signup' : 'signin')}
          style={styles.link}
        >
          <ThemedText variant="subhead" tone="accent">
            {mode === 'signin'
              ? 'New here? Create an account'
              : 'Already have an account? Sign in'}
          </ThemedText>
        </Pressable>

        {mode !== 'invite' && (
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center' },
  form: { padding: spacing.lg, gap: spacing.md },
  masthead: { gap: spacing.xs, marginBottom: spacing.sm },
  submit: { marginTop: spacing.sm },
  link: { alignItems: 'center', paddingVertical: spacing.sm },
  inviteLink: { alignItems: 'center', paddingBottom: spacing.sm },
});
