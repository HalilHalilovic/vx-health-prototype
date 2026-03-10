create table if not exists public.clients (
  id text primary key,
  name text not null,
  coach_team text not null default 'Unassigned',
  created_at timestamptz not null default now()
);

create table if not exists public.weekly_scores (
  id bigint generated always as identity primary key,
  client_id text not null references public.clients(id) on delete cascade,
  week_start date not null,
  current_score int check (current_score between 1 and 5 or current_score is null),
  predictive_score int check (predictive_score between 1 and 5 or predictive_score is null),
  notes text not null default '',
  actions text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, week_start)
);

create index if not exists idx_weekly_scores_client_week
  on public.weekly_scores(client_id, week_start desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_weekly_scores_updated_at on public.weekly_scores;
create trigger trg_weekly_scores_updated_at
before update on public.weekly_scores
for each row execute function public.set_updated_at();

alter table public.clients enable row level security;
alter table public.weekly_scores enable row level security;

drop policy if exists "Allow read clients" on public.clients;
create policy "Allow read clients"
on public.clients
for select
to anon, authenticated
using (true);

drop policy if exists "Allow insert clients" on public.clients;
create policy "Allow insert clients"
on public.clients
for insert
to anon, authenticated
with check (true);

drop policy if exists "Allow update clients" on public.clients;
create policy "Allow update clients"
on public.clients
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Allow read weekly scores" on public.weekly_scores;
create policy "Allow read weekly scores"
on public.weekly_scores
for select
to anon, authenticated
using (true);

drop policy if exists "Allow write weekly scores" on public.weekly_scores;
create policy "Allow write weekly scores"
on public.weekly_scores
for insert
to anon, authenticated
with check (true);

drop policy if exists "Allow update weekly scores" on public.weekly_scores;
create policy "Allow update weekly scores"
on public.weekly_scores
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Allow delete clients" on public.clients;
create policy "Allow delete clients"
on public.clients
for delete
to anon, authenticated
using (true);

drop policy if exists "Allow delete weekly scores" on public.weekly_scores;
create policy "Allow delete weekly scores"
on public.weekly_scores
for delete
to anon, authenticated
using (true);
