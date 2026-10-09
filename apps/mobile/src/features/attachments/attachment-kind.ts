/**
 * What a file is, as far as the phone's attachment views care: whether it can
 * be drawn as a picture, and where saving it should put it.
 *
 * Pure and free of native imports, so it can be tested; the components that
 * act on it live next door.
 */
export type AttachmentKind = 'image' | 'video' | 'audio' | 'pdf' | 'other';

export function attachmentKind(mimeType: string): AttachmentKind {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf') return 'pdf';
  return 'other';
}

/** Photos and videos save to the photo library; everything else to Files. */
export function savesToPhotos(mimeType: string): boolean {
  const kind = attachmentKind(mimeType);
  return kind === 'image' || kind === 'video';
}

/**
 * Which page the gallery shows after the file on page `index` is deleted from
 * a list that then has `remaining` files: the one that slid into its place, or
 * the new last one if it was the last. Null when nothing is left to show.
 */
export function pageAfterDelete(index: number, remaining: number): number | null {
  if (remaining <= 0) return null;
  return Math.min(index, remaining - 1);
}
