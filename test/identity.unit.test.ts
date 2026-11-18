import assert from "node:assert/strict";
import { test } from "node:test";
import jwt from "jsonwebtoken";
import { resolveIdentity } from "../src/app";

const SECRET = "secreto-de-pruebas";

test("resolveIdentity extrae id y rol de un Bearer token válido y ignora peticiones sin token", () => {
  const token = jwt.sign({ sub: "u-1", role: "BUYER", email: "ana@finca.co" }, SECRET, { expiresIn: "15m" });

  assert.deepEqual(resolveIdentity(`Bearer ${token}`, SECRET), { id: "u-1", role: "BUYER" });
  assert.equal(resolveIdentity(undefined, SECRET), null);
  assert.equal(resolveIdentity(`Basic ${token}`, SECRET), null);
});

test("resolveIdentity rechaza tokens con otra firma, expirados o sin rol", () => {
  const foreign = jwt.sign({ sub: "u-1", role: "ADMIN" }, "otro-secreto");
  const expired = jwt.sign({ sub: "u-1", role: "BUYER", exp: Math.floor(Date.now() / 1000) - 60 }, SECRET);
  const noRole = jwt.sign({ sub: "u-1" }, SECRET);

  assert.throws(() => resolveIdentity(`Bearer ${foreign}`, SECRET), /invalid signature/);
  assert.throws(() => resolveIdentity(`Bearer ${expired}`, SECRET), /jwt expired/);
  assert.throws(() => resolveIdentity(`Bearer ${noRole}`, SECRET), /payload incompleto/);
});
