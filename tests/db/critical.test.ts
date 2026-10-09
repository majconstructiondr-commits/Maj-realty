// Pruebas críticas de permisos y reglas de negocio en la base de datos.
// Requiere PostgreSQL local preparado con: npm run db:test:reset
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { admin, as, connect, createUser, expectError, grantRole } from "./helpers";

let c: Client;
let c2: Client;
const u: Record<string, string> = {};
let planId: string;
let licA: string;
let propA: string;

const STAFF = () => ({ id: u.staff, aal: "aal2" as const });
const A = () => ({ id: u.sellerA });
const B = () => ({ id: u.sellerB });
const C = () => ({ id: u.client });

async function newDraft(actor: { id: string }, title = "Apartamento de prueba en Piantini") {
  return as(c, actor, async () => {
    const r = await c.query(
      `insert into properties(title, operation, property_type, owner_user_id, description, province, municipality, sector)
       values ($1, 'venta', 'apartamento', $2, 'Descripción suficientemente larga para pasar la validación mínima.', 'Distrito Nacional', 'Santo Domingo de Guzmán', 'Piantini')
       returning id`,
      [title, actor.id],
    );
    const id = r.rows[0].id as string;
    await c.query(
      `insert into property_prices(property_id, operation, amount, currency) values ($1, 'venta', 250000, 'USD')`,
      [id],
    );
    await c.query(
      `insert into property_media(property_id, kind, storage_path, alt_text, is_cover) values ($1, 'foto', $2, 'Sala', true)`,
      [id, `properties/${id}/foto1.webp`],
    );
    await c.query(
      `update property_private set street = 'Calle Uno', street_number = '10', building = 'Torre A', unit = '5B',
         exact_lat = 18.4712345, exact_lng = -69.9412345, owner_name = 'Dueño Real', owner_id_number = '001-0000000-1',
         publication_authorized = true where property_id = $1`,
      [id],
    );
    return id;
  });
}

beforeAll(async () => {
  c = await connect();
  c2 = await connect();
  await admin(c, async () => {
    u.staff = await createUser(c, "staff@maj.test", "Personal MAJ");
    u.staffNoMfa = u.staff;
    u.sellerA = await createUser(c, "a@test.do", "Vendedor A");
    u.sellerB = await createUser(c, "b@test.do", "Vendedor B");
    u.client = await createUser(c, "cliente@test.do", "Cliente C");
    u.owner1 = await createUser(c, "dueno1@test.do", "Propietario Uno");
    u.owner2 = await createUser(c, "dueno2@test.do", "Propietario Dos");
    await grantRole(c, u.staff, "admin");
    await grantRole(c, u.sellerA, "vendedor");
    await grantRole(c, u.sellerB, "vendedor");
    await c.query(
      `insert into storage.objects(bucket_id, name) values ('property-media', 'placeholder')`,
    );
    planId = (await c.query(`select id from plans where code = 'individual'`)).rows[0].id;
  });
});

afterAll(async () => {
  await c.end();
  await c2.end();
});

describe("Roles y MFA", () => {
  it("el personal sin segundo factor (aal1) no tiene privilegios", async () => {
    const r = await as(c, { id: u.staff, aal: "aal1" }, () => c.query("select public.is_staff() s"));
    expect(r.rows[0].s).toBe(false);
    const r2 = await as(c, STAFF(), () => c.query("select public.is_staff() s"));
    expect(r2.rows[0].s).toBe(true);
  });

  it("un usuario no puede asignarse roles", async () => {
    await expectError(as(c, A(), () => c.query(`insert into user_roles(user_id, role) values ($1, 'admin')`, [u.sellerA])));
  });
});

describe("Vendedor registra y publica tras aprobación", () => {
  it("sin licencia no puede enviar a revisión", async () => {
    propA = await newDraft(A());
    await expectError(
      as(c, A(), () => c.query(`update properties set status = 'en_revision' where id = $1`, [propA])),
      /licencia/i,
    );
  });

  it("no puede crear una publicación directamente publicada", async () => {
    await expectError(
      as(c, A(), () =>
        c.query(
          `insert into properties(title, operation, property_type, owner_user_id, status) values ('Atajo publicado', 'venta', 'casa', $1, 'publicado')`,
          [u.sellerA],
        ),
      ),
      /borrador/,
    );
  });

  it("no puede activarse una licencia a sí mismo", async () => {
    await expectError(
      as(c, A(), () =>
        c.query(
          `insert into licenses(holder_user_id, plan_id, status, starts_at, ends_at, active_listing_quota) values ($1, $2, 'activa', now(), now() + interval '1 year', 10)`,
          [u.sellerA, planId],
        ),
      ),
    );
  });

  it("con licencia activa envía a revisión; no puede aprobarse; el personal aprueba y aparece en el catálogo", async () => {
    licA = await as(c, STAFF(), async () =>
      (
        await c.query(
          `insert into licenses(holder_user_id, plan_id, status, starts_at, ends_at, active_listing_quota) values ($1, $2, 'activa', now() - interval '1 day', now() + interval '1 year', 1) returning id`,
          [u.sellerA, planId],
        )
      ).rows[0].id,
    );
    await as(c, A(), () => c.query(`update properties set status = 'en_revision' where id = $1`, [propA]));
    await expectError(as(c, A(), () => c.query(`update properties set status = 'publicado' where id = $1`, [propA])));

    const before = await as(c, "anon", () => c.query(`select id from catalog where id = $1`, [propA]));
    expect(before.rowCount).toBe(0);

    await as(c, STAFF(), () => c.query(`update properties set status = 'publicado' where id = $1`, [propA]));
    const after = await as(c, "anon", () => c.query(`select * from catalog where id = $1`, [propA]));
    expect(after.rowCount).toBe(1);
    expect(after.rows[0].sale_price).toBe("250000.00");
    expect(after.rows[0].sale_currency).toBe("USD");
  });

  it("rechazo exige motivo", async () => {
    const p = await newDraft(B(), "Casa para rechazo de prueba");
    await as(c, STAFF(), async () => {
      await c.query(`update properties set status = 'en_revision', is_maj_listing = true where id = $1`, [p]);
      await expectError(c.query(`update properties set status = 'rechazado' where id = $1`, [p]), /motivo/);
    });
  });
});

describe("Visitante busca y consulta", () => {
  it("el visitante solo ve campos públicos y nunca la dirección exacta", async () => {
    const r = await as(c, "anon", () => c.query(`select * from catalog where id = $1`, [propA]));
    const row = r.rows[0];
    const text = JSON.stringify(row);
    expect(text).not.toContain("Calle Uno");
    expect(text).not.toContain("001-0000000-1");
    expect(text).not.toContain("18.471234");
    expect(row.approx_lat).toBe("18.470");
    expect(row.public_address).toBeNull();
    expect(Object.keys(row)).not.toContain("owner_user_id");
  });

  it("el visitante no accede a tablas base ni a datos privados", async () => {
    await expectError(as(c, "anon", () => c.query(`select * from properties`)), /permission denied/);
    await expectError(as(c, "anon", () => c.query(`select * from property_private`)), /permission denied/);
    await expectError(as(c, "anon", () => c.query(`select * from property_documents`)), /permission denied/);
  });

  it("filtros combinables por características (jsonb)", async () => {
    await as(c, STAFF(), () =>
      c.query(`update properties set features = '{"piscina":{"v":"si"},"ascensor":{"v":"no"}}' where id = $1`, [propA]),
    );
    const r = await as(c, "anon", () =>
      c.query(`select id from catalog where features @> '{"piscina":{"v":"si"}}' and province = 'Distrito Nacional' and sale_price <= 300000`),
    );
    expect(r.rows.map((x) => x.id)).toContain(propA);
  });

  it("el visitante crea una solicitud real con número; sin consentimiento falla", async () => {
    const r = await as(c, "anon", () =>
      c.query(
        `select create_service_request('info_inmueble', 'Ana Pérez', 'ana@test.do', null, 'whatsapp', 'Me interesa', '{}', $1, null, true, false, 'v1') r`,
        [propA],
      ),
    );
    expect(r.rows[0].r.number).toMatch(/^SOL-\d{4}-\d{6}$/);
    await expectError(
      as(c, "anon", () =>
        c.query(`select create_service_request('contacto', 'Ana', 'ana@test.do', null, 'whatsapp', 'x', '{}', null, null, false, false, 'v1')`),
      ),
      /contactemos/,
    );
  });
});

describe("Aislamiento entre vendedores", () => {
  it("otro vendedor no puede leer ni editar la publicación ni sus datos privados", async () => {
    const read = await as(c, B(), () => c.query(`select * from properties where id = $1`, [propA]));
    expect(read.rowCount).toBe(0);
    const priv = await as(c, B(), () => c.query(`select * from property_private where property_id = $1`, [propA]));
    expect(priv.rowCount).toBe(0);
    const upd = await as(c, B(), () => c.query(`update properties set title = 'Hackeado por B' where id = $1`, [propA]));
    expect(upd.rowCount).toBe(0);
    await expectError(
      as(c, B(), () => c.query(`insert into property_prices(property_id, operation, amount, currency) values ($1, 'renta', 1, 'DOP')`, [propA])),
    );
  });

  it("documentos privados no se pueden descargar por terceros", async () => {
    const path = `properties/${propA}/titulo.pdf`;
    await admin(c, () => c.query(`insert into storage.objects(bucket_id, name) values ('private-docs', $1)`, [path]));
    await as(c, A(), () =>
      c.query(
        `insert into property_documents(property_id, doc_type, storage_path, file_name, mime_type, size_bytes, uploaded_by) values ($1, 'titulo', $2, 'titulo.pdf', 'application/pdf', 1000, $3)`,
        [propA, path, u.sellerA],
      ),
    );
    const own = await as(c, A(), () => c.query(`select name from storage.objects where bucket_id = 'private-docs' and name = $1`, [path]));
    expect(own.rowCount).toBe(1);
    const third = await as(c, B(), () => c.query(`select name from storage.objects where bucket_id = 'private-docs' and name = $1`, [path]));
    expect(third.rowCount).toBe(0);
    const client = await as(c, C(), () => c.query(`select name from storage.objects where bucket_id = 'private-docs'`));
    expect(client.rowCount).toBe(0);
    const anon = await as(c, "anon", () => c.query(`select name from storage.objects where bucket_id = 'private-docs'`));
    expect(anon.rowCount).toBe(0);
    const docs = await as(c, B(), () => c.query(`select * from property_documents where property_id = $1`, [propA]));
    expect(docs.rowCount).toBe(0);
  });

  it("las fotos aprobadas de publicaciones visibles son legibles; las de borradores no", async () => {
    await admin(c, () => c.query(`insert into storage.objects(bucket_id, name) values ('property-media', $1)`, [`properties/${propA}/foto1.webp`]));
    const pub = await as(c, "anon", () => c.query(`select name from storage.objects where bucket_id = 'property-media' and name like $1`, [`properties/${propA}/%`]));
    expect(pub.rowCount).toBe(1);
    const draft = await newDraft(A(), "Borrador con foto privada");
    await admin(c, () => c.query(`insert into storage.objects(bucket_id, name) values ('property-media', $1)`, [`properties/${draft}/foto1.webp`]));
    const hidden = await as(c, "anon", () => c.query(`select name from storage.objects where name = $1`, [`properties/${draft}/foto1.webp`]));
    expect(hidden.rowCount).toBe(0);
  });
});

describe("Cambios materiales", () => {
  it("el vendedor no cambia el precio publicado directamente; la solicitud mantiene la versión publicada hasta aprobación", async () => {
    await expectError(
      as(c, A(), () => c.query(`update property_prices set amount = 1 where property_id = $1`, [propA])),
      /revisión/,
    );
    await expectError(as(c, A(), () => c.query(`update properties set title = 'Nuevo título' where id = $1`, [propA])), /revisión/);
    const reqId = await as(c, A(), async () =>
      (
        await c.query(`select submit_property_change($1, $2) id`, [
          propA,
          JSON.stringify({ prices: [{ operation: "venta", amount: 240000, currency: "USD", negotiable: true }] }),
        ])
      ).rows[0].id,
    );
    const still = await as(c, "anon", () => c.query(`select sale_price from catalog where id = $1`, [propA]));
    expect(still.rows[0].sale_price).toBe("250000.00");
    await expectError(as(c, A(), () => c.query(`select review_property_change($1, true, 'ok')`, [reqId])), /personal/);
    await as(c, STAFF(), () => c.query(`select review_property_change($1, true, 'Verificado con el propietario')`, [reqId]));
    const now = await as(c, "anon", () => c.query(`select sale_price, sale_negotiable from catalog where id = $1`, [propA]));
    expect(now.rows[0].sale_price).toBe("240000.00");
    expect(now.rows[0].sale_negotiable).toBe(true);
  });
});

describe("Licencias", () => {
  it("dos envíos simultáneos no exceden la cuota", async () => {
    // licA tiene cuota 1 y ya está consumida por propA → liberar cuota pausando propA
    await as(c, A(), () => c.query(`update properties set status = 'pausado' where id = $1`, [propA]));
    const p1 = await newDraft(A(), "Concurrente uno de prueba");
    const p2 = await newDraft(A(), "Concurrente dos de prueba");
    const claims = JSON.stringify({ sub: u.sellerA, role: "authenticated", aal: "aal1" });
    for (const cl of [c, c2]) {
      await cl.query("begin");
      await cl.query("set local role authenticated");
      await cl.query(`select set_config('request.jwt.claims', $1, true)`, [claims]);
    }
    await c.query(`update properties set status = 'en_revision' where id = $1`, [p1]);
    const second = c2.query(`update properties set status = 'en_revision' where id = $1`, [p2]).then(
      () => "ok",
      (e: Error) => e.message,
    );
    await new Promise((r) => setTimeout(r, 300));
    await c.query("commit");
    const res = await second;
    await c2.query(res === "ok" ? "commit" : "rollback");
    expect(res).toMatch(/Cuota/);
  });

  it("licencia suspendida pausa las publicaciones e impide publicar", async () => {
    const live = await as(c, A(), () => c.query(`select id from properties where license_id = $1 and status = 'en_revision'`, [licA]));
    const pid = live.rows[0].id;
    await as(c, STAFF(), () => c.query(`update properties set status = 'publicado' where id = $1`, [pid]));
    await as(c, STAFF(), () => c.query(`update licenses set status = 'suspendida', status_reason = 'Prueba' where id = $1`, [licA]));
    const st = await as(c, A(), () => c.query(`select status, pause_reason from properties where id = $1`, [pid]));
    expect(st.rows[0].status).toBe("pausado");
    const pub = await as(c, "anon", () => c.query(`select id from catalog where id = $1`, [pid]));
    expect(pub.rowCount).toBe(0);
    await expectError(as(c, A(), () => c.query(`update properties set status = 'en_revision' where id = $1`, [pid])), /licencia/i);
  });

  it("licencia vencida por fecha deja de mostrar publicaciones y la tarea la marca vencida", async () => {
    const lic = await as(c, STAFF(), async () =>
      (
        await c.query(
          `insert into licenses(holder_user_id, plan_id, status, starts_at, ends_at, active_listing_quota) values ($1, $2, 'activa', now() - interval '2 day', now() + interval '1 hour', 5) returning id`,
          [u.sellerB, planId],
        )
      ).rows[0].id,
    );
    const p = await newDraft(B(), "Publicación de B por vencer");
    await as(c, B(), () => c.query(`update properties set status = 'en_revision' where id = $1`, [p]));
    await as(c, STAFF(), () => c.query(`update properties set status = 'publicado' where id = $1`, [p]));
    expect((await as(c, "anon", () => c.query(`select 1 from catalog where id = $1`, [p]))).rowCount).toBe(1);
    await admin(c, () => c.query(`alter table licenses disable trigger licenses_guard`));
    await admin(c, () => c.query(`update licenses set ends_at = now() - interval '1 minute' where id = $1`, [lic]));
    await admin(c, () => c.query(`alter table licenses enable trigger licenses_guard`));
    expect((await as(c, "anon", () => c.query(`select 1 from catalog where id = $1`, [p]))).rowCount).toBe(0);
    const job = await admin(c, () => c.query(`select run_scheduled_jobs() r`));
    expect(job.rows[0].r.licencias_vencidas).toBeGreaterThanOrEqual(1);
    const st = await admin(c, () => c.query(`select status from properties where id = $1`, [p]));
    expect(st.rows[0].status).toBe("pausado");
  });
});

describe("Cliente conversa y agenda", () => {
  let pub: string;
  beforeAll(async () => {
    pub = await as(c, STAFF(), async () => {
      const r = await c.query(
        `insert into properties(title, operation, property_type, owner_user_id, description, province, municipality, is_maj_listing)
         values ('Villa MAJ para chat', 'renta', 'villa', $1, 'Descripción suficientemente larga para pasar la validación.', 'La Altagracia', 'Higüey', true) returning id`,
        [u.staff],
      );
      const id = r.rows[0].id;
      await c.query(`insert into property_prices(property_id, operation, amount, currency, rent_period) values ($1, 'renta', 3500, 'USD', 'mensual')`, [id]);
      await c.query(`insert into property_media(property_id, kind, storage_path) values ($1, 'foto', $2)`, [id, `properties/${id}/a.webp`]);
      await c.query(`update property_private set publication_authorized = true where property_id = $1`, [id]);
      await c.query(`update properties set status = 'en_revision' where id = $1`, [id]);
      await c.query(`update properties set status = 'publicado' where id = $1`, [id]);
      return id;
    });
  });

  it("el cliente inicia conversación; solo participantes y personal la leen", async () => {
    const conv = await as(c, C(), async () =>
      (await c.query(`select start_conversation($1, null, 'Consulta villa', 'Hola, ¿está disponible?') id`, [pub])).rows[0].id,
    );
    const mine = await as(c, C(), () => c.query(`select body from messages where conversation_id = $1`, [conv]));
    expect(mine.rowCount).toBe(1);
    const other = await as(c, B(), () => c.query(`select body from messages where conversation_id = $1`, [conv]));
    expect(other.rowCount).toBe(0);
    await expectError(
      as(c, B(), () => c.query(`insert into messages(conversation_id, sender_id, body) values ($1, $2, 'intruso')`, [conv, u.sellerB])),
    );
    const staff = await as(c, STAFF(), () => c.query(`select body from messages where conversation_id = $1`, [conv]));
    expect(staff.rowCount).toBe(1);
    const notif = await as(c, STAFF(), () => c.query(`select * from notifications where user_id = $1 and kind = 'mensaje'`, [u.staff]));
    expect(notif.rowCount).toBeGreaterThanOrEqual(1);
  });

  it("agenda una visita en horario hábil y se impide la doble reserva", async () => {
    // próximo martes 10:00 hora de Santo Domingo (UTC-4)
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + ((9 - d.getUTCDay()) % 7 || 7));
    const day = d.toISOString().slice(0, 10);
    const start = `${day}T10:00:00-04:00`;
    const appt = await as(c, C(), async () =>
      (await c.query(`select request_appointment($1, null, $2, 'Llevo a mi familia') id`, [pub, start])).rows[0].id,
    );
    expect(appt).toBeTruthy();
    await expectError(
      as(c, B(), () => c.query(`select request_appointment($1, null, $2, null)`, [pub, `${day}T10:30:00-04:00`])),
      /disponible/,
    );
    await expectError(
      as(c, C(), () => c.query(`select request_appointment($1, null, $2, null)`, [pub, `${day}T22:00:00-04:00`])),
      /horario/,
    );
    await expectError(as(c, C(), () => c.query(`select update_appointment($1, 'confirmar', null, null)`, [appt])));
    await as(c, STAFF(), () => c.query(`select update_appointment($1, 'confirmar', null, null)`, [appt]));
    const r = await as(c, C(), () =>
      c.query(`select status, to_char(starts_at at time zone 'America/Santo_Domingo', 'HH24:MI') h from appointments where id = $1`, [appt]),
    );
    expect(r.rows[0]).toEqual({ status: "confirmada", h: "10:00" });
  });
});

describe("Propietario solo ve su cartera", () => {
  it("contratos y movimientos aislados por propietario; montos separados por moneda", async () => {
    const [k1, k2] = await as(c, STAFF(), async () => {
      const a = await c.query(
        `insert into management_contracts(owner_user_id, property_label, start_date, status) values ($1, 'Apto Naco 3A', current_date, 'activo') returning id`,
        [u.owner1],
      );
      const b = await c.query(
        `insert into management_contracts(owner_user_id, property_label, start_date, status) values ($1, 'Local Zona Colonial', current_date, 'activo') returning id`,
        [u.owner2],
      );
      for (const [k, amt, cur] of [
        [a.rows[0].id, 1200, "USD"],
        [a.rows[0].id, 30000, "DOP"],
        [b.rows[0].id, 900, "USD"],
      ] as const) {
        await c.query(
          `insert into management_movements(contract_id, kind, direction, amount, currency, movement_date, period, description) values ($1, 'renta_cobrada', 'ingreso', $2, $3, current_date, to_char(current_date, 'YYYY-MM'), 'Renta')`,
          [k, amt, cur],
        );
      }
      return [a.rows[0].id, b.rows[0].id];
    });
    const o1 = await as(c, { id: u.owner1 }, () => c.query(`select id from management_contracts`));
    expect(o1.rows.map((r) => r.id)).toEqual([k1]);
    const st = await as(c, { id: u.owner1 }, () => c.query(`select currency, ingresos from management_statements order by currency`));
    expect(st.rows).toEqual([
      { currency: "DOP", ingresos: "30000.00" },
      { currency: "USD", ingresos: "1200.00" },
    ]);
    const leak = await as(c, { id: u.owner1 }, () => c.query(`select * from management_movements where contract_id = $1`, [k2]));
    expect(leak.rowCount).toBe(0);
    await expectError(
      as(c, { id: u.owner1 }, () =>
        c.query(
          `insert into management_movements(contract_id, kind, direction, amount, currency, movement_date, period, description) values ($1, 'ajuste', 'ingreso', 1, 'USD', current_date, '2026-10', 'x')`,
          [k1],
        ),
      ),
    );
  });
});

describe("Solicitudes y cotizaciones conservan historial", () => {
  it("cambios de estado quedan registrados; las notas privadas no las ve el cliente", async () => {
    const req = await as(c, C(), async () =>
      (
        await c.query(
          `select create_service_request('remodelacion', 'Cliente C', 'cliente@test.do', '809-555-0000', 'whatsapp', 'Remodelar cocina', '{"area_m2": 12}', null, null, true, false, 'v1') r`,
        )
      ).rows[0].r,
    );
    await as(c, STAFF(), async () => {
      await c.query(`update service_requests set status = 'en_revision', stage = 'contactado', assigned_to = $2 where id = $1`, [req.id, u.staff]);
      await c.query(`select add_request_note($1, 'Cliente parece indeciso', true)`, [req.id]);
      await c.query(`select add_request_note($1, 'Le visitaremos el martes', false)`, [req.id]);
    });
    const ev = await as(c, C(), () => c.query(`select kind, body from request_events where request_id = $1 order by id`, [req.id]));
    const kinds = ev.rows.map((r) => r.kind);
    expect(kinds).toContain("creada");
    expect(kinds).toContain("estado");
    expect(ev.rows.map((r) => r.body)).not.toContain("Cliente parece indeciso");
    const all = await as(c, STAFF(), () => c.query(`select kind from request_events where request_id = $1`, [req.id]));
    expect(all.rows.map((r) => r.kind)).toEqual(expect.arrayContaining(["nota_privada", "etapa", "asignacion"]));
    const tamper = await as(c, C(), () => c.query(`update service_requests set status = 'completada' where id = $1`, [req.id]));
    expect(tamper.rowCount).toBe(0);

    const q = await as(c, STAFF(), async () => {
      const r = await c.query(
        `insert into quotes(request_id, client_user_id, client_name, service, title, currency, tax_label, tax_rate) values ($1, $2, 'Cliente C', 'remodelacion', 'Remodelación de cocina', 'DOP', 'ITBIS', 0.18) returning id`,
        [req.id, u.client],
      );
      const id = r.rows[0].id;
      await c.query(`insert into quote_items(quote_id, description, quantity, unit, unit_price) values ($1, 'Demolición', 1, 'global', 15000), ($1, 'Gabinetes', 3, 'ml', 20000)`, [id]);
      return id;
    });
    const hidden = await as(c, C(), () => c.query(`select * from quotes where id = $1`, [q]));
    expect(hidden.rowCount).toBe(0); // borrador no visible al cliente
    await as(c, STAFF(), () => c.query(`update quotes set status = 'enviada', valid_until = current_date + 15 where id = $1`, [q]));
    const tot = await as(c, C(), () => c.query(`select subtotal, tax, total from quote_totals where quote_id = $1`, [q]));
    expect(tot.rows[0]).toEqual({ subtotal: "75000.00", tax: "13500.00", total: "88500.00" });
    await expectError(as(c, STAFF(), () => c.query(`update quote_items set unit_price = 1 where quote_id = $1`, [q])), /nueva versión/);
    await expectError(as(c, B(), () => c.query(`select respond_quote($1, true, 'acepto')`, [q])), /No autorizado/);
    const res = await as(c, C(), () => c.query(`select respond_quote($1, true, 'De acuerdo') s`, [q]));
    expect(res.rows[0].s).toBe("aceptada");
    const hist = await as(c, C(), () => c.query(`select action from quote_events where quote_id = $1 order by id`, [q]));
    expect(hist.rows.map((r) => r.action)).toEqual(["enviada", "aceptada"]);
  });
});

describe("Las validaciones no se eluden llamando a la API", () => {
  it("inserción directa de solicitudes y eventos está denegada", async () => {
    await expectError(
      as(c, "anon", () =>
        c.query(`insert into service_requests(kind, contact_name, contact_email, contact_consent) values ('contacto', 'X', 'x@x.do', true)`),
      ),
      /permission denied/,
    );
    await expectError(
      as(c, C(), () =>
        c.query(`insert into service_requests(kind, contact_name, contact_email, contact_consent) values ('contacto', 'X', 'x@x.do', true)`),
      ),
      /permission denied/,
    );
  });

  it("servicio legal deshabilitado no acepta solicitudes", async () => {
    await expectError(
      as(c, "anon", () =>
        c.query(`select create_service_request('legal', 'Ana', 'ana2@test.do', null, 'correo', 'x', '{"service_code":"deslinde"}', null, null, true, false, 'v1')`),
      ),
      /no está habilitado/,
    );
  });

  it("solicitud legal con varios servicios exige que todos estén habilitados", async () => {
    await c.query(`update legal_services set enabled = true, responsible_professional = 'Prueba' where code = 'contrato_alquiler'`);
    await expectError(
      as(c, "anon", () =>
        c.query(`select create_service_request('legal', 'Ana', 'ana3@test.do', null, 'correo', 'x', '{"service_code":"contrato_alquiler","service_codes":["contrato_alquiler","deslinde"]}', null, null, true, false, 'v1')`),
      ),
      /no está habilitado/,
    );
    const ok = await as(c, "anon", () =>
      c.query(`select create_service_request('legal', 'Ana', 'ana3@test.do', null, 'correo', 'x', '{"service_code":"contrato_alquiler","service_codes":["contrato_alquiler"]}', null, null, true, false, 'v1') as r`),
    );
    expect(ok.rows[0].r.number).toMatch(/^SOL-/);
    await c.query(`select 1`);
  });

  it("límite de solicitudes por contacto", async () => {
    const call = () =>
      as(c, "anon", () =>
        c.query(`select create_service_request('contacto', 'Spam', 'spam@test.do', null, 'correo', 'x', '{}', null, null, true, false, 'v1')`),
      );
    for (let i = 0; i < 6; i++) await call();
    await expectError(call(), /Demasiadas/);
  });

  it("un vendedor no se cambia el plan ni modifica campos de revisión", async () => {
    const plan = await as(c, A(), () => c.query(`update licenses set active_listing_quota = 999 where holder_user_id = $1`, [u.sellerA]));
    expect(plan.rowCount).toBe(0);
    const d = await newDraft(A(), "Borrador para campos reservados");
    await expectError(
      as(c, A(), () => c.query(`update properties set documents_reviewed_at = current_date where id = $1`, [d])),
      /reservado/,
    );
    await expectError(as(c, A(), () => c.query(`update profiles set identity_reviewed_at = now() where id = $1`, [u.sellerA])));
  });
});
