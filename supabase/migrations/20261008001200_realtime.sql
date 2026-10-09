-- =====================================================================
-- Migración 0012: tiempo real para el chat interno.
-- Supabase Realtime respeta RLS: cada usuario solo recibe mensajes de
-- conversaciones en las que participa (o el personal).
-- Condicional: en entornos sin la publicación (pruebas locales) no hace nada.
-- =====================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
end $$;
