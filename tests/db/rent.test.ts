// Cobro de rentas: solicitud del propietario, cuotas, pago del inquilino y confirmación de MAJ con comisión.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { admin, as, connect, createUser, expectError, grantRole } from "./helpers";

let c: Client;
const u: Record<string, string> = {};
let contract: string;
let lease: string;
let charge: string;
const STAFF = () => ({ id: u.staff, aal: "aal2" as const });
const OWNER = () => ({ id: u.owner });
const TENANT = () => ({ id: u.tenant });

beforeAll(async () => {
  c = await connect();
  await admin(c, async () => {
    u.staff = await createUser(c, "staff@rentas.test", "Personal Rentas");
    u.owner = await createUser(c, "duena@rentas.test", "Dueña");
    u.tenant = await createUser(c, "inquilino@rentas.test", "Inquilino");
    u.other = await createUser(c, "otro@rentas.test", "Otro");
    await grantRole(c, u.staff, "staff");
    await grantRole(c, u.owner, "propietario");
  });
  const p = await as(c, OWNER(), () =>
    c.query(`insert into properties(title, operation, property_type, owner_user_id) values ('Apartamento para renta', 'renta', 'apartamento', $1) returning id`, [u.owner]),
  );
  u.property = p.rows[0].id;
});

afterAll(async () => {
  await c.end();
});

describe("cobro de rentas", () => {
  it("solo el titular pide el cobro de renta de su publicación", async () => {
    await expectError(
      as(c, { id: u.other }, () =>
        c.query(`select request_rent_collection($1, 'Inquilino', 'inquilino@rentas.test', null, 30000, 'DOP', 5::smallint, '2026-10-01', null)`, [u.property]),
      ),
      /titular/,
    );
    const r = await as(c, OWNER(), () =>
      c.query(`select request_rent_collection($1, 'Inquilino', 'Inquilino@Rentas.test', null, 30000, 'DOP', 5::smallint, '2026-10-01', 'Apto 2B') as id`, [u.property]),
    );
    contract = r.rows[0].id;
    const l = await as(c, OWNER(), () => c.query(`select id, fee_percent, tenant_email from rental_leases where contract_id = $1`, [contract]));
    expect(Number(l.rows[0].fee_percent)).toBe(5);
    expect(l.rows[0].tenant_email).toBe("inquilino@rentas.test");
    lease = l.rows[0].id;
    await expectError(
      as(c, OWNER(), () => c.query(`select request_rent_collection($1, 'Otro', 'x@y.do', null, 1, 'DOP', 1::smallint, '2026-10-01', null)`, [u.property])),
      /ya tiene/,
    );
  });

  it("no se generan cuotas hasta que MAJ activa el contrato", async () => {
    const n0 = await as(c, STAFF(), () => c.query(`select generate_rent_charges('2026-10') as n`));
    expect(n0.rows[0].n).toBe(0);
    await as(c, STAFF(), () => c.query(`update management_contracts set status = 'activo' where id = $1`, [contract]));
    const n1 = await as(c, STAFF(), () => c.query(`select generate_rent_charges('2026-10') as n`));
    expect(n1.rows[0].n).toBe(1);
    const again = await as(c, STAFF(), () => c.query(`select generate_rent_charges('2026-10') as n`));
    expect(again.rows[0].n).toBe(0);
    await expectError(as(c, OWNER(), () => c.query(`select generate_rent_charges('2026-11')`)), /No autorizado/);
    const ch = await as(c, STAFF(), () => c.query(`select id, due_date::text, amount from rent_charges where lease_id = $1`, [lease]));
    expect(ch.rows[0].due_date).toBe("2026-10-05");
    charge = ch.rows[0].id;
  });

  it("el inquilino se vincula por su correo confirmado y ve su cuota; otros no", async () => {
    const before = await as(c, TENANT(), () => c.query(`select count(*)::int as n from rent_charges`));
    expect(before.rows[0].n).toBe(0);
    const linked = await as(c, TENANT(), () => c.query(`select link_my_leases() as n`));
    expect(linked.rows[0].n).toBe(1);
    const after = await as(c, TENANT(), () => c.query(`select count(*)::int as n from rent_charges`));
    expect(after.rows[0].n).toBe(1);
    const other = await as(c, { id: u.other }, () => c.query(`select count(*)::int as n from rent_charges`));
    expect(other.rows[0].n).toBe(0);
  });

  it("solo el inquilino informa el pago, y la cuota pasa a revisión", async () => {
    await expectError(
      as(c, { id: u.other }, () =>
        c.query(`insert into rent_payments(charge_id, submitted_by, amount, currency, method, reference) values ($1, $2, 30000, 'DOP', 'transferencia', 'X')`, [charge, u.other]),
      ),
      /no es suya/,
    );
    await as(c, TENANT(), () =>
      c.query(`insert into rent_payments(charge_id, submitted_by, amount, currency, method, reference, status) values ($1, $2, 30000, 'DOP', 'transferencia', 'TRX-1', 'confirmado')`, [charge, u.tenant]),
    );
    const st = await as(c, TENANT(), () => c.query(`select c.status, p.status as pay from rent_charges c join rent_payments p on p.charge_id = c.id where c.id = $1`, [charge]));
    expect(st.rows[0]).toEqual({ status: "en_revision", pay: "pendiente" });
    await expectError(
      as(c, TENANT(), () => c.query(`insert into rent_payments(charge_id, submitted_by, amount, currency, method, reference) values ($1, $2, 30000, 'DOP', 'transferencia', 'TRX-2')`, [charge, u.tenant])),
      /no está pendiente/,
    );
    const upd = await as(c, TENANT(), () => c.query(`update rent_payments set status = 'confirmado' where charge_id = $1`, [charge]));
    expect(upd.rowCount).toBe(0);
  });

  it("al rechazar vuelve a pendiente; al confirmar registra renta y comisión del 5%", async () => {
    const pay1 = await as(c, STAFF(), () => c.query(`select id from rent_payments where charge_id = $1`, [charge]));
    await expectError(as(c, STAFF(), () => c.query(`select review_rent_payment($1, false, '')`, [pay1.rows[0].id])), /motivo/);
    await as(c, STAFF(), () => c.query(`select review_rent_payment($1, false, 'Comprobante ilegible')`, [pay1.rows[0].id]));
    const st = await as(c, STAFF(), () => c.query(`select status from rent_charges where id = $1`, [charge]));
    expect(st.rows[0].status).toBe("pendiente");

    const pay2 = await as(c, TENANT(), () =>
      c.query(`insert into rent_payments(charge_id, submitted_by, amount, currency, method, reference) values ($1, $2, 30000, 'DOP', 'transferencia', 'TRX-3') returning id`, [charge, u.tenant]),
    );
    await expectError(as(c, OWNER(), () => c.query(`select review_rent_payment($1, true, null)`, [pay2.rows[0].id])), /Solo el personal/);
    await as(c, STAFF(), () => c.query(`select review_rent_payment($1, true, null)`, [pay2.rows[0].id]));
    const done = await as(c, OWNER(), () => c.query(`select status, fee_amount::float as fee, owner_amount::float as owner from rent_charges where id = $1`, [charge]));
    expect(done.rows[0]).toEqual({ status: "pagado", fee: 1500, owner: 28500 });
    const mv = await as(c, OWNER(), () => c.query(`select kind, amount::float as amount from management_movements where contract_id = $1 order by kind`, [contract]));
    expect(mv.rows).toEqual([{ kind: "comision", amount: 1500 }, { kind: "renta_cobrada", amount: 30000 }]);
    const notes = await as(c, OWNER(), () => c.query(`select count(*)::int as n from notifications where kind = 'renta'`));
    expect(notes.rows[0].n).toBeGreaterThan(0);
  });

  it("tareas diarias: recordatorio y aviso de atraso una sola vez", async () => {
    await as(c, STAFF(), () =>
      c.query(`insert into rent_charges(lease_id, period, due_date, amount, currency) values ($1, '2026-09', current_date - 2, 30000, 'DOP')`, [lease]),
    );
    const r1 = await admin(c, () => c.query(`select run_rent_jobs() as r`));
    expect(r1.rows[0].r.avisos_atraso).toBe(1);
    const r2 = await admin(c, () => c.query(`select run_rent_jobs() as r`));
    expect(r2.rows[0].r.avisos_atraso).toBe(0);
    const n = await as(c, TENANT(), () => c.query(`select count(*)::int as n from notifications where title like '%atrasada'`));
    expect(n.rows[0].n).toBe(1);
  });
});
