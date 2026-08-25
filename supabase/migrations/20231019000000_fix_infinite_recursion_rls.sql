-- Fix infinite recursion in RLS policies for service_participants and service_records
-- The previous policies had circular dependencies:
--   service_participants SELECT -> queries service_records -> queries service_participants -> ...

-- =============================================
-- SERVICE PARTICIPANTS - Remove old recursive policies
-- =============================================
DROP POLICY IF EXISTS "Users can view service participants" ON public.service_participants;
DROP POLICY IF EXISTS "Users can insert service participants" ON public.service_participants;
DROP POLICY IF EXISTS "Users can update service participants" ON public.service_participants;
DROP POLICY IF EXISTS "Users can delete service participants" ON public.service_participants;

-- Also drop policies created by previous migrations
DROP POLICY IF EXISTS "Service participants are viewable by everyone" ON public.service_participants;
DROP POLICY IF EXISTS "Service participants are insertable by everyone" ON public.service_participants;
DROP POLICY IF EXISTS "Service participants are updatable by everyone" ON public.service_participants;
DROP POLICY IF EXISTS "Service participants are deletable by everyone" ON public.service_participants;
DROP POLICY IF EXISTS "Service participants are viewable by admins or own" ON public.service_participants;
DROP POLICY IF EXISTS "Service participants are updatable by admins or own" ON public.service_participants;
DROP POLICY IF EXISTS "Service participants are deletable by admins or own" ON public.service_participants;
DROP POLICY IF EXISTS "Service participants are insertable by authenticated users" ON public.service_participants;

-- =============================================
-- SERVICE PARTICIPANTS - Recreate direct non-recursive policies
-- =============================================
CREATE POLICY "Enable select for authenticated users"
ON public.service_participants FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable insert for authenticated users"
ON public.service_participants FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users"
ON public.service_participants FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Enable delete for authenticated users"
ON public.service_participants FOR DELETE
TO authenticated
USING (true);

-- =============================================
-- SERVICE RECORDS - Remove old recursive policies
-- =============================================
DROP POLICY IF EXISTS "Users can view service records" ON public.service_records;
DROP POLICY IF EXISTS "Users can insert service records" ON public.service_records;
DROP POLICY IF EXISTS "Users can update service records" ON public.service_records;
DROP POLICY IF EXISTS "Users can delete service records" ON public.service_records;

-- Also drop policies created by previous migrations
DROP POLICY IF EXISTS "Service records are viewable by everyone" ON public.service_records;
DROP POLICY IF EXISTS "Service records are insertable by everyone" ON public.service_records;
DROP POLICY IF EXISTS "Service records are updatable by everyone" ON public.service_records;
DROP POLICY IF EXISTS "Service records are deletable by everyone" ON public.service_records;
DROP POLICY IF EXISTS "Service records are viewable by admins or own participants" ON public.service_records;
DROP POLICY IF EXISTS "Service records are updatable by admins or own participants" ON public.service_records;
DROP POLICY IF EXISTS "Service records are deletable by admins or own participants" ON public.service_records;
DROP POLICY IF EXISTS "Service records are insertable by authenticated users" ON public.service_records;
DROP POLICY IF EXISTS "Service records are viewable by admins, own participants or creator" ON public.service_records;

-- =============================================
-- SERVICE RECORDS - Recreate direct non-recursive policies
-- =============================================
CREATE POLICY "Enable select for authenticated users on service_records"
ON public.service_records FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable insert for authenticated users on service_records"
ON public.service_records FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users on service_records"
ON public.service_records FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Enable delete for authenticated users on service_records"
ON public.service_records FOR DELETE
TO authenticated
USING (true);