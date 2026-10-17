-- Indicado por MAJ (2026-10-17): MAJ REALTY usa solo el 849-802-8181 para llamadas y WhatsApp.
-- Los números 809-770-6277 y 849-272-5000 pertenecen a otro negocio y se retiran del sitio.
insert into public.site_settings (key, value, is_public, description) values
  ('company.phones', '["849-802-8181"]', true, 'Teléfonos de contacto'),
  ('whatsapp.primary', '"18498028181"', true, 'WhatsApp principal (solo dígitos con código de país)'),
  ('whatsapp.secondary', 'null', true, 'WhatsApp alternativo (vacío = no se muestra)')
on conflict (key) do update set value = excluded.value, description = excluded.description;
