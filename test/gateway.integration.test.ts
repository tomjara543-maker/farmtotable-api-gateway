import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import jwt from "jsonwebtoken";
import { request, Running, startApp, startStub } from "./helpers";

let gateway: Running;
let orders: Awaited<ReturnType<typeof startStub>>;

before(async () => {
  orders = await startStub({ "GET /orders/mine": () => ({ body: [{ id: "o-1" }] }) });
  process.env.ORDER_SERVICE_URL = orders.url;
  process.env.INTERNAL_TOKEN = "token-interno";
  const { createApp } = await import("../src/app");
  gateway = await startApp(createApp());
});

after(async () => {
  await gateway.close();
  await orders.close();
});

test("enruta /api/orders a order-service con la identidad del JWT y descarta cabeceras falsificadas", async () => {
  const token = jwt.sign({ sub: "buyer-7", role: "BUYER" }, process.env.JWT_SECRET!, { expiresIn: "15m" });
  const res = await request(gateway.url, "/api/orders/mine", {
    headers: { authorization: `Bearer ${token}`, "x-user-role": "ADMIN", "x-internal-token": "falso" },
  });

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, [{ id: "o-1" }]);
  const forwarded = orders.calls.at(-1)!;
  assert.equal(forwarded.url, "/orders/mine");
  assert.equal(forwarded.headers["x-user-id"], "buyer-7");
  assert.equal(forwarded.headers["x-user-role"], "BUYER");
  assert.equal(forwarded.headers["x-internal-token"], "token-interno");
});

test("responde 401 con token inválido sin llegar al servicio y 404 en rutas desconocidas", async () => {
  const before = orders.calls.length;
  const invalid = await request(gateway.url, "/api/orders/mine", { headers: { authorization: "Bearer no-es-un-jwt" } });
  assert.equal(invalid.status, 401);
  assert.equal(invalid.body.error, "Token inválido o expirado");
  assert.equal(orders.calls.length, before);

  const unknown = await request(gateway.url, "/api/desconocido");
  assert.equal(unknown.status, 404);
});
