import { afterAll, beforeAll, it } from "vitest";
import type { Client } from "pg";
import { as, connect, createUser, expectError } from "./helpers";

let c: Client;
beforeAll(async () => {
  c = await connect();
});
afterAll(async () => c.end());

it("limita mensajes por minuto y reportes sobre publicaciones no visibles", async () => {
  const u = await createUser(c, `spam-${Date.now()}@test.do`);
  // conversación creada por superusuario para la prueba
  const conv = (await c.query(`insert into conversations(subject, created_by) values ('Prueba', $1) returning id`, [u])).rows[0].id;
  await c.query(`insert into conversation_participants(conversation_id, user_id, participant_role) values ($1, $2, 'cliente')`, [conv, u]);
  await as(c, { id: u }, async () => {
    for (let i = 0; i < 20; i++) await c.query(`insert into messages(conversation_id, sender_id, body) values ($1, $2, 'hola')`, [conv, u]);
  });
  await expectError(as(c, { id: u }, () => c.query(`insert into messages(conversation_id, sender_id, body) values ($1, $2, 'otra')`, [conv, u])), /rápido/);
  await expectError(
    as(c, "anon", () => c.query(`insert into property_reports(property_id, reason) values (gen_random_uuid(), 'fraude')`)),
  );
});
