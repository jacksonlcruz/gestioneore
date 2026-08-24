-- Restrict update policies so that:
-- - Admins can update any record
-- - Employees can only update records where they are participants

-- =============================================
-- SERVICE RECORDS - UPDATE
-- =============================================
drop policy if exists "Service records are updatable by everyone" on public.service_records;

create policy "Service records are updatable by admins or own participants"
  on public.service_records for update
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
  )
  with check (
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
-- SERVICE PARTICIPANTS - UPDATE
-- =============================================
drop policy if exists "Service participants are updatable by everyone" on public.service_participants;

create policy "Service participants are updatable by admins or own"
  on public.service_participants for update
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
  )
  with check (
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