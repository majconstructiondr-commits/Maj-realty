// Supuestos del editor de publicaciones sobre la base de datos: edición directa en borrador,
// solicitudes de cambio en publicaciones activas, multimedia/documentos en activas y duplicado.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { admin, as, connect, createUser, expectError, grantRole } from "./helpers";
import { DUPLICATE_COLUMNS } from "../../src/lib/listing-editor/transitions";

let c: Client;
const u: Record<string, string> = {};
let prop: string;
const STAFF = () => ({ id: u.staff, aal: "aal2" as const });
const OWNER = () => ({ id: u.owner });

beforeAll(async () => {
  c = await connect();
  await admin(c, async () => {
    u.staff = await createUser(c, "staff@editor.test", "Personal Editor");
    u.owner = await createUser(c, "vendedor@editor.test", "Vendedor Editor");
    u.other = await createUser(c, "otro@editor.test", "Otro");
    await grantRole(c, u.staff, "admin");
    await grantRole(c, u.owner, "vendedor");
  });
  const plan = await admin(c, () => c.query(`select id from plans where code = 'individual'`));
  await as(c, STAFF(), () =>
    c.query(
      `insert into licenses(holder_user_id, plan_id, status, starts_at, ends_at, active_listing_quota)
       values ($1, $2, 'activa', now() - interval '1 day', now() + interval '1 year', 5)`,
      [u.owner, plan.rows[0].id],
    ),
  );
});

afterAll(async () => {
  await c.end();
});

describe("borrador: edición directa por pasos", () => {
  it("guarda distribución con cero, desconocido y no aplica; precios por upsert; datos privados", async () => {
    prop = await as(c, OWNER(), async () => {
      const r = await c.query(
        `insert into properties(title, operation, property_type, owner_user_id) values ('Casa para el editor', 'ambas', 'casa', $1) returning id`,
        [u.owner],
      );
      const id = r.rows[0].id as string;
      await c.query(
        `update properties set description = $2, province = 'Santiago', municipality = 'Santiago de los Caballeros',
           parking_spaces = 0, bedrooms = null, floor_number = null, na_fields = '{floor_number}', balcony = 'no_aplica',
           features = '{"piscina":{"v":"si"},"mascotas":{"v":"desconocido","d":"Consultar"}}'
         where id = $1`,
        [id, "Casa amplia con patio, marquesina y área de lavado techada."],
      );
      for (const op of ["venta", "renta"]) {
        await c.query(
          `insert into property_prices(property_id, operation, amount, currency, rent_period) values ($1, $2, null, 'DOP', $3)
           on conflict (property_id, operation) do update set amount = excluded.amount`,
          [id, op, op === "renta" ? "mensual" : null],
        );
      }
      await c.query(`insert into property_media(property_id, kind, storage_path, alt_text, width, height, is_cover, sort_order) values ($1, 'foto', $2, 'Fachada', 1600, 1200, true, 0)`, [id, `properties/${id}/fachada.webp`]);
      await c.query(`update property_private set street = 'Calle Sol', unit = null, exact_lat = 19.4512, exact_lng = -70.6971, publication_authorized = true, authorization_date = current_date where property_id = $1`, [id]);
      return id;
    });
    const r = await admin(c, () => c.query(`select parking_spaces, bedrooms, na_fields, approx_lat from properties where id = $1`, [prop]));
    expect(r.rows[0]).toMatchObject({ parking_spaces: 0, bedrooms: null, na_fields: ["floor_number"], approx_lat: "19.450" });
  });

  it("otro usuario no puede editar ni leer el borrador", async () => {
    const r = await as(c, { id: u.other }, () => c.query(`update properties set title = 'Intrusión total' where id = $1 returning id`, [prop]));
    expect(r.rowCount).toBe(0);
    await expectError(as(c, { id: u.other }, () => c.query(`select public.submit_property_change($1, '{"property":{"title":"X"}}')`, [prop])), /No autorizado/);
  });
});

describe("publicación activa: solicitud de cambio", () => {
  beforeAll(async () => {
    await as(c, OWNER(), () => c.query(`update properties set status = 'en_revision' where id = $1`, [prop]));
    await as(c, STAFF(), () => c.query(`update properties set status = 'publicado' where id = $1`, [prop]));
  });

  it("no admite edición directa del contenido, precios ni datos privados", async () => {
    await expectError(as(c, OWNER(), () => c.query(`update properties set title = 'Nuevo título' where id = $1`, [prop])), /solicitud de cambio/);
    await expectError(as(c, OWNER(), () => c.query(`update property_prices set amount = 1 where property_id = $1`, [prop])), /solicitud de cambio/);
    await expectError(as(c, OWNER(), () => c.query(`update property_private set unit = '2A' where property_id = $1`, [prop])), /solicitud de cambio/);
  });

  it("la fecha de disponibilidad sí se actualiza directamente", async () => {
    const r = await as(c, OWNER(), () => c.query(`update properties set available_from = '2026-12-01' where id = $1 returning available_from`, [prop]));
    expect(r.rowCount).toBe(1);
  });

  it("multimedia nueva, orden y portada se pueden cambiar (la nueva queda sin aprobar); documentos quedan pendientes", async () => {
    await as(c, OWNER(), async () => {
      await c.query(`insert into property_media(property_id, kind, storage_path, alt_text, width, height, sort_order, approved) values ($1, 'foto', $2, 'Cocina', 1600, 1200, 1, true)`, [prop, `properties/${prop}/cocina.webp`]);
      await c.query(`update property_media set sort_order = case when sort_order = 0 then 1 else 0 end where property_id = $1`, [prop]);
      await c.query(`update property_media set is_cover = false where property_id = $1 and is_cover`, [prop]);
      await c.query(`update property_media set is_cover = true where property_id = $1 and alt_text = 'Cocina'`, [prop]);
      await c.query(
        `insert into property_documents(property_id, doc_type, storage_path, file_name, mime_type, size_bytes) values ($1, 'titulo', $2, 'titulo.pdf', 'application/pdf', 1000)`,
        [prop, `properties/${prop}/titulo.pdf`],
      );
    });
    const m = await admin(c, () => c.query(`select alt_text, approved, is_cover from property_media where property_id = $1 order by sort_order`, [prop]));
    expect(m.rows).toEqual([
      { alt_text: "Cocina", approved: false, is_cover: true },
      { alt_text: "Fachada", approved: true, is_cover: false },
    ]);
    const d = await admin(c, () => c.query(`select review_status from property_documents where property_id = $1`, [prop]));
    expect(d.rows[0].review_status).toBe("pendiente");
  });

  it("la solicitud combinada se aplica completa al aprobarla y la versión publicada se mantiene mientras tanto", async () => {
    const changes = {
      property: { title: "Casa renovada para el editor", na_fields: [], floor_number: 1, features: { piscina: { v: "no" } } },
      private: { unit: "Casa 4" },
      prices: [
        { operation: "venta", amount: 9500000, currency: "DOP", negotiable: true, maintenance_amount: null, maintenance_currency: null, maintenance_included: "no_aplica", additional_costs: null, rent_period: null, deposit_amount: null, deposit_months: null, advance_months: null, min_term_months: null, delivery_conditions: "Inmediata" },
        { operation: "renta", amount: 55000, currency: "DOP", negotiable: false, maintenance_amount: 3000, maintenance_currency: "DOP", maintenance_included: "si", additional_costs: null, rent_period: "mensual", deposit_amount: null, deposit_months: 2, advance_months: 1, min_term_months: 12, delivery_conditions: null },
      ],
    };
    const req = await as(c, OWNER(), () => c.query(`select public.submit_property_change($1, $2::jsonb) id`, [prop, JSON.stringify(changes)]));
    const before = await as(c, "anon", () => c.query(`select title from catalog where id = $1`, [prop]));
    expect(before.rows[0].title).toBe("Casa para el editor");
    const pending = await as(c, OWNER(), () => c.query(`select status, changes from property_change_requests where id = $1`, [req.rows[0].id]));
    expect(pending.rows[0].status).toBe("pendiente");

    await as(c, STAFF(), () => c.query(`select public.review_property_change($1, true, null)`, [req.rows[0].id]));
    const after = await admin(c, () =>
      c.query(
        `select p.title, p.floor_number, p.na_fields, p.features, pr.unit,
                (select json_agg(json_build_object('op', operation, 'amount', amount, 'dep', deposit_months, 'period', rent_period) order by operation) from property_prices where property_id = p.id) prices
         from properties p join property_private pr on pr.property_id = p.id where p.id = $1`,
        [prop],
      ),
    );
    expect(after.rows[0]).toMatchObject({ title: "Casa renovada para el editor", floor_number: 1, na_fields: [], features: { piscina: { v: "no" } }, unit: "Casa 4" });
    expect(after.rows[0].prices).toEqual([
      { op: "renta", amount: 55000, dep: 2, period: "mensual" },
      { op: "venta", amount: 9500000, dep: null, period: null },
    ]);
  });
});

describe("duplicar como borrador", () => {
  it("copia columnas permitidas y precios a un borrador nuevo del usuario", async () => {
    const cols = DUPLICATE_COLUMNS.join(", ");
    const id = await as(c, OWNER(), async () => {
      const r = await c.query(
        `insert into properties(${cols}, title, owner_user_id)
         select ${cols}, 'Copia de ' || title, $2 from properties where id = $1 returning id, status, license_id`,
        [prop, u.owner],
      );
      expect(r.rows[0]).toMatchObject({ status: "borrador", license_id: null });
      await c.query(
        `insert into property_prices(property_id, operation, amount, currency, negotiable, maintenance_amount, maintenance_currency, maintenance_included,
           additional_costs, rent_period, deposit_amount, deposit_months, advance_months, min_term_months, delivery_conditions)
         select $2, operation, amount, currency, negotiable, maintenance_amount, maintenance_currency, maintenance_included,
           additional_costs, rent_period, deposit_amount, deposit_months, advance_months, min_term_months, delivery_conditions
         from property_prices where property_id = $1`,
        [prop, r.rows[0].id],
      );
      return r.rows[0].id as string;
    });
    const r = await admin(c, () =>
      c.query(`select (select count(*)::int from property_prices where property_id = $1) prices, (select count(*)::int from property_media where property_id = $1) media`, [id]),
    );
    expect(r.rows[0]).toEqual({ prices: 2, media: 0 });
  });
});
