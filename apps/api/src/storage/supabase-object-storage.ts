import { InternalServerErrorException, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import {
  SIGNED_URL_TTL_SECONDS,
  type ObjectStorage,
  type SignedUpload,
  type SignedUrl,
  type StoredObject,
  type UploadOptions,
} from './object-storage';

const BUCKET = 'attachments';
/** Supabase's signed upload URLs are valid for two hours; it isn't configurable. */
const UPLOAD_URL_TTL_SECONDS = 2 * 60 * 60;

/**
 * Service-role wrapper around the private `attachments` bucket. The default
 * provider, and what local development runs on (`npx supabase start`).
 */
export class SupabaseObjectStorage implements ObjectStorage {
  private readonly logger = new Logger(SupabaseObjectStorage.name);
  private readonly client: ReturnType<typeof createClient>;

  constructor(config: ConfigService) {
    this.client = createClient(
      config.getOrThrow<string>('SUPABASE_URL'),
      config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }

  /**
   * Supabase can't sign the size into the URL, so the bucket's own
   * `file_size_limit` and the `head()` check on save are what hold the cap here.
   */
  async createUploadUrl(
    key: string,
    { contentType }: UploadOptions,
  ): Promise<SignedUpload> {
    const { data, error } = await this.client.storage
      .from(BUCKET)
      .createSignedUploadUrl(key);
    if (error || !data) {
      throw new InternalServerErrorException('Could not start the upload');
    }
    return {
      url: data.signedUrl,
      expiresIn: UPLOAD_URL_TTL_SECONDS,
      headers: { 'Content-Type': contentType },
    };
  }

  async createDownloadUrl(key: string, fileName: string): Promise<SignedUrl> {
    const { data, error } = await this.client.storage
      .from(BUCKET)
      .createSignedUrl(key, SIGNED_URL_TTL_SECONDS, { download: fileName });
    if (error || !data) {
      throw new InternalServerErrorException('Could not sign the download');
    }
    return { url: data.signedUrl, expiresIn: SIGNED_URL_TTL_SECONDS };
  }

  /**
   * Same short-lived signed URL as the download, minus the `download`
   * disposition — the object serves inline under its stored content-type so
   * the browser previews it (image/pdf/audio/video) instead of saving it.
   */
  async createViewUrl(key: string): Promise<SignedUrl> {
    const { data, error } = await this.client.storage
      .from(BUCKET)
      .createSignedUrl(key, SIGNED_URL_TTL_SECONDS);
    if (error || !data) {
      throw new InternalServerErrorException('Could not sign the preview');
    }
    return { url: data.signedUrl, expiresIn: SIGNED_URL_TTL_SECONDS };
  }

  async head(key: string): Promise<StoredObject | null> {
    const { data, error } = await this.client.storage.from(BUCKET).info(key);
    if (error) {
      // Storage answers a missing object with 400 or 404; anything else is
      // Storage itself failing, which shouldn't read as "upload didn't finish".
      const status = Number((error as { status?: number }).status);
      if (status === 400 || status === 404) return null;
      throw new InternalServerErrorException('Could not check the upload');
    }
    return { size: data.size ?? 0, contentType: data.contentType ?? '' };
  }

  async remove(keys: string[]) {
    if (keys.length === 0) return;
    // supabase-js returns `{ error }` rather than throwing, so an unchecked
    // call silently left orphaned private files behind. Still best-effort
    // (the row is already gone), but now it leaves a trail to clean up from.
    const { error } = await this.client.storage.from(BUCKET).remove(keys);
    if (error) {
      this.logger.warn({
        msg: `Storage cleanup failed: ${error.message}`,
        paths: keys,
      });
    }
  }
}
