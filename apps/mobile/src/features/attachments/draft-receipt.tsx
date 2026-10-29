import { useState } from 'react';
import { Image } from 'expo-image';
import { MAX_ATTACHMENT_BYTES } from '@artist/shared';
import { notify } from '@artist/api-client';
import { reportError } from '@/lib/report-error';
import { Button } from '@/components/button';
import { Section } from '@/components/section';
import { PosterText } from '@/components/poster-text';
import { useThemeColors } from '@/theme';
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
      if (next.source.size > MAX_ATTACHMENT_BYTES) {
        notify.error('File is larger than the 50MB limit');
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
    <Section title="RECEIPT">
      {receipt?.preview && (
        <Image
          source={{ uri: receipt.preview }}
          contentFit="contain"
          style={{ width: 120, height: 120 }}
        />
      )}
      <PosterText variant="cardMeta" color={colors.mutedForeground}>
        {receipt
          ? `${receipt.source.fileName} · uploads when you save`
          : 'Add a photo or file to upload when you save.'}
      </PosterText>
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
    </Section>
  );
}
