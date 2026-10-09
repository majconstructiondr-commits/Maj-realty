# Guía de despliegue · MAJ REALTY SRL

Esta guía lleva la aplicación de cero a producción. Los pasos marcados **(MAJ)** requieren decisiones o cuentas de la empresa.

> Nada de esto afirma que el dominio esté registrado, que el correo esté activo ni que los documentos legales estén aprobados. Son tareas pendientes.

## 1. Cuentas necesarias (MAJ)

| Servicio | Para qué | Costo orientativo |
|---|---|---|
| [Supabase](https://supabase.com) | Base de datos PostgreSQL, autenticación, archivos privados, tiempo real | Plan gratuito para empezar; el plan Pro (de pago mensual) añade copias diarias retenidas y recuperación a un punto en el tiempo como complemento. Confirmar precios vigentes en su web. |
| [Vercel](https://vercel.com) u otro hosting de Next.js | Publicar la aplicación con HTTPS | Plan Hobby gratuito es solo para uso no comercial; para una empresa corresponde el plan Pro (de pago). Confirmar condiciones vigentes. |
| [NIC.DO](https://www.nic.do/) | Registro del dominio `.do` / `.com.do` | Tarifa anual del registro |
| Proveedor de correo (Google Workspace, Microsoft 365, Zoho…) | Correo corporativo | Según proveedor |
| SMTP transaccional (Resend, Postmark, Amazon SES, Brevo…) | Correos de verificación y recuperación de contraseña | Varios tienen nivel gratuito |
| Cloudflare Turnstile (opcional) | Protección anti-bots en formularios | Gratuito |

Todas las cuentas deben crearse **a nombre de la empresa**, con correo de la empresa, MFA activado y al menos dos personas con acceso de administración.

## 2. Supabase

1. Crear un proyecto en la región más cercana disponible (p. ej. `us-east-1`).
2. Aplicar las migraciones **en orden** (`supabase/migrations/*.sql`):
   - Con la CLI: `npx supabase link --project-ref <ref>` y luego `npx supabase db push`.
   - O pegando cada archivo, en orden, en *SQL Editor*.
   - O desde GitHub (sin instalar nada): en el repositorio, *Settings → Secrets and variables → Actions*, crear el secreto `SUPABASE_DB_URL` con la cadena de conexión **Session pooler** de Supabase (*Connect* → *Session pooler*, con la contraseña de la base de datos). Luego *Actions → Aplicar migraciones de base de datos → Run workflow*. El flujo también se ejecuta solo cuando una migración nueva llega a `main`, y nunca aplica dos veces la misma (`scripts/apply-migrations.sh`).
3. **No** ejecutar `supabase/seed-demo.sql` en producción (solo para demostraciones).
4. *Authentication → URL Configuration*:
   - *Site URL*: `https://<dominio-definitivo>`
   - *Redirect URLs*: `https://<dominio-definitivo>/auth/confirm`, `https://<dominio-definitivo>/auth/callback` (y `http://localhost:3000/**` solo en desarrollo).
5. *Authentication → Email Templates*: en “Confirm signup” y “Reset password” usar enlaces con `token_hash`:
   - Confirmación: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/panel`
   - Recuperación: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/cuenta/nueva-clave`
6. *Authentication → SMTP*: configurar el SMTP transaccional con un remitente del dominio (p. ej. `no-responder@<dominio>`). El SMTP de prueba de Supabase tiene límites muy bajos y no sirve para producción.
7. *Authentication → Providers → Email*: mantener **“Confirm email” activado**.
8. *Authentication → Multi-Factor*: TOTP activado (lo está por defecto). La base de datos exige MFA al personal (`security.require_mfa_for_staff = true`).
9. Crear el primer administrador:
   1. Registrarse en `/cuenta/registro` y confirmar el correo.
   2. En *SQL Editor*:
      ```sql
      insert into public.user_roles (user_id, role)
      select id, 'admin' from auth.users where email = 'correo-del-administrador@empresa';
      ```
   3. Entrar en `/cuenta/seguridad` y registrar el segundo factor. Sin él, el panel MAJ no se habilita.
10. Llaves: *Project Settings → API*. La **publicable/anon** va en `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. La **service_role** solo si se usa la ruta `/api/cron` (variable de servidor, nunca `NEXT_PUBLIC_`).

### Tareas programadas

`run_scheduled_jobs()` vence licencias (y pausa sus publicaciones), avisa vencimientos próximos y marca cotizaciones vencidas. Programarla **cada hora** con una de estas opciones:

- **pg_cron (recomendado, sin exponer llaves)**: *Database → Extensions* → activar `pg_cron`, y en *SQL Editor*:
  ```sql
  select cron.schedule('maj-tareas', '5 * * * *', $$select public.run_scheduled_jobs()$$);
  ```
- **Vercel Cron**: definir `CRON_SECRET` y `SUPABASE_SERVICE_ROLE_KEY` y crear `vercel.json`:
  ```json
  { "crons": [{ "path": "/api/cron", "schedule": "5 * * * *" }] }
  ```

## 3. Publicar la aplicación (Vercel)

1. Importar el repositorio de GitHub en Vercel (framework Next.js detectado automáticamente).
2. Variables de entorno (*Settings → Environment Variables*), según `.env.example`:
   `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_LOGO_SRC`, `IP_HASH_SALT` (y opcionales).
   Las variables `NEXT_PUBLIC_*` se incorporan al compilar: deben estar definidas **antes** del despliegue (si se cambian, volver a desplegar). Sin ellas la aplicación se compila en modo demostración.
3. Desplegar. Revisar `/`, `/venta`, registro, recuperación de contraseña y panel.
4. Mantener `NEXT_PUBLIC_ALLOW_INDEXING=false` hasta el lanzamiento.

## 4. Dominio, HTTPS y una sola versión del dominio (MAJ)

Propuesta: `majrealty.com.do`. Alternativas: `majrealty.do`, `majrealtysrl.com`. **La disponibilidad y el registro están pendientes.**

1. Consultar disponibilidad y registrar en [NIC.DO](https://www.nic.do/) (o registrador autorizado) **a nombre de MAJ REALTY SRL**, con contactos administrativo y técnico de la empresa. Activar renovación automática y guardar las credenciales en el gestor de contraseñas de la empresa.
2. En Vercel → *Settings → Domains*: añadir `majrealty.com.do` y `www.majrealty.com.do`. Elegir **una** versión principal (recomendado: sin `www`) y marcar la otra como **redirección 308** a la principal.
3. En la zona DNS del dominio crear los registros que indique Vercel (normalmente `A` para el dominio raíz y `CNAME` para `www`).
4. Vercel emite el certificado HTTPS automáticamente. La aplicación ya envía `Strict-Transport-Security`.
5. Actualizar `NEXT_PUBLIC_SITE_URL` y las URL de Supabase (paso 2.4) con el dominio definitivo.

## 5. Correo corporativo (MAJ)

1. Contratar el proveedor de correo y crear los buzones (p. ej. `info@`, `ventas@`). **No publicar en la web un correo hasta que esté activo** (se edita en *Panel MAJ → Configuración → company.email*).
2. DNS: registros `MX` del proveedor, **SPF** (`TXT v=spf1 include:<proveedor> ~all`), **DKIM** (según proveedor) y **DMARC** (`_dmarc` → `v=DMARC1; p=none; rua=mailto:dmarc@<dominio>`; endurecer a `quarantine` cuando todo funcione).
3. Verificar el dominio también en el proveedor SMTP transaccional (registros DKIM/SPF que indique).

## 6. WhatsApp

Los números se editan en *Panel MAJ → Configuración* (`whatsapp.primary`, `whatsapp.secondary`, `whatsapp.routing`, `whatsapp.template`). Los botones usan enlaces `https://wa.me/<número>?text=…`. **No hay integración con la API de WhatsApp**: no se reciben ni sincronizan mensajes externos. Integrarla requiere una cuenta de WhatsApp Business Platform, un proveedor y el consentimiento aplicable.

## 7. Copias de seguridad y restauración

- **Supabase** realiza copias diarias del proyecto (retención según plan). En el plan Pro puede añadirse recuperación a un punto en el tiempo.
- **Copias lógicas propias** (recomendado semanal y antes de cada cambio grande):
  ```bash
  SUPABASE_DB_URL='postgresql://…' ./scripts/backup.sh backups/
  ```
  Genera `maj-data-<fecha>.sql.gz` + suma SHA-256 (datos de `public`, `auth` y metadatos de `storage`). Guardar cifradas fuera de Supabase.
- **Archivos (fotos y documentos)**: descargar los buckets `property-media`, `private-docs` y `public-assets` con la API S3 de Supabase Storage (*Project Settings → Storage → S3*) usando `rclone` o `aws s3 sync`, a un almacenamiento cifrado de la empresa.
- **Prueba de restauración (obligatoria antes del lanzamiento y luego trimestral)**: crear un proyecto Supabase de prueba vacío y ejecutar
  ```bash
  RESTORE_DB_URL='postgresql://…proyecto-de-prueba…' ./scripts/restore-test.sh backups/maj-data-<fecha>.sql.gz
  ```
  El script aplica las migraciones, carga los datos y muestra conteos para compararlos con producción. Este procedimiento se probó localmente con la simulación de Supabase (`supabase/tests/supabase-shim.sql`).
- **Retención**: definir con asesoría legal cuánto tiempo se conservan solicitudes, documentos y registros. No se promete borrar documentos que deban conservarse legalmente.

## 8. Antes del lanzamiento

```bash
SUPABASE_DB_URL='postgresql://…' NEXT_PUBLIC_SITE_URL=https://majrealty.com.do node scripts/check-launch.mjs
```

Comprueba: logo, dominio, ausencia de datos de demostración, datos de la empresa confirmados (dirección, correo, RNC, horario, teléfono), MFA del personal, planes con precio y cuota, y que exista un administrador. Además, manualmente:

- [ ] Documentos legales revisados por abogado dominicano (hoy son borradores).
- [ ] Evaluación con profesionales de las obligaciones de la empresa bajo la Ley 172-13 y, si aplica, la Ley 155-17 (un checkbox o una página no bastan).
- [ ] Servicios legales habilitados solo con profesional responsable.
- [ ] Notificaciones por correo configuradas (SMTP) y probadas.
- [ ] Recuperación de contraseña probada.
- [ ] Prueba de restauración realizada.
- [ ] `NEXT_PUBLIC_ALLOW_INDEXING=true` y enviar `sitemap.xml` a Google Search Console.
