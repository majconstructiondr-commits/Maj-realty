// Funciones del panel administrativo: solo personal con MFA; nunca exponen correos a otros usuarios.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { admin, as, connect, createUser, expectError, grantRole } from "./helpers";

let c: Client;
const u: Record<string, string> = {};
const STAFF = () => ({ id: u.staff, aal: "aal2" as const });

beforeAll(async () => {
  c = await connect();
  await admin(c, async () => {
    u.staff = await createUser(c, "panel-staff@maj.test", "Personal Panel");
    u.client = await createUser(c, "panel-cliente@test.do", "Cliente Panel");
    await grantRole(c, u.staff, "staff");
  });
});

afterAll(async () => {
  await c.end();
});

describe("Herramientas del panel", () => {
  it("staff_find_user solo para personal con MFA", async () => {
    const r = await as(c, STAFF(), () => c.query("select * from public.staff_find_user($1)", ["  PANEL-CLIENTE@test.do "]));
    expect(r.rows[0].id).toBe(u.client);
    expect(r.rows[0].email).toBe("panel-cliente@test.do");
    await expectError(as(c, { id: u.staff, aal: "aal1" }, () => c.query("select * from public.staff_find_user('panel-cliente@test.do')")), /No autorizado/);
    await expectError(as(c, { id: u.client }, () => c.query("select * from public.staff_find_user('panel-staff@maj.test')")), /No autorizado/);
    await expectError(as(c, "anon", () => c.query("select * from public.staff_find_user('panel-staff@maj.test')")));
  });

  it("staff_user_labels y staff_user_directory exigen personal", async () => {
    const r = await as(c, STAFF(), () => c.query("select * from public.staff_user_labels($1::uuid[])", [[u.client, u.staff]]));
    expect(r.rows).toHaveLength(2);
    const d = await as(c, STAFF(), () => c.query("select * from public.staff_user_directory('panel-cliente', null, null, 10, 0)"));
    expect(d.rows).toHaveLength(1);
    expect(d.rows[0].roles).toContain("cliente");
    expect(Number(d.rows[0].total_count)).toBe(1);
    const byRole = await as(c, STAFF(), () => c.query("select * from public.staff_user_directory(null, 'staff', null, 10, 0)"));
    expect(byRole.rows.map((x) => x.id)).toContain(u.staff);
    await expectError(as(c, { id: u.client }, () => c.query("select * from public.staff_user_labels($1::uuid[])", [[u.staff]])), /No autorizado/);
    await expectError(as(c, { id: u.client }, () => c.query("select * from public.staff_user_directory(null, null, null, 10, 0)")), /No autorizado/);
  });

  it("staff_dashboard separa interés de cierres y agrupa importes por moneda", async () => {
    const r = await as(c, STAFF(), () => c.query("select public.staff_dashboard(30) d"));
    const d = r.rows[0].d;
    for (const k of ["views", "whatsapp_clicks", "saved_inquiries", "closed_properties", "closed_requests", "quotes_accepted", "unattended_requests"]) {
      expect(d).toHaveProperty(k);
    }
    expect(typeof d.quotes_accepted).toBe("object");
    await expectError(as(c, { id: u.client }, () => c.query("select public.staff_dashboard(30)")), /No autorizado/);
  });
});
