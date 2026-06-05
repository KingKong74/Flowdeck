-- Flowdeck schema
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query).
-- Stores each user's entire app state as one JSONB row, locked down so a
-- user can only ever read/write their own row.

create table if not exists public.workspaces (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.workspaces enable row level security;

-- A user can only touch the row whose user_id matches their auth uid.
create policy "read own workspace"
  on public.workspaces for select
  using (auth.uid() = user_id);

create policy "insert own workspace"
  on public.workspaces for insert
  with check (auth.uid() = user_id);

create policy "update own workspace"
  on public.workspaces for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
