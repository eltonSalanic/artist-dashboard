import { splitFileName } from "./file-name";

/**
 * Photos are shrunk on the device before upload. Band Wall holds working files
 * (stage plots, receipts, a shot of the van), not a photo library, so 2048 px
 * on the long edge is plenty on any screen and cuts a 3–8 MB phone photo to
 * well under 1 MB. Re-encoding also turns iPhone HEIC into JPEG, which every
 * browser opens, and drops EXIF data, so a photo no longer carries the GPS
 * position it was taken at.
 *
 * Only photos: PNGs and GIFs are usually screenshots, line art or animations
 * that JPEG would blur or freeze, and audio, video and PDFs are already
 * compressed or would lose quality a bandmate needs.
 */
export const IMAGE_MAX_EDGE = 2048;
export const IMAGE_JPEG_QUALITY = 0.8;

const COMPRESSIBLE = new Set([
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export function isCompressibleImage(mimeType: string): boolean {
  return COMPRESSIBLE.has(mimeType.toLowerCase());
}

/**
 * Alongside the upload, the device also makes a small JPEG preview so the
 * attachment grid loads tens of KB per tile instead of the full photo. PNGs
 * get one too: the original is left alone, only the preview is a JPEG.
 * GIFs and SVGs do not; their tiles load the original.
 */
export const THUMBNAIL_MAX_EDGE = 400;
export const THUMBNAIL_JPEG_QUALITY = 0.7;

export function canThumbnail(mimeType: string): boolean {
  return (
    isCompressibleImage(mimeType) || mimeType.toLowerCase() === "image/png"
  );
}

/** The size to draw at: the same shape, no edge over `maxEdge`, never enlarged. */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number = IMAGE_MAX_EDGE,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge || longest <= 0) return { width, height };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** "IMG_0042.HEIC" → "IMG_0042.jpg": the name matches what was re-encoded. */
export function compressedImageName(fileName: string): string {
  const { base } = splitFileName(fileName);
  return `${base || "photo"}.jpg`;
}
