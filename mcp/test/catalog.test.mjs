// Catalog: quién ve, modifica y administra cada curso, con un Forgejo simulado (el de verdad se prueba aparte).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HttpError } from "../dist/auth.js";
import { Catalog, ensureOrgVisibility } from "../dist/catalog.js";

const ORG = "cursos";

/** Un Forgejo mínimo: repos con dueños/colaboradores, estrellas y commit statuses. */
function fakeForgejo() {
  const s = {
    admins: new Set(["root"]),
    repos: new Map(), // slug -> { private, owner, collab: Map(user -> read|write|admin), stars: Set, verified: bool }
    org: { visibility: "private" },
  };
  const perms = (r, user) => {
    if (s.admins.has(user)) return { admin: true, push: true, pull: true };
    const rank = { read: 1, write: 2, admin: 3 }[r.collab.get(user)] ?? 0;
    return { admin: rank >= 3, push: rank >= 2, pull: !r.private || rank >= 1 };
  };
  const json = (slug, r, user) => ({
    name: slug,
    description: `curso ${slug}`,
    updated_at: "2026-10-10T00:00:00Z",
    private: r.private,
    stars_count: r.stars.size,
    permissions: perms(r, user),
    owner: { login: ORG },
  });
  const make = (user) => ({
    async find(path) {
      const m = /^\/repos\/cursos\/([^/]+)$/.exec(path);
      if (m) {
        const r = s.repos.get(m[1]);
        return r && perms(r, user).pull ? json(m[1], r, user) : null;
      }
      const b = /^\/repos\/cursos\/([^/]+)\/branches\/main$/.exec(path);
      if (b) return s.repos.has(b[1]) ? { commit: { id: `sha-${b[1]}` } } : null;
      if (path === "/orgs/cursos") return s.org;
      return null;
    },
    async all(path) {
      if (path === `/orgs/${ORG}/repos`) return [...s.repos].map(([slug, r]) => json(slug, r, "root"));
      if (path === "/user/starred") return [...s.repos].filter(([, r]) => r.stars.has(user)).map(([slug, r]) => json(slug, r, user));
      const st = /^\/repos\/cursos\/([^/]+)\/commits\/sha-[^/]+\/statuses$/.exec(path);
      if (st) return s.repos.get(st[1])?.verified ? [{ context: "byox/verify", status: "success" }] : [];
      throw new Error(`all ${path}`);
    },
    async req(method, path, body) {
      let m;
      if ((m = /^\/user\/starred\/cursos\/([^/]+)$/.exec(path))) {
        const r = s.repos.get(m[1]);
        method === "PUT" ? r.stars.add(user) : r.stars.delete(user);
        return null;
      }
      if ((m = /^\/repos\/cursos\/([^/]+)$/.exec(path)) && method === "PATCH") {
        const r = s.repos.get(m[1]);
        if (!perms(r, user).admin) throw new Error("403");
        r.private = body.private;
        // Forgejo borra las estrellas de quienes dejan de tener acceso.
        if (r.private) r.stars = new Set([...r.stars].filter((u) => perms(r, u).pull));
        return json(m[1], r, user);
      }
      if ((m = /^\/repos\/cursos\/([^/]+)\/collaborators\/([^/]+)$/.exec(path)) && method === "PUT") {
        s.repos.get(m[1]).collab.set(decodeURIComponent(m[2]), body.permission);
        return null;
      }
      if (method === "PATCH" && path === "/orgs/cursos") return void Object.assign(s.org, body);
      throw new Error(`req ${method} ${path}`);
    },
  });
  const fj = { ...make("root"), as: (u) => make(u) };
  const add = (slug, { owner, isPrivate = true, verified = true } = {}) =>
    s.repos.set(slug, { private: isPrivate, owner, collab: new Map(owner ? [[owner, "admin"]] : []), stars: new Set(), verified });
  return { fj, s, add };
}

const status = (p) => p.then(() => 0, (e) => (e instanceof HttpError ? e.status : -1));

describe("Catalog", () => {
  it("un curso privado lo ven su dueño y los administradores, nadie más", async () => {
    const { fj, add } = fakeForgejo();
    add("mio", { owner: "ana" });
    const c = new Catalog(fj, ORG);
    assert.equal((await c.access("ana", "mio"))?.manage, true);
    assert.equal((await c.access("root", "mio"))?.manage, true);
    assert.equal(await c.access("beto", "mio"), null);
    assert.equal(await status(c.need("beto", "mio", "see")), 404);
  });

  it("uno público lo ve cualquiera pero solo lo modifica y administra el dueño", async () => {
    const { fj, add } = fakeForgejo();
    add("pub", { owner: "ana", isPrivate: false });
    const c = new Catalog(fj, ORG);
    const a = await c.access("beto", "pub");
    assert.deepEqual([a.public, a.write, a.manage], [true, false, false]);
    await c.need("beto", "pub", "see");
    assert.equal(await status(c.need("beto", "pub", "write")), 403);
    assert.equal(await status(c.need("beto", "pub", "manage")), 403);
    await c.need("ana", "pub", "manage");
  });

  it("list devuelve solo lo que esa cuenta puede ver", async () => {
    const { fj, add } = fakeForgejo();
    add("a-priv", { owner: "ana" });
    add("b-pub", { owner: "ana", isPrivate: false });
    add("c-priv", { owner: "beto" });
    const c = new Catalog(fj, ORG);
    assert.deepEqual((await c.list("ana")).map((x) => x.slug).sort(), ["a-priv", "b-pub"]);
    assert.deepEqual((await c.list("beto")).map((x) => x.slug).sort(), ["b-pub", "c-priv"]);
    assert.deepEqual((await c.list("root")).map((x) => x.slug).sort(), ["a-priv", "b-pub", "c-priv"]);
    assert.deepEqual((await c.names()).sort(), ["a-priv", "b-pub", "c-priv"]);
  });

  it("rechaza slugs que no son un nombre de curso (nada de ../ ni mayúsculas)", async () => {
    const { fj, add } = fakeForgejo();
    add("ok", { owner: "ana", isPrivate: false });
    const c = new Catalog(fj, ORG);
    for (const bad of ["..", "%2e%2e", "a/b", "A", "", ".oculto"]) assert.equal(await c.access("ana", bad), null, bad);
  });

  it("publicar: solo el dueño, y solo con el último commit verificado", async () => {
    const { fj, add } = fakeForgejo();
    add("sin-verificar", { owner: "ana", verified: false });
    add("ok", { owner: "ana" });
    const c = new Catalog(fj, ORG);
    assert.equal(await status(c.setPublic("ana", "sin-verificar", true)), 400);
    assert.equal(await status(c.setPublic("beto", "ok", true)), 404); // ni lo ve
    assert.equal((await c.setPublic("ana", "ok", true)).public, true);
    assert.equal(await status(c.setPublic("beto", "ok", false)), 403); // lo ve, pero no es suyo
    assert.equal((await c.setPublic("root", "ok", false)).public, false); // un administrador sí
    assert.equal((await c.setPublic("ana", "ok", true)).public, true);
  });

  it("estrellas: se ven los totales, se pueden sacar y no se estrella lo que no ves", async () => {
    const { fj, add } = fakeForgejo();
    add("pub", { owner: "ana", isPrivate: false });
    add("priv", { owner: "ana" });
    const c = new Catalog(fj, ORG);
    assert.deepEqual(await c.star("beto", "pub", true), { starred: true, stars: 1 });
    assert.deepEqual(await c.star("gamma", "pub", true), { starred: true, stars: 2 });
    assert.deepEqual([...(await c.starred("beto"))], ["pub"]);
    assert.deepEqual(await c.star("beto", "pub", false), { starred: false, stars: 1 });
    assert.equal(await status(c.star("beto", "priv", true)), 404);
  });

  it("volver privado borra las estrellas ajenas (lo hace Forgejo) y el total se actualiza", async () => {
    const { fj, add } = fakeForgejo();
    add("pub", { owner: "ana", isPrivate: false });
    const c = new Catalog(fj, ORG);
    await c.star("beto", "pub", true);
    assert.equal((await c.access("ana", "pub")).stars, 1);
    assert.equal((await c.setPublic("ana", "pub", false)).stars, 0);
  });

  it("claim: quien crea el curso queda como colaborador administrador, salvo los administradores", async () => {
    const { fj, s, add } = fakeForgejo();
    add("nuevo");
    add("del-admin");
    const c = new Catalog(fj, ORG);
    await c.claim("ana", "nuevo");
    assert.equal(s.repos.get("nuevo").collab.get("ana"), "admin");
    assert.equal((await c.access("ana", "nuevo")).manage, true);
    await c.claim("root", "del-admin");
    assert.equal(s.repos.get("del-admin").collab.has("root"), false);
  });

  it("ensureOrgVisibility pasa la org de private a limited y no toca el resto", async () => {
    const { fj, s } = fakeForgejo();
    await ensureOrgVisibility(fj, ORG);
    assert.equal(s.org.visibility, "limited");
    s.org.visibility = "public";
    await ensureOrgVisibility(fj, ORG);
    assert.equal(s.org.visibility, "public");
  });
});
