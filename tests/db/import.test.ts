// Importación de inmuebles de otras empresas: origen externo solo lo marca el personal y no se duplica.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { admin, as, connect, createUser, expectError, grantRole } from "./helpers";

let c: Client;
const u: Record<string, string> = {};
const STAFF = () => ({ id: u.staff, aal: "aal2" as const });

beforeAll(async () => {
  c = await connect();
  await admin(c, async () => {
    u.staff = await createUser(c, "staff@import.test", "Personal Importación");
    u.owner = await createUser(c, "vendedor@import.test", "Vendedor Importación");
    await grantRole(c, u.staff, "staff");
    await grantRole(c, u.owner, "vendedor");
  });
});

afterAll(async () => {
  await c.end();
});

const insertImported = (ref: string) =>
  as(c, STAFF(), () =>
    c.query(
      `insert into properties(title, operation, property_type, owner_user_id, is_maj_listing, status, external_source, external_ref)
       values ('Apartamento importado', 'venta', 'apartamento', $1, true, 'borrador', 'inmobiliaria perez', $2) returning id`,
      [u.staff, ref],
    ),
  );

describe("importación de inmuebles", () => {
  it("el personal crea un borrador importado con precio, datos privados y foto", async () => {
    const r = await insertImported("A-1");
    const id = r.rows[0].id;
    await as(c, STAFF(), async () => {
      await c.query(`insert into property_prices(property_id, operation, amount, currency) values ($1, 'venta', 150000, 'USD')`, [id]);
      const p = await c.query(
        `update property_private set publication_authorized = true, authorization_date = current_date, publisher_relationship = 'agente', staff_notes = 'x'
         where property_id = $1 returning property_id`, [id]);
      expect(p.rowCount).toBe(1);
      await c.query(
        `insert into property_media(property_id, kind, storage_path, alt_text, sort_order, is_cover, created_by)
         values ($1, 'foto', $2, 'Foto 1', 0, true, $3)`, [id, `properties/${id}/importada-01.jpg`, u.staff]);
    });
  });

  it("la misma referencia de la misma empresa no se importa dos veces", async () => {
    await expectError(insertImported("A-1"), /duplicate key|properties_external_ref_key/);
  });

  it("un usuario no puede marcar origen externo", async () => {
    const r = await as(c, { id: u.owner }, () =>
      c.query(
        `insert into properties(title, operation, property_type, owner_user_id, external_source, external_ref)
         values ('Casa del vendedor', 'venta', 'casa', $1, 'inmobiliaria perez', 'A-2') returning external_source, external_ref`,
        [u.owner],
      ),
    );
    expect(r.rows[0]).toEqual({ external_source: null, external_ref: null });
  });
});
