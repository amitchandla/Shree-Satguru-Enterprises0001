-- =========================================================
-- Shree Satguru Enterprises — Storage Policies
-- Run this after creating the "business-media" bucket
-- (README.md Step 5) in the Supabase SQL Editor.
-- =========================================================

-- Create the bucket if it doesn't already exist (public read).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-media',
  'business-media',
  true,
  52428800, -- 50MB
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public: can view/download files in this bucket.
drop policy if exists "business_media_public_read" on storage.objects;
create policy "business_media_public_read"
  on storage.objects for select
  using (bucket_id = 'business-media');

-- Only the authenticated Owner can upload.
drop policy if exists "business_media_owner_insert" on storage.objects;
create policy "business_media_owner_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'business-media'
    and public.is_owner()
  );

-- Only the authenticated Owner can update file metadata.
drop policy if exists "business_media_owner_update" on storage.objects;
create policy "business_media_owner_update"
  on storage.objects for update
  using (bucket_id = 'business-media' and public.is_owner())
  with check (bucket_id = 'business-media' and public.is_owner());

-- Only the authenticated Owner can delete.
drop policy if exists "business_media_owner_delete" on storage.objects;
create policy "business_media_owner_delete"
  on storage.objects for delete
  using (bucket_id = 'business-media' and public.is_owner());
