import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/lib/supabase';
import { spacing, useThemeColors } from '@/theme';

type Mode = 'signin' | 'signup';

/**
 * Email + password, matching `apps/web/src/features/auth/login-page.tsx`.
 *
 * Deliberately not magic links. The plan expected them to be the sharp edge
 * here, but reading the web app settled it: password sign-in is the only way
 * in, and the one magic link the product sends is a Supabase *invite*, whose
 * redirect the API hardcodes to `WEB_URL/auth/callback`. An invited bandmate
 * accepts on the web, sets a password, and signs in here with it.
 */
export function SignInScreen() {
  const colors = useThemeColors();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async () => {
    setPending(true);
    setError(null);
    setNotice(null);

    const result =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setPending(false);
    if (result.error) {
      // The draft stays put so a typo in the password costs one field, not two.
      setError(result.error.message);
      return;
    }
    // Sign-up returns no session when the project requires email confirmation.
    // Local Supabase has it off, so this is the deployed-project path.
    if (result.data.session === null) {
      setNotice('Check your email to confirm your account, then sign in.');
      setMode('signin');
    }
    // On success the root layout swaps the stack — no navigation needed here.
  };

  const canSubmit = email.trim() !== '' && password !== '' && !pending;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.form}>
        <ThemedText variant="title">
          {mode === 'signin' ? 'Welcome back' : 'Create your account'}
        </ThemedText>
        <ThemedText variant="subhead" tone="muted" style={styles.subtitle}>
          {mode === 'signin'
            ? "Sign in to your band's dashboard."
            : 'Start a dashboard for your band.'}
        </ThemedText>

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

        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          editable={!pending}
          secureTextEntry
          autoCapitalize="none"
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          textContentType={mode === 'signin' ? 'password' : 'newPassword'}
          returnKeyType="go"
          onSubmitEditing={() => {
            if (canSubmit) void submit();
          }}
          error={error}
        />

        {notice !== null && (
          <ThemedText variant="footnote" tone="muted">
            {notice}
          </ThemedText>
        )}

        <Button
          title={mode === 'signin' ? 'Sign in' : 'Create account'}
          loading={pending}
          disabled={!canSubmit}
          onPress={() => void submit()}
          style={styles.submit}
        />

        <Pressable
          accessibilityRole="button"
          disabled={pending}
          onPress={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setError(null);
            setNotice(null);
          }}
          style={styles.link}
        >
          <ThemedText variant="subhead" tone="accent">
            {mode === 'signin'
              ? 'New here? Create an account'
              : 'Already have an account? Sign in'}
          </ThemedText>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center' },
  form: { padding: spacing.lg, gap: spacing.md },
  subtitle: { marginTop: -spacing.sm },
  submit: { marginTop: spacing.sm },
  link: { alignItems: 'center', paddingVertical: spacing.sm },
});
