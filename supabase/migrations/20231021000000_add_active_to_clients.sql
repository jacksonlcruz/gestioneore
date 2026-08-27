-- Add active column to clients table for soft delete functionality
-- When active = false, the client is hidden from new entries but historical records are preserved

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

-- Update the insert/update policies if needed (existing policies allow all authenticated users)