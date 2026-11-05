/**
 * The one seam between the API and wherever files live. Providers only move
 * bytes and sign URLs; keys, size caps and permission checks stay in
 * StorageService and the services above it, so swapping providers is a new
 * class and an env var, not a rewrite.
 */
export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

export interface SignedUrl {
  url: string;
  /** Seconds the URL stays valid. */
  expiresIn: number;
}

export interface UploadOptions {
  contentType: string;
  size: number;
}

export interface SignedUpload extends SignedUrl {
  /** Headers the client must send with its PUT, or the signature won't match. */
  headers: Record<string, string>;
}

export interface StoredObject {
  size: number;
  contentType: string;
}

export interface ObjectStorage {
  /** A presigned PUT for one object. Signs the type and size where it can. */
  createUploadUrl(key: string, options: UploadOptions): Promise<SignedUpload>;
  /** A short-lived GET that saves the object as `fileName`. */
  createDownloadUrl(key: string, fileName: string): Promise<SignedUrl>;
  /** A short-lived GET that serves the object inline, for previews. */
  createViewUrl(key: string): Promise<SignedUrl>;
  /** The object's real size and type, or null when nothing is stored there. */
  head(key: string): Promise<StoredObject | null>;
  /** Best-effort delete: logs what failed rather than throwing. */
  remove(keys: string[]): Promise<void>;
}

/** Long enough for a click-to-download round trip, short enough to not leak. */
export const SIGNED_URL_TTL_SECONDS = 60;
