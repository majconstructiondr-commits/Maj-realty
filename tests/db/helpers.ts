// Utilidades para probar políticas y reglas de la base de datos en un PostgreSQL local
// con la simulación de Supabase (supabase/tests/supabase-shim.sql).
import { Client } from "pg";

export const DB_URL = process.env.TEST_DATABASE_URL ?? "postgresql://postgres@localhost:54329/maj_test?host=/tmp";

export async function connect() {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  return c;
}

export type Actor = { id?: string; aal?: "aal1" | "aal2" } | "anon";

/** Ejecuta fn dentro de una transacción con el rol y las credenciales simuladas del actor. */
export async function as<T>(c: Client, actor: Actor, fn: () => Promise<T>): Promise<T> {
  await c.query("begin");
  try {
    if (actor === "anon") {
      await c.query("set local role anon");
      await c.query(`select set_config('request.jwt.claims', '{"role":"anon"}', true)`);
    } else {
      await c.query("set local role authenticated");
      await c.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: actor.id, role: "authenticated", aal: actor.aal ?? "aal1" }),
      ]);
    }
    const out = await fn();
    await c.query("commit");
    return out;
  } catch (e) {
    await c.query("rollback");
    throw e;
  }
}

/** Ejecuta como superusuario (preparación de datos). */
export async function admin<T>(c: Client, fn: () => Promise<T>): Promise<T> {
  await c.query("reset role");
  await c.query(`select set_config('request.jwt.claims', '', false)`);
  return fn();
}

export async function createUser(c: Client, email: string, name = "Usuario Prueba"): Promise<string> {
  const r = await c.query(
    "insert into auth.users(email, raw_user_meta_data, email_confirmed_at) values ($1, $2, now()) returning id",
    [email, JSON.stringify({ full_name: name })],
  );
  return r.rows[0].id;
}

export async function grantRole(c: Client, userId: string, role: string) {
  await c.query("insert into public.user_roles(user_id, role) values ($1, $2) on conflict do nothing", [userId, role]);
}

export async function expectError(p: Promise<unknown>, match?: RegExp) {
  try {
    await p;
  } catch (e) {
    const msg = (e as Error).message;
    if (match && !match.test(msg)) throw new Error(`Error inesperado: ${msg}`);
    return msg;
  }
  throw new Error("Se esperaba un error y la operación tuvo éxito");
}
