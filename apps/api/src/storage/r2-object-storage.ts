import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  SIGNED_URL_TTL_SECONDS,
  type ObjectStorage,
  type SignedUpload,
  type SignedUrl,
  type StoredObject,
  type UploadOptions,
} from './object-storage';

/** Attachments never change once uploaded, so devices may keep them. */
const CACHE_CONTROL = 'private, max-age=31536000, immutable';
/** A big file on a slow phone connection still has to start inside this. */
const UPLOAD_URL_TTL_SECONDS = 15 * 60;

/**
 * Cloudflare R2 through its S3 API. Presigned URLs only work on the
 * `<account>.r2.cloudflarestorage.com` endpoint, not on a custom domain, which
 * is fine: every URL here is short-lived and private.
 */
export class R2ObjectStorage implements ObjectStorage {
  private readonly logger = new Logger(R2ObjectStorage.name);
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService, s3?: S3Client) {
    this.bucket = config.getOrThrow<string>('R2_BUCKET');
    this.s3 =
      s3 ??
      new S3Client({
        region: 'auto',
        endpoint: `https://${config.getOrThrow<string>('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: config.getOrThrow<string>('R2_ACCESS_KEY_ID'),
          secretAccessKey: config.getOrThrow<string>('R2_SECRET_ACCESS_KEY'),
        },
      });
  }

  /**
   * The size goes into the signature, so R2 refuses a body of any other
   * length: a client that skips the size check can't upload past the cap.
   */
  async createUploadUrl(
    key: string,
    { contentType, size }: UploadOptions,
  ): Promise<SignedUpload> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: size,
      CacheControl: CACHE_CONTROL,
    });
    const url = await getSignedUrl(this.s3, command, {
      expiresIn: UPLOAD_URL_TTL_SECONDS,
      // Signed rather than hoisted into the query string, so the client has to
      // send exactly these values.
      signableHeaders: new Set([
        'content-type',
        'content-length',
        'cache-control',
      ]),
    });
    return {
      url,
      expiresIn: UPLOAD_URL_TTL_SECONDS,
      headers: { 'Content-Type': contentType, 'Cache-Control': CACHE_CONTROL },
    };
  }

  async createDownloadUrl(key: string, fileName: string): Promise<SignedUrl> {
    return this.signGet(key, contentDisposition(fileName));
  }

  async createViewUrl(key: string): Promise<SignedUrl> {
    return this.signGet(key);
  }

  async head(key: string): Promise<StoredObject | null> {
    try {
      const out = await this.s3.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        size: out.ContentLength ?? 0,
        contentType: out.ContentType ?? '',
      };
    } catch (error) {
      if (error instanceof NotFound) return null;
      throw error;
    }
  }

  async remove(keys: string[]) {
    if (keys.length === 0) return;
    try {
      // One request deletes up to 1000 keys; a band's cleanup is far smaller.
      const out = await this.s3.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
        }),
      );
      if (out.Errors?.length) {
        this.logger.warn({
          msg: 'Storage cleanup failed',
          paths: out.Errors.map((e) => e.Key),
        });
      }
    } catch (error) {
      // Best-effort, as with Supabase: the rows are already gone.
      this.logger.warn({
        msg: `Storage cleanup failed: ${(error as Error).message}`,
        paths: keys,
      });
    }
  }

  private async signGet(key: string, disposition?: string): Promise<SignedUrl> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: disposition,
    });
    const url = await getSignedUrl(this.s3, command, {
      expiresIn: SIGNED_URL_TTL_SECONDS,
    });
    return { url, expiresIn: SIGNED_URL_TTL_SECONDS };
  }
}

/** RFC 6266: an ASCII fallback plus the real name, UTF-8 encoded. */
function contentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
