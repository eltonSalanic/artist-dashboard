import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  useWindowDimensions,
  View,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchAttachmentUrl, notify, type AttachmentDto } from '@artist/api-client';
import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { env } from '@/lib/env';
import { reachableStorageUrl } from '@/lib/storage-url';
import { spacing } from '@/theme';
import { attachmentKind, pageAfterDelete, savesToPhotos } from './attachment-kind';
import { AttachmentThumb } from './attachment-thumb';
import { NameSheet } from './name-sheet';
import { saveToDevice } from './save';

/** The gallery is dark whatever the theme, as Photos is: pictures read best on black. */
const INK = '#ffffff';
const DIM = 'rgba(255,255,255,0.7)';

/**
 * A parent's files, full screen, one per page: swipe for the next. Pictures
 * and video frames fill the page; anything else shows its icon and opens in
 * the system browser sheet, where PDFs, audio and video all play.
 *
 * Save, Rename and Delete sit under the file on screen, each only when the
 * viewer may do it — the same rule the API applies.
 */
export function AttachmentGallery({
  boardId,
  attachments,
  startIndex,
  canManage,
  onRename,
  onDelete,
  onClose,
}: {
  boardId: string;
  attachments: AttachmentDto[];
  startIndex: number;
  canManage: (attachment: AttachmentDto) => boolean;
  onRename: (attachmentId: string, fileName: string) => Promise<unknown>;
  onDelete: (attachmentId: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(startIndex);
  const [naming, setNaming] = useState(false);
  const [busy, setBusy] = useState<'save' | 'rename' | 'delete' | 'open' | null>(null);

  const current = attachments[Math.min(index, attachments.length - 1)];
  if (!current) return null;
  const manage = canManage(current);
  const kind = attachmentKind(current.mimeType);

  const run = async (what: NonNullable<typeof busy>, job: () => Promise<unknown>) => {
    setBusy(what);
    try {
      await job();
    } finally {
      setBusy(null);
    }
  };

  const open = () =>
    run('open', async () => {
      try {
        const { url } = await fetchAttachmentUrl(boardId, current.id, 'view');
        await WebBrowser.openBrowserAsync(reachableStorageUrl(url, env.supabaseUrl));
      } catch (error) {
        notify.error(error instanceof Error ? error.message : 'Could not open the file');
      }
    });

  const confirmDelete = () =>
    Alert.alert(`Delete ${current.fileName}?`, 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          void run('delete', async () => {
            await onDelete(current.id);
            const next = pageAfterDelete(index, attachments.length - 1);
            if (next === null) onClose();
            else setIndex(next);
          }),
      },
    ]);

  return (
    <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        <FlatList
          data={attachments}
          keyExtractor={(attachment) => attachment.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={startIndex}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={(event) =>
            setIndex(Math.round(event.nativeEvent.contentOffset.x / width))
          }
          renderItem={({ item }) => (
            <Page boardId={boardId} attachment={item} width={width} onOpen={open} />
          )}
        />

        {/* Top: close and position. */}
        <View
          style={{
            position: 'absolute',
            top: insets.top + spacing.xs,
            left: spacing.md,
            right: spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <RoundButton icon={{ sf: 'xmark', md: 'close' }} label="Close" onPress={onClose} />
          {attachments.length > 1 && (
            <ThemedText variant="subhead" style={{ color: DIM }}>
              {index + 1} of {attachments.length}
            </ThemedText>
          )}
          <View style={{ width: 36 }} />
        </View>

        {/* Bottom: the name and what can be done with it. */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingTop: spacing.md,
            paddingHorizontal: spacing.md,
            paddingBottom: insets.bottom + spacing.sm,
            gap: spacing.md,
            backgroundColor: 'rgba(0,0,0,0.55)',
          }}
        >
          <ThemedText variant="headline" numberOfLines={2} style={{ color: INK, textAlign: 'center' }}>
            {current.fileName}
          </ThemedText>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            {(kind === 'video' || kind === 'audio' || kind === 'pdf' || kind === 'other') && (
              <Action
                icon={{ sf: 'arrow.up.forward.app', md: 'open-in-new' }}
                label="Open"
                busy={busy === 'open'}
                onPress={() => void open()}
              />
            )}
            <Action
              icon={{ sf: 'square.and.arrow.down', md: 'download' }}
              label={savesToPhotos(current.mimeType) ? 'Save to Photos' : 'Save'}
              busy={busy === 'save'}
              onPress={() => void run('save', () => saveToDevice(boardId, current))}
            />
            {manage && (
              <Action
                icon={{ sf: 'pencil', md: 'edit' }}
                label="Rename"
                busy={busy === 'rename'}
                onPress={() => setNaming(true)}
              />
            )}
            {manage && (
              <Action
                icon={{ sf: 'trash', md: 'delete-outline' }}
                label="Delete"
                busy={busy === 'delete'}
                onPress={confirmDelete}
              />
            )}
          </View>
        </View>

        {naming && (
          <NameSheet
            title="Rename"
            fileName={current.fileName}
            confirmLabel="Save"
            pending={busy === 'rename'}
            onCancel={() => setNaming(false)}
            onConfirm={(fileName) =>
              void run('rename', async () => {
                await onRename(current.id, fileName);
                setNaming(false);
              })
            }
          />
        )}
      </View>
    </Modal>
  );
}

function Page({
  boardId,
  attachment,
  width,
  onOpen,
}: {
  boardId: string;
  attachment: AttachmentDto;
  width: number;
  onOpen: () => void;
}) {
  const kind = attachmentKind(attachment.mimeType);
  return (
    <Pressable
      // A video page plays on tap; a picture page does nothing on tap.
      disabled={kind === 'image'}
      onPress={onOpen}
      accessibilityLabel={attachment.fileName}
      style={{ width, flex: 1, alignItems: 'center', justifyContent: 'center' }}
    >
      {kind === 'image' || kind === 'video' ? (
        <AttachmentThumb boardId={boardId} attachment={attachment} contentFit="contain" />
      ) : (
        <View style={{ width: 160, height: 160, borderRadius: 20, overflow: 'hidden' }}>
          <AttachmentThumb boardId={boardId} attachment={attachment} size={160} />
        </View>
      )}
    </Pressable>
  );
}

function RoundButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.18)',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Icon name={icon} size={16} color={INK} />
    </Pressable>
  );
}

function Action({
  icon,
  label,
  busy,
  onPress,
}: {
  icon: IconName;
  label: string;
  busy: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => ({ alignItems: 'center', gap: 4, minWidth: 64, opacity: pressed ? 0.6 : 1 })}
    >
      {busy ? <ActivityIndicator color={INK} /> : <Icon name={icon} size={22} color={INK} />}
      <ThemedText variant="footnote" style={{ color: DIM }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}
