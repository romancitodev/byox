// Invitaciones: vencimiento, tope de cuentas, quién se registró y concurrencia. Con el store de archivos.
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { InviteError, Invites } from "../dist/invites.js";
import { openDb } from "../dist/store.js";

const dir = mkdtempSync(join(tmpdir(), "byox-inv-"));
const db = await openDb(dir);
let n = 0;
const fresh = () => {
  const clock = { t: Date.UTC(2026, 9, 10, 12) };
  const table = db.table(`invites-${++n}`);
  return { clock, table, inv: new Invites(table, () => clock.t) };
};
const ok = (user) => async () => user;
const rejects = (p, reason) => assert.rejects(p, (e) => e instanceof InviteError && e.reason === reason);
const HOUR = 3_600_000;

describe("invites", () => {
  it("por defecto sirve para una cuenta y no vence", async () => {
    const { inv } = fresh();
    const { code, id } = await inv.create("admin", { note: "  Ana  " });
    assert.match(code, /^inv_[0-9a-f]{24}$/);
    const [v] = await inv.list();
    assert.deepEqual({ id: v.id, note: v.note, max: v.max, used: v.used, state: v.state, expires: v.expires }, { id, note: "Ana", max: 1, used: 0, state: "active", expires: null });
    assert.deepEqual(await inv.redeem(code, ok("ana")), { user: "ana", note: "Ana" });
    await rejects(inv.redeem(code, ok("otro")), "exhausted");
    assert.equal((await inv.list())[0].state, "used");
  });

  it("vence a las horas pedidas", async () => {
    const { inv, clock } = fresh();
    const { code } = await inv.create("admin", { ttlHours: 24 });
    clock.t += 23 * HOUR;
    assert.equal((await inv.list())[0].state, "active");
    clock.t += 2 * HOUR;
    assert.equal((await inv.list())[0].state, "expired");
    await rejects(inv.redeem(code, ok("tarde")), "expired");
  });

  it("con tope N sirve para N cuentas y recuerda quiénes", async () => {
    const { inv, clock } = fresh();
    const { code } = await inv.create("admin", { max: 3 });
    for (const u of ["a", "b", "c"]) {
      clock.t += 1000;
      await inv.redeem(code, ok(u));
    }
    await rejects(inv.redeem(code, ok("d")), "exhausted");
    const [v] = await inv.list();
    assert.deepEqual(v.uses.map((x) => x.user), ["a", "b", "c"]);
    assert.equal(v.used, 3);
    assert.ok(v.uses[0].at < v.uses[2].at);
  });

  it("ilimitado (max null) no se agota", async () => {
    const { inv } = fresh();
    const { code } = await inv.create("admin", { max: null });
    for (let i = 0; i < 25; i++) await inv.redeem(code, ok(`u${i}`));
    const [v] = await inv.list();
    assert.equal(v.max, null);
    assert.equal(v.state, "active");
    assert.equal(v.used, 25);
  });

  it("si crear la cuenta falla, el código no se gasta", async () => {
    const { inv } = fresh();
    const { code } = await inv.create("admin");
    await assert.rejects(inv.redeem(code, async () => { throw new Error("Ese usuario ya existe"); }), /ya existe/);
    assert.equal((await inv.list())[0].used, 0);
    await inv.redeem(code, ok("ana"));
  });

  it("un código inventado, vacío o ya revocado es inválido", async () => {
    const { inv } = fresh();
    await rejects(inv.redeem("inv_nope", ok("x")), "invalid");
    await rejects(inv.redeem("", ok("x")), "invalid");
    await rejects(inv.redeem(undefined, ok("x")), "invalid");
  });

  it("dos personas con el último cupo: pasa una sola", async () => {
    const { inv } = fresh();
    const { code } = await inv.create("admin", { max: 1 });
    const slow = (u) => async () => (await new Promise((r) => setTimeout(r, 20)), u);
    const res = await Promise.allSettled([inv.redeem(code, slow("a")), inv.redeem(code, slow("b")), inv.redeem(code, slow("c"))]);
    assert.equal(res.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal((await inv.list())[0].used, 1);
  });

  it("revocar: sin usos se borra; con usos queda en la lista con sus cuentas", async () => {
    const { inv } = fresh();
    const a = await inv.create("admin", { max: 5, note: "a" });
    const b = await inv.create("admin", { max: 5, note: "b" });
    await inv.redeem(b.code, ok("bea"));
    assert.equal(await inv.revoke(a.id), true);
    assert.equal(await inv.revoke(b.id), true);
    assert.equal(await inv.revoke("000000000000"), false);
    const list = await inv.list();
    assert.equal(list.length, 1);
    assert.equal(list[0].state, "revoked");
    assert.deepEqual(list[0].uses.map((u) => u.user), ["bea"]);
    await rejects(inv.redeem(a.code, ok("x")), "invalid");
    await rejects(inv.redeem(b.code, ok("x")), "invalid");
  });

  it("valida la duración y el tope", async () => {
    const { inv } = fresh();
    for (const ttlHours of [0, -5, NaN, Infinity, 24 * 365 + 1]) await rejects(inv.create("admin", { ttlHours }), "ttl");
    for (const max of [0, -1, 1.5, NaN, 1001]) await rejects(inv.create("admin", { max }), "max");
    await inv.create("admin", { ttlHours: 24 * 365, max: 1000 });
  });

  it("los códigos viejos (sin max ni usos) valen una cuenta", async () => {
    const { inv, table } = fresh();
    const code = "inv_viejo";
    const { createHash } = await import("node:crypto");
    await table.set(createHash("sha256").update(code).digest("hex"), { by: "admin", created: "2026-10-01T00:00:00.000Z" });
    const [v] = await inv.list();
    assert.deepEqual({ max: v.max, used: v.used, state: v.state }, { max: 1, used: 0, state: "active" });
    await inv.redeem(code, ok("ana"));
    await rejects(inv.redeem(code, ok("otro")), "exhausted");
  });

  it("recorta la nota y lista lo más nuevo primero", async () => {
    const { inv, clock } = fresh();
    await inv.create("admin", { note: "x".repeat(200) });
    clock.t += 5000;
    await inv.create("admin", { note: "segundo" });
    const list = await inv.list();
    assert.equal(list[0].note, "segundo");
    assert.equal(list[1].note.length, 80);
  });
});
