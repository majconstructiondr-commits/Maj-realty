-- =====================================================================
-- Migración 0005: mensajería interna, notificaciones y citas
-- La mensajería NO está integrada con WhatsApp. Abrir un enlace de WhatsApp no equivale a un mensaje enviado.
-- =====================================================================

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  subject text not null check (char_length(subject) between 2 and 160),
  property_id uuid references public.properties(id) on delete set null,
  request_id uuid references public.service_requests(id) on delete set null,
  status text not null default 'abierta' check (status in ('abierta', 'cerrada', 'bloqueada')),
  created_by uuid not null references public.profiles(id),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  participant_role text not null check (participant_role in ('cliente', 'publicador', 'personal')),
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conversation_participants_user_idx on public.conversation_participants(user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text not null check (char_length(body) between 1 and 4000),
  attachment_path text,     -- bucket privado "private-docs", carpeta conversations/<id>/
  attachment_name text,
  attachment_mime text check (attachment_mime is null or attachment_mime in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  hidden boolean not null default false,
  hidden_reason text,
  hidden_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages(conversation_id, created_at);

create table public.message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id),
  reason text not null check (char_length(reason) between 3 and 1000),
  status text not null default 'abierto' check (status in ('abierto', 'resuelto', 'descartado')),
  resolution text,
  resolved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (message_id, reporter_id)
);

create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  link text check (link is null or link ~ '^/'),
  read_at timestamptz,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id, read_at, created_at desc);

create or replace function public.is_participant(p_conversation uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conversation_participants where conversation_id = p_conversation and user_id = auth.uid())
$$;
grant execute on function public.is_participant(uuid) to authenticated;

create or replace function public.notify(p_user uuid, p_kind text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications(user_id, kind, title, body, link) values (p_user, p_kind, p_title, left(p_body, 300), p_link)
$$;
revoke all on function public.notify(uuid, text, text, text, text) from public, anon, authenticated;

-- Inicia conversación sobre un inmueble público o una solicitud propia.
create or replace function public.start_conversation(p_property uuid, p_request uuid, p_subject text, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_conv uuid;
  v_owner uuid;
  v_advisor uuid;
begin
  if auth.uid() is null then
    raise exception 'Inicie sesión para usar el chat' using errcode = '42501';
  end if;
  if p_property is not null then
    if not public.property_is_public(p_property) then
      raise exception 'Inmueble no disponible' using errcode = 'P0001';
    end if;
    select p.owner_user_id, a.user_id into v_owner, v_advisor
      from public.properties p left join public.advisors a on a.id = p.advisor_id where p.id = p_property;
    -- reutiliza la conversación existente del cliente sobre el mismo inmueble
    select c.id into v_conv from public.conversations c
      join public.conversation_participants cp on cp.conversation_id = c.id and cp.user_id = auth.uid() and cp.participant_role = 'cliente'
     where c.property_id = p_property and c.status = 'abierta' limit 1;
  elsif p_request is not null then
    if not exists (select 1 from public.service_requests where id = p_request and client_user_id = auth.uid()) and not public.is_staff() then
      raise exception 'No autorizado' using errcode = '42501';
    end if;
    select c.id into v_conv from public.conversations c where c.request_id = p_request and c.status = 'abierta' limit 1;
  else
    raise exception 'Indique un inmueble o una solicitud' using errcode = 'P0001';
  end if;

  if v_conv is null then
    insert into public.conversations(subject, property_id, request_id, created_by)
    values (left(coalesce(nullif(trim(p_subject), ''), 'Consulta'), 160), p_property, p_request, auth.uid())
    returning id into v_conv;
    insert into public.conversation_participants(conversation_id, user_id, participant_role)
    values (v_conv, auth.uid(), case when public.is_staff() then 'personal' else 'cliente' end);
    if v_owner is not null and v_owner <> auth.uid() then
      insert into public.conversation_participants(conversation_id, user_id, participant_role)
      values (v_conv, v_owner, 'publicador') on conflict do nothing;
    end if;
    if v_advisor is not null and v_advisor <> auth.uid() then
      insert into public.conversation_participants(conversation_id, user_id, participant_role)
      values (v_conv, v_advisor, 'personal') on conflict do nothing;
    end if;
    if p_request is not null then
      insert into public.conversation_participants(conversation_id, user_id, participant_role)
      select v_conv, r.assigned_to, 'personal' from public.service_requests r
       where r.id = p_request and r.assigned_to is not null and r.assigned_to <> auth.uid()
      on conflict do nothing;
      insert into public.conversation_participants(conversation_id, user_id, participant_role)
      select v_conv, r.client_user_id, 'cliente' from public.service_requests r
       where r.id = p_request and r.client_user_id is not null
      on conflict do nothing;
    end if;
  end if;

  if char_length(trim(coalesce(p_body, ''))) > 0 then
    insert into public.messages(conversation_id, sender_id, body) values (v_conv, auth.uid(), left(trim(p_body), 4000));
  end if;
  return v_conv;
end $$;
grant execute on function public.start_conversation(uuid, uuid, text, text) to authenticated;

create or replace function public.messages_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.sender_id <> auth.uid() then
      raise exception 'Remitente inválido' using errcode = '42501';
    end if;
    if not (public.is_participant(new.conversation_id) or public.is_staff()) then
      raise exception 'No participa en esta conversación' using errcode = '42501';
    end if;
    if exists (select 1 from public.conversations where id = new.conversation_id and status <> 'abierta') then
      raise exception 'La conversación está cerrada' using errcode = 'P0001';
    end if;
    if new.attachment_path is not null and new.attachment_path not like ('conversations/' || new.conversation_id::text || '/%') then
      raise exception 'Adjunto no válido' using errcode = 'P0001';
    end if;
    new.hidden := false; new.hidden_by := null; new.hidden_reason := null;
    return new;
  end if;
  -- UPDATE: solo moderación por personal
  if not public.is_staff() then
    raise exception 'Los mensajes no se editan' using errcode = '42501';
  end if;
  if new.body <> old.body or new.sender_id <> old.sender_id then
    raise exception 'Solo se puede ocultar un mensaje' using errcode = '42501';
  end if;
  new.hidden_by := auth.uid();
  return new;
end $$;
create trigger messages_guard before insert or update on public.messages
  for each row execute function public.messages_guard();

create or replace function public.messages_after() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_subject text;
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id returning subject into v_subject;
  update public.conversation_participants set last_read_at = new.created_at
   where conversation_id = new.conversation_id and user_id = new.sender_id;
  insert into public.notifications(user_id, kind, title, body, link)
  select cp.user_id, 'mensaje', 'Nuevo mensaje: ' || v_subject, left(new.body, 140), '/panel/mensajes/' || new.conversation_id
    from public.conversation_participants cp
   where cp.conversation_id = new.conversation_id and cp.user_id <> new.sender_id;
  return null;
end $$;
create trigger messages_after after insert on public.messages
  for each row execute function public.messages_after();

create or replace function public.mark_conversation_read(p_conversation uuid) returns void
language sql security definer set search_path = public as $$
  update public.conversation_participants set last_read_at = now()
   where conversation_id = p_conversation and user_id = auth.uid()
$$;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Citas (zona horaria America/Santo_Domingo; se guardan en UTC)
-- ---------------------------------------------------------------------
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete set null,
  request_id uuid references public.service_requests(id) on delete set null,
  client_id uuid references public.profiles(id) on delete set null,
  agent_id uuid not null references public.profiles(id),
  kind text not null default 'visita' check (kind in ('visita', 'evaluacion', 'visita_tecnica', 'reunion')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'solicitada' check (status in ('solicitada', 'confirmada', 'cancelada', 'completada', 'no_asistio')),
  client_notes text check (char_length(client_notes) <= 1000),
  agent_notes text check (char_length(agent_notes) <= 1000),
  cancel_reason text,
  confirmed_by uuid references public.profiles(id),
  confirmed_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  -- Prevención de doble reserva del mismo asesor
  constraint appointments_no_overlap exclude using gist (
    agent_id with =, tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('solicitada', 'confirmada'))
);
create index appointments_agent_idx on public.appointments(agent_id, starts_at);
create index appointments_client_idx on public.appointments(client_id, starts_at);

create table public.appointment_events (
  id bigint generated always as identity primary key,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  action text not null,
  detail text,
  actor_id uuid,
  created_at timestamptz not null default now()
);

-- Verifica horario hábil configurado (site_settings 'appointments.hours': {"1":["09:00","17:00"],...} 0=domingo)
create or replace function public.within_business_hours(p_start timestamptz, p_end timestamptz) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_hours jsonb := coalesce(public.setting('appointments.hours'), '{}'::jsonb);
  v_local_start timestamp := p_start at time zone 'America/Santo_Domingo';
  v_local_end timestamp := p_end at time zone 'America/Santo_Domingo';
  v_day jsonb;
begin
  if v_local_start::date <> v_local_end::date then return false; end if;
  v_day := v_hours -> extract(dow from v_local_start)::int::text;
  if v_day is null or jsonb_array_length(v_day) <> 2 then return false; end if;
  return v_local_start::time >= (v_day ->> 0)::time and v_local_end::time <= (v_day ->> 1)::time;
end $$;

create or replace function public.request_appointment(p_property uuid, p_request uuid, p_starts_at timestamptz, p_notes text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_agent uuid;
  v_minutes integer := coalesce((public.setting('appointments.duration_minutes') #>> '{}')::int, 60);
  v_lead interval := make_interval(hours => coalesce((public.setting('appointments.min_lead_hours') #>> '{}')::int, 12));
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Inicie sesión para agendar' using errcode = '42501';
  end if;
  if p_starts_at < now() + v_lead then
    raise exception 'Elija una fecha con al menos % de anticipación', v_lead using errcode = 'P0001';
  end if;
  if p_starts_at > now() + interval '90 days' then
    raise exception 'Elija una fecha dentro de los próximos 90 días' using errcode = 'P0001';
  end if;
  if not public.within_business_hours(p_starts_at, p_starts_at + make_interval(mins => v_minutes)) then
    raise exception 'El horario elegido está fuera del horario de atención' using errcode = 'P0001';
  end if;
  if p_property is not null then
    if not public.property_is_public(p_property) then
      raise exception 'Inmueble no disponible' using errcode = 'P0001';
    end if;
    select coalesce(a.user_id, p.owner_user_id) into v_agent
      from public.properties p left join public.advisors a on a.id = p.advisor_id and a.is_active where p.id = p_property;
  elsif p_request is not null then
    select assigned_to into v_agent from public.service_requests where id = p_request and client_user_id = auth.uid();
    if v_agent is null then
      raise exception 'La solicitud aún no tiene responsable asignado' using errcode = 'P0001';
    end if;
  end if;
  if v_agent is null then
    raise exception 'No hay asesor disponible para este inmueble' using errcode = 'P0001';
  end if;
  begin
    insert into public.appointments(property_id, request_id, client_id, agent_id, starts_at, ends_at, client_notes, created_by,
      kind)
    values (p_property, p_request, auth.uid(), v_agent, p_starts_at, p_starts_at + make_interval(mins => v_minutes),
      left(p_notes, 1000), auth.uid(), case when p_request is not null then 'reunion' else 'visita' end)
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'Ese horario ya no está disponible. Elija otro.' using errcode = 'P0001';
  end;
  insert into public.appointment_events(appointment_id, action, actor_id) values (v_id, 'solicitada', auth.uid());
  perform public.notify(v_agent, 'cita', 'Nueva solicitud de visita',
    to_char(p_starts_at at time zone 'America/Santo_Domingo', 'DD/MM/YYYY HH24:MI'), '/panel/visitas');
  return v_id;
end $$;
grant execute on function public.request_appointment(uuid, uuid, timestamptz, text) to authenticated;

-- Confirmar / cancelar / reprogramar / completar
create or replace function public.update_appointment(p_id uuid, p_action text, p_new_start timestamptz, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  a public.appointments;
  v_is_agent boolean;
  v_is_client boolean;
  v_minutes integer;
begin
  select * into a from public.appointments where id = p_id for update;
  if a.id is null then raise exception 'Cita no encontrada' using errcode = 'P0001'; end if;
  v_is_agent := a.agent_id = auth.uid() or public.is_staff();
  v_is_client := a.client_id = auth.uid();
  if not (v_is_agent or v_is_client) then raise exception 'No autorizado' using errcode = '42501'; end if;

  if p_action = 'confirmar' then
    if not v_is_agent or a.status <> 'solicitada' then raise exception 'No se puede confirmar' using errcode = 'P0001'; end if;
    update public.appointments set status = 'confirmada', confirmed_by = auth.uid(), confirmed_at = now() where id = p_id;
    if a.client_id is not null then
      perform public.notify(a.client_id, 'cita', 'Visita confirmada',
        to_char(a.starts_at at time zone 'America/Santo_Domingo', 'DD/MM/YYYY HH24:MI'), '/panel/visitas');
    end if;
  elsif p_action = 'cancelar' then
    if a.status not in ('solicitada', 'confirmada') then raise exception 'No se puede cancelar' using errcode = 'P0001'; end if;
    update public.appointments set status = 'cancelada', cancel_reason = left(p_reason, 500) where id = p_id;
    perform public.notify(case when v_is_client then a.agent_id else a.client_id end, 'cita', 'Visita cancelada',
      coalesce(p_reason, ''), '/panel/visitas');
  elsif p_action = 'reprogramar' then
    if a.status not in ('solicitada', 'confirmada') or p_new_start is null then raise exception 'No se puede reprogramar' using errcode = 'P0001'; end if;
    v_minutes := extract(epoch from (a.ends_at - a.starts_at)) / 60;
    if p_new_start < now() or not public.within_business_hours(p_new_start, p_new_start + make_interval(mins => v_minutes)) then
      raise exception 'Horario no válido o fuera del horario de atención' using errcode = 'P0001';
    end if;
    begin
      -- reprogramar vuelve a requerir confirmación del asesor (salvo que lo haga el propio asesor)
      update public.appointments set starts_at = p_new_start, ends_at = p_new_start + make_interval(mins => v_minutes),
        status = case when v_is_agent then 'confirmada' else 'solicitada' end,
        confirmed_by = case when v_is_agent then auth.uid() end, confirmed_at = case when v_is_agent then now() end
      where id = p_id;
    exception when exclusion_violation then
      raise exception 'Ese horario ya no está disponible' using errcode = 'P0001';
    end;
  elsif p_action in ('completar', 'no_asistio') then
    if not v_is_agent or a.status <> 'confirmada' then raise exception 'No permitido' using errcode = 'P0001'; end if;
    update public.appointments set status = case when p_action = 'completar' then 'completada' else 'no_asistio' end where id = p_id;
  else
    raise exception 'Acción no válida' using errcode = 'P0001';
  end if;
  insert into public.appointment_events(appointment_id, action, detail, actor_id)
  values (p_id, p_action, coalesce(p_reason, to_char(p_new_start at time zone 'America/Santo_Domingo', 'YYYY-MM-DD HH24:MI')), auth.uid());
end $$;
grant execute on function public.update_appointment(uuid, text, timestamptz, text) to authenticated;

create trigger appointments_touch before update on public.appointments
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.message_reports enable row level security;
alter table public.notifications enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_events enable row level security;

create policy conversations_read on public.conversations for select to authenticated
  using (public.is_participant(id) or public.is_staff());
create policy conversations_staff on public.conversations for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy participants_read on public.conversation_participants for select to authenticated
  using (public.is_participant(conversation_id) or public.is_staff());
create policy participants_staff on public.conversation_participants for insert to authenticated
  with check (public.is_staff());
create policy messages_read on public.messages for select to authenticated
  using ((public.is_participant(conversation_id) and not hidden) or public.is_staff());
create policy messages_insert on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and (public.is_participant(conversation_id) or public.is_staff()));
create policy messages_moderate on public.messages for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy message_reports_insert on public.message_reports for insert to authenticated
  with check (reporter_id = auth.uid() and status = 'abierto' and exists (
    select 1 from public.messages m where m.id = message_id and public.is_participant(m.conversation_id)));
create policy message_reports_read on public.message_reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_staff());
create policy message_reports_staff on public.message_reports for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy notifications_own on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_mark on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy appointments_read on public.appointments for select to authenticated
  using (client_id = auth.uid() or agent_id = auth.uid() or public.is_staff());
create policy appointment_events_read on public.appointment_events for select to authenticated
  using (exists (select 1 from public.appointments a where a.id = appointment_id
                 and (a.client_id = auth.uid() or a.agent_id = auth.uid() or public.is_staff())));

revoke all on public.conversations, public.conversation_participants, public.messages, public.message_reports,
  public.notifications, public.appointments, public.appointment_events from anon;
revoke insert, delete on public.conversations from authenticated;
revoke update, delete on public.conversation_participants from authenticated;
revoke delete on public.messages from authenticated;
revoke insert, delete on public.notifications from authenticated;
revoke insert, update, delete on public.appointments, public.appointment_events from authenticated;
-- Notificaciones: el usuario solo puede marcar como leída
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
