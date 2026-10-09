-- =====================================================================
-- Migración 0007: almacenamiento (buckets y políticas) y configuración inicial editable
-- =====================================================================

create or replace function public.try_uuid(p text) returns uuid
language plpgsql immutable as $$
begin
  return p::uuid;
exception when others then
  return null;
end $$;
grant execute on function public.try_uuid(text) to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('property-media', 'property-media', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('private-docs', 'private-docs', false, 15728640, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
  ('public-assets', 'public-assets', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;

-- ¿Una ruta de multimedia pertenece a una foto aprobada de una publicación pública?
create or replace function public.media_path_public(p_path text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.property_media m
    where m.storage_path = p_path and m.approved and public.property_is_public(m.property_id)
  )
$$;
grant execute on function public.media_path_public(text) to anon, authenticated;

create or replace function public.private_doc_access(p_path text, p_write boolean) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_parts text[] := string_to_array(p_path, '/');
  v_id uuid := public.try_uuid(v_parts[2]);
begin
  if v_id is null then return false; end if;
  case v_parts[1]
    when 'properties' then
      return public.property_access(v_id, case when p_write then 'edit' else 'view' end);
    when 'requests' then
      if p_write then
        return exists (select 1 from public.service_requests r where r.id = v_id
                       and ((r.upload_token::text = v_parts[3] and r.created_at > now() - interval '2 hours')
                            or public.request_access(r.id)));
      end if;
      return public.request_access(v_id);
    when 'conversations' then
      return public.is_participant(v_id) or public.is_staff();
    when 'licenses' then
      return public.is_staff() or exists (select 1 from public.licenses l where l.id = v_id
             and (l.holder_user_id = auth.uid() or (l.organization_id is not null and public.org_member_can(l.organization_id, 'manage_members'))));
    when 'management' then
      return case when p_write then public.is_staff() else public.contract_access(v_id) end;
    when 'profiles' then
      return v_id = auth.uid() or public.is_staff();
    else
      return public.is_staff();
  end case;
end $$;
grant execute on function public.private_doc_access(text, boolean) to anon, authenticated;

-- property-media: lectura pública solo de fotos aprobadas de publicaciones visibles
create policy media_read on storage.objects for select
  using (bucket_id = 'property-media' and (
    public.media_path_public(name)
    or public.property_access(public.try_uuid((storage.foldername(name))[2]), 'view')));
create policy media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'property-media' and (storage.foldername(name))[1] = 'properties'
    and public.property_access(public.try_uuid((storage.foldername(name))[2]), 'edit'));
create policy media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'property-media' and public.property_access(public.try_uuid((storage.foldername(name))[2]), 'edit'));

-- private-docs: nunca público; permisos por carpeta
create policy docs_read on storage.objects for select
  using (bucket_id = 'private-docs' and public.private_doc_access(name, false));
create policy docs_insert on storage.objects for insert
  with check (bucket_id = 'private-docs' and public.private_doc_access(name, true));
create policy docs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'private-docs' and public.is_admin());

-- public-assets: logo, equipo, portafolio autorizado. Escritura solo personal.
create policy assets_read on storage.objects for select using (bucket_id = 'public-assets');
create policy assets_write on storage.objects for insert to authenticated
  with check (bucket_id = 'public-assets' and public.is_staff());
create policy assets_delete on storage.objects for delete to authenticated
  using (bucket_id = 'public-assets' and public.is_staff());

-- =====================================================================
-- Configuración inicial (editable desde el panel). Datos por confirmar marcados como tal.
-- =====================================================================
insert into public.site_settings (key, value, is_public, description) values
  ('company.name', '"MAJ REALTY SRL"', true, 'Nombre comercial'),
  ('company.phones', '["849-802-8181", "809-770-6277", "849-272-5000"]', true, 'Teléfonos de contacto'),
  ('company.primary_phone', '"849-802-8181"', true, 'Teléfono principal de contacto (indicado por MAJ)'),
  ('company.email', 'null', true, 'Correo de contacto (POR CONFIRMAR; no publicar uno propuesto como activo)'),
  ('company.address', 'null', true, 'Dirección física (POR CONFIRMAR)'),
  ('company.rnc', '"131090443"', true, 'RNC de MAJ REALTY SRL (indicado por MAJ)'),
  ('company.hours', 'null', true, 'Horario de atención visible (POR CONFIRMAR)'),
  ('company.data_confirmed', 'false', false, 'Marcar true cuando dirección, correo, RNC, horario y teléfono estén confirmados'),
  ('whatsapp.primary', '"18097706277"', true, 'WhatsApp principal (solo dígitos con código de país)'),
  ('whatsapp.secondary', '"18492725000"', true, 'WhatsApp alternativo'),
  ('whatsapp.routing', '"equipo"', true, 'Destino de WhatsApp en fichas: "equipo" (MAJ) o "asesor" (asesor asignado si existe)'),
  ('whatsapp.template', '"Hola, me interesa {servicio}, referencia {codigo}, enlace {url}"', true, 'Texto sugerido'),
  ('site.show_demo_data', 'false', false, 'Mostrar datos de demostración en el catálogo (NUNCA en producción)'),
  ('appointments.duration_minutes', '60', true, 'Duración de una visita'),
  ('appointments.min_lead_hours', '12', true, 'Anticipación mínima para agendar'),
  ('appointments.hours', '{"1":["09:00","17:00"],"2":["09:00","17:00"],"3":["09:00","17:00"],"4":["09:00","17:00"],"5":["09:00","17:00"],"6":["09:00","13:00"]}', true,
     'Horario para citas por día (0=domingo), hora de Santo Domingo. VALOR INICIAL: confirmar con MAJ'),
  ('support.response_time_text', '"Respondemos en horario laborable."', true, 'Texto de tiempo de respuesta (sin promesas no confirmadas)'),
  ('security.require_mfa_for_staff', 'true', false, 'Exigir segundo factor (MFA) al personal y administradores'),
  ('limits.requests_per_contact_hour', '6', false, 'Máximo de solicitudes por contacto por hora'),
  ('limits.anonymous_requests_per_10min', '60', false, 'Máximo global de solicitudes de visitantes cada 10 minutos'),
  ('legal.documents_version', '"borrador-2026-10-08"', true, 'Versión de documentos legales (borradores pendientes de revisión de abogado)'),
  ('quotes.default_tax', '{"label": null, "rate": 0}', false, 'Impuesto por defecto en cotizaciones (configurar con contador)'),
  ('licenses.expiry_notice_days', '15', false, 'Días de aviso antes del vencimiento de licencias')
on conflict (key) do nothing;

-- Planes configurables: precios y cuotas pendientes de decisión de MAJ (price NULL = sin definir).
insert into public.plans (code, name, description, holder_type, price, currency, duration_days, active_listing_quota, max_members, is_active, sort_order) values
  ('individual', 'Individual', 'Para propietarios y vendedores independientes. Precio y cuota pendientes de definir por MAJ.', 'individual', null, 'DOP', 365, 0, 1, true, 1),
  ('profesional', 'Profesional', 'Para agentes con cartera activa. Precio y cuota pendientes de definir por MAJ.', 'individual', null, 'DOP', 365, 0, 1, true, 2),
  ('agencia', 'Agencia', 'Para empresas con varios miembros. Precio y cuota pendientes de definir por MAJ.', 'organizacion', null, 'DOP', 365, 0, 5, true, 3)
on conflict (code) do nothing;

-- Servicios legales: DESHABILITADOS hasta que MAJ confirme profesional responsable.
insert into public.legal_services (code, name, description, enabled, sort_order) values
  ('revision_titulo', 'Revisión de título', 'Revisión documental del certificado de título y su estado.', false, 1),
  ('revision_contrato', 'Revisión de contratos', 'Revisión de contratos de compraventa o alquiler.', false, 2),
  ('transferencia', 'Transferencia de inmueble', 'Acompañamiento en el proceso de transferencia.', false, 3),
  ('deslinde', 'Deslinde', 'Gestión de deslinde con agrimensor y abogado.', false, 4),
  ('sucesion', 'Sucesiones', 'Gestión de inmuebles en sucesión.', false, 5),
  ('certificacion_estado_juridico', 'Certificación del estado jurídico', 'Solicitud de certificación ante el Registro de Títulos.', false, 6)
on conflict (code) do nothing;
