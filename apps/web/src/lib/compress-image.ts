import {
  canThumbnail,
  compressedImageName,
  fitWithin,
  IMAGE_JPEG_QUALITY,
  isCompressibleImage,
  THUMBNAIL_JPEG_QUALITY,
  THUMBNAIL_MAX_EDGE,
} from "@artist/shared";

/** A picked file made ready to upload, with its preview when one was made. */
export interface PreparedImage {
  file: File;
  thumbnail?: Blob;
}

/**
 * The browser's half of the photo rule in `@artist/shared`'s
 * image-compression: shrink photos to 2048 px on the long edge and re-encode
 * as JPEG, which drops EXIF data such as where the photo was taken. Photos
 * and PNGs also get a 400 px JPEG preview for the attachment grid; the image
 * is decoded once for both.
 *
 * Anything else, and any image the browser can't decode (HEIC outside
 * Safari), goes up untouched and without a preview; the size caps still
 * apply to it.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!canThumbnail(file.type)) return { file };
  if (typeof createImageBitmap !== "function") return { file };

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return { file };
  }

  try {
    let ready = file;
    if (isCompressibleImage(file.type)) {
      const blob = await drawJpeg(bitmap, undefined, IMAGE_JPEG_QUALITY);
      if (blob) {
        ready = new File([blob], compressedImageName(file.name), {
          type: "image/jpeg",
          lastModified: file.lastModified,
        });
      }
    }
    const thumbnail = await drawJpeg(
      bitmap,
      THUMBNAIL_MAX_EDGE,
      THUMBNAIL_JPEG_QUALITY,
    );
    return thumbnail ? { file: ready, thumbnail } : { file: ready };
  } catch {
    return { file };
  } finally {
    bitmap.close();
  }
}

async function drawJpeg(
  bitmap: ImageBitmap,
  maxEdge: number | undefined,
  quality: number,
): Promise<Blob | null> {
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(bitmap, 0, 0, width, height);
  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
}
