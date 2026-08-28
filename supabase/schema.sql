-- =========================================================
-- Shree Satguru Enterprises — Database Schema
-- Run this first in the Supabase SQL Editor.
-- =========================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- profiles
-- One row per authenticated user. Created automatically for
-- every new auth.users row via the trigger below, with role
-- defaulting to 'customer'. The Owner's role is upgraded to
-- 'owner' manually — see README.md Step 7.
-- ---------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  phone text,
  role text not null default 'customer' check (role in ('owner', 'customer')),
  created_at timestamptz not null default now()
);

-- Automatically create a profile row whenever a new user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'customer')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------
-- business_settings
-- Single-row table holding editable public business info.
-- ---------------------------------------------------------
create table if not exists public.business_settings (
  id uuid primary key default gen_random_uuid(),
  business_name text not null default 'Shree Satguru Enterprises',
  owner_name text not null default 'Mr. Hansraj',
  description text,
  phone_primary text not null default '9416888344',
  phone_secondary text default '9729185344',
  whatsapp_number text not null default '9416888344',
  address text default 'Near HP Petrol Pump, Main Bus Stand, Mohanpur, Rewari, Haryana – 123401, India',
  location_url text,
  updated_at timestamptz not null default now()
);

-- Seed exactly one row if the table is empty.
insert into public.business_settings (business_name, owner_name, description, phone_primary, phone_secondary, whatsapp_number, address)
select
  'Shree Satguru Enterprises',
  'Mr. Hansraj',
  'Shree Satguru Enterprises is a trusted destination for a wide range of hardware, paint, and electrical products. We focus on providing quality products at competitive wholesale prices. Our goal is to offer customers a reliable shopping experience with a wide selection of products.',
  '9416888344',
  '9729185344',
  '9416888344',
  'Near HP Petrol Pump, Main Bus Stand, Mohanpur, Rewari, Haryana – 123401, India'
where not exists (select 1 from public.business_settings);

-- ---------------------------------------------------------
-- inquiries
-- Customer inquiry form submissions.
-- ---------------------------------------------------------
create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  message text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- gallery_media
-- Owner-managed photo/video gallery.
-- ---------------------------------------------------------
create table if not exists public.gallery_media (
  id uuid primary key default gen_random_uuid(),
  title text,
  description text,
  media_type text not null check (media_type in ('image', 'video')),
  file_url text not null,
  file_path text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create index if not exists idx_gallery_media_created_at on public.gallery_media (created_at desc);
create index if not exists idx_inquiries_created_at on public.inquiries (created_at desc);
