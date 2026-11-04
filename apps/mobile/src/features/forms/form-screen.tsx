import { createContext, use, useRef, type ReactNode, type RefObject } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { router, Stack, useNavigation } from 'expo-router';
import { useHeaderHeight, usePreventRemove } from 'expo-router/react-navigation';
import { PosterText } from '@/components/poster-text';
import { LIQUID_GLASS } from '@/lib/liquid-glass';
import type { TextInput } from '@/components/text-input';
import { face, spacing, usePosterCanvas, useThemeColors } from '@/theme';
import type { RequiredFields } from './required-fields';

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
 *
 * `required` is checked before `onSave`: with a field missing, Save scrolls to
 * the first one, focuses it and shows what it needs, and nothing is sent.
 * `canSave` is for the rest — an edit with no changes has nothing to save.
 */
export function FormScreen({
  title,
  dirty,
  canSave,
  saving,
  onSave,
  scrollable = true,
  postered = false,
  required,
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
  required?: RequiredFields;
  children: ReactNode;
}) {
  const canvas = usePosterCanvas();
  const navigation = useNavigation();
  const headerHeight = useHeaderHeight();
  const leaving = useRef(false);
  const scroller = useRef<ScrollView>(null);
  const content = useRef<View>(null);

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

  // Scrolls the field to just under the header, then focuses it. The content
  // sits under the header (automatic insets), so its top is `headerHeight` in.
  const reveal = (field: TextInput) => {
    const inner = content.current;
    if (!scrollable || !inner) return field.focus();
    field.measureLayout(
      inner,
      (_x, y) => {
        scroller.current?.scrollTo({
          y: Math.max(0, y - spacing.lg) - headerHeight,
          animated: true,
        });
        field.focus();
      },
      () => field.focus(),
    );
  };

  const save = () => {
    const missing = required?.check();
    if (missing) return reveal(missing);
    return onSave(leave).then(
      () => {
        // Some saves deliberately navigate to a newly created detail record
        // instead of closing the form. In that case the save handler already
        // called `leave`, so don't also pop the screen.
        if (!leaving.current) leave(() => router.back());
      },
      () => undefined,
    );
  };

  return (
    <LeaveContext value={leave}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: canvas.background }}
        behavior={process.env.EXPO_OS === 'android' ? 'padding' : undefined}
      >
        <Stack.Screen options={{ title, headerTitle: postered ? '' : undefined }} />
        <ConfirmHeader
          confirm="Save"
          pending={saving}
          confirmDisabled={!canSave}
          onCancel={() => router.back()}
          onConfirm={() => void save()}
        />
        {scrollable ? (
          <ScrollView
            ref={scroller}
            // Typed as never-null, though React sets it to null on unmount.
            innerViewRef={content as RefObject<View>}
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

/**
 * Cancel and a confirm (Save, Done) in a native header.
 *
 * On iOS 26 these are the system's own bar buttons, set as Apple's apps set
 * them in Liquid Glass: an ✕ in plain glass, and a ✓ in prominent glass filled
 * with the page ink, so the way forward is the one tinted thing in the bar.
 * Elsewhere, and before iOS 26, the words — as iOS 18 and Material set them.
 */
export function ConfirmHeader({
  confirm,
  pending,
  confirmDisabled,
  onCancel,
  onConfirm,
}: {
  confirm: string;
  pending?: boolean;
  confirmDisabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const colors = useThemeColors();

  if (LIQUID_GLASS) {
    return (
      <>
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button
            icon="xmark"
            accessibilityLabel="Cancel"
            disabled={pending}
            onPress={onCancel}
          />
        </Stack.Toolbar>
        <Stack.Toolbar placement="right">
          {pending ? (
            <Stack.Toolbar.View>
              <View style={{ width: 36, height: 36, justifyContent: 'center' }}>
                <ActivityIndicator />
              </View>
            </Stack.Toolbar.View>
          ) : (
            <Stack.Toolbar.Button
              icon="checkmark"
              variant="prominent"
              tintColor={colors.primary}
              accessibilityLabel={confirm}
              disabled={confirmDisabled}
              onPress={onConfirm}
            />
          )}
        </Stack.Toolbar>
      </>
    );
  }

  return (
    <Stack.Screen
      options={{
        headerLeft: () => <HeaderText title="Cancel" disabled={pending} onPress={onCancel} />,
        headerRight: () =>
          pending ? (
            <ActivityIndicator />
          ) : (
            <HeaderText title={confirm} bold disabled={confirmDisabled} onPress={onConfirm} />
          ),
      }}
    />
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
