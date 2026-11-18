-- Hardening de segurança (auditoria 2026-11-18)
-- Fecha acesso anônimo a dados e escalonamento de papel via RLS.
-- Rollback correspondente: 20261118000000_security_hardening.rollback.sql

-- =============================================
-- 1. Anônimo não acessa nenhuma tabela de public
-- =============================================
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

-- =============================================
-- 2. PROFILES: ninguém escreve direto pelo cliente.
--    Escritas passam pelas rotas /api/admin (service role).
-- =============================================
drop policy if exists "Profiles are insertable by everyone" on public.profiles;
drop policy if exists "Profiles are updatable by everyone" on public.profiles;

-- =============================================
-- 3. CLIENTS: só usuários logados leem e escrevem
-- =============================================
drop policy if exists "Clients are viewable by everyone" on public.clients;
drop policy if exists "Clients are insertable by everyone" on public.clients;
drop policy if exists "Clients are updatable by everyone" on public.clients;

create policy "Clients are viewable by authenticated users"
  on public.clients for select to authenticated using (true);
create policy "Clients are insertable by authenticated users"
  on public.clients for insert to authenticated with check (true);
create policy "Clients are updatable by authenticated users"
  on public.clients for update to authenticated using (true) with check (true);

-- =============================================
-- 4. FREELANCERS: idem
-- =============================================
drop policy if exists "Freelancers are viewable by everyone" on public.freelancers;
drop policy if exists "Freelancers are insertable by everyone" on public.freelancers;
drop policy if exists "Freelancers are updatable by everyone" on public.freelancers;

create policy "Freelancers are viewable by authenticated users"
  on public.freelancers for select to authenticated using (true);
create policy "Freelancers are insertable by authenticated users"
  on public.freelancers for insert to authenticated with check (true);
create policy "Freelancers are updatable by authenticated users"
  on public.freelancers for update to authenticated using (true) with check (true);

-- =============================================
-- 5. handle_new_user: nunca aceitar papel vindo dos metadados.
--    Novo perfil nasce como employee; admins são promovidos
--    pelas rotas /api/admin (service role).
-- =============================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'employee',
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

-- Função de trigger não deve ser chamável via /rest/v1/rpc
revoke execute on function public.handle_new_user() from public, anon, authenticated;
