import { useState } from 'react';
import { Pressable, View } from 'react-native';
import type { AttachmentDto } from '@artist/api-client';
import { PosterText } from '@/components/poster-text';
import { spacing, useThemeColors } from '@/theme';
import { AttachmentGallery } from './attachment-gallery';
import { AttachmentThumb } from './attachment-thumb';

const COLUMNS = 3;

/**
 * Files as a grid of thumbnails, each with its name and nothing else — the
 * size and uploader live in the gallery's world, not the list's. A tap opens
 * the gallery on that file, and a swipe there reaches the rest.
 *
 * Set like Spotify's album grid: square art with tight corners, the name
 * left-aligned under it in the row title's weight.
 */
export function AttachmentGrid({
  boardId,
  attachments,
  canManage,
  onRename,
  onDelete,
}: {
  boardId: string;
  attachments: AttachmentDto[];
  /** Whether the viewer may rename and delete this one. */
  canManage: (attachment: AttachmentDto) => boolean;
  onRename: (attachmentId: string, fileName: string) => Promise<unknown>;
  onDelete: (attachmentId: string) => Promise<unknown>;
}) {
  const colors = useThemeColors();
  const [width, setWidth] = useState(0);
  const [opened, setOpened] = useState<number | null>(null);
  const tile = width > 0 ? (width - spacing.sm * (COLUMNS - 1)) / COLUMNS : 0;

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}
    >
      {tile > 0 &&
        attachments.map((attachment, index) => (
          <Pressable
            key={attachment.id}
            accessibilityRole="imagebutton"
            accessibilityLabel={`Open ${attachment.fileName}`}
            onPress={() => setOpened(index)}
            style={({ pressed }) => ({ width: tile, gap: 6, opacity: pressed ? 0.7 : 1 })}
          >
            <View
              style={{
                width: tile,
                height: tile,
                borderRadius: 8,
                borderCurve: 'continuous',
                overflow: 'hidden',
                backgroundColor: colors.muted,
              }}
            >
              <AttachmentThumb boardId={boardId} attachment={attachment} size={tile} />
            </View>
            <PosterText variant="meta" color={colors.foreground} numberOfLines={2}>
              {attachment.fileName}
            </PosterText>
          </Pressable>
        ))}

      {opened !== null && (
        <AttachmentGallery
          boardId={boardId}
          attachments={attachments}
          startIndex={Math.min(opened, attachments.length - 1)}
          canManage={canManage}
          onRename={onRename}
          onDelete={onDelete}
          onClose={() => setOpened(null)}
        />
      )}
    </View>
  );
}
