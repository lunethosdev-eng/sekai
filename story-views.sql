create table if not exists public.story_views (
  story_id uuid not null references public.stories(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);
alter table public.story_views enable row level security;
drop policy if exists story_views_insert on public.story_views;
create policy story_views_insert on public.story_views for insert to authenticated with check (auth.uid() = viewer_id);
drop policy if exists story_views_select on public.story_views;
create policy story_views_select on public.story_views for select using (
  auth.uid() = viewer_id
  or exists (select 1 from public.stories s where s.id = story_id and s.user_id = auth.uid())
);

alter table public.messages add column if not exists media_url text;

NOTIFY pgrst, 'reload schema';
