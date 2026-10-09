-- Servicios de gestión documental que MAJ REALTY ofrece sin abogado (decisión de MAJ, 2026-10-09).
-- Quedan habilitados con MAJ REALTY como responsable. Los servicios que requieren abogado o notario
-- siguen deshabilitados hasta que MAJ indique el profesional responsable.

update public.legal_services
   set name = 'Estado jurídico del inmueble',
       description = 'Solicitud de la certificación del estado jurídico ante el Registro de Títulos: dueño, cargas, hipotecas y oposiciones.'
 where code = 'certificacion_estado_juridico' and name = 'Certificación del estado jurídico';

insert into public.legal_services (code, name, description, enabled, sort_order) values
  ('verificacion_compra', 'Verificación de documentos antes de comprar', 'Revisamos que el título, el estado jurídico y los impuestos del inmueble estén en orden. No sustituye la opinión de un abogado.', false, 7),
  ('contrato_alquiler', 'Contrato de alquiler', 'Preparación del contrato de alquiler con modelo estándar. La legalización de firmas la hace un notario.', false, 8),
  ('impuestos_transferencia', 'Impuestos de transferencia (DGII)', 'Cálculo y pago de impuestos de transferencia inmobiliaria ante la DGII.', false, 9),
  ('ipi', 'Impuesto al patrimonio inmobiliario (IPI)', 'Declaración y pago del IPI ante la DGII.', false, 10)
on conflict (code) do nothing;

update public.legal_services
   set enabled = true, responsible_professional = 'MAJ REALTY (gestión documental)'
 where code in ('certificacion_estado_juridico', 'verificacion_compra', 'contrato_alquiler', 'impuestos_transferencia', 'ipi')
   and not enabled;

-- Una solicitud legal puede pedir varios servicios (details.service_codes). Todos deben estar habilitados.
create or replace function public.check_legal_service_codes()
returns trigger
language plpgsql set search_path = public as $$
declare
  v_codes jsonb := new.details -> 'service_codes';
begin
  if new.kind <> 'legal' or v_codes is null then
    return new;
  end if;
  if jsonb_typeof(v_codes) <> 'array' or jsonb_array_length(v_codes) = 0 or jsonb_array_length(v_codes) > 20 then
    raise exception 'Seleccione entre 1 y 20 servicios' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from jsonb_array_elements_text(v_codes) c
    where not exists (select 1 from public.legal_services s where s.code = c and s.enabled)
  ) then
    raise exception 'Uno de los servicios legales no está habilitado actualmente' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger check_legal_service_codes before insert on public.service_requests
  for each row execute function public.check_legal_service_codes();
