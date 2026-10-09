// pickDocker: reparte por turnos entre los daemons de DOCKER_HOSTS y pasa al siguiente si uno no responde.
// Usa un `docker` falso en el PATH que sólo "responde" para algunas direcciones.
import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

const skip = process.platform === "win32" ? "usa un script de shell" : false;

function fakeDocker(alive) {
  const dir = mkdtempSync(join(tmpdir(), "byox-docker-"));
  const file = join(dir, "docker");
  writeFileSync(file, `#!/bin/sh\ncase " ${alive.join(" ")} " in *" $DOCKER_HOST "*) echo 27.0; exit 0;; esac\necho "no responde" >&2\nexit 1\n`);
  chmodSync(file, 0o755);
  process.env.PATH = `${dir}:${process.env.PATH}`;
}

describe("pickDocker", { skip }, () => {
  it("sin DOCKER_HOSTS usa el entorno de siempre", async () => {
    delete process.env.DOCKER_HOSTS;
    const { pickDocker } = await import("../dist/docker.js");
    assert.equal(await pickDocker(), process.env);
  });

  it("reparte por turnos y salta los que no responden", async () => {
    fakeDocker(["tcp://127.0.0.1:2375", "tcp://127.0.0.2:2375"]);
    process.env.DOCKER_HOSTS = "tcp://127.0.0.1:2375,tcp://127.0.0.9:2375,tcp://127.0.0.2:2375";
    const { pickDocker } = await import("../dist/docker.js");
    const elegidos = [];
    for (let i = 0; i < 6; i++) elegidos.push((await pickDocker()).DOCKER_HOST);
    // El .9 está caído: nunca se elige, y los otros dos se alternan.
    assert.ok(!elegidos.includes("tcp://127.0.0.9:2375"));
    assert.ok(elegidos.includes("tcp://127.0.0.1:2375") && elegidos.includes("tcp://127.0.0.2:2375"));
  });

  it("un nombre con varias IP se expande a cada una", async () => {
    fakeDocker(["tcp://127.0.0.1:2375"]);
    process.env.DOCKER_HOSTS = "tcp://localhost:2375";
    const { pickDocker } = await import("../dist/docker.js");
    assert.equal((await pickDocker()).DOCKER_HOST, "tcp://127.0.0.1:2375");
  });

  it("si ninguno responde, falla con el motivo", async () => {
    fakeDocker([]);
    process.env.DOCKER_HOSTS = "tcp://127.0.0.1:2375,tcp://127.0.0.2:2375";
    const { pickDocker } = await import("../dist/docker.js");
    await assert.rejects(pickDocker(), /ningún Docker responde/);
  });
});
