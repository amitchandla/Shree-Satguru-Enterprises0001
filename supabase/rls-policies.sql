-- =========================================================
-- Shree Satguru Enterprises — Row Level Security Policies
-- Run this after schema.sql in the Supabase SQL Editor.
--
-- Design: the frontend uses only the public "anon" key, so
-- every permission boundary below is enforced by Postgres
-- itself, not by the browser. A user who bypasses the UI
-- and calls the API directly still cannot do more than these
-- policies allow.
-- =========================================================

-- Helper: is the currently authenticated user the owner?
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner'
  );
$$;

-- ---------------------------------------------------------
-- profiles
-- ---------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));
-- Note: role changes are intentionally blocked from the client.
-- Promote a user to 'owner' manually in the SQL editor (README Step 7).

-- ---------------------------------------------------------
-- business_settings
-- Public: read only. Owner: read + update.
-- ---------------------------------------------------------
alter table public.business_settings enable row level security;

drop policy if exists "business_settings_public_select" on public.business_settings;
create policy "business_settings_public_select"
  on public.business_settings for select
  using (true);

drop policy if exists "business_settings_owner_update" on public.business_settings;
create policy "business_settings_owner_update"
  on public.business_settings for update
  using (public.is_owner())
  with check (public.is_owner());

drop policy if exists "business_settings_owner_insert" on public.business_settings;
create policy "business_settings_owner_insert"
  on public.business_settings for insert
  with check (public.is_owner());

-- No delete policy: business_settings is a single persistent row.

-- ---------------------------------------------------------
-- inquiries
-- Public: can create only. Owner: can read + delete.
-- No one (including the owner) can update an inquiry —
-- it's a submitted record, not an editable document.
-- ---------------------------------------------------------
alter table public.inquiries enable row level security;

drop policy if exists "inquiries_public_insert" on public.inquiries;
create policy "inquiries_public_insert"
  on public.inquiries for insert
  with check (
    length(trim(name)) > 0
    and phone ~ '^[6-9][0-9]{9}$'
  );

drop policy if exists "inquiries_owner_select" on public.inquiries;
create policy "inquiries_owner_select"
  on public.inquiries for select
  using (public.is_owner());

drop policy if exists "inquiries_owner_delete" on public.inquiries;
create policy "inquiries_owner_delete"
  on public.inquiries for delete
  using (public.is_owner());

-- ---------------------------------------------------------
-- gallery_media
-- Public: read only. Owner: full manage (insert/update/delete).
-- ---------------------------------------------------------
alter table public.gallery_media enable row level security;

drop policy if exists "gallery_media_public_select" on public.gallery_media;
create policy "gallery_media_public_select"
  on public.gallery_media for select
  using (true);

drop policy if exists "gallery_media_owner_insert" on public.gallery_media;
create policy "gallery_media_owner_insert"
  on public.gallery_media for insert
  with check (public.is_owner() and created_by = auth.uid());

drop policy if exists "gallery_media_owner_update" on public.gallery_media;
create policy "gallery_media_owner_update"
  on public.gallery_media for update
  using (public.is_owner())
  with check (public.is_owner());

drop policy if exists "gallery_media_owner_delete" on public.gallery_media;
create policy "gallery_media_owner_delete"
  on public.gallery_media for delete
  using (public.is_owner());
