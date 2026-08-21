-- Add email and is_active columns to profiles
alter table public.profiles
  add column if not exists email text,
  add column if not exists is_active boolean not null default true;