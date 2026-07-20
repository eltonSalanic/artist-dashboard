-- Private bucket for task/comment attachments (PDFs, MP3s, WAVs, images).
-- Access is mediated by the NestJS API via signed URLs; no public access.
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;
