-- Initial schema for the time tracking system

-- =============================================
-- PROFILES
-- =============================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'employee')),
  full_name text
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "Profiles are insertable by everyone"
  on public.profiles for insert
  with check (true);

create policy "Profiles are updatable by everyone"
  on public.profiles for update
  using (true)
  with check (true);

create policy "Profiles are deletable by everyone"
  on public.profiles for delete
  using (true);

-- =============================================
-- CLIENTS
-- =============================================
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.clients enable row level security;

create policy "Clients are viewable by everyone"
  on public.clients for select
  using (true);

create policy "Clients are insertable by everyone"
  on public.clients for insert
  with check (true);

create policy "Clients are updatable by everyone"
  on public.clients for update
  using (true)
  with check (true);

create policy "Clients are deletable by everyone"
  on public.clients for delete
  using (true);

-- =============================================
-- FREELANCERS
-- =============================================
create table if not exists public.freelancers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.freelancers enable row level security;

create policy "Freelancers are viewable by everyone"
  on public.freelancers for select
  using (true);

create policy "Freelancers are insertable by everyone"
  on public.freelancers for insert
  with check (true);

create policy "Freelancers are updatable by everyone"
  on public.freelancers for update
  using (true)
  with check (true);

create policy "Freelancers are deletable by everyone"
  on public.freelancers for delete
  using (true);

-- =============================================
-- SERVICE RECORDS
-- =============================================
create table if not exists public.service_records (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  date date not null,
  start_time time not null,
  end_time time not null,
  observation text
);

alter table public.service_records enable row level security;

create policy "Service records are viewable by everyone"
  on public.service_records for select
  using (true);

create policy "Service records are insertable by everyone"
  on public.service_records for insert
  with check (true);

create policy "Service records are updatable by everyone"
  on public.service_records for update
  using (true)
  with check (true);

create policy "Service records are deletable by everyone"
  on public.service_records for delete
  using (true);

-- =============================================
-- SERVICE PARTICIPANTS
-- =============================================
create table if not exists public.service_participants (
  id uuid primary key default gen_random_uuid(),
  service_record_id uuid not null references public.service_records (id) on delete cascade,
  worker_type text not null check (worker_type in ('employee', 'freelancer')),
  profile_id uuid references public.profiles (id) on delete cascade,
  freelancer_id uuid references public.freelancers (id) on delete cascade,
  constraint service_participants_worker_check check (
    (worker_type = 'employee' and profile_id is not null and freelancer_id is null)
    or
    (worker_type = 'freelancer' and freelancer_id is not null and profile_id is null)
  )
);

alter table public.service_participants enable row level security;

create policy "Service participants are viewable by everyone"
  on public.service_participants for select
  using (true);

create policy "Service participants are insertable by everyone"
  on public.service_participants for insert
  with check (true);

create policy "Service participants are updatable by everyone"
  on public.service_participants for update
  using (true)
  with check (true);

create policy "Service participants are deletable by everyone"
  on public.service_participants for delete
  using (true);