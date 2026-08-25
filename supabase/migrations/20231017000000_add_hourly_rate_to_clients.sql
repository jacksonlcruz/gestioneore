-- Add hourly_rate column to clients table
alter table public.clients
  add column if not exists hourly_rate numeric(10, 2) not null default 0;

-- Update RLS policies to include the new column (existing policies already cover all columns)