# MAJ REALTY SRL · Plataforma inmobiliaria

Aplicación web para vender, rentar y administrar inmuebles en República Dominicana, con solicitudes de remodelación, cotizaciones y gestiones legales. Español como idioma inicial, estructura preparada para inglés.

**Tecnología:** Next.js 16 (App Router, TypeScript) · Supabase (PostgreSQL con seguridad por filas, autenticación con MFA, almacenamiento privado, tiempo real) · CSS propio adaptable (primero móvil) · Leaflet + OpenStreetMap para mapas aproximados. Sin dependencias de pago obligatorias.

## Puesta en marcha local

```bash
npm install
cp .env.example .env.local      # completar con las llaves de un proyecto Supabase de desarrollo
npm run dev                      # http://localhost:3000
```

Sin variables de Supabase la aplicación arranca en **modo demostración**: muestra inmuebles de ejemplo marcados como “Demostración” y los formularios **no** guardan ni confirman nada.

Base de datos de desarrollo: aplicar `supabase/migrations/*.sql` en orden (ver `docs/DESPLIEGUE.md`). Para cargar ejemplos identificados: `supabase/seed-demo.sql` (nunca en producción).

## Pruebas

```bash
npm test            # pruebas unitarias (formatos, WhatsApp, búsqueda, validaciones, calculadora…)
npm run test:db     # pruebas críticas de permisos y reglas en PostgreSQL local
npm run typecheck
npm run lint
```

`npm run test:db` necesita un PostgreSQL 16 local (socket en `/tmp`, puerto `54329`, o `TEST_DATABASE_URL`). Crea la base `maj_test` con una simulación mínima de Supabase (`supabase/tests/supabase-shim.sql`: roles `anon`/`authenticated`, `auth.uid()`, `storage.objects`) y aplica todas las migraciones. Las pruebas cubren, entre otras:

- Visitante busca y consulta; solo ve campos públicos, nunca la dirección exacta ni datos del propietario.
- Vendedor registra y publica solo tras aprobación del personal; no puede aprobarse ni activarse una licencia.
- Otro vendedor no puede leer ni editar publicaciones, datos privados ni documentos ajenos.
- Licencia vencida o suspendida pausa publicaciones e impide publicar; dos envíos simultáneos no exceden la cuota.
- Cambios materiales de una publicación activa quedan pendientes y la versión publicada se mantiene.
- Cliente conversa y agenda; se impide la doble reserva; horario de Santo Domingo.
- Documentos privados no descargables por terceros ni visitantes.
- Propietario solo ve su cartera; estados de cuenta separados por moneda.
- Solicitudes y cotizaciones conservan historial; notas privadas ocultas al cliente; cotización enviada no se edita.
- Las validaciones no se eluden llamando a la API (inserciones directas denegadas, límites de envío, servicios legales deshabilitados).
- Personal sin segundo factor (MFA) no tiene privilegios.

## Arquitectura y decisiones

- **Permisos en la base de datos**, no solo en la interfaz: todas las tablas tienen RLS; reglas de negocio en disparadores y funciones (`supabase/migrations`). La aplicación usa siempre la llave publicable con la sesión del usuario. La llave `service_role` solo se usa (opcionalmente) en `/api/cron`.
- **Datos públicos separados**: los visitantes no acceden a las tablas base. El catálogo se sirve desde las vistas `catalog`, `catalog_prices` y `catalog_media`, que filtran publicaciones aprobadas con licencia vigente y solo exponen columnas públicas. La dirección exacta, el propietario y los datos legales viven en `property_private`.
- **Ubicación aproximada**: las coordenadas públicas se redondean (~1 km) a partir de las exactas; el mapa dibuja una zona, no un punto. Las fotos se recomprimen en el navegador, lo que elimina metadatos EXIF (incluido GPS).
- **Archivos**: bucket `property-media` (privado; las fotos aprobadas de publicaciones visibles se sirven con URL firmadas temporales), `private-docs` (documentos, nunca públicos; permisos por carpeta) y `public-assets` (logo, equipo, portafolio autorizado).
- **Licencias de publicación** (permiso contractual interno, no licencia profesional): cuota contada en servidor con bloqueo de fila; al vencer/suspender se pausan publicaciones conservando datos e historial. Planes, precios y cuotas los define MAJ (precio vacío = por definir).
- **Solicitudes**: todo formulario crea un registro real con número `SOL-AAAA-NNNNNN`, fecha, responsable e historial. La confirmación aparece solo después de que la base de datos devuelve el número. WhatsApp complementa, no reemplaza, el registro; un clic en WhatsApp se cuenta como clic, no como contacto.
- **Monedas**: DOP y USD nunca se suman; conversiones solo orientativas con tasa, fuente y fecha registradas por el personal.
- **Zona horaria**: `America/Santo_Domingo` para citas, fechas y numeración anual.
- **Auditoría**: tabla `audit_log` con autor, fecha y cambios de las tablas sensibles.

## Estructura

```
supabase/migrations/   esquema, RLS, funciones, buckets y configuración inicial
supabase/seed-demo.sql datos de demostración identificados (no producción)
src/app/               páginas públicas, /panel (usuarios), /admin (personal MAJ), /api
src/components/        interfaz
src/lib/               datos, validación, formatos, seguridad, WhatsApp
src/i18n/              textos (es; en preparado)
tests/unit, tests/db   pruebas
scripts/               copias de seguridad, prueba de restauración, verificación de lanzamiento
docs/DESPLIEGUE.md     despliegue, dominio, HTTPS, correo, tareas programadas, copias
```

## Rutas principales

- Públicas: `/`, `/venta`, `/renta`, `/inmuebles/[ref]`, servicios, `/publica-tu-propiedad`, `/nosotros`, `/contacto`, `/legal/*`.
- Cuenta: `/cuenta/ingresar`, `/cuenta/registro`, `/cuenta/recuperar`, `/cuenta/seguridad` (MFA).
- Usuario (`/panel`): solicitudes, cotizaciones, mensajes, visitas, favoritos, búsquedas, publicaciones (editor por pasos), licencia y pagos, agencia, propiedades administradas.
- Personal MAJ (`/admin`, exige MFA): resumen, inmuebles y revisión, solicitudes/CRM, visitas, mensajes, cotizaciones, administración de inmuebles, licencias y planes, publicadores, usuarios, reportes, contenido, configuración y auditoría. Exportación CSV en `/api/admin/export/*`.

## Configuración editable sin código

*Panel MAJ → Configuración*: teléfonos, WhatsApp y regla de destino, texto sugerido de WhatsApp, horarios de citas, datos de empresa, límites anti-abuso, MFA del personal. *Contenido*: textos de páginas, documentos legales (reemplazan los borradores), portafolio, equipo, servicios legales habilitados y tasas de cambio.

## Integraciones pendientes y costos

| Integración | Estado |
|---|---|
| Logo oficial | **Pendiente**: hay un espacio identificado “LOGO PENDIENTE”. Copiar el archivo a `public/brand/` y definir `NEXT_PUBLIC_LOGO_SRC`. |
| Dominio `majrealty.com.do` (propuesta) | **Pendiente** de disponibilidad y registro a nombre de la empresa. |
| Correo corporativo y SMTP | **Pendiente**. No se muestra ningún correo hasta configurarlo. |
| Pasarela de pago de licencias | **No implementada**: pagos manuales con comprobante y revisión. Una pasarela requerirá eventos verificados, idempotencia, recibos y política de cancelación. |
| API de WhatsApp | **No integrada**: solo enlaces `wa.me` y chat interno. |
| Notificaciones por correo | Las notificaciones se guardan dentro de la plataforma; el envío por correo requiere SMTP y una función de envío. |
| Avisos de búsquedas guardadas | Las búsquedas se guardan en *Mi cuenta*; el aviso automático de inmuebles nuevos **aún no está implementado**. |
| Chat en tiempo real | Requiere la publicación `supabase_realtime` (migración `0012`, existe por defecto en Supabase). Sin ella, el chat se actualiza al recargar. |
| Analítica / cookies de terceros | No instaladas. |
| Revisión legal | Los documentos legales son **borradores** sujetos a revisión de abogado dominicano. |

## Antes del lanzamiento

Ver la lista completa en `docs/DESPLIEGUE.md` y ejecutar `node scripts/check-launch.mjs`. En resumen: eliminar muestras, incorporar logo real, confirmar datos empresariales y contactos, registrar y configurar dominio, revisar condiciones y procesos legales con profesionales, configurar notificaciones, probar recuperación de contraseña y restauración de copias. No desplegar con datos ficticios presentados como reales.
