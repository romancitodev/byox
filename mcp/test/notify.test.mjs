// Avisos a Discord: sin red, con un fetch falso.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Notifier, clean } from "../dist/notify.js";

const URL_OK = "https://discord.com/api/webhooks/123456789012345678/abc_DEF-123";
const recorder = (replies = []) => {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    const r = replies.shift() ?? { status: 204 };
    return { ok: r.status < 300, status: r.status, headers: new Headers(), json: async () => r.json ?? {} };
  };
  return { calls, fetch };
};
const make = (o = {}, replies = []) => {
  const rec = recorder(replies);
  return { n: new Notifier({ url: URL_OK, gap: 0, fetch: rec.fetch, ...o }), calls: rec.calls };
};

describe("notify", () => {
  it("sin URL no hace nada", async () => {
    const { n, calls } = make({ url: "" });
    assert.equal(n.enabled, false);
    assert.equal(n.send("system", "info", "hola"), false);
    await n.flush(50);
    assert.equal(calls.length, 0);
  });

  it("rechaza URLs que no son un webhook de Discord", () => {
    for (const bad of ["http://discord.com/api/webhooks/1/x", "https://evil.example/api/webhooks/123456789012345678/x", "https://discord.com.evil.io/api/webhooks/1/x"]) {
      assert.equal(new Notifier({ url: bad }).enabled, false, bad);
    }
    assert.equal(new Notifier({ url: URL_OK }).enabled, true);
  });

  it("manda un embed con título, campos y color por nivel", async () => {
    const { n, calls } = make({ name: "app.byox.dev" });
    assert.equal(n.send("signup", "info", "Nuevo registro", { Usuario: "ana", Vacío: "" }), true);
    await n.flush();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, URL_OK);
    const e = calls[0].body.embeds[0];
    assert.match(e.title, /Nuevo registro/);
    assert.deepEqual(e.fields.map((f) => f.name), ["Usuario"]);
    assert.equal(e.footer.text, "app.byox.dev");
    assert.equal(e.color, 0x3ba55d);
  });

  it("nunca deja que el texto de un usuario mencione a nadie", async () => {
    const { n, calls } = make();
    n.send("course", "info", "Curso @everyone", { Autor: "@here <@1234567890123456789>" }, { text: "@everyone" });
    await n.flush();
    assert.deepEqual(calls[0].body.allowed_mentions, { parse: [], users: [] });
    assert.equal(calls[0].body.content, undefined);
  });

  it("menciona sólo al usuario configurado y sólo en errores", async () => {
    const { n, calls } = make({ pingUser: "111222333444555666" });
    n.send("system", "info", "ok");
    n.send("error", "error", "mal");
    await n.flush();
    assert.equal(calls[0].body.content, undefined);
    assert.equal(calls[1].body.content, "<@111222333444555666>");
    assert.deepEqual(calls[1].body.allowed_mentions, { parse: [], users: ["111222333444555666"] });
  });

  it("respeta las categorías pedidas; 'start' viene apagada", async () => {
    const def = make();
    assert.equal(def.n.send("start", "info", "x"), false);
    assert.equal(def.n.send("verify", "info", "x"), true);
    assert.equal(make({ events: "all" }).n.send("start", "info", "x"), true);
    assert.equal(make({ events: "signup" }).n.send("verify", "info", "x"), false);
  });

  it("agrupa errores repetidos y cuenta las repeticiones", async () => {
    const { n, calls } = make();
    assert.equal(n.send("error", "error", "Error interno", {}, { key: "k" }), true);
    assert.equal(n.send("error", "error", "Error interno", {}, { key: "k" }), false);
    assert.equal(n.send("error", "error", "Error interno", {}, { key: "k" }), false);
    assert.equal(n.send("error", "error", "Otro", {}, { key: "otro" }), true);
    await n.flush();
    assert.equal(calls.length, 2);
  });

  it("los info no se agrupan", async () => {
    const { n, calls } = make();
    n.send("signup", "info", "Nuevo registro", { Usuario: "a" });
    n.send("signup", "info", "Nuevo registro", { Usuario: "b" });
    await n.flush();
    assert.equal(calls.length, 2);
  });

  it("saca tokens, contraseñas, URLs de base y webhooks, y recorta", () => {
    const s = clean(
      `falló con byox_a1b2c3d4e5f6a7b8 y Bearer abcdef0123456789 en postgres://byox:secreto@postgres:5432/byox y ${URL_OK} password=hunter22222`,
    );
    for (const leak of ["a1b2c3d4e5f6a7b8", "abcdef0123456789", "secreto", "abc_DEF-123", "hunter22222"]) assert.ok(!s.includes(leak), leak);
    assert.equal(clean("x".repeat(5000), 100).length, 100);
    assert.equal(clean("a\u0000b\u001bc"), "abc");
  });

  it("recorta los campos al límite de Discord", async () => {
    const { n, calls } = make();
    n.send("error", "error", "t".repeat(600), { largo: "y".repeat(5000) }, { text: "z".repeat(9000) });
    await n.flush();
    const e = calls[0].body.embeds[0];
    assert.ok(e.title.length <= 256);
    assert.ok(e.description.length <= 4096);
    assert.ok(e.fields[0].value.length <= 1024);
  });

  it("reintenta ante el límite de Discord (429) y manda el aviso", async () => {
    const { n, calls } = make({}, [{ status: 429, json: { retry_after: 0.01 } }, { status: 204 }]);
    n.send("system", "info", "hola");
    await n.flush(5000);
    assert.equal(calls.length, 2);
  });

  it("un fallo de red no tira nada", async () => {
    const n = new Notifier({ url: URL_OK, gap: 0, fetch: async () => { throw new Error("sin red"); } });
    assert.doesNotThrow(() => n.send("system", "info", "hola"));
    await n.flush(5000);
  });

  it("descarta lo que sobra si la cola se llena y lo avisa", async () => {
    const { n, calls } = make({ gap: 0 });
    let sent = 0;
    for (let i = 0; i < 40; i++) if (n.send("signup", "info", "Nuevo registro", { i })) sent++;
    assert.ok(sent < 40);
    await n.flush(5000);
    n.send("signup", "info", "Después");
    await n.flush(5000);
    const last = calls.at(-1).body.embeds[0].fields.map((f) => f.name);
    assert.ok(last.includes("Avisos descartados por exceso"));
  });
});
