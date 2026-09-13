-- Badges de perfil (Owner puede asignar)
alter table public.profiles add column if not exists badges text[] not null default '{}';

-- Valores sugeridos: verified | developer | celebrity | owner | special

create index if not exists profiles_badges_gin on public.profiles using gin (badges);

NOTIFY pgrst, 'reload schema';
