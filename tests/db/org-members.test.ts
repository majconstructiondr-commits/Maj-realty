// Alta de miembros por correo (sin revelar cuentas), directorio de miembros, uso de cuota y estadísticas.
// Requiere PostgreSQL local preparado con: npm run db:test:reset
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { admin, as, connect, createUser, expectError, grantRole } from "./helpers";

let c: Client;
const u: Record<string, string> = {};
let org: string;
let pendingOrg: string;
let orgPlan: string;
let indPlan: string;

const STAFF = () => ({ id: u.staff, aal: "aal2" as const });
const actor = (k: string) => ({ id: u[k] });

async function addByEmail(who: string, orgId: string, email: string, role = "agente") {
  const r = await as(c, actor(who), () =>
    c.query(`select public.add_org_member_by_email($1, $2, $3, true, false, false, true) as ok`, [orgId, email, role]),
  );
  return r.rows[0].ok as boolean;
}

beforeAll(async () => {
  c = await connect();
  await admin(c, async () => {
    u.staff = await createUser(c, "staff@org.test", "Personal Org");
    u.gestor = await createUser(c, "gestor@org.test", "Gestora Agencia");
    u.agente = await createUser(c, "agente@org.test", "Agente Uno");
    u.nuevo = await createUser(c, "Nuevo.Miembro@org.test", "Nuevo Miembro");
    u.extra = await createUser(c, "extra@org.test", "Extra");
    u.outsider = await createUser(c, "fuera@org.test", "Ajeno");
    u.pendGestor = await createUser(c, "pendiente@org.test", "Gestor Pendiente");
    u.suspended = await createUser(c, "suspendido@org.test", "Suspendido");
    await grantRole(c, u.staff, "admin");
    await grantRole(c, u.gestor, "agencia");
    orgPlan = (await c.query(`select id from plans where code = 'agencia'`)).rows[0].id;
    indPlan = (await c.query(`select id from plans where code = 'individual'`)).rows[0].id;
  });
  await as(c, STAFF(), () => c.query(`update public.profiles set is_suspended = true where id = $1`, [u.suspended]));

  // La gestora crea su agencia (pendiente) y se registra como gestora inicial.
  org = await as(c, actor("gestor"), async () => {
    const o = await c.query(`insert into organizations(name, created_by) values ('Agencia Prueba', $1) returning id`, [u.gestor]);
    await c.query(`insert into organization_members(organization_id, user_id, member_role) values ($1, $2, 'gestor')`, [o.rows[0].id, u.gestor]);
    return o.rows[0].id as string;
  });
  pendingOrg = await as(c, actor("pendGestor"), async () => {
    const o = await c.query(`insert into organizations(name, created_by) values ('Agencia Pendiente', $1) returning id`, [u.pendGestor]);
    await c.query(`insert into organization_members(organization_id, user_id, member_role) values ($1, $2, 'gestor')`, [o.rows[0].id, u.pendGestor]);
    return o.rows[0].id as string;
  });
});

afterAll(async () => {
  await c.end();
});

describe("add_org_member_by_email", () => {
  it("una agencia pendiente no puede añadir miembros", async () => {
    await expectError(addByEmail("pendGestor", pendingOrg, "agente@org.test"), /activa/);
  });

  it("solo quien gestiona miembros puede llamarla", async () => {
    await as(c, STAFF(), () => c.query(`update organizations set status = 'activa' where id = $1`, [org]));
    await expectError(addByEmail("outsider", org, "agente@org.test"), /No autorizado/);
    await expectError(as(c, "anon", () => c.query(`select public.add_org_member_by_email($1, 'agente@org.test')`, [org])));
  });

  it("respeta el máximo de miembros de la licencia", async () => {
    await expectError(addByEmail("gestor", org, "agente@org.test"), /permite 1 miembro/);
    // Con el cupo lleno, un correo sin cuenta recibe la misma respuesta: no se revela si existe.
    await expectError(addByEmail("gestor", org, "no-existe@org.test"), /permite 1 miembro/);
    await as(c, STAFF(), () =>
      c.query(
        `insert into licenses(organization_id, plan_id, status, starts_at, ends_at, active_listing_quota, max_members)
         values ($1, $2, 'activa', now() - interval '1 day', now() + interval '1 year', 5, 4)`,
        [org, orgPlan],
      ),
    );
  });

  it("añade una cuenta existente (sin distinguir mayúsculas) con los permisos indicados", async () => {
    expect(await addByEmail("gestor", org, "agente@org.test")).toBe(true);
    expect(await addByEmail("gestor", org, "  NUEVO.miembro@ORG.test ")).toBe(true);
    const r = await admin(c, () =>
      c.query(`select member_role, can_publish, can_view_leads, can_manage_members, added_by from organization_members where organization_id = $1 and user_id = $2`, [org, u.nuevo]),
    );
    expect(r.rows[0]).toMatchObject({ member_role: "agente", can_publish: true, can_view_leads: true, can_manage_members: false, added_by: u.gestor });
  });

  it("devuelve false (sin error ni detalle) para correos sin cuenta, cuentas suspendidas o ya miembros", async () => {
    expect(await addByEmail("gestor", org, "noexiste@org.test")).toBe(false);
    expect(await addByEmail("gestor", org, "suspendido@org.test")).toBe(false);
    expect(await addByEmail("gestor", org, "agente@org.test")).toBe(false);
    const r = await admin(c, () => c.query(`select count(*)::int n from organization_members where organization_id = $1`, [org]));
    expect(r.rows[0].n).toBe(3);
  });

  it("valida rol y formato de correo", async () => {
    await expectError(addByEmail("gestor", org, "extra@org.test", "duenio"), /Rol/);
    await expectError(addByEmail("gestor", org, "sin-arroba"), /Correo/);
  });

  it("un agente sin permiso de gestionar no puede añadir", async () => {
    await expectError(addByEmail("agente", org, "extra@org.test"), /No autorizado/);
  });

  it("los intentos no son visibles para usuarios y se limitan por hora", async () => {
    const seen = await as(c, actor("gestor"), () => c.query(`select count(*)::int n from org_member_lookup_attempts`));
    expect(seen.rows[0].n).toBe(0);
    await expectError(as(c, actor("gestor"), () => c.query(`insert into org_member_lookup_attempts(actor_id, organization_id, found) values ($1, $2, false)`, [u.gestor, org])));
    const staffSees = await as(c, STAFF(), () => c.query(`select count(*)::int n from org_member_lookup_attempts where actor_id = $1`, [u.gestor]));
    expect(staffSees.rows[0].n).toBeGreaterThan(0);
    await admin(c, () =>
      c.query(`insert into org_member_lookup_attempts(actor_id, organization_id, found) select $1, $2, false from generate_series(1, 20)`, [u.gestor, org]),
    );
    await expectError(addByEmail("gestor", org, "extra@org.test"), /Demasiados intentos/);
    await admin(c, () => c.query(`delete from org_member_lookup_attempts where actor_id = $1`, [u.gestor]));
  });
});

describe("org_member_directory", () => {
  it("quien gestiona ve nombres y correos de todos; un agente solo su fila; un ajeno nada", async () => {
    const g = await as(c, actor("gestor"), () => c.query(`select * from public.org_member_directory($1)`, [org]));
    expect(g.rows.map((r) => String(r.email).toLowerCase()).sort()).toEqual(["agente@org.test", "gestor@org.test", "nuevo.miembro@org.test"]);
    const a = await as(c, actor("agente"), () => c.query(`select * from public.org_member_directory($1)`, [org]));
    expect(a.rows.map((r) => r.user_id)).toEqual([u.agente]);
    const o = await as(c, actor("outsider"), () => c.query(`select * from public.org_member_directory($1)`, [org]));
    expect(o.rowCount).toBe(0);
  });
});

describe("license_usage y listing_event_counts", () => {
  let lic: string;
  let prop: string;

  beforeAll(async () => {
    lic = await as(c, STAFF(), async () =>
      (
        await c.query(
          `insert into licenses(holder_user_id, plan_id, status, starts_at, ends_at, active_listing_quota)
           values ($1, $2, 'activa', now() - interval '1 day', now() + interval '1 year', 3) returning id`,
          [u.extra, indPlan],
        )
      ).rows[0].id,
    );
    prop = await as(c, actor("extra"), async () => {
      const r = await c.query(
        `insert into properties(title, operation, property_type, owner_user_id, description, province, municipality)
         values ('Apartamento para estadísticas', 'venta', 'apartamento', $1, 'Descripción suficientemente larga para la revisión.', 'Santiago', 'Santiago')
         returning id`,
        [u.extra],
      );
      const id = r.rows[0].id as string;
      await c.query(`insert into property_prices(property_id, operation, amount, currency) values ($1, 'venta', null, 'DOP')`, [id]);
      await c.query(`insert into property_media(property_id, kind, storage_path, alt_text) values ($1, 'foto', $2, 'Fachada')`, [id, `properties/${id}/a.webp`]);
      await c.query(`update property_private set publication_authorized = true, authorization_date = current_date where property_id = $1`, [id]);
      await c.query(`update properties set status = 'en_revision' where id = $1`, [id]);
      return id;
    });
    await admin(c, () =>
      c.query(
        `insert into property_events(property_id, kind) values ($1, 'vista'), ($1, 'vista'), ($1, 'clic_whatsapp'), ($1, 'compartir')`,
        [prop],
      ),
    );
  });

  it("el titular ve el uso de su cuota; otros usuarios reciben null", async () => {
    const mine = await as(c, actor("extra"), () => c.query(`select public.license_usage($1) n`, [lic]));
    expect(mine.rows[0].n).toBe(1);
    const other = await as(c, actor("outsider"), () => c.query(`select public.license_usage($1) n`, [lic]));
    expect(other.rows[0].n).toBeNull();
  });

  it("los miembros de una agencia ven el uso de la licencia de la agencia", async () => {
    const orgLic = await admin(c, () => c.query(`select id from licenses where organization_id = $1`, [org]));
    const r = await as(c, actor("agente"), () => c.query(`select public.license_usage($1) n`, [orgLic.rows[0].id]));
    expect(r.rows[0].n).toBe(0);
  });

  it("estadísticas agregadas solo para quien puede ver la publicación", async () => {
    const mine = await as(c, actor("extra"), () => c.query(`select * from public.listing_event_counts($1::uuid[])`, [[prop]]));
    expect(mine.rows[0]).toMatchObject({ property_id: prop, vistas: "2", clics_whatsapp: "1", compartidos: "1", favoritos: "0" });
    const other = await as(c, actor("outsider"), () => c.query(`select * from public.listing_event_counts($1::uuid[])`, [[prop]]));
    expect(other.rowCount).toBe(0);
    await expectError(as(c, "anon", () => c.query(`select * from public.listing_event_counts($1::uuid[])`, [[prop]])));
  });
});
