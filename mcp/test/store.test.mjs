// Corre contra archivos y, si DATABASE_URL está definida, también contra Postgres.
//   npm test                                   (sólo archivos)
//   DATABASE_URL=postgres://… npm test         (archivos y Postgres)
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { Results } from "../dist/results.js";
import { openDb } from "../dist/store.js";
import { Usage } from "../dist/usage.js";

const dir = mkdtempSync(join(tmpdir(), "byox-test-"));
const backends = [["archivos", () => openDb(dir)]];
if (process.env.DATABASE_URL) backends.push(["postgres", () => openDb(dir, process.env.DATABASE_URL)]);

for (const [name, open] of backends) {
  describe(`store en ${name}`, async () => {
    const db = await open();
    after(() => db.close());
    // Un prefijo por corrida: Postgres puede tener filas de antes.
    const ns = `t${Date.now()}`;

    it("get, set, del y entries", async () => {
      const t = db.table(`${ns}-tokens`);
      assert.equal(await t.get("a"), undefined);
      await t.set("a", { u: "ana" });
      await t.set("b", { u: "beto" });
      await t.set("a", { u: "ana2" });
      assert.deepEqual(await t.get("a"), { u: "ana2" });
      assert.deepEqual((await t.entries()).map(([k]) => k).sort(), ["a", "b"]);
      await t.del("a");
      assert.equal(await t.get("a"), undefined);
    });

    it("incr suma sin perder incrementos simultáneos", async () => {
      const t = db.table(`${ns}-count`);
      await Promise.all(Array.from({ length: 50 }, () => t.incr("k")));
      assert.equal(await t.incr("k", 0), 50);
      assert.equal(await t.incr("k", 5), 55);
    });

    it("el secreto se genera una vez", async () => {
      assert.equal(await db.secret(`${ns}-secret`, () => "uno"), "uno");
      assert.equal(await db.secret(`${ns}-secret`, () => "dos"), "uno");
    });

    it("Results: dos record() a la vez sobre el mismo repo se conservan", async () => {
      const r = new Results(db);
      const repo = `${ns}/redis`;
      await Promise.all([
        r.record({ repo, sha: "s1", run: "1", at: "t", results: [{ id: "1", ok: true, log: "x" }] }),
        r.record({ repo, sha: "s2", run: "2", at: "t", results: [{ id: "2", ok: false, log: "y" }] }),
      ]);
      assert.deepEqual(Object.keys(await r.get(repo)).sort(), ["1", "2"]);
      assert.deepEqual(await r.get(`${ns}/nada`), {});
    });

    it("Usage: llamadas por semana y cursos distintos por mes", async () => {
      const u = new Usage(db);
      const who = `${ns}-ana`;
      await Promise.all([u.call(who), u.call(who, 2), u.call(who)]);
      await u.course(who, "shell");
      await u.course(who, "redis");
      await u.course(who, "shell"); // empezarlo otra vez no cuenta dos veces
      const s = await u.summary(who);
      assert.equal(s.mcpCalls, 4);
      assert.deepEqual(s.activeCourses.sort(), ["redis", "shell"]);
      assert.equal((await u.summary(`${ns}-otra`)).mcpCalls, 0);
    });

    it("Usage.take: corta en el tope, no gasta lo rechazado y null no tiene tope", async () => {
      const u = new Usage(db);
      const who = `${ns}-tope`;
      assert.deepEqual(await u.take(who, 3, 5), { ok: true, used: 3 });
      assert.deepEqual(await u.take(who, 3, 5), { ok: false, used: 3 }); // 6 > 5: rechazado, el contador queda en 3
      assert.deepEqual(await u.take(who, 2, 5), { ok: true, used: 5 }); // justo en el tope entra
      assert.equal((await u.take(who, 1, 5)).ok, false);
      const s = await u.summary(who, 5);
      assert.equal(s.mcpCalls, 5);
      assert.equal(s.mcpRemaining, 0);
      assert.equal(s.mcpLimit, 5);
      // Sin tope (administradores): cuenta pero nunca corta.
      assert.equal((await u.take(`${ns}-admin`, 500, null)).ok, true);
      assert.equal((await u.summary(`${ns}-admin`)).mcpRemaining, null);
      // Requests a la vez: nunca entran más que el tope.
      const racers = await Promise.all(Array.from({ length: 20 }, () => u.take(`${ns}-carrera`, 1, 10)));
      assert.equal(racers.filter((r) => r.ok).length, 10);
      assert.equal((await u.summary(`${ns}-carrera`)).mcpCalls, 10);
    });
  });
}

describe("store en archivos: el formato en disco no cambió", () => {
  it("map en <nombre>.json, un archivo por clave en <dir>/ y el secreto suelto", async () => {
    const d = mkdtempSync(join(tmpdir(), "byox-test-"));
    const db = await openDb(d);
    await db.table("tokens").set("a", 1);
    await new Promise((r) => setTimeout(r, 700)); // la escritura del map es diferida
    await new Promise((r) => setTimeout(r, 0));
    await db.table("results", { dir: "results", sep: "__" }).set("ana/redis", { x: 1 });
    await db.secret("secret", () => "s");
    assert.deepEqual(readdirSync(d).sort(), ["results", "secret", "tokens.json"]);
    assert.deepEqual(readdirSync(join(d, "results")), ["ana__redis.json"]);
  });
});

describe("Usage.week (semana ISO)", () => {
  const w = (iso) => Usage.week(new Date(`${iso}T12:00:00Z`));
  it("casos de borde del año", () => {
    assert.equal(w("2026-01-01"), "2026-W01");
    assert.equal(w("2024-12-30"), "2025-W01"); // lunes: ya es la semana 1 de 2025
    assert.equal(w("2027-01-01"), "2026-W53"); // viernes: todavía la última de 2026
    assert.equal(w("2026-10-09"), "2026-W41");
  });
  it("un mes", () => assert.equal(Usage.month(new Date("2026-10-09T12:00:00Z")), "2026-10"));
  it("el cupo se renueva el lunes siguiente a las 00:00 UTC", () => {
    const next = (iso) => Usage.nextWeek(new Date(iso)).toISOString();
    assert.equal(next("2026-10-10T12:00:00Z"), "2026-10-12T00:00:00.000Z"); // sábado
    assert.equal(next("2026-10-11T23:59:00Z"), "2026-10-12T00:00:00.000Z"); // domingo
    assert.equal(next("2026-10-12T00:00:00Z"), "2026-10-19T00:00:00.000Z"); // lunes: la semana que arranca
    assert.equal(next("2026-12-31T10:00:00Z"), "2027-01-04T00:00:00.000Z"); // cruza el año
  });
});
