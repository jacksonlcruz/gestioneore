-- Add username column to profiles for login by username or email
alter table public.profiles
  add column if not exists username text unique,
  add column if not exists created_at timestamptz not null default now();