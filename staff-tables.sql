-- Tablas de staff: warnings y bans (opcional pero recomendado)
create table if not exists public.user_warnings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null default '',
  issued_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_bans (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  banned boolean not null default true,
  reason text,
  by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.user_warnings enable row level security;
alter table public.user_bans enable row level security;

-- Lectura: el propio usuario puede ver sus warnings; escritura la hace staff vía service o políticas amplias de staff
drop policy if exists warnings_select_own on public.user_warnings;
create policy warnings_select_own on public.user_warnings for select using (auth.uid() = user_id);

drop policy if exists bans_select_own on public.user_bans;
create policy bans_select_own on public.user_bans for select using (auth.uid() = user_id);

-- Inserción desde cliente autenticado (staff usa la app logueada).
-- Ajusta después con una tabla staff_roles si quieres restringir solo a tu uid.
drop policy if exists warnings_insert_auth on public.user_warnings;
create policy warnings_insert_auth on public.user_warnings for insert to authenticated with check (true);

drop policy if exists bans_upsert_auth on public.user_bans;
create policy bans_upsert_auth on public.user_bans for all to authenticated using (true) with check (true);

NOTIFY pgrst, 'reload schema';
