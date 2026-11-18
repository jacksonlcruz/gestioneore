-- ROLLBACK da migração 20261118000000_security_hardening.sql
-- Restaura o estado anterior (INSECURO). Use só se algo essencial quebrar.

grant all on all tables in schema public to anon;
alter default privileges in schema public grant all on tables to anon;

-- PROFILES
create policy "Profiles are insertable by everyone" on public.profiles for insert with check (true);
create policy "Profiles are updatable by everyone" on public.profiles for update using (true) with check (true);

-- CLIENTS
drop policy if exists "Clients are viewable by authenticated users" on public.clients;
drop policy if exists "Clients are insertable by authenticated users" on public.clients;
drop policy if exists "Clients are updatable by authenticated users" on public.clients;
create policy "Clients are viewable by everyone" on public.clients for select using (true);
create policy "Clients are insertable by everyone" on public.clients for insert with check (true);
create policy "Clients are updatable by everyone" on public.clients for update using (true) with check (true);

-- FREELANCERS
drop policy if exists "Freelancers are viewable by authenticated users" on public.freelancers;
drop policy if exists "Freelancers are insertable by authenticated users" on public.freelancers;
drop policy if exists "Freelancers are updatable by authenticated users" on public.freelancers;
create policy "Freelancers are viewable by everyone" on public.freelancers for select using (true);
create policy "Freelancers are insertable by everyone" on public.freelancers for insert with check (true);
create policy "Freelancers are updatable by everyone" on public.freelancers for update using (true) with check (true);

-- handle_new_user (versão original, que aceita papel dos metadados)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $function$
begin
  insert into public.profiles (id, full_name, role, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'employee'),
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$function$;

grant execute on function public.handle_new_user() to anon, authenticated;
