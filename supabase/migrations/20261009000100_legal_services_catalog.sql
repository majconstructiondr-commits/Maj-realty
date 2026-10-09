-- Catálogo ampliado de servicios legales inmobiliarios y solicitudes con varios servicios.
-- Los servicios nuevos quedan DESHABILITADOS hasta que MAJ indique el profesional responsable.

update public.legal_services
   set name = 'Estado jurídico del inmueble',
       description = 'Certificación del estado jurídico ante el Registro de Títulos: dueño, cargas, hipotecas y oposiciones.'
 where code = 'certificacion_estado_juridico' and name = 'Certificación del estado jurídico';

insert into public.legal_services (code, name, description, enabled, sort_order) values
  ('contrato_alquiler', 'Contrato de alquiler', 'Redacción o revisión de contrato de alquiler residencial o comercial.', false, 7),
  ('contrato_venta', 'Contrato de venta de inmueble', 'Redacción del contrato de compraventa del inmueble.', false, 8),
  ('promesa_venta', 'Contrato de promesa de venta', 'Contrato de promesa de venta con plazos y forma de pago.', false, 9),
  ('revision_compra', 'Revisión completa antes de comprar', 'Revisión de título, cargas, impuestos y documentos del vendedor antes de firmar.', false, 10),
  ('poder_representacion', 'Poder de representación', 'Poder notarial para comprar, vender o administrar un inmueble.', false, 11),
  ('legalizacion_firmas', 'Legalización de firmas', 'Legalización notarial de firmas en contratos y documentos.', false, 12),
  ('impuestos_transferencia', 'Impuestos de transferencia (DGII)', 'Cálculo y pago de impuestos de transferencia inmobiliaria.', false, 13),
  ('duplicado_titulo', 'Duplicado de certificado de título', 'Solicitud por pérdida o deterioro del certificado de título.', false, 14),
  ('hipoteca', 'Inscripción o cancelación de hipoteca', 'Gestión de hipotecas ante el Registro de Títulos.', false, 15),
  ('desalojo', 'Desalojo y cobro de alquileres', 'Acciones por falta de pago o fin de contrato de alquiler.', false, 16),
  ('condominio', 'Régimen de condominio', 'Constitución de condominio y su reglamento.', false, 17)
on conflict (code) do nothing;

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
