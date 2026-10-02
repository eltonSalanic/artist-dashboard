import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { radius, spacing, useTheme } from '@/theme';

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
  const theme = useTheme();
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
      style={[styles.root, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.form}>
        <Text style={[styles.title, { color: theme.text }]}>
          {mode === 'signin' ? 'Welcome back' : 'Create your account'}
        </Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>
          {mode === 'signin'
            ? "Sign in to your band's dashboard."
            : 'Start a dashboard for your band.'}
        </Text>

        <Text style={[styles.label, { color: theme.muted }]}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          editable={!pending}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          placeholder="you@band.com"
          placeholderTextColor={theme.muted}
          style={[
            styles.input,
            {
              color: theme.text,
              borderColor: theme.border,
              backgroundColor: theme.card,
            },
          ]}
        />

        <Text style={[styles.label, { color: theme.muted }]}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          editable={!pending}
          secureTextEntry
          autoCapitalize="none"
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          textContentType={mode === 'signin' ? 'password' : 'newPassword'}
          onSubmitEditing={() => {
            if (canSubmit) void submit();
          }}
          returnKeyType="go"
          style={[
            styles.input,
            {
              color: theme.text,
              borderColor: theme.border,
              backgroundColor: theme.card,
            },
          ]}
        />

        {error !== null && (
          <Text style={[styles.message, { color: theme.danger }]}>{error}</Text>
        )}
        {notice !== null && (
          <Text style={[styles.message, { color: theme.muted }]}>{notice}</Text>
        )}

        <Pressable
          accessibilityRole="button"
          disabled={!canSubmit}
          onPress={() => void submit()}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: theme.accent,
              opacity: !canSubmit ? 0.5 : pressed ? 0.85 : 1,
            },
          ]}
        >
          {pending ? (
            <ActivityIndicator color={theme.onAccent} />
          ) : (
            <Text style={[styles.buttonLabel, { color: theme.onAccent }]}>
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </Text>
          )}
        </Pressable>

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
          <Text style={[styles.linkLabel, { color: theme.accent }]}>
            {mode === 'signin'
              ? 'New here? Create an account'
              : 'Already have an account? Sign in'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center' },
  form: { padding: spacing.lg, gap: spacing.xs },
  title: { fontSize: 26, fontWeight: '700' },
  subtitle: { fontSize: 15, marginBottom: spacing.md },
  label: { fontSize: 13, fontWeight: '600', marginTop: spacing.sm },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontSize: 16,
  },
  message: { fontSize: 14, marginTop: spacing.sm },
  button: {
    marginTop: spacing.lg,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
  link: { marginTop: spacing.md, alignItems: 'center' },
  linkLabel: { fontSize: 14, fontWeight: '500' },
});
