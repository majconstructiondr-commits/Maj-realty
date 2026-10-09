-- Importación de inmuebles de otras empresas (Excel o feed): origen y referencia externa para evitar duplicados.
alter table public.properties
  add column external_source text check (char_length(external_source) <= 120),
  add column external_ref text check (char_length(external_ref) <= 80);

create unique index properties_external_ref_key on public.properties (external_source, external_ref)
  where external_source is not null and external_ref is not null;

comment on column public.properties.external_source is 'Empresa de origen normalizada (minúsculas, sin acentos) cuando el inmueble se importó';
comment on column public.properties.external_ref is 'Código del inmueble en la empresa de origen';

-- Solo el personal de MAJ marca el origen externo (evita que un usuario ocupe la referencia de otra empresa).
create or replace function public.properties_external_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then
    if tg_op = 'INSERT' then
      new.external_source := null;
      new.external_ref := null;
    else
      new.external_source := old.external_source;
      new.external_ref := old.external_ref;
    end if;
  end if;
  return new;
end $$;

create trigger properties_external_guard before insert or update on public.properties
  for each row execute function public.properties_external_guard();
