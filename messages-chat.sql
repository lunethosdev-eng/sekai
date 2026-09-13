-- Mejoras de chat
alter table public.messages add column if not exists read_at timestamptz;
alter table public.messages add column if not exists reply_to uuid;
alter table public.messages add column if not exists reply_to_body text;

-- Realtime (en Dashboard: Database > Replication > messages, o:)
-- alter publication supabase_realtime add table public.messages;

NOTIFY pgrst, 'reload schema';
