-- Restrict delete policies so that:
-- - Admins can delete any record
-- - Employees can only delete records where they are participants

-- =============================================
-- SERVICE RECORDS - DELETE
-- =============================================
drop policy if exists "Service records are deletable by everyone" on public.service_records;

create policy "Service records are deletable by admins or own participants"
  on public.service_records for delete
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
-- SERVICE PARTICIPANTS - DELETE
-- =============================================
drop policy if exists "Service participants are deletable by everyone" on public.service_participants;

create policy "Service participants are deletable by admins or own"
  on public.service_participants for delete
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
  );

-- =============================================
-- CLIENTS - DELETE (only admins)
-- =============================================
drop policy if exists "Clients are deletable by everyone" on public.clients;

create policy "Clients are deletable by admins only"
  on public.clients for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- =============================================
-- FREELANCERS - DELETE (only admins)
-- =============================================
drop policy if exists "Freelancers are deletable by everyone" on public.freelancers;

create policy "Freelancers are deletable by admins only"
  on public.freelancers for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- =============================================
-- PROFILES - DELETE (only admins)
-- =============================================
drop policy if exists "Profiles are deletable by everyone" on public.profiles;

create policy "Profiles are deletable by admins only"
  on public.profiles for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );
