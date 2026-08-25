-- Fix RLS for service_records and service_participants inserts
-- - Add created_by column to service_records to track the creator
-- - Ensure insert policies allow authenticated users
-- - Update select policy to allow creator to see their own records

-- =============================================
-- SERVICE RECORDS - ADD created_by
-- =============================================
alter table public.service_records
  add column if not exists created_by uuid references public.profiles (id) on delete set null;

-- =============================================
-- SERVICE RECORDS - INSERT POLICY
-- =============================================
drop policy if exists "Service records are insertable by everyone" on public.service_records;

create policy "Service records are insertable by authenticated users"
  on public.service_records for insert
  with check (
    auth.uid() is not null
  );

-- =============================================
-- SERVICE RECORDS - SELECT POLICY (include creator)
-- =============================================
drop policy if exists "Service records are viewable by admins or own participants" on public.service_records;

create policy "Service records are viewable by admins, own participants or creator"
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
    or
    created_by = auth.uid()
  );

-- =============================================
-- SERVICE PARTICIPANTS - INSERT POLICY
-- =============================================
drop policy if exists "Service participants are insertable by everyone" on public.service_participants;

create policy "Service participants are insertable by authenticated users"
  on public.service_participants for insert
  with check (
    auth.uid() is not null
  );