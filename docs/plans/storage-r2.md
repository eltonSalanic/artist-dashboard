# Move file storage to Cloudflare R2

> **State:** In progress
> **Updated:** 2026-11-05
> **Task ID prefix:** `STO`
> **Source:** Imported from Claude: "Plan: move image storage to Cloudflare" (https://claude.ai/artifact/Wb6SoyxDMM7rHXZvvjxG1N)

## Goal

Attachments move from Supabase Storage to Cloudflare R2 behind an
`ObjectStorage` interface, so the next provider change is a class and an env
var. Downloads stop costing money as bands grow.

## Scope and decisions

- In scope: the storage interface, Supabase and R2 providers, per-type size
  caps, checking the bucket on save, setting up R2, copying existing files.
- Out of scope: compressing images and thumbnails (the
  [compression card](https://trello.com/c/6odIAnyS)), which builds on this.
- Decisions:
  - R2, not Cloudflare Images, because the bucket holds PDFs, audio and video.
  - Local dev stays on Supabase Storage (free, offline). R2 locally is possible
    with a dev bucket when testing CORS or prod behaviour.
  - Caps per type: images 10 MB, PDFs 25 MB, audio and video 100 MB, anything
    else 25 MB. Only images get compressed; audio, video and PDFs are already
    compressed or would lose quality.
  - Same object keys in both buckets, so the migration is a copy with no
    database change.

## Tasks

| ID | Task | State | Trello card |
|---|---|---|---|
| STO-001 | `ObjectStorage` interface, Supabase and R2 providers, `STORAGE_PROVIDER` | Testing | [STO-001/002](https://trello.com/c/qh1mFKP5) |
| STO-002 | Per-type size caps in shared, the apps and the API; `head()` check on save | Testing | [STO-001/002](https://trello.com/c/qh1mFKP5) |
| STO-003 | Create R2 buckets (dev, staging, prod) and scoped tokens; a CORS policy on each bucket for its web origin | In progress: buckets and env done, CORS to add | — |
| STO-004 | Copy existing files with `rclone`, verify, switch, catch-up sync | Planned | — |
| STO-005 | Empty the old bucket 30 days after the switch | Planned | — |

## Migration steps (STO-004)

1. Count what there is: `select count(*), sum(size) from "Attachment"`.
2. `rclone sync <old>:attachments r2:bandwall-attachments-prod --progress`,
   using the old bucket's S3 endpoint and access keys.
3. Check every `Attachment.storagePath` exists in R2; any missing key fails.
4. Set `STORAGE_PROVIDER=r2` and redeploy the API.
5. Run the same sync and check again, for uploads made between 2 and 4.
6. Leave the old bucket alone for 30 days. Rolling back is switching the
   variable back and copying back anything uploaded to R2 meanwhile.
