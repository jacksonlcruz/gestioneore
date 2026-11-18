-- 1. extra_costs: cada um vê os custos dos registros em que participa, os que criou,
--    e admin vê tudo. Custos sem registro (avulsos) só o criador e admin veem.
-- 2. profiles: e-mail não fica exposto a funcionários. Telas de admin leem via
--    admin_list_profiles() (SECURITY DEFINER, exige admin).
-- Rollback correspondente: 20261118020000_extra_costs_and_profiles_rls.rollback.sql

-- =============================================
-- EXTRA_COSTS
-- =============================================
drop policy if exists "Enable all for authenticated users on extra_costs" on public.extra_costs;

create policy "extra_costs_select_involved"
  on public.extra_costs for select to authenticated
  using (
    public.is_admin()
    or created_by = auth.uid()
    or (
      service_record_id is not null
      and (
        public.is_record_participant(service_record_id)
        or public.is_record_creator(service_record_id)
      )
    )
  );

create policy "extra_costs_insert_own"
  on public.extra_costs for insert to authenticated
  with check (
    public.is_admin()
    or (
      created_by = auth.uid()
      and (
        service_record_id is null
        or public.is_record_participant(service_record_id)
        or public.is_record_creator(service_record_id)
      )
    )
  );

create policy "extra_costs_update_own"
  on public.extra_costs for update to authenticated
  using (public.is_admin() or created_by = auth.uid())
  with check (public.is_admin() or created_by = auth.uid());

create policy "extra_costs_delete_own"
  on public.extra_costs for delete to authenticated
  using (public.is_admin() or created_by = auth.uid());

-- =============================================
-- PROFILES: e-mail só para admin
-- =============================================
revoke select on public.profiles from authenticated;
grant select (id, full_name, username, role, is_active, created_at) on public.profiles to authenticated;

create or replace function public.admin_list_profiles()
returns setof public.profiles
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query select * from public.profiles order by full_name;
end;
$$;

revoke execute on function public.admin_list_profiles() from public, anon;
grant execute on function public.admin_list_profiles() to authenticated;
