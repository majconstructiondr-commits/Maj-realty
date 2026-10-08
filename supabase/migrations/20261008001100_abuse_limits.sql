-- =====================================================================
-- Migración 0011: límites contra abuso aplicados en la base de datos (no se eluden llamando a la API)
-- =====================================================================
create or replace function public.throttle_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  if public.is_staff() then return new; end if;
  if tg_table_name = 'property_reports' then
    select count(*) into v_count from public.property_reports
     where created_at > now() - interval '1 hour'
       and (property_id = new.property_id or (auth.uid() is not null and reporter_id = auth.uid()));
    if v_count >= 20 then
      raise exception 'Demasiados reportes recientes. Intente más tarde.' using errcode = 'P0001';
    end if;
  elsif tg_table_name = 'messages' then
    select count(*) into v_count from public.messages where sender_id = auth.uid() and created_at > now() - interval '1 minute';
    if v_count >= 20 then
      raise exception 'Está enviando mensajes demasiado rápido. Espere un momento.' using errcode = 'P0001';
    end if;
  elsif tg_table_name = 'conversations' then
    select count(*) into v_count from public.conversations where created_by = auth.uid() and created_at > now() - interval '1 day';
    if v_count >= 30 then
      raise exception 'Límite diario de conversaciones nuevas alcanzado.' using errcode = 'P0001';
    end if;
  elsif tg_table_name = 'appointments' then
    select count(*) into v_count from public.appointments
     where created_by = auth.uid() and status in ('solicitada', 'confirmada') and starts_at > now();
    if v_count >= 10 then
      raise exception 'Tiene demasiadas visitas pendientes. Cancele alguna antes de pedir otra.' using errcode = 'P0001';
    end if;
  elsif tg_table_name = 'saved_searches' then
    select count(*) into v_count from public.saved_searches where user_id = new.user_id;
    if v_count >= 50 then
      raise exception 'Máximo 50 búsquedas guardadas.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

create trigger property_reports_throttle before insert on public.property_reports for each row execute function public.throttle_guard();
create trigger messages_throttle before insert on public.messages for each row execute function public.throttle_guard();
create trigger conversations_throttle before insert on public.conversations for each row execute function public.throttle_guard();
create trigger appointments_throttle before insert on public.appointments for each row execute function public.throttle_guard();
create trigger saved_searches_throttle before insert on public.saved_searches for each row execute function public.throttle_guard();

-- Los reportes de visitantes solo se aceptan sobre publicaciones visibles
drop policy if exists property_reports_insert_anon on public.property_reports;
create policy property_reports_insert on public.property_reports for insert
  with check (status = 'abierto' and resolved_by is null and resolution is null
              and (reporter_id is null or reporter_id = auth.uid())
              and public.property_is_public(property_id));
