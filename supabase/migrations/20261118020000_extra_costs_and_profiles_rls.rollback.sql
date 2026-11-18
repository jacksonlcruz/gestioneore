-- ROLLBACK da migração 20261118020000_extra_costs_and_profiles_rls.sql
-- Restaura o acesso anterior (amplo). Use só em emergência.
-- ATENÇÃO: o código novo (admin_list_profiles e colunas explícitas) precisa ser revertido junto.

drop function if exists public.admin_list_profiles();

grant select on public.profiles to authenticated;

drop policy if exists "extra_costs_select_involved" on public.extra_costs;
drop policy if exists "extra_costs_insert_own" on public.extra_costs;
drop policy if exists "extra_costs_update_own" on public.extra_costs;
drop policy if exists "extra_costs_delete_own" on public.extra_costs;

create policy "Enable all for authenticated users on extra_costs"
  on public.extra_costs for all to authenticated using (true) with check (true);
