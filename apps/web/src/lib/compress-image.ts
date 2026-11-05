import {
  compressedImageName,
  fitWithin,
  IMAGE_JPEG_QUALITY,
  isCompressibleImage,
} from "@artist/shared";

/**
 * The browser's half of the photo rule in `@artist/shared`'s
 * image-compression: shrink to 2048 px on the long edge and re-encode as
 * JPEG, which drops EXIF data such as where the photo was taken.
 *
 * Anything else, and any photo the browser can't decode (HEIC outside
 * Safari), goes up untouched; the size caps still apply to it.
 */
export async function compressImage(file: File): Promise<File> {
  if (!isCompressibleImage(file.type)) return file;
  if (typeof createImageBitmap !== "function") return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }

  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", IMAGE_JPEG_QUALITY),
    );
    if (!blob) return file;
    return new File([blob], compressedImageName(file.name), {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  } finally {
    bitmap.close();
  }
}
