-- =====================================================================
-- DATOS DE DEMOSTRACIÓN · SOLO PARA DESARROLLO O PRESENTACIÓN
-- NO ejecutar en producción. Todos los registros llevan is_demo = true y títulos "DEMO ·".
-- Eliminar con: delete from public.properties where is_demo; (ver scripts/check-launch.mjs)
-- Requiere que exista al menos un usuario (se usa el más antiguo como titular).
-- =====================================================================
begin;
set local session_replication_role = replica;  -- omite disparadores de negocio solo para esta carga

with owner as (select id from auth.users order by created_at limit 1),
ins as (
  insert into public.properties (code, slug, title, operation, property_type, description, condition, status, owner_user_id,
    is_maj_listing, is_demo, province, municipality, sector, approx_lat, approx_lng, built_area_m2, land_area_m2,
    bedrooms, bathrooms, half_bathrooms, parking_spaces, floor_number, na_fields, features, published_at, first_published_at)
  select v.code, v.slug, v.title, v.op, v.tipo, v.descr, v.cond, 'publicado', owner.id, true, true, v.prov, v.mun, 'Sector de ejemplo',
    v.lat, v.lng, v.built, v.land, v.hab, v.banos, v.medios, v.parq, v.piso, v.na, v.feat::jsonb, now(), now()
  from owner, (values
    ('DEMO-000001', 'demo-apartamento', 'DEMO · Apartamento de 3 habitaciones', 'venta', 'apartamento', 'Publicación de demostración. No es un inmueble real.', 'nuevo', 'Distrito Nacional', 'Santo Domingo de Guzmán', 18.470, -69.940, 165, null::numeric, 3, 3, 1, 2, 7, '{}'::text[], '{"ascensor":{"v":"si"},"piscina":{"v":"no"}}'),
    ('DEMO-000002', 'demo-casa', 'DEMO · Casa familiar con patio', 'ambas', 'casa', 'Publicación de demostración. No es un inmueble real.', 'usado', 'Santiago', 'Santiago de los Caballeros', 19.450, -70.690, 240, 400, 4, 3, null, 3, null, '{floor_number}', '{"inversor":{"v":"si"}}'),
    ('DEMO-000003', 'demo-solar', 'DEMO · Solar residencial', 'venta', 'solar', 'Publicación de demostración. No es un inmueble real.', null, 'La Altagracia', 'Higüey', 18.610, -68.710, null, 1200, null, null, null, null, null, '{built_area_m2,bedrooms,bathrooms,half_bathrooms,floor_number,levels,year_built}', '{}')
  ) as v(code, slug, title, op, tipo, descr, cond, prov, mun, lat, lng, built, land, hab, banos, medios, parq, piso, na, feat)
  on conflict (code) do nothing
  returning id, code
)
insert into public.property_prices (property_id, operation, amount, currency, negotiable, rent_period)
select id, x.op, x.amount, x.cur::public.currency_code, false, x.period
from ins join (values
  ('DEMO-000001', 'venta', 285000, 'USD', null),
  ('DEMO-000002', 'venta', 12500000, 'DOP', null),
  ('DEMO-000002', 'renta', 65000, 'DOP', 'mensual'),
  ('DEMO-000003', 'venta', 95000, 'USD', null)
) as x(code, op, amount, cur, period) on x.code = ins.code;

insert into public.property_private (property_id, publication_authorized)
select id, true from public.properties where is_demo on conflict do nothing;

update public.site_settings set value = 'true' where key = 'site.show_demo_data';
commit;
