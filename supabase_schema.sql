-- Chromi social/auth schema. Ejecutar en Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  chromi_id text not null unique default ('CHR-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),
  username text not null unique check (username ~ '^[a-zA-Z0-9_]{3,24}$'),
  display_name text not null default 'Usuario' check (char_length(display_name) between 1 and 32),
  bio text not null default '' check (char_length(bio) <= 160),
  avatar_url text,
  visibility text not null default 'public' check (visibility in ('public','private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','blocked')),
  created_at timestamptz not null default now(),
  unique(requester_id,addressee_id),
  check(requester_id <> addressee_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check(char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  check(sender_id <> recipient_id)
);

create table if not exists public.search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  query text not null check(char_length(query) between 1 and 200),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.messages enable row level security;
alter table public.search_history enable row level security;

drop policy if exists profiles_select_public_or_own on public.profiles;
create policy profiles_select_public_or_own on public.profiles for select using (visibility='public' or auth.uid()=id);
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert with check (auth.uid()=id);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using (auth.uid()=id) with check (auth.uid()=id);

drop policy if exists friendships_select_participant on public.friendships;
create policy friendships_select_participant on public.friendships for select using (auth.uid()=requester_id or auth.uid()=addressee_id);
drop policy if exists friendships_insert_requester on public.friendships;
create policy friendships_insert_requester on public.friendships for insert with check(auth.uid()=requester_id);
drop policy if exists friendships_update_participant on public.friendships;
create policy friendships_update_participant on public.friendships for update using(auth.uid()=requester_id or auth.uid()=addressee_id);

drop policy if exists messages_select_participant on public.messages;
create policy messages_select_participant on public.messages for select using(auth.uid()=sender_id or auth.uid()=recipient_id);
drop policy if exists messages_insert_sender on public.messages;
create policy messages_insert_sender on public.messages for insert with check(auth.uid()=sender_id);

drop policy if exists search_history_own on public.search_history;
create policy search_history_own on public.search_history for all using(auth.uid()=user_id) with check(auth.uid()=user_id);

insert into storage.buckets(id,name,public) values ('avatars','avatars',true) on conflict(id) do nothing;
drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects for select using(bucket_id='avatars');
drop policy if exists avatars_owner_insert on storage.objects;
create policy avatars_owner_insert on storage.objects for insert with check(bucket_id='avatars' and auth.uid()::text=split_part(name,'/',1));
drop policy if exists avatars_owner_update on storage.objects;
create policy avatars_owner_update on storage.objects for update using(bucket_id='avatars' and auth.uid()::text=split_part(name,'/',1));
drop policy if exists avatars_owner_delete on storage.objects;
create policy avatars_owner_delete on storage.objects for delete using(bucket_id='avatars' and auth.uid()::text=split_part(name,'/',1));

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,username,display_name)
  values(new.id,'guest_'||substr(replace(new.id::text,'-',''),1,8),coalesce(new.raw_user_meta_data->>'display_name','Usuario'))
  on conflict(id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles for each row execute procedure public.touch_updated_at();


-- Chromi v11: social notifications and persistent library.
create table if not exists public.notifications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 kind text not null,
 title text not null,
 body text not null default '',
 read boolean not null default false,
 created_at timestamptz not null default now()
);
create table if not exists public.library_items (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 external_id text not null,
 item_type text not null,
 title text not null,
 image_url text,
 description text,
 source_url text,
 created_at timestamptz not null default now(),
 unique(user_id, external_id, item_type)
);
alter table public.notifications enable row level security;
alter table public.library_items enable row level security;
drop policy if exists notifications_own on public.notifications;
create policy notifications_own on public.notifications for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists library_own on public.library_items;
create policy library_own on public.library_items for all using(auth.uid()=user_id) with check(auth.uid()=user_id);


-- Chromi v12: Sekai social publishing (posts, arts, Shorts and long videos).
create table if not exists public.posts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 type text not null check(type in ('image','art','short','video')),
 media_url text not null,
 thumbnail_url text,
 title text not null default '' check(char_length(title)<=120),
 caption text not null default '' check(char_length(caption)<=2000),
 visibility text not null default 'public' check(visibility in ('public','friends')),
 duration_seconds integer check(duration_seconds is null or duration_seconds>=0),
 created_at timestamptz not null default now()
);
create table if not exists public.post_likes (
 post_id uuid not null references public.posts(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(post_id,user_id)
);
create table if not exists public.post_comments (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.posts(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 body text not null check(char_length(body) between 1 and 1000),
 created_at timestamptz not null default now()
);
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
drop policy if exists posts_public_read on public.posts;
create policy posts_public_read on public.posts for select using (visibility='public' or auth.uid()=user_id);
drop policy if exists posts_insert_own on public.posts;
create policy posts_insert_own on public.posts for insert with check(auth.uid()=user_id);
drop policy if exists posts_update_own on public.posts;
create policy posts_update_own on public.posts for update using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists posts_delete_own on public.posts;
create policy posts_delete_own on public.posts for delete using(auth.uid()=user_id);
drop policy if exists post_likes_read on public.post_likes;
create policy post_likes_read on public.post_likes for select using(true);
drop policy if exists post_likes_insert_own on public.post_likes;
create policy post_likes_insert_own on public.post_likes for insert with check(auth.uid()=user_id);
drop policy if exists post_likes_delete_own on public.post_likes;
create policy post_likes_delete_own on public.post_likes for delete using(auth.uid()=user_id);
drop policy if exists post_comments_read on public.post_comments;
create policy post_comments_read on public.post_comments for select using(true);
drop policy if exists post_comments_insert_own on public.post_comments;
create policy post_comments_insert_own on public.post_comments for insert with check(auth.uid()=user_id);
drop policy if exists post_comments_delete_own on public.post_comments;
create policy post_comments_delete_own on public.post_comments for delete using(auth.uid()=user_id);

insert into storage.buckets(id,name,public) values ('sekai-media','sekai-media',true) on conflict(id) do update set public=true;
drop policy if exists sekai_media_public_read on storage.objects;
create policy sekai_media_public_read on storage.objects for select using(bucket_id='sekai-media');
drop policy if exists sekai_media_owner_insert on storage.objects;
create policy sekai_media_owner_insert on storage.objects for insert to authenticated with check(bucket_id='sekai-media' and auth.uid()::text=split_part(name,'/',1));
drop policy if exists sekai_media_owner_update on storage.objects;
create policy sekai_media_owner_update on storage.objects for update to authenticated using(bucket_id='sekai-media' and auth.uid()::text=split_part(name,'/',1)) with check(bucket_id='sekai-media' and auth.uid()::text=split_part(name,'/',1));
drop policy if exists sekai_media_owner_delete on storage.objects;
create policy sekai_media_owner_delete on storage.objects for delete to authenticated using(bucket_id='sekai-media' and auth.uid()::text=split_part(name,'/',1));
