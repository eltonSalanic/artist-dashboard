import { View } from 'react-native';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { splitFileName } from '@artist/shared';
import { useAttachmentUrl, type AttachmentDto } from '@artist/api-client';
import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { env } from '@/lib/env';
import { reachableStorageUrl } from '@/lib/storage-url';
import { useThemeColors } from '@/theme';
import { attachmentKind, type AttachmentKind } from './attachment-kind';

const ICON: Record<AttachmentKind, IconName> = {
  image: { sf: 'photo', md: 'image' },
  video: { sf: 'film', md: 'movie' },
  audio: { sf: 'waveform', md: 'audiotrack' },
  pdf: { sf: 'doc.richtext', md: 'picture-as-pdf' },
  other: { sf: 'doc', md: 'insert-drive-file' },
};

/**
 * A signed link to draw an attachment, made reachable from the phone. Only
 * fetched for what can be drawn: a PDF tile is an icon, and signing it would
 * be a request for nothing.
 */
export function useViewUrl(boardId: string, attachment: AttachmentDto, enabled = true) {
  const url = useAttachmentUrl(boardId, attachment.id, 'view', enabled);
  return url.data ? reachableStorageUrl(url.data.url, env.supabaseUrl) : undefined;
}

/**
 * A picture of an attachment: the image itself, a frame of a video, or the
 * file type's icon with its extension for anything else.
 *
 * Images cache under the attachment's id rather than the URL, because the URL
 * is re-signed every minute and would otherwise never hit the cache.
 */
export function AttachmentThumb({
  boardId,
  attachment,
  size,
  contentFit = 'cover',
}: {
  boardId: string;
  attachment: AttachmentDto;
  /** Undefined fills the parent, as the gallery does. */
  size?: number;
  contentFit?: 'cover' | 'contain';
}) {
  const colors = useThemeColors();
  const kind = attachmentKind(attachment.mimeType);
  const drawable = kind === 'image' || kind === 'video';
  const url = useViewUrl(boardId, attachment, drawable);

  // A frame from a little way in: the very first is often black.
  const frame = useQuery({
    queryKey: ['video-thumb', attachment.id],
    queryFn: () => VideoThumbnails.getThumbnailAsync(url!, { time: 1000, quality: 0.6 }),
    enabled: kind === 'video' && url !== undefined,
    // The frame is a local file; it does not expire with the link.
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });

  const box = size === undefined ? { flex: 1, alignSelf: 'stretch' as const } : { width: size, height: size };
  const picture =
    kind === 'image' && url
      ? { uri: url, cacheKey: `attachment-${attachment.id}` }
      : kind === 'video' && frame.data
        ? { uri: frame.data.uri }
        : null;

  if (picture) {
    return (
      <View style={box}>
        <Image
          source={picture}
          contentFit={contentFit}
          transition={150}
          style={{ flex: 1 }}
          accessibilityIgnoresInvertColors
        />
        {kind === 'video' && (
          <View
            pointerEvents="none"
            style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name={{ sf: 'play.circle.fill', md: 'play-circle-filled' }} size={size ? size / 3 : 56} color="#ffffff" />
          </View>
        )}
      </View>
    );
  }

  const { extension } = splitFileName(attachment.fileName);
  return (
    <View style={[box, { alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: colors.muted }]}>
      <Icon name={ICON[kind]} size={size ? size / 3 : 56} color={colors.mutedForeground} />
      {extension !== '' && (
        <ThemedText variant="caption" tone="muted">
          {extension.slice(1).toUpperCase()}
        </ThemedText>
      )}
    </View>
  );
}
