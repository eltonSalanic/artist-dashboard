import { createContext, use, useRef, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
} from 'react-native';
import { router, Stack, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { ThemedText } from '@/components/themed-text';
import { spacing, useThemeColors } from '@/theme';

/**
 * Leaves the form on purpose — after a save, an archive or a delete — without
 * the unsaved-changes prompt. Anything that navigates away from inside a form
 * goes through this.
 */
const LeaveContext = createContext<(navigate: () => void) => void>((navigate) =>
  navigate(),
);
export const useLeaveForm = () => use(LeaveContext);

/**
 * The frame every create/edit form shares: a modal with Cancel and Save in the
 * header, a keyboard-aware scroll view, and protection for unsaved work.
 *
 * Unsaved work is guarded with `usePreventRemove`, which catches every way out
 * — Cancel, the iOS swipe-down, Android's back button — rather than only the
 * ones this screen draws. A swipe is too easy to do by accident to cost
 * someone a paragraph of description.
 *
 * `onSave` resolves once saved and rejects on failure (the hook has already
 * shown why); the form closes only on success, so nothing typed is lost.
 */
export function FormScreen({
  title,
  dirty,
  canSave,
  saving,
  onSave,
  scrollable = true,
  children,
}: {
  title: string;
  dirty: boolean;
  canSave: boolean;
  saving: boolean;
  onSave: () => Promise<unknown>;
  /**
   * False when the content brings its own scroller — a virtualised or
   * reorderable list cannot sit inside a ScrollView.
   */
  scrollable?: boolean;
  children: ReactNode;
}) {
  const colors = useThemeColors();
  const navigation = useNavigation();
  const leaving = useRef(false);

  usePreventRemove(dirty, ({ data }) => {
    if (leaving.current) return navigation.dispatch(data.action);
    Alert.alert('Discard changes?', undefined, [
      { text: 'Keep editing', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => navigation.dispatch(data.action),
      },
    ]);
  });

  const leave = (navigate: () => void) => {
    leaving.current = true;
    navigate();
  };

  const save = () =>
    onSave().then(
      () => leave(() => router.back()),
      () => undefined,
    );

  return (
    <LeaveContext value={leave}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={process.env.EXPO_OS === 'android' ? 'padding' : undefined}
      >
        <Stack.Screen
          options={{
            title,
            headerLeft: () => <HeaderText title="Cancel" onPress={() => router.back()} />,
            headerRight: () =>
              saving ? (
                <ActivityIndicator />
              ) : (
                <HeaderText
                  title="Save"
                  bold
                  disabled={!canSave}
                  onPress={() => void save()}
                />
              ),
          }}
        />
        {scrollable ? (
          <ScrollView
            style={{ flex: 1 }}
            contentInsetAdjustmentBehavior="automatic"
            automaticallyAdjustKeyboardInsets
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }}
          >
            {children}
          </ScrollView>
        ) : (
          children
        )}
      </KeyboardAvoidingView>
    </LeaveContext>
  );
}

/** A text button in a native header: Cancel, Save, Done. */
export function HeaderText({
  title,
  bold,
  disabled,
  onPress,
}: {
  title: string;
  bold?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={10}
    >
      <ThemedText
        variant="body"
        style={{
          color: colors.primary,
          fontWeight: bold ? '600' : '400',
          opacity: disabled ? 0.4 : 1,
        }}
      >
        {title}
      </ThemedText>
    </Pressable>
  );
}
