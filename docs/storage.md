# File storage

> **Status:** The storage interface, both providers and the per-type caps are on
> `feat/storage-interface-r2`. Local dev runs on Supabase Storage. R2 buckets,
> tokens and the migration of existing files are not set up yet.

Attachments (task and comment files, show files, receipts) live in one private
bucket. The apps never hold storage credentials: they ask the API for a signed
URL, PUT the bytes straight to storage, then ask the API to save the row.

## Providers

`STORAGE_PROVIDER` picks where files live. Nothing outside `apps/api/src/storage/`
names a provider; everything else injects `StorageService`, which sits on the
`ObjectStorage` interface (`object-storage.ts`).

| Provider | Used for | Env vars |
|---|---|---|
| `supabase` (default) | Local dev, on the free local stack from `npx supabase start` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `r2` | Staging and prod (Cloudflare R2, through its S3 API) | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` |

The API refuses to start if the chosen provider's variables are missing.
Adding a provider means a new class implementing `ObjectStorage` and a case in
`createObjectStorage()` in `storage.module.ts`.

Why R2 and not Cloudflare Images: the bucket holds PDFs, audio and video as
well as photos, and Images only stores images. R2 also charges nothing for
downloads, which are the main storage cost as bands grow.

## Rules

- **Keys are minted by the API:** `<boardId>/<uuid>/<sanitised file name>`. They
  carry nothing provider-specific, so moving providers is a copy under the same
  keys. Saving a row checks the key is under the board.
- **Saving checks the bucket.** `StorageService.stat()` (the provider's `head()`)
  must find the object, and the row records the size storage reports, not the
  client's number.
- **Signed URLs:** view and download URLs last 60 seconds. R2 upload URLs last
  15 minutes and sign `Content-Type`, `Content-Length` and `Cache-Control`, so a
  body of a different size is refused. Supabase upload URLs last 2 hours and
  can't sign the size; its bucket limit and the check on save cover that.
- **Uploads are cached for a year** on R2 (`private, max-age=31536000, immutable`):
  attachments never change once uploaded.
- **Deletes are best effort.** The row is the source of truth; a failed object
  delete is logged, not thrown.

## Size caps

One map in `packages/shared/src/dto/attachment.dto.ts`, checked by the apps
before upload, by the upload-URL schema and again by `StorageService`.

| Type | Cap |
|---|---|
| Images | 10 MB |
| PDFs | 25 MB |
| Audio | 100 MB |
| Video | 100 MB |
| Anything else | 25 MB |

`MAX_ATTACHMENT_BYTES` is the largest of these (100 MB). The local bucket's
`file_size_limit` in `supabase/config.toml` matches it, so local dev never
refuses a file prod would take.

## Setting up R2

1. In the Cloudflare dashboard, create one private bucket per environment, e.g.
   `bandwall-attachments-staging` and `bandwall-attachments-prod`. Leave the
   public `r2.dev` URL off.
2. Create an R2 API token per bucket with Object Read & Write on that bucket
   only. Put its key pair, the account ID and the bucket name in the API's env.
3. Add a CORS policy so the web app can upload from the browser (the phone's
   native upload doesn't need one). Each bucket gets its own, listing only its
   environment's web origin, matched exactly: scheme, host and port, no
   trailing slash. In the dashboard: R2 Object Storage → the bucket →
   **Settings** → **CORS Policy** → **Add CORS policy**, paste the JSON, save.
   The two headers are the ones the API signs into each upload. For prod:

   ```json
   [
     {
       "AllowedOrigins": ["https://bandwall.app"],
       "AllowedMethods": ["PUT", "GET"],
       "AllowedHeaders": ["Content-Type", "Cache-Control"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

   The dev bucket uses `http://localhost:3000` (plus your LAN address if you
   open the web app on it); staging uses its own web URL.
4. Set `STORAGE_PROVIDER=r2` and deploy the API. The order on staging and prod
   is in [release-workflow.md](release-workflow.md#shipping-a-change).

To try R2 from your Mac, point a local API at a separate dev bucket (add
`http://localhost:3000` to its CORS origins). It needs internet; Cloudflare's
local R2 emulator only works inside Workers.

## Moving existing files

Copy every object to R2 under the same key, then switch: `rclone sync` from the
old bucket's S3 endpoint to the R2 bucket, check every `Attachment.storagePath`
exists in R2, set `STORAGE_PROVIDER=r2`, redeploy, and sync once more to catch
uploads made in between. Keep the old bucket for 30 days so rolling back is
switching the variable back. The steps are in
[plans/storage-r2.md](plans/storage-r2.md).
