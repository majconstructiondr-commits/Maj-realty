-- =====================================================================
-- MAJ REALTY SRL · Migración 0001: base, perfiles, roles, configuración y auditoría
-- =====================================================================
create extension if not exists btree_gist with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.app_role as enum ('cliente', 'propietario', 'vendedor', 'agencia', 'staff', 'admin');
create type public.currency_code as enum ('DOP', 'USD');

-- ---------------------------------------------------------------------
-- Configuración del sitio (contactos, WhatsApp, horarios, textos, seguridad)
-- is_public = true: legible por visitantes. Lo demás solo personal.
-- ---------------------------------------------------------------------
create table public.site_settings (
  key text primary key,
  value jsonb not null,
  is_public boolean not null default false,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create or replace function public.setting(p_key text) returns jsonb
language sql stable security definer set search_path = public as $$
  select value from public.site_settings where key = p_key
$$;
revoke all on function public.setting(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Perfiles: datos visibles del usuario. Datos sensibles en profile_private.
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 160),
  display_name text check (char_length(display_name) <= 80),
  avatar_path text,
  preferred_locale text not null default 'es' check (preferred_locale in ('es', 'en')),
  terms_version_accepted text,
  terms_accepted_at timestamptz,
  identity_reviewed_at timestamptz,          -- solo personal MAJ
  identity_review_scope text,                -- alcance de la revisión realizada
  is_suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profile_private (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  phone text check (char_length(phone) <= 40),
  whatsapp text check (char_length(whatsapp) <= 40),
  id_document_type text check (id_document_type in ('cedula', 'pasaporte', 'rnc', 'otro')),
  id_document_number text check (char_length(id_document_number) <= 40),
  address text check (char_length(address) <= 300),
  marketing_opt_in boolean not null default false,
  marketing_opt_in_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references public.profiles(id),
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- ---------------------------------------------------------------------
-- Funciones de autorización (SECURITY DEFINER para evitar recursión de RLS)
-- ---------------------------------------------------------------------
create or replace function public.has_role(p_role public.app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles r
    join public.profiles p on p.id = r.user_id
    where r.user_id = auth.uid() and r.role = p_role and not p.is_suspended
  )
$$;

-- Nivel de autenticación: aal2 = sesión con segundo factor (MFA) verificado.
create or replace function public.mfa_satisfied() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((auth.jwt() ->> 'aal') = 'aal2', false)
      or coalesce((public.setting('security.require_mfa_for_staff') #>> '{}')::boolean, true) = false
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select (public.has_role('staff') or public.has_role('admin')) and public.mfa_satisfied()
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role('admin') and public.mfa_satisfied()
$$;

grant execute on function public.has_role(public.app_role), public.is_staff(), public.is_admin(), public.mfa_satisfied()
  to anon, authenticated;

-- ---------------------------------------------------------------------
-- Auditoría
-- ---------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  table_name text not null,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_table_record_idx on public.audit_log (table_name, record_id);
create index audit_log_created_idx on public.audit_log (created_at desc);

create or replace function public.audit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_id text;
begin
  if tg_op = 'DELETE' then
    v_id := (to_jsonb(old) ->> 'id');
    insert into public.audit_log(actor_id, action, table_name, record_id, old_data)
    values (auth.uid(), tg_op, tg_table_name, v_id, to_jsonb(old));
    return old;
  else
    v_id := coalesce(to_jsonb(new) ->> 'id', to_jsonb(new) ->> 'key', to_jsonb(new) ->> 'user_id');
    if tg_op = 'UPDATE' and to_jsonb(old) = to_jsonb(new) then
      return new;
    end if;
    insert into public.audit_log(actor_id, action, table_name, record_id, old_data, new_data)
    values (auth.uid(), tg_op, tg_table_name, v_id,
            case when tg_op = 'UPDATE' then to_jsonb(old) end, to_jsonb(new));
    return new;
  end if;
end $$;

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Alta de usuario: perfil + rol cliente
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 160));
  insert into public.profile_private (user_id) values (new.id);
  insert into public.user_roles (user_id, role) values (new.id, 'cliente');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Los usuarios no pueden cambiar campos de revisión ni suspensión de su propio perfil.
create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then
    if new.identity_reviewed_at is distinct from old.identity_reviewed_at
       or new.identity_review_scope is distinct from old.identity_review_scope
       or new.is_suspended is distinct from old.is_suspended then
      raise exception 'No autorizado para modificar campos de revisión' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger profile_private_touch before update on public.profile_private
  for each row execute function public.touch_updated_at();

create trigger audit_user_roles after insert or update or delete on public.user_roles
  for each row execute function public.audit_trigger();
create trigger audit_site_settings after insert or update or delete on public.site_settings
  for each row execute function public.audit_trigger();
create trigger audit_profiles after update on public.profiles
  for each row execute function public.audit_trigger();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.site_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;
alter table public.user_roles enable row level security;
alter table public.audit_log enable row level security;

create policy site_settings_public_read on public.site_settings
  for select using (is_public or public.is_staff());
create policy site_settings_admin_write on public.site_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- Perfil: el propio usuario y personal. Nombre visible de otros participantes
-- se obtiene mediante funciones específicas (no se expone la tabla entera).
create policy profiles_self_read on public.profiles
  for select using (id = auth.uid() or public.is_staff());
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid() or public.is_staff())
  with check (id = auth.uid() or public.is_staff());

create policy profile_private_self on public.profile_private
  for select using (user_id = auth.uid() or public.is_staff());
create policy profile_private_self_update on public.profile_private
  for update using (user_id = auth.uid() or public.is_staff())
  with check (user_id = auth.uid() or public.is_staff());

create policy user_roles_read on public.user_roles
  for select using (user_id = auth.uid() or public.is_staff());
create policy user_roles_admin on public.user_roles
  for all using (public.is_admin()) with check (public.is_admin());

create policy audit_log_staff_read on public.audit_log
  for select using (public.is_staff());

revoke insert, update, delete on public.audit_log from anon, authenticated;
revoke insert, delete on public.profiles, public.profile_private from anon, authenticated;
revoke all on public.profile_private from anon;

-- Nombre público mínimo de un usuario (para chat/ficha), sin datos privados.
create or replace function public.public_name(p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(display_name, ''), nullif(split_part(full_name, ' ', 1), ''), 'Usuario')
  from public.profiles where id = p_user
$$;
grant execute on function public.public_name(uuid) to authenticated;
