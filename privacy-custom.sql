-- Privacidad y customización avanzada
alter table public.profiles add column if not exists message_privacy text default 'friends'
  check (message_privacy in ('everyone','friends','nobody'));
alter table public.profiles add column if not exists friend_privacy text default 'everyone'
  check (friend_privacy in ('everyone','friends_of_friends','nobody'));
alter table public.profiles add column if not exists discoverable boolean not null default true;
alter table public.profiles add column if not exists show_activity boolean not null default true;
alter table public.profiles add column if not exists allow_downloads boolean not null default false;
alter table public.profiles add column if not exists high_contrast boolean not null default false;
alter table public.profiles add column if not exists dense_ui boolean not null default false;
alter table public.profiles add column if not exists paused boolean not null default false;

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.user_blocks enable row level security;
drop policy if exists blocks_own on public.user_blocks;
create policy blocks_own on public.user_blocks for all using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);

NOTIFY pgrst, 'reload schema';
