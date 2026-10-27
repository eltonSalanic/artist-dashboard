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
import { PosterText } from '@/components/poster-text';
import { face, spacing, usePosterCanvas, useThemeColors } from '@/theme';

/**
 * Leaves the form on purpose — after a save, an archive or a delete — without
 * the unsaved-changes prompt. Anything that navigates away from inside a form
 * goes through this.
 */
export type LeaveForm = (navigate: () => void) => void;

const LeaveContext = createContext<LeaveForm>((navigate) => navigate());
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
  postered = false,
  children,
}: {
  title: string;
  /**
   * The form opens with a `FormPoster` that already names it ("NEW TASK"),
   * so the bar stays empty, as it does over a detail screen. `title` still
   * names the screen to assistive tech and the back stack.
   */
  postered?: boolean;
  dirty: boolean;
  canSave: boolean;
  saving: boolean;
  /** Save handlers can use `leave` to navigate to the saved record. */
  onSave: (leave: LeaveForm) => Promise<unknown>;
  /**
   * False when the content brings its own scroller — a virtualised or
   * reorderable list cannot sit inside a ScrollView.
   */
  scrollable?: boolean;
  children: ReactNode;
}) {
  const canvas = usePosterCanvas();
  const navigation = useNavigation();
  const leaving = useRef(false);

  usePreventRemove(dirty || saving, ({ data }) => {
    if (leaving.current) return navigation.dispatch(data.action);
    // Finish saving (including any receipt upload) before allowing dismissal.
    if (saving) return;
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
    onSave(leave).then(
      () => {
        // Some saves deliberately navigate to a newly created detail record
        // instead of closing the form. In that case the save handler already
        // called `leave`, so don't also pop the screen.
        if (!leaving.current) leave(() => router.back());
      },
      () => undefined,
    );

  return (
    <LeaveContext value={leave}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: canvas.background }}
        behavior={process.env.EXPO_OS === 'android' ? 'padding' : undefined}
      >
        <Stack.Screen
          options={{
            title,
            headerTitle: postered ? '' : undefined,
            headerLeft: () => (
              <HeaderText title="Cancel" disabled={saving} onPress={() => router.back()} />
            ),
            headerRight: () =>
              saving ? (
                <ActivityIndicator />
              ) : (
                <HeaderText title="Save" bold disabled={!canSave} onPress={() => void save()} />
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
      {/* Figtree like the rest of the bar; Save a weight up, as iOS sets the
          confirming action. */}
      <PosterText
        variant="rowTitle"
        color={colors.primary}
        style={{ fontFamily: bold ? face.bold : face.medium, opacity: disabled ? 0.4 : 1 }}
      >
        {title}
      </PosterText>
    </Pressable>
  );
}
