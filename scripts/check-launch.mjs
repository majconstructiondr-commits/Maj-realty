#!/usr/bin/env node
// Lista de verificación antes del lanzamiento. Uso:
//   SUPABASE_DB_URL=postgresql://... NEXT_PUBLIC_LOGO_SRC=/brand/logo.svg node scripts/check-launch.mjs
// Sale con código 1 si algo bloquea el lanzamiento.
import pg from "pg";

const url = process.env.SUPABASE_DB_URL;
const problems = [];
const ok = [];
if (!process.env.NEXT_PUBLIC_LOGO_SRC) problems.push("Falta el logo oficial (NEXT_PUBLIC_LOGO_SRC).");
else ok.push("Logo configurado.");
if (!process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL.includes("localhost")) problems.push("NEXT_PUBLIC_SITE_URL no apunta al dominio definitivo.");
if (!url) {
  problems.push("SUPABASE_DB_URL no definido: no se pudo revisar la base de datos.");
} else {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  const q = async (sql) => (await c.query(sql)).rows[0];
  const demo = await q(`select (select count(*) from properties where is_demo) p, (select count(*) from service_requests where is_demo) r, (select count(*) from quotes where is_demo) q`);
  if (Number(demo.p) + Number(demo.r) + Number(demo.q) > 0) problems.push(`Hay datos de demostración: ${demo.p} inmuebles, ${demo.r} solicitudes, ${demo.q} cotizaciones.`);
  else ok.push("Sin datos de demostración.");
  const s = await q(`select
     (select value from site_settings where key='site.show_demo_data') demo,
     (select value from site_settings where key='company.data_confirmed') confirmed,
     (select value from site_settings where key='company.email') email,
     (select value from site_settings where key='company.address') address,
     (select value from site_settings where key='company.rnc') rnc,
     (select value from site_settings where key='company.hours') hours,
     (select value from site_settings where key='security.require_mfa_for_staff') mfa`);
  if (s.demo === true) problems.push("site.show_demo_data está activo.");
  if (s.confirmed !== true) problems.push("company.data_confirmed no está marcado: confirmar dirección, correo, RNC, horario y teléfono.");
  for (const k of ["email", "address", "rnc", "hours"]) if (s[k] === null) problems.push(`Dato de empresa pendiente: company.${k}.`);
  if (s.mfa !== true) problems.push("MFA del personal desactivado.");
  const plans = await q(`select count(*) filter (where price is null) sin_precio, count(*) filter (where active_listing_quota = 0) sin_cuota from plans where is_active`);
  if (Number(plans.sin_precio) > 0 || Number(plans.sin_cuota) > 0) problems.push(`Planes sin precio (${plans.sin_precio}) o sin cuota (${plans.sin_cuota}) definidos por MAJ.`);
  const admins = await q(`select count(*) n from user_roles where role = 'admin'`);
  if (Number(admins.n) === 0) problems.push("No hay ningún administrador.");
  await c.end();
}
problems.push("Recordatorio manual: revisión de documentos legales por abogado, dominio registrado a nombre de la empresa, correo corporativo, notificaciones y prueba de restauración.");
for (const o of ok) console.log("✓", o);
for (const p of problems) console.log("✗", p);
process.exit(problems.length > 1 ? 1 : 0);
