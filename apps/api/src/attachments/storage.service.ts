import { randomUUID } from 'node:crypto';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'attachments';
/** Long enough for a click-to-download round trip, short enough to not leak. */
const DOWNLOAD_URL_TTL_SECONDS = 60;

/**
 * Service-role wrapper around the private `attachments` bucket. The browser
 * never talks to Storage with its own credentials: it asks the API for a
 * signed upload token, PUTs the bytes, then asks the API to persist the row.
 * Every permission check therefore stays in Nest.
 */
@Injectable()
export class StorageService {
  private readonly client: SupabaseClient;

  constructor(config: ConfigService) {
    this.client = createClient(
      config.getOrThrow<string>('SUPABASE_URL'),
      config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }

  /**
   * The path is minted here, never taken from the client — a uuid segment
   * keeps two uploads of "mix.wav" apart and keeps every object under the
   * board that owns it.
   */
  async createUploadUrl(boardId: string, fileName: string) {
    const path = `${boardId}/${randomUUID()}/${sanitize(fileName)}`;
    const { data, error } = await this.client.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);
    if (error || !data) {
      throw new InternalServerErrorException('Could not start the upload');
    }
    return { path, token: data.token, signedUrl: data.signedUrl };
  }

  async createDownloadUrl(storagePath: string, fileName: string) {
    const { data, error } = await this.client.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, DOWNLOAD_URL_TTL_SECONDS, {
        download: fileName,
      });
    if (error || !data) {
      throw new InternalServerErrorException('Could not sign the download');
    }
    return { url: data.signedUrl, expiresIn: DOWNLOAD_URL_TTL_SECONDS };
  }

  /**
   * Same short-lived signed URL as the download, minus the `download`
   * disposition — the object serves inline under its stored content-type so
   * the browser previews it (image/pdf/audio/video) instead of saving it.
   */
  async createViewUrl(storagePath: string) {
    const { data, error } = await this.client.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, DOWNLOAD_URL_TTL_SECONDS);
    if (error || !data) {
      throw new InternalServerErrorException('Could not sign the preview');
    }
    return { url: data.signedUrl, expiresIn: DOWNLOAD_URL_TTL_SECONDS };
  }

  /** Best-effort object cleanup; the DB row is the source of truth. */
  async remove(storagePaths: string[]) {
    if (storagePaths.length === 0) return;
    await this.client.storage.from(BUCKET).remove(storagePaths);
  }
}

/** Keeps object keys to characters Storage is happy addressing. */
function sanitize(fileName: string): string {
  return fileName.replace(/[^\w.-]+/g, '_').slice(-100);
}
