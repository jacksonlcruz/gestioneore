-- Restringe registros de serviço: cada um vê só o que envolve.
-- Admin vê tudo. Funcionário vê registros em que participa ou que criou.
-- A mesclagem de horários idênticos passa pela função merge_service_record_slot,
-- que só junta o usuário a um registro com cliente, data e horários exatamente iguais.
-- Rollback correspondente: 20261118010000_service_records_rls.rollback.sql

-- =============================================
-- Funções auxiliares (SECURITY DEFINER evita recursão de RLS)
-- =============================================
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_record_participant(rec uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.service_participants
    where service_record_id = rec and profile_id = auth.uid()
  );
$$;

create or replace function public.is_record_creator(rec uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.service_records
    where id = rec and created_by = auth.uid()
  );
$$;

revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_record_participant(uuid) from public, anon;
revoke execute on function public.is_record_creator(uuid) from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_record_participant(uuid) to authenticated;
grant execute on function public.is_record_creator(uuid) to authenticated;

-- =============================================
-- Mesclagem de registro com horário idêntico
--   Retorna o id do registro mesclado, ou NULL se não existe registro idêntico
--   (nesse caso o app cria um registro novo normalmente).
--   Regra: quem chama precisa estar entre os participantes informados (ou ser admin).
-- =============================================
create or replace function public.merge_service_record_slot(
  p_client_id uuid,
  p_date date,
  p_start time,
  p_end time,
  p_observation text,
  p_profile_ids uuid[],
  p_freelancer_ids uuid[]
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_rec record;
  v_obs text;
  v_pid uuid;
  v_fid uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select id, observation into v_rec
  from public.service_records
  where client_id = p_client_id
    and date = p_date
    and start_time = p_start
    and end_time = p_end
  order by id
  limit 1
  for update;

  -- Sem registro idêntico: o app cria um registro novo normalmente
  if not found then
    return null;
  end if;

  -- Registro idêntico existe: só quem trabalhou nele (listado ou admin) pode uni-lo
  if not (public.is_admin() or v_uid = any(coalesce(p_profile_ids, '{}'::uuid[]))) then
    raise exception 'caller must be one of the listed participants' using errcode = '42501';
  end if;

  -- Observações: junta sem duplicar (mesma regra de mergeObservations no front)
  v_obs := nullif(btrim(coalesce(p_observation, '')), '');
  if v_obs is not null and v_obs <> '-' then
    if nullif(btrim(coalesce(v_rec.observation, '')), '') is null or btrim(v_rec.observation) = '-' then
      update public.service_records set observation = v_obs where id = v_rec.id;
    elsif position(v_obs in v_rec.observation) = 0 then
      update public.service_records
        set observation = btrim(v_rec.observation) || ' | ' || v_obs
        where id = v_rec.id;
    end if;
  end if;

  -- Participantes: adiciona só os que ainda não estão no registro
  foreach v_pid in array coalesce(p_profile_ids, '{}'::uuid[]) loop
    insert into public.service_participants (service_record_id, worker_type, profile_id)
    select v_rec.id, 'employee', v_pid
    where not exists (
      select 1 from public.service_participants sp
      where sp.service_record_id = v_rec.id and sp.profile_id = v_pid
    );
  end loop;

  foreach v_fid in array coalesce(p_freelancer_ids, '{}'::uuid[]) loop
    insert into public.service_participants (service_record_id, worker_type, freelancer_id)
    select v_rec.id, 'freelancer', v_fid
    where not exists (
      select 1 from public.service_participants sp
      where sp.service_record_id = v_rec.id and sp.freelancer_id = v_fid
    );
  end loop;

  return v_rec.id;
end;
$$;

revoke execute on function public.merge_service_record_slot(uuid, date, time, time, text, uuid[], uuid[]) from public, anon;
grant execute on function public.merge_service_record_slot(uuid, date, time, time, text, uuid[], uuid[]) to authenticated;

-- =============================================
-- SERVICE_RECORDS
-- =============================================
drop policy if exists "Enable select for authenticated users on service_records" on public.service_records;
drop policy if exists "Enable insert for authenticated users on service_records" on public.service_records;
drop policy if exists "Enable update for authenticated users on service_records" on public.service_records;
drop policy if exists "Enable delete for authenticated users on service_records" on public.service_records;

create policy "service_records_select_involved"
  on public.service_records for select to authenticated
  using (
    public.is_admin()
    or created_by = auth.uid()
    or public.is_record_participant(id)
  );

create policy "service_records_insert_auth"
  on public.service_records for insert to authenticated
  with check (true);

create policy "service_records_update_involved"
  on public.service_records for update to authenticated
  using (public.is_admin() or public.is_record_participant(id))
  with check (public.is_admin() or public.is_record_participant(id));

create policy "service_records_delete_involved"
  on public.service_records for delete to authenticated
  using (public.is_admin() or public.is_record_participant(id));

-- =============================================
-- SERVICE_PARTICIPANTS
-- =============================================
drop policy if exists "Enable select for authenticated users" on public.service_participants;
drop policy if exists "Enable insert for authenticated users" on public.service_participants;
drop policy if exists "Enable update for authenticated users" on public.service_participants;
drop policy if exists "Enable delete for authenticated users" on public.service_participants;

create policy "service_participants_select_involved"
  on public.service_participants for select to authenticated
  using (
    public.is_admin()
    or profile_id = auth.uid()
    or public.is_record_participant(service_record_id)
    or public.is_record_creator(service_record_id)
  );

create policy "service_participants_insert_involved"
  on public.service_participants for insert to authenticated
  with check (
    public.is_admin()
    or public.is_record_participant(service_record_id)
    or public.is_record_creator(service_record_id)
  );

create policy "service_participants_update_involved"
  on public.service_participants for update to authenticated
  using (public.is_admin() or public.is_record_participant(service_record_id))
  with check (public.is_admin() or public.is_record_participant(service_record_id));

create policy "service_participants_delete_involved"
  on public.service_participants for delete to authenticated
  using (public.is_admin() or public.is_record_participant(service_record_id));
