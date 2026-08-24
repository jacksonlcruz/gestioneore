-- Fix RLS policies for profiles and service_records
-- - Profiles: authenticated users can read their own profile and colleagues' profiles
-- - Service records: employees can only read records where they are participants

-- =============================================
-- PROFILES - SELECT
-- =============================================
drop policy if exists "Profiles are viewable by everyone" on public.profiles;

create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  using (
    auth.uid() is not null
  );

-- =============================================
-- SERVICE RECORDS - SELECT
-- =============================================
drop policy if exists "Service records are viewable by everyone" on public.service_records;
drop policy if exists "Service records are viewable by admins or own participants" on public.service_records;

create policy "Service records are viewable by admins or own participants"
  on public.service_records for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
    or
    exists (
      select 1 from public.service_participants sp
      where sp.service_record_id = service_records.id
        and sp.worker_type = 'employee'
        and sp.profile_id = auth.uid()
    )
  );

-- =============================================
-- SERVICE PARTICIPANTS - SELECT
-- =============================================
drop policy if exists "Service participants are viewable by everyone" on public.service_participants;
drop policy if exists "Service participants are viewable by admins or own" on public.service_participants;

create policy "Service participants are viewable by admins or own"
  on public.service_participants for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
    or
    (
      worker_type = 'employee'
      and profile_id = auth.uid()
    )
    or
    exists (
      select 1 from public.service_records sr
      where sr.id = service_participants.service_record_id
        and exists (
          select 1 from public.service_participants sp2
          where sp2.service_record_id = sr.id
            and sp2.worker_type = 'employee'
            and sp2.profile_id = auth.uid()
        )
    )
  );