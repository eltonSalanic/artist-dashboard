import { useCallback, useEffect, useId, useRef, type Ref } from 'react';
import {
  InputAccessoryView,
  Keyboard,
  TextInput as NativeTextInput,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type TextInputProps,
} from 'react-native';
import { spacing, useThemeColors } from '@/theme';
import { PosterText } from './poster-text';

/** The ref type stays the platform's, so `useRef<TextInput>` reads the same. */
export type TextInput = NativeTextInput;

/**
 * The platform's `TextInput` with a Done bar over the iOS keyboard. The iOS
 * keyboard has no key that puts it away: a multiline field turns Return into a
 * line break, and on a long form the only way out was tapping somewhere that
 * happened to blur the field. Android's keyboard has its own hide key, so
 * there it is the plain control.
 *
 * Every field in the app uses this instead of React Native's, so none is left
 * without a way out.
 *
 * One bar per field: on the new architecture an `InputAccessoryView` attaches
 * to the first field with its `nativeID` that is on screen when it mounts, so a
 * single shared bar would miss fields that appear after it. The bar renders
 * after its field for the same reason. It is absolutely positioned, so it
 * takes no room in the field's layout.
 *
 * `autoFocus` is done here, after mount, rather than by the native field: the
 * native field focuses the moment it reaches the window, before its bar has
 * attached, and the keyboard then comes up without one.
 *
 * `doneBar={false}` leaves the bar off, for a single-line field whose Return key
 * already puts the keyboard away. The bar has a cost: on iOS, React Native
 * reloads the keyboard on every prop update of a focused field with an
 * `inputAccessoryViewID`, and typing is a prop update, so each letter fires
 * fresh keyboard events and a `KeyboardAvoidingView` around it can jump.
 */
// eslint-disable-next-line @typescript-eslint/no-redeclare -- a type and a component, one name
export function TextInput({
  ref,
  inputAccessoryViewID,
  autoFocus,
  doneBar = true,
  ...props
}: TextInputProps & { ref?: Ref<NativeTextInput>; doneBar?: boolean }) {
  const id = useId();
  const field = useRef<NativeTextInput>(null);
  const withBar = Platform.OS === 'ios' && doneBar && inputAccessoryViewID == null;

  useEffect(() => {
    if (withBar && autoFocus) field.current?.focus();
    // On mount only, as the native prop does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setRef = useCallback(
    (node: NativeTextInput | null) => {
      field.current = node;
      if (typeof ref === 'function') return ref(node);
      if (ref) ref.current = node;
    },
    [ref],
  );

  if (!withBar) {
    return (
      <NativeTextInput
        ref={ref}
        autoFocus={autoFocus}
        inputAccessoryViewID={inputAccessoryViewID}
        {...props}
      />
    );
  }

  return (
    <>
      <NativeTextInput ref={setRef} inputAccessoryViewID={id} {...props} />
      <InputAccessoryView nativeID={id}>
        <DoneBar />
      </InputAccessoryView>
    </>
  );
}

/**
 * Laid out like the system's own keyboard toolbar: a hairline on top and the
 * one action at the trailing edge. Page tokens, not the nearest card's: the bar
 * sits on the keyboard, not on the card the field is in.
 */
function DoneBar() {
  const tokens = useThemeColors();

  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'flex-end',
        backgroundColor: tokens.card,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: tokens.border,
        paddingHorizontal: spacing.sm,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Hide keyboard"
        onPress={() => Keyboard.dismiss()}
        hitSlop={spacing.xs}
        style={({ pressed }) => ({
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.sm + 2,
          opacity: pressed ? 0.5 : 1,
        })}
      >
        <PosterText variant="caption" color={tokens.foreground}>
          Done
        </PosterText>
      </Pressable>
    </View>
  );
}
