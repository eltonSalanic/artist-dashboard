import { useState } from 'react';
import { Image } from 'expo-image';
import { attachmentSizeError } from '@artist/shared';
import { notify } from '@artist/api-client';
import { reportError } from '@/lib/report-error';
import { Button } from '@/components/button';
import { View } from 'react-native';
import { FieldLabel } from '@/components/field-label';
import { PosterText } from '@/components/poster-text';
import { spacing, useThemeColors } from '@/theme';
import { NameSheet } from './name-sheet';
import { chooseSource, pickUpload, type PickedUpload } from './pick';

/** Keep the local file until the finance entry exists and Save can upload it. */
export function DraftReceipt({
  receipt,
  onChange,
  disabled,
}: {
  receipt: PickedUpload | null;
  onChange: (receipt: PickedUpload | null) => void;
  disabled: boolean;
}) {
  const colors = useThemeColors();
  const [picked, setPicked] = useState<PickedUpload | null>(null);
  const [picking, setPicking] = useState(false);

  const add = async () => {
    setPicking(true);
    try {
      const from = await chooseSource();
      if (!from) return;
      const next = await pickUpload(from);
      if (!next) return;
      const tooBig = attachmentSizeError(
        next.source.contentType || 'application/octet-stream',
        next.source.size,
      );
      if (tooBig) {
        notify.error(tooBig);
        return;
      }
      setPicked(next);
    } catch (error) {
      // The native text ("PHPhotosErrorDomain 3311") means nothing to a user;
      // the reporter gets it, the user gets a sentence.
      reportError(error);
      notify.error('Could not open the picker. Try again.');
    } finally {
      setPicking(false);
    }
  };

  return (
    // Headed like the form's other fields: it only ever sits in the finance form.
    <View style={{ gap: spacing.xs + 2 }}>
      <FieldLabel hint={receipt ? undefined : 'Add a photo or file to upload when you save.'}>
        Receipt
      </FieldLabel>
      {receipt?.preview && (
        <Image
          source={{ uri: receipt.preview }}
          contentFit="contain"
          style={{ width: 120, height: 120 }}
        />
      )}
      {receipt && (
        <PosterText variant="cardMeta" color={colors.mutedForeground}>
          {`${receipt.source.fileName} · uploads when you save`}
        </PosterText>
      )}
      <Button
        title={receipt ? 'Change Receipt' : 'Add Receipt'}
        variant="secondary"
        size="sm"
        disabled={disabled || picking}
        onPress={() => void add()}
      />
      {receipt && (
        <Button
          title="Remove Receipt"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onPress={() => onChange(null)}
        />
      )}
      {picked && (
        <NameSheet
          title="Name this receipt"
          fileName={picked.source.fileName}
          previewUri={picked.preview}
          confirmLabel="Add"
          onCancel={() => setPicked(null)}
          onConfirm={(fileName) => {
            onChange({ ...picked, source: { ...picked.source, fileName } });
            setPicked(null);
          }}
        />
      )}
    </View>
  );
}
