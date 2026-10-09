import { execFile } from "node:child_process";
import { lookup } from "node:dns/promises";
import { promisify } from "node:util";

const exec = promisify(execFile);

/**
 * Dónde corre Docker para verificar cursos. Por defecto, el socket local (o DOCKER_HOST), como siempre.
 * Con DOCKER_HOSTS (tcp://host:2375, separados por comas) hay varios daemons, por ejemplo uno por runner: un
 * nombre que resuelve a varias IP (el Service headless de un StatefulSet) se expande a cada una. Cada
 * verificación elige UN daemon y hace con él todo (pull, create, cp, start, rm), porque esos pasos tienen que
 * caer en la misma máquina. Se reparten por turnos y, si uno no responde, se pasa al siguiente.
 */
let turn = 0;

async function candidates(): Promise<string[]> {
  const out: string[] = [];
  for (const h of (process.env.DOCKER_HOSTS ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
    const m = /^tcp:\/\/([^:/]+):(\d+)$/.exec(h);
    if (!m) {
      out.push(h);
      continue;
    }
    const ips = await lookup(m[1], { all: true, family: 4 }).catch(() => []);
    out.push(...(ips.length ? ips.map((a) => `tcp://${a.address}:${m[2]}`) : [h]));
  }
  return out;
}

/** El entorno con el que correr `docker` en el daemon elegido. */
export async function pickDocker(): Promise<NodeJS.ProcessEnv> {
  const hosts = await candidates();
  if (hosts.length === 0) return process.env;
  const start = turn++;
  const errors: string[] = [];
  for (let i = 0; i < hosts.length; i++) {
    const host = hosts[(start + i) % hosts.length];
    const env = { ...process.env, DOCKER_HOST: host };
    try {
      await exec("docker", ["version", "--format", "{{.Server.Version}}"], { env, timeout: 5000 });
      return env;
    } catch (e) {
      errors.push(`${host}: ${(e as Error).message.split("\n")[0]}`);
    }
  }
  throw new Error(`ningún Docker responde (${errors.join("; ")})`);
}
