-- Add active column to freelancers table for soft delete functionality
-- When active = false, the freelancer is hidden from new entries but historical records are preserved
ALTER TABLE public.freelancers
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;