-- ROLLBACK da migração 20261118010000_service_records_rls.sql
-- Restaura o acesso amplo (qualquer logado lê/edita tudo). Use só em emergência.

drop policy if exists "service_records_select_involved" on public.service_records;
drop policy if exists "service_records_insert_auth" on public.service_records;
drop policy if exists "service_records_update_involved" on public.service_records;
drop policy if exists "service_records_delete_involved" on public.service_records;

create policy "Enable select for authenticated users on service_records" on public.service_records for select to authenticated using (true);
create policy "Enable insert for authenticated users on service_records" on public.service_records for insert to authenticated with check (true);
create policy "Enable update for authenticated users on service_records" on public.service_records for update to authenticated using (true);
create policy "Enable delete for authenticated users on service_records" on public.service_records for delete to authenticated using (true);

drop policy if exists "service_participants_select_involved" on public.service_participants;
drop policy if exists "service_participants_insert_involved" on public.service_participants;
drop policy if exists "service_participants_update_involved" on public.service_participants;
drop policy if exists "service_participants_delete_involved" on public.service_participants;

create policy "Enable select for authenticated users" on public.service_participants for select to authenticated using (true);
create policy "Enable insert for authenticated users" on public.service_participants for insert to authenticated with check (true);
create policy "Enable update for authenticated users" on public.service_participants for update to authenticated using (true);
create policy "Enable delete for authenticated users" on public.service_participants for delete to authenticated using (true);

drop function if exists public.merge_service_record_slot(uuid, date, time, time, text, uuid[], uuid[]);
drop function if exists public.is_record_creator(uuid);
drop function if exists public.is_record_participant(uuid);
drop function if exists public.is_admin();
