import { useState } from 'react';
import { Modal, Pressable, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { splitFileName, withExtension } from '@artist/shared';
import { ThemedText } from '@/components/themed-text';
import { radius, spacing, useThemeColors } from '@/theme';

/**
 * Names a file: a new upload before it goes, or an existing one.
 *
 * Only the part before the extension is editable; the extension sits beside
 * the field, so a renamed rider still opens as a PDF. A page sheet rather than
 * an alert with a text field, which is iOS-only and has no room for the
 * preview that tells you which photo you are naming.
 *
 * Callers mount it per file (or key it), so the field starts from that name.
 */
export function NameSheet({
  title,
  fileName,
  previewUri,
  confirmLabel,
  pending = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  /** The current name, extension included. */
  fileName: string;
  /** A local picture of what is being named, when there is one. */
  previewUri?: string;
  confirmLabel: string;
  pending?: boolean;
  /** The full new name, extension put back on. */
  onConfirm: (fileName: string) => void;
  onCancel: () => void;
}) {
  const colors = useThemeColors();
  const { base, extension } = splitFileName(fileName);
  const [draft, setDraft] = useState(base);
  const next = withExtension(draft, extension);
  const submit = () => {
    if (next && !pending) onConfirm(next);
  };

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
    >
      <View style={{ flex: 1, backgroundColor: colors.background, padding: spacing.md, gap: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <HeaderButton label="Cancel" onPress={onCancel} />
          <ThemedText variant="headline">{title}</ThemedText>
          <HeaderButton label={confirmLabel} bold disabled={!next || pending} onPress={submit} />
        </View>

        {previewUri && (
          <Image
            source={{ uri: previewUri }}
            contentFit="cover"
            style={{
              alignSelf: 'center',
              width: 160,
              height: 160,
              borderRadius: radius.md,
              backgroundColor: colors.muted,
            }}
          />
        )}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            paddingHorizontal: spacing.md,
            borderRadius: radius.md,
            borderCurve: 'continuous',
            backgroundColor: colors.card,
          }}
        >
          <TextInput
            autoFocus
            selectTextOnFocus
            accessibilityLabel="File name"
            value={draft}
            onChangeText={setDraft}
            maxLength={255}
            returnKeyType="done"
            onSubmitEditing={submit}
            placeholder="Name"
            placeholderTextColor={colors.mutedForeground}
            style={{ flex: 1, paddingVertical: spacing.md, fontSize: 17, color: colors.foreground }}
          />
          {extension !== '' && (
            <ThemedText variant="body" tone="muted">
              {extension}
            </ThemedText>
          )}
        </View>
        <ThemedText variant="footnote" tone="muted">
          What your band sees, and what a download saves as.
        </ThemedText>
      </View>
    </Modal>
  );
}

function HeaderButton({
  label,
  bold = false,
  disabled = false,
  onPress,
}: {
  label: string;
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
      hitSlop={10}
      onPress={onPress}
    >
      <ThemedText
        variant="body"
        style={{
          color: colors.primary,
          fontWeight: bold ? '600' : '400',
          opacity: disabled ? 0.4 : 1,
        }}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}
