-- Add individual start/end hours to service_participants
-- so each team member can have its own working hours, keeping
-- service_records as the display/billing hours for the client.

ALTER TABLE public.service_participants
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS end_time time;

-- Backfill existing rows, copying the parent record times where null.
UPDATE public.service_participants sp
SET 
  start_time = sr.start_time,
  end_time = sr.end_time
FROM public.service_records sr
WHERE sp.service_record_id = sr.id
  AND sp.start_time IS NULL;