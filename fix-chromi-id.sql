-- Fix chromi_id NOT NULL + default
alter table public.profiles
  alter column chromi_id set default ('CHR-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)));

-- Backfill filas que quedaron sin chromi_id
update public.profiles
set chromi_id = ('CHR-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)))
where chromi_id is null;

-- Asegurar NOT NULL
alter table public.profiles
  alter column chromi_id set not null;

-- Mejorar trigger para que siempre genere chromi_id
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id, username, display_name, chromi_id)
  values(
    new.id,
    'guest_' || substr(replace(new.id::text,'-',''),1,8),
    coalesce(new.raw_user_meta_data->>'display_name','Usuario'),
    'CHR-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))
  )
  on conflict(id) do nothing;
  return new;
end; $$;

NOTIFY pgrst, 'reload schema';
