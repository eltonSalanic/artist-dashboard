import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { attachmentSizeError, type UploadUrlDto } from '@artist/shared';
import { OBJECT_STORAGE, type ObjectStorage } from './object-storage';

/**
 * What the rest of the API uses for files. It owns the rules — object keys,
 * size caps — and hands the bytes to whichever ObjectStorage provider is
 * configured. The browser never talks to storage with its own credentials:
 * it asks the API for a signed upload URL, PUTs the bytes, then asks the API
 * to persist the row. Every permission check therefore stays in Nest.
 */
@Injectable()
export class StorageService {
  constructor(
    @Inject(OBJECT_STORAGE) private readonly objects: ObjectStorage,
  ) {}

  /**
   * The path is minted here, never taken from the client — a uuid segment
   * keeps two uploads of "mix.wav" apart and keeps every object under the
   * board that owns it. Keys carry nothing provider-specific, so the same keys
   * work in any bucket.
   */
  async createUploadUrl(boardId: string, dto: UploadUrlDto) {
    // The DTO schema checks this too; repeated so no caller can skip it.
    const tooBig = attachmentSizeError(dto.contentType, dto.size);
    if (tooBig) throw new BadRequestException(tooBig);

    const path = `${boardId}/${randomUUID()}/${sanitize(dto.fileName)}`;
    const { url, headers, expiresIn } = await this.objects.createUploadUrl(
      path,
      { contentType: dto.contentType, size: dto.size },
    );
    return { path, signedUrl: url, headers, expiresIn };
  }

  createDownloadUrl(storagePath: string, fileName: string) {
    return this.objects.createDownloadUrl(storagePath, fileName);
  }

  createViewUrl(storagePath: string) {
    return this.objects.createViewUrl(storagePath);
  }

  /** What is really stored at the path, or null if the upload never landed. */
  stat(storagePath: string) {
    return this.objects.head(storagePath);
  }

  /** Best-effort object cleanup; the DB row is the source of truth. */
  remove(storagePaths: string[]) {
    return this.objects.remove(storagePaths);
  }
}

/** Keeps object keys to characters every provider is happy addressing. */
function sanitize(fileName: string): string {
  return fileName.replace(/[^\w.-]+/g, '_').slice(-100);
}
