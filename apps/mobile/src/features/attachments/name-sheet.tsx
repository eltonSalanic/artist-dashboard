import { useState } from 'react';
import { Modal, View } from 'react-native';
import { Image } from 'expo-image';
import { splitFileName, withExtension } from '@artist/shared';
import { TextInput } from '@/components/text-input';
import { FieldLabel } from '@/components/field-label';
import { PosterText } from '@/components/poster-text';
import { HeaderText } from '@/features/forms/form-screen';
import { face, posterInput, posterRadius, spacing, useTokens } from '@/theme';

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
  const tokens = useTokens();
  const { base, extension } = splitFileName(fileName);
  const [draft, setDraft] = useState(base);
  const next = withExtension(draft, extension);
  const submit = () => {
    if (next && !pending) onConfirm(next);
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel}>
      <View
        style={{
          flex: 1,
          backgroundColor: tokens.background,
          padding: spacing.md,
          gap: spacing.lg,
        }}
      >
        {/* Drawn like the form bar: Cancel and the confirm in Figtree, the
            confirm a weight up. */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: 44,
          }}
        >
          <HeaderText title="Cancel" onPress={onCancel} />
          <PosterText
            variant="rowTitle"
            color={tokens.foreground}
            style={{ fontFamily: face.bold }}
          >
            {title}
          </PosterText>
          <HeaderText title={confirmLabel} bold disabled={!next || pending} onPress={submit} />
        </View>

        {previewUri && (
          <Image
            source={{ uri: previewUri }}
            contentFit="cover"
            style={{
              alignSelf: 'center',
              width: 180,
              height: 180,
              borderRadius: posterRadius.block,
              backgroundColor: tokens.muted,
            }}
          />
        )}

        <View style={{ gap: spacing.xs + 2 }}>
          <FieldLabel>Name</FieldLabel>
          {/* The form's flat filled field, with the extension inside it at
              the right, where it cannot be typed over. */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              paddingHorizontal: spacing.md,
              borderRadius: posterRadius.block,
              borderCurve: 'continuous',
              backgroundColor: tokens.muted,
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
              placeholderTextColor={tokens.mutedForeground}
              style={[
                posterInput,
                { flex: 1, paddingVertical: spacing.sm + 5, color: tokens.foreground },
              ]}
            />
            {extension !== '' && (
              <PosterText variant="field" color={tokens.mutedForeground}>
                {extension}
              </PosterText>
            )}
          </View>
          <PosterText variant="cardMeta" color={tokens.mutedForeground}>
            What your band sees, and what a download saves as.
          </PosterText>
        </View>
      </View>
    </Modal>
  );
}
