import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { fetchAttachmentUrl, notify, type AttachmentDto } from '@artist/api-client';
import { Icon, type IconName } from '@/components/icon';
import { Row } from '@/components/row';
import { fileSize } from '@/features/board/format';
import { env } from '@/lib/env';
import { reachableStorageUrl } from '@/lib/storage-url';
import { useThemeColors } from '@/theme';

function iconFor(mimeType: string): IconName {
  if (mimeType.startsWith('image/')) return { sf: 'photo', md: 'image' };
  if (mimeType.startsWith('audio/')) return { sf: 'waveform', md: 'audiotrack' };
  if (mimeType.startsWith('video/')) return { sf: 'film', md: 'movie' };
  if (mimeType === 'application/pdf') return { sf: 'doc.richtext', md: 'picture-as-pdf' };
  return { sf: 'paperclip', md: 'attach-file' };
}

/**
 * One attached file. A tap opens it in the system browser sheet (Safari View
 * Controller / Custom Tabs) — not an embedded webview, which this app does not
 * ship — where images, PDFs, audio and video all render, and the share button
 * covers "save to Files". That one action replaces web's separate view and
 * download buttons.
 *
 * The signed URL is fetched at the moment of the tap: it lives a minute.
 */
export function AttachmentRow({
  boardId,
  attachment,
  first,
  onDelete,
}: {
  boardId: string;
  attachment: AttachmentDto;
  first?: boolean;
  /** Absent when the viewer may not delete it. */
  onDelete?: () => void;
}) {
  const colors = useThemeColors();
  const [opening, setOpening] = useState(false);

  const open = async () => {
    setOpening(true);
    try {
      const { url } = await fetchAttachmentUrl(boardId, attachment.id, 'view');
      await WebBrowser.openBrowserAsync(reachableStorageUrl(url, env.supabaseUrl));
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Could not open the file');
    } finally {
      setOpening(false);
    }
  };

  const confirmDelete = () =>
    Alert.alert(`Delete ${attachment.fileName}?`, 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);

  return (
    <Row
      first={first}
      title={attachment.fileName}
      meta={`${fileSize(attachment.size)} · ${attachment.uploadedBy.displayName}`}
      lead={
        opening ? (
          <ActivityIndicator size="small" />
        ) : (
          <Icon name={iconFor(attachment.mimeType)} size={17} />
        )
      }
      onPress={opening ? undefined : () => void open()}
      trailing={
        onDelete ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete ${attachment.fileName}`}
            hitSlop={12}
            onPress={confirmDelete}
          >
            <View style={{ padding: 4 }}>
              <Icon
                name={{ sf: 'trash', md: 'delete-outline' }}
                size={17}
                color={colors.mutedForeground}
              />
            </View>
          </Pressable>
        ) : undefined
      }
    />
  );
}
