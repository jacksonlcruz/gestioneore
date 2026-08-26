-- Create extra_costs table for managing additional costs / materials linked to clients
-- Examples: laundry of bed linens, extra materials, etc.

CREATE TABLE IF NOT EXISTS public.extra_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  service_record_id UUID REFERENCES public.service_records(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.extra_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for authenticated users on extra_costs"
ON public.extra_costs FOR ALL TO authenticated USING (true) WITH CHECK (true);