// El vigilante avisa sólo cuando algo cambia de estado, y no por un parpadeo.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Watch, defaultChecks } from "../dist/watch.js";

const sink = () => {
  const sent = [];
  return { sent, out: { send: (...a) => (sent.push(a), true) } };
};
const flaky = (results) => ({ name: "Forgejo", run: async () => results.shift() ?? null });

describe("watch", () => {
  it("no avisa por un solo fallo", async () => {
    const { sent, out } = sink();
    const w = new Watch([flaky(["no responde", null])], out);
    await w.tick();
    await w.tick();
    assert.equal(sent.length, 0);
  });

  it("avisa a la segunda revisión mala, una sola vez, y avisa cuando vuelve", async () => {
    const { sent, out } = sink();
    const w = new Watch([flaky(["no responde", "no responde", "no responde", null, null])], out);
    for (let i = 0; i < 5; i++) await w.tick();
    assert.equal(sent.length, 2);
    assert.deepEqual(sent[0].slice(0, 3), ["system", "error", "Forgejo: con problemas"]);
    assert.equal(sent[0][4].text, "no responde");
    assert.deepEqual(sent[1].slice(0, 3), ["system", "info", "Forgejo: recuperado"]);
  });

  it("arrancar bien no dispara 'recuperado'", async () => {
    const { sent, out } = sink();
    const w = new Watch([flaky([null, null])], out);
    await w.tick();
    await w.tick();
    assert.equal(sent.length, 0);
  });

  it("una revisión que revienta cuenta como problema, no tira el vigilante", async () => {
    const { sent, out } = sink();
    const w = new Watch([{ name: "Runner", run: async () => { throw new Error("ECONNREFUSED"); } }], out);
    await w.tick();
    await w.tick();
    assert.equal(sent.length, 1);
    assert.match(sent[0][4].text, /ECONNREFUSED/);
  });

  it("revisa el disco con el umbral pedido", async () => {
    const fj = { find: async () => ({}), req: async () => [{ status: "idle" }] };
    const disk = (pct) => defaultChecks(fj, "/", pct).find((c) => c.name === "Disco");
    assert.match(await disk(1).run(), /usado/);
    assert.equal(await disk(101).run(), null);
    const runner = defaultChecks({ ...fj, req: async () => [{ status: "offline" }] }, "/").find((c) => c.name === "Runner");
    assert.match(await runner.run(), /runner/);
  });
});
